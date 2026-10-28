import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ALIGNMENTS, conditionsFor } from '../constants'
import { isAK, systemOf } from '../systems'
import { DEATHS_DOOR } from '../ak'
import { rememberRest, restSnapshot } from '../rest'
import { activeEffects, damageReduction, netAdvantage, signed, spLimits, statInfo, type StatKey } from '../calc'
import { uid } from '../blank'
import { useChar, useStore, useUI, type PageId } from '../store'
import { Field, FitInput, Num, Pips, Popover, Toast, useToast } from './ui'
import { akClassOf, autoFactionFor, autoSymbolFor, SymbolPicker, useAkIcons } from './ClassSymbol'
import { dropImagesOn, Lightbox } from './ImagePicker'
import { StatEditor } from './StatEditor'
import { Icon } from './Icon'

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']

const TABS: { id: PageId; name: string }[] = [
  { id: 'overview', name: 'Overview' },
  { id: 'character', name: 'Character' },
  { id: 'features', name: 'Features' },
  { id: 'spells', name: 'Spells' },
  { id: 'actions', name: 'Actions' },
  { id: 'gallery', name: 'Gallery' },
  { id: 'settings', name: 'Settings' },
]
/** Arknights 5e: Operator Skills get their own page and spells are called Arts */
const AK_TABS: { id: PageId; name: string }[] = [
  { id: 'overview', name: 'Overview' },
  { id: 'character', name: 'Character' },
  { id: 'features', name: 'Features' },
  { id: 'operator', name: 'Op. Skills' },
  { id: 'spells', name: 'Arts' },
  { id: 'actions', name: 'Actions' },
  { id: 'gallery', name: 'Gallery' },
  { id: 'settings', name: 'Settings' },
]

export function TopBar() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const { page, go, set } = useUI()
  // the portrait is a square as tall as the name + stats block beside it
  const mainRef = useRef<HTMLDivElement>(null)
  const [mainH, setMainH] = useState(116)
  useLayoutEffect(() => {
    const el = mainRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setMainH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const toast = useToast()
  /** apply every active feature's effects for this kind of rest; returns what happened */
  const restEffects = (d: typeof c, rest: 'long' | 'short') => {
    const done: string[] = []
    for (const f of d.features) {
      if (!f.active) continue
      for (const e of f.restEffects) {
        if (e.rest !== rest) continue
        if (e.kind === 'inspiration') { d.inspiration = true; done.push(`Heroic Inspiration (${f.name || 'feature'})`) }
        else if (e.kind === 'tempHp') { d.hp.temp = Math.max(d.hp.temp, e.value); done.push(`${e.value} temp HP (${f.name || 'feature'})`) }
        else if (e.kind === 'reminder') done.push(`Reminder: ${e.note || f.name}`)
      }
    }
    return done
  }
  const report = (rest: string, done: string[]) => toast.show(done.length ? `${rest} rest · ${done.join(' · ')}` : `${rest} rest taken`)

  const akIcons = useAkIcons((st) => st.list)
  const ensureIcons = useAkIcons((st) => st.ensure)
  const ak = isAK(c)
  // Arknights sheets show the game's class / branch icons automatically (downloaded once onto this computer)
  useEffect(() => { if (ak) ensureIcons() }, [ak, ensureIcons])
  const longRest = () => {
    if (!window.confirm(ak
      ? 'Take a long rest? This refills HP, Arts Points, hit dice (half) and resources, tops SP up to your start SP, and removes one failed death save.'
      : 'Take a long rest? This refills HP, spell slots, hit dice (half), resources and clears death saves.')) return
    let done: string[] = []
    const before = restSnapshot(c)
    patch((d) => {
      rememberRest(d, 'long', before)
      const max = statInfo(d as typeof c, 'hpMax', activeEffects(d as typeof c)).total
      d.hp.current = max
      d.hp.temp = 0
      if (ak) {
        // AK5e: failed death saves only go away one per long rest
        d.deathSaves = { successes: 0, failures: Math.max(0, d.deathSaves.failures - 1) }
        d.ak.mettle = 0
        d.ak.ap.used = 0
        d.ak.ninthUsed = false
        d.ak.activeSkill = ''
        d.ak.sp = Math.max(d.ak.sp, spLimits(d as typeof c).start)
      } else d.deathSaves = { successes: 0, failures: 0 }
      for (const k of Object.keys(d.slots)) d.slots[+k].used = 0
      let regain = Math.max(1, Math.floor(d.hitDice.reduce((s, h) => s + h.total, 0) / 2))
      for (const h of d.hitDice) { const r = Math.min(h.spent, regain); h.spent -= r; regain -= r }
      for (const r of d.resources) r.used = 0
      done = restEffects(d, 'long')
    })
    report('Long', done)
  }
  const shortRest = () => {
    if (!window.confirm('Take a short rest? Resources that recharge on a short rest are refilled.')) return
    let done: string[] = []
    const before = restSnapshot(c)
    patch((d) => {
      rememberRest(d, 'short', before)
      if (ak && d.ak.ap.recharge === 'short') d.ak.ap.used = 0
      for (const r of d.resources) {
        if (r.recharge === 'short') r.used = 0
        else if (r.recharge === 'shortOne') r.used = Math.max(0, r.used - 1)
      }
      done = restEffects(d, 'short')
    })
    report('Short', done)
  }

  const lineStyle = { fontWeight: 600 }
  return (
    <header className="topbar">
      <Portrait size={Math.max(60, mainH - 12)} />
      {/* class, subclass / branch, nationality and faction marks, stacked beside the portrait */}
      <div className="sym-col">
        <SymbolPicker label="Class" official={ak ? 'class' : undefined} akClass={akClassOf(c.className)} value={c.classSymbol}
          auto={autoSymbolFor(c.className, { ak, icons: akIcons })} onChange={(v) => patch((d) => { d.classSymbol = v })} />
        <SymbolPicker label={ak ? 'Branch' : 'Subclass'} official={ak ? 'class' : undefined} akClass={akClassOf(c.className)} value={c.subclassSymbol}
          auto={autoSymbolFor(c.subclass, { ak, branchOf: c.className, icons: akIcons })} onChange={(v) => patch((d) => { d.subclassSymbol = v })} />
        {ak && <SymbolPicker label="Nationality" official="faction" value={c.nationSymbol} auto={autoFactionFor(c.nationality, akIcons)} onChange={(v) => patch((d) => { d.nationSymbol = v })} />}
        <SymbolPicker label="Faction" official={ak ? 'faction' : undefined} value={c.factionSymbol} fallback={c.emblem}
          auto={ak && c.story.alliesTitle !== 'Allies & Organizations' ? autoFactionFor(c.story.alliesTitle, akIcons) : ''} onChange={(v) => patch((d) => { d.factionSymbol = v })} />
      </div>
      <div className="top-main" ref={mainRef}>
        <div className="banner">
          <div className="name-banner">
            <FitInput minSize={12} value={c.name} placeholder="Character name" onChange={(e) => patch((d) => { d.name = e.target.value })} />
            <label>Character Name</label>
          </div>
          <div className="details">
            <Field label="Class" value={c.className} onChange={(v) => patch((d) => { d.className = v })} />
            <Field label={ak ? 'Branch' : 'Subclass'} value={c.subclass} onChange={(v) => patch((d) => { d.subclass = v })} />
            <Field label="Species / Race" value={c.species} onChange={(v) => patch((d) => { d.species = v })} />
            <div className="field">
              <div className="row" style={{ gap: 4 }}>
                <Num min={1} max={20} width={34} className="line-input" style={lineStyle} value={c.level} onChange={(n) => patch((d) => { d.level = n })} />
                <FitInput className="line-input" style={lineStyle} value={c.xp} placeholder="XP" onChange={(e) => patch((d) => { d.xp = e.target.value })} />
              </div>
              <label>Level · Experience</label>
            </div>
            <Field label="Background" value={c.background} onChange={(v) => patch((d) => { d.background = v })} />
            {ak ? <Field label="Nationality" value={c.nationality} onChange={(v) => patch((d) => { d.nationality = v })} /> : (
              <div className="field">
                <FitInput list="aligns" value={c.alignment} onChange={(e) => patch((d) => { d.alignment = e.target.value })} />
                <label>Alignment</label>
              </div>
            )}
            <Field label="Player" value={c.player} onChange={(v) => patch((d) => { d.player = v })} />
            <datalist id="aligns">{ALIGNMENTS.filter(Boolean).map((a) => <option key={a} value={a} />)}</datalist>
          </div>
        </div>
        <Vitals />
      </div>

      <nav className="nav">
        {(ak ? AK_TABS : TABS).map((t) => (
          <button key={t.id} className={`tab ${page === t.id ? 'active' : ''}`} onClick={() => go(t.id)}>{t.name}</button>
        ))}
        <span className="spacer" />
        <button className="btn sm ghost" onClick={() => set({ book: 'full' })} title="Read the sourcebooks full screen (Ctrl + B: side pane, Ctrl + F: search)">📖 Sourcebooks</button>
        <button className="btn sm ghost" onClick={shortRest} title="Short rest">☾ Short rest</button>
        <button className="btn sm ghost" onClick={longRest} title="Long rest">☀ Long rest</button>
        <button className="btn sm ghost" onClick={() => set({ charListOpen: true })}>👥 Characters</button>
        <button className="btn sm ghost" onClick={() => set({ themeOpen: true })} title="UI style (Ctrl + T)">◐</button>
      </nav>
      <Toast msg={toast.msg} />
    </header>
  )
}

/** The character's image, always in the top-left corner. Click to view large; ✎ to choose from the gallery; drop to add. */
function Portrait({ size }: { size: number }) {
  const c = useChar()
  const set = useUI((s) => s.set)
  const [big, setBig] = useState(false)
  const pick = () => set({ imagePick: 'portrait' })
  return (
    <div className={`top-portrait ${c.portrait ? '' : 'empty'}`}
      style={{ width: size, height: size, ...(c.portrait ? { backgroundImage: `url("${c.portrait}")` } : {}) }}
      title={c.portrait ? 'Click to enlarge · ✎ to change · drop an image to add it' : 'Click to choose an image'}
      onClick={() => (c.portrait ? setBig(true) : pick())}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); dropImagesOn('portrait', e.dataTransfer.files) }}>
      {!c.portrait && <span>＋<br />Image</span>}
      {c.portrait && <button className="btn icon sm edit" title="Change image" onClick={(e) => { e.stopPropagation(); pick() }}>✎</button>}
      {big && <Lightbox src={c.portrait} onClose={() => setBig(false)} />}
    </div>
  )
}

function Vitals() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const fx = activeEffects(c)
  const [edit, setEdit] = useState<StatKey | null>(null)
  const [amt, setAmt] = useState('')
  const [condOpen, setCondOpen] = useState(false)
  const [hdOpen, setHdOpen] = useState(false)
  const refs = useRef<Record<string, HTMLElement | null>>({})
  const ac = statInfo(c, 'ac', fx)
  const ini = statInfo(c, 'initiative', fx)
  const spd = statInfo(c, 'speed', fx)
  const hpm = statInfo(c, 'hpMax', fx)
  const pct = Math.max(0, Math.min(100, (c.hp.current / Math.max(1, hpm.total)) * 100))
  const iniAdv = netAdvantage(ini)

  const addsText = (i: ReturnType<typeof statInfo>, unit = '') => {
    const sum = i.adds.reduce((s, a) => s + a.value, 0)
    return i.adds.length && sum ? `${i.baseValue}${unit} ${signed(sum)}` : ''
  }
  const apply = (sign: 1 | -1) => {
    const n = parseInt(amt, 10)
    if (!n || n < 0) return
    patch((d) => {
      if (sign === -1) {
        let dmg = n
        const t = Math.min(d.hp.temp, dmg)
        d.hp.temp -= t
        dmg -= t
        d.hp.current = Math.max(0, d.hp.current - dmg)
      } else {
        d.hp.current = Math.min(hpm.total, d.hp.current + n)
        // AK5e: you stop Dying (and lose your Mettle), but failed saves stay until a long rest
        if (d.hp.current > 0 && ak) d.ak.mettle = 0
        else if (d.hp.current > 0) d.deathSaves = { successes: 0, failures: 0 }
      }
    })
    setAmt('')
  }
  const totalHd = c.hitDice.reduce((s, h) => s + h.total - h.spent, 0)
  const ak = isAK(c)
  const conditions = conditionsFor(systemOf(c))
  const dr = damageReduction(c, fx)

  return (
    <div className="vitals">
      <div className="vbox shield" ref={(el) => (refs.current.ac = el)} onClick={() => setEdit(edit === 'ac' ? null : 'ac')} title="Click to edit base AC and added bonuses">
        <div className="l">Armor Class</div>
        <div className="v">{ac.total}</div>
        <div className="sub">{addsText(ac)}</div>
      </div>
      <div className="vbox" ref={(el) => (refs.current.initiative = el)} onClick={() => setEdit(edit === 'initiative' ? null : 'initiative')}>
        <div className="l">Initiative</div>
        <div className="v">{signed(ini.total)}</div>
        <div className="sub">{iniAdv === 'adv' ? 'ADV' : iniAdv === 'dis' ? 'DIS' : addsText(ini) ? '' : ''}</div>
      </div>
      <div className="vbox" ref={(el) => (refs.current.speed = el)} onClick={() => setEdit(edit === 'speed' ? null : 'speed')}>
        <div className="l">Speed</div>
        <div className="v">{spd.total}<span style={{ fontSize: 11 }}>ft</span></div>
        <div className="sub">{addsText(spd)}</div>
      </div>
      {ak ? (
        <div className="vbox" style={{ cursor: 'default' }} title={'Damage Reduction: a flat cut to damage taken, before resistance (never below 1).' + (dr.adds.length ? '\n' + dr.adds.map((a) => `${a.label} ${signed(a.value)}`).join('\n') : '')}>
          <div className="l">Dmg Red.</div>
          <div className="v dr-v">
            <Num min={0} max={99} value={c.ak.dr} onChange={(n) => patch((d) => { d.ak.dr = n })} />
          </div>
          <div className="sub">{dr.adds.length ? `= ${dr.total}` : ''}</div>
        </div>
      ) : (
        <div className="vbox size-box" style={{ cursor: 'default' }}>
          <div className="l">Size</div>
          <select className="size-select" value={c.size} onChange={(e) => patch((d) => { d.size = e.target.value })}>
            {SIZES.includes(c.size) ? null : <option value={c.size}>{c.size}</option>}
            {SIZES.map((x) => <option key={x}>{x}</option>)}
          </select>
          <div className="sub" />
        </div>
      )}

      <div className="vbox hp-box">
        <div className="hp-main">
          <div className="l" style={{ textAlign: 'left' }}>Hit Points</div>
          <div className="big">
            <Num min={0} className="" value={c.hp.current} onChange={(n) => patch((d) => { d.hp.current = n })} />
            <span className="of" ref={(el) => (refs.current.hpMax = el)} title="Edit max HP" onClick={() => setEdit(edit === 'hpMax' ? null : 'hpMax')}>
              / {hpm.total}
            </span>
          </div>
          <div className={`hpbar ${pct < 25 ? 'crit' : pct < 50 ? 'low' : ''}`}><i style={{ width: pct + '%' }} /></div>
        </div>
        <div className="col" style={{ gap: 3, alignItems: 'stretch' }}>
          <div className="row" style={{ gap: 3 }}>
            <button className="btn sm" style={{ color: 'var(--dis)' }} onClick={() => apply(-1)} title="Take damage (uses temp HP first)">Dmg</button>
            <input className="box-input" style={{ width: 44, textAlign: 'center' }} placeholder="±" value={amt}
              onChange={(e) => setAmt(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && apply(e.shiftKey ? 1 : -1)} />
            <button className="btn sm" style={{ color: 'var(--good)' }} onClick={() => apply(1)} title="Heal">Heal</button>
          </div>
          <div className="row" style={{ gap: 4, justifyContent: 'center' }}>
            <span className="l" style={{ margin: 0 }}>Temp</span>
            <Num min={0} className="box-input" width={48} style={{ textAlign: 'center' }} value={c.hp.temp} onChange={(n) => patch((d) => { d.hp.temp = n })} />
          </div>
        </div>
      </div>

      <div className="vbox hd-box" ref={(el) => (refs.current.hd = el)} onClick={() => setHdOpen(!hdOpen)} title="Hit dice">
        <div className="l">Hit Dice</div>
        <div className="v" style={{ fontSize: c.hitDice.length > 1 ? 14 : undefined }}>
          {c.hitDice.length === 0 ? '—' : c.hitDice.map((h) => `${h.total - h.spent}d${h.die}`).join(' + ')}
        </div>
        <div className="sub">{c.hitDice.length ? `${totalHd} left` : 'set up'}</div>
      </div>

      {ak ? (
        <div className={`vbox death-box ${c.hp.current <= 0 ? 'dying' : ''}`} style={{ cursor: 'default' }}
          title={"Dying at 0 HP: death save at the start of each turn (+2 Mettle on a success, +1 on a fail). Three failures and you die.\n\nDeath's Door actions:\n" + DEATHS_DOOR.map(([n, m, t]) => `${n} (${m} Mettle): ${t}`).join('\n')}>
          <div className="l">{c.hp.current <= 0 ? 'Dying' : 'Mettle · Fails'}</div>
          <div className="row" style={{ gap: 6, marginTop: 3 }}>
            <span className="small muted" style={{ width: 14 }} title="Mettle">◆</span>
            <Pips kind="mettle" total={6} used={6 - c.ak.mettle} onChange={(u) => patch((d) => { d.ak.mettle = 6 - u })} />
          </div>
          <div className="row" style={{ gap: 6, marginTop: 3, marginBottom: 3 }}>
            <span className="small muted" style={{ width: 14 }}>✗</span>
            <Pips kind="fail" total={3} used={3 - c.deathSaves.failures} onChange={(u) => patch((d) => { d.deathSaves.failures = 3 - u })} />
          </div>
        </div>
      ) : (
      <div className="vbox death-box" style={{ cursor: 'default' }}>
        <div className="l">Death Saves</div>
        <div className="row" style={{ gap: 6, marginTop: 3 }}>
          <span className="small muted" style={{ width: 14 }}>✓</span>
          <Pips kind="succ" total={3} used={3 - c.deathSaves.successes} onChange={(u) => patch((d) => { d.deathSaves.successes = 3 - u })} />
        </div>
        <div className="row" style={{ gap: 6, marginTop: 3, marginBottom: 3 }}>
          <span className="small muted" style={{ width: 14 }}>✗</span>
          <Pips kind="fail" total={3} used={3 - c.deathSaves.failures} onChange={(u) => patch((d) => { d.deathSaves.failures = 3 - u })} />
        </div>
      </div>
      )}

      <div className="vbox cond-box" ref={(el) => (refs.current.cond = el)} onClick={() => setCondOpen(!condOpen)}>
        <div className="l" style={{ alignSelf: 'center' }}>Conditions</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 3, padding: '3px 0' }}>
          {c.conditions.length === 0 && <span className="muted small">none — click to add</span>}
          {c.conditions.map((x) => <span key={x} className="chip accent">{x}</span>)}
        </div>
      </div>

      <button className="inv-btn" onClick={() => useUI.getState().set({ inventoryOpen: true })} title="Open inventory (Ctrl+I)">
        <Icon name="pack" className="inv-ico" />
        <span className="l">Inventory</span>
      </button>

      {edit && <StatEditor statKey={edit} anchor={refs.current[edit]} onClose={() => setEdit(null)} />}
      {hdOpen && <HitDiceEditor anchor={refs.current.hd} onClose={() => setHdOpen(false)} />}
      {condOpen && (
        <Popover anchor={refs.current.cond} onClose={() => setCondOpen(false)} width={300}>
          <div className="row" style={{ flexWrap: 'wrap', gap: 5 }}>
            {conditions.map((x) => {
              const on = c.conditions.includes(x)
              return (
                <button key={x} className={`chip ${on ? 'accent' : ''}`} style={{ cursor: 'pointer' }}
                  onClick={() => patch((d) => { d.conditions = on ? d.conditions.filter((y) => y !== x) : [...d.conditions, x] })}>
                  {x}
                </button>
              )
            })}
            {c.conditions.filter((x) => !conditions.includes(x)).map((x) => (
              <button key={x} className="chip accent" style={{ cursor: 'pointer' }} onClick={() => patch((d) => { d.conditions = d.conditions.filter((y) => y !== x) })}>{x} ✕</button>
            ))}
          </div>
          <input className="box-input" style={{ marginTop: 8 }} placeholder="Custom condition + Enter"
            onKeyDown={(e) => {
              const v = (e.target as HTMLInputElement).value.trim()
              if (e.key === 'Enter' && v) { patch((d) => { if (!d.conditions.includes(v)) d.conditions.push(v) }); (e.target as HTMLInputElement).value = '' }
            }} />
        </Popover>
      )}
    </div>
  )
}

function HitDiceEditor({ anchor, onClose }: { anchor: HTMLElement | null; onClose: () => void }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  return (
    <Popover anchor={anchor} onClose={onClose} width={320}>
      <h3 style={{ fontSize: 14, marginBottom: 8 }}>Hit Dice</h3>
      {c.hitDice.length === 0 && <div className="muted small" style={{ marginBottom: 6 }}>Add a die type for each class (e.g. d8 × your level).</div>}
      {c.hitDice.map((h) => (
        <div className="stat-line" key={h.id}>
          <select value={h.die} onChange={(e) => patch((d) => { const x = d.hitDice.find((y) => y.id === h.id); if (x) x.die = +e.target.value })}>
            {[4, 6, 8, 10, 12, 20].map((n) => <option key={n} value={n}>d{n}</option>)}
          </select>
          <span className="small">total</span>
          <Num min={0} max={30} className="box-input" width={44} value={h.total} onChange={(n) => patch((d) => { const x = d.hitDice.find((y) => y.id === h.id); if (x) { x.total = n; x.spent = Math.min(x.spent, n) } })} />
          <Pips total={h.total} used={h.spent} onChange={(u) => patch((d) => { const x = d.hitDice.find((y) => y.id === h.id); if (x) x.spent = u })} />
          <button className="btn icon sm" onClick={() => patch((d) => { d.hitDice = d.hitDice.filter((y) => y.id !== h.id) })}>✕</button>
        </div>
      ))}
      <button className="btn sm" onClick={() => patch((d) => { d.hitDice.push({ id: uid(), die: 8, total: Math.max(1, d.level), spent: 0 }) })}>＋ Add hit die</button>
      <div className="muted small" style={{ marginTop: 6 }}>Filled circle = still available. Click to spend one.</div>
    </Popover>
  )
}
