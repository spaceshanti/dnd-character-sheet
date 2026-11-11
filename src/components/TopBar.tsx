import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ALIGNMENTS, conditionsFor } from '../constants'
import { isAK, systemOf } from '../systems'
import { DEATHS_DOOR } from '../ak'
import { longRestOn, rememberRest, restEffects, restSnapshot } from '../rest'
import { activeEffects, damageReduction, martialDcAuto, netAdvantage, signed, spellStats, statInfo, type StatKey } from '../calc'
import { uid } from '../blank'
import { useChar, useStore, useUI, type PageId } from '../store'
import { Field, FitInput, Num, OverrideNum, Pips, Popover, Toast, useToast } from './ui'
import { akClassOf, autoFactionFor, autoSymbolFor, SymbolMark, SymbolPicker, useAkIcons } from './ClassSymbol'
import { useAutoFill } from './AutoFill'
import { dropImagesOn, Lightbox } from './ImagePicker'
import { StatEditor } from './StatEditor'
import { Icon } from './Icon'
import { askConfirm } from './Dialog'

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
  const report = (rest: string, done: string[]) => toast.show(done.length ? `${rest} rest · ${done.join(' · ')}` : `${rest} rest taken`)

  const akIcons = useAkIcons((st) => st.list)
  const ensureIcons = useAkIcons((st) => st.ensure)
  const ak = isAK(c)
  // Arknights sheets show the game's class / branch icons automatically (downloaded once onto this computer)
  useEffect(() => { if (ak) ensureIcons() }, [ak, ensureIcons])
  const longRest = async () => {
    if (!(await askConfirm(ak
      ? 'Take a long rest? This refills HP, Arts Points, hit dice (half) and resources, tops SP up to your start SP, and removes one failed death save.'
      : 'Take a long rest? This refills HP, spell slots, hit dice (half), resources and clears death saves.'))) return
    let done: string[] = []
    const before = restSnapshot(c)
    patch((d) => {
      rememberRest(d, 'long', before)
      done = longRestOn(d)
    })
    report('Long', done)
  }
  const shortRest = async () => {
    if (!(await askConfirm('Take a short rest? Resources that recharge on a short rest are refilled.'))) return
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
  const fill = useAutoFill()
  // the page bar always fits: tighten the tabs, then drop the buttons' words, until nothing sticks out
  const [navEl, setNavEl] = useState<HTMLElement | null>(null)
  const [tight, setTight] = useState(0)
  const [, remeasure] = useState(0)
  useLayoutEffect(() => {
    const n = navEl
    if (n && tight < 4 && n.scrollWidth > n.clientWidth + 1) setTight(tight + 1)
  })
  useLayoutEffect(() => {
    const n = navEl
    if (!n) return
    let w = n.clientWidth
    const check = () => { if (n.clientWidth !== w) { w = n.clientWidth; setTight(0); remeasure((x) => x + 1) } }
    const ro = new ResizeObserver(check)
    ro.observe(n)
    window.addEventListener('resize', check)
    return () => { ro.disconnect(); window.removeEventListener('resize', check) }
  }, [navEl])
  // the marks beside the portrait share its height
  const portrait = Math.max(60, mainH - 12)
  const symCount = ak ? 4 : 3
  const symSize = Math.max(18, Math.min(44, Math.floor((portrait - 3 * (symCount - 1)) / symCount)))
  const sym = {
    cls: c.classSymbol || autoSymbolFor(c.className, { ak, icons: akIcons }),
    sub: c.subclassSymbol || autoSymbolFor(c.subclass, { ak, branchOf: c.className, icons: akIcons }),
    nat: c.nationSymbol === 'emblem' ? c.emblem : c.nationSymbol || autoFactionFor(c.nationality, akIcons),
  }
  // class / branch / nation marks are an Arknights-sheet thing; the D&D sheet goes without
  const inline = (v: string, what: string) => (ak && v ? <SymbolMark value={v} size={15} title={what} /> : undefined)
  return (
    <header className={`topbar ${ak ? '' : 'no-marks'}`}>
      <Portrait size={portrait} />
      {/* class, subclass / branch, nationality and faction marks, stacked beside the portrait */}
      {ak && <div className="sym-col" style={{ height: portrait }}>
        <SymbolPicker size={symSize} label="Class" official={ak ? 'class' : undefined} akClass={akClassOf(c.className)} value={c.classSymbol}
          auto={autoSymbolFor(c.className, { ak, icons: akIcons })} onChange={(v) => patch((d) => { d.classSymbol = v })} />
        <SymbolPicker size={symSize} label={ak ? 'Branch' : 'Subclass'} official={ak ? 'class' : undefined} akClass={akClassOf(c.className)} value={c.subclassSymbol}
          auto={autoSymbolFor(c.subclass, { ak, branchOf: c.className, icons: akIcons })} onChange={(v) => patch((d) => { d.subclassSymbol = v })} />
        {ak && <SymbolPicker size={symSize} label="Nationality" official="faction" value={c.nationSymbol} emblem={c.emblem} auto={autoFactionFor(c.nationality, akIcons)} onChange={(v) => patch((d) => { d.nationSymbol = v })} />}
        <SymbolPicker size={symSize} label="Faction" official={ak ? 'faction' : undefined} value={c.factionSymbol} fallback={c.emblem} emblem={c.emblem}
          auto={ak && c.story.alliesTitle !== 'Allies & Organizations' ? autoFactionFor(c.story.alliesTitle, akIcons) : ''} onChange={(v) => patch((d) => { d.factionSymbol = v })} />
      </div>}
      <div className="top-main" ref={mainRef}>
        <div className="banner">
          <div className="name-banner">
            {/* Arknights: the operator codename, when one's been assigned, sits just above the name */}
            {ak && c.ak.codename.trim() && <div className="codename" title="Operator codename (set on the Character page)">{c.ak.codename}</div>}
            <NameBox value={c.name} onChange={(v) => patch((d) => { d.name = v })} />
            <div className="name-label-row">
              <label>Character Name</label>
              {c.nickname?.trim() && <span className="nickname" title="Nickname (set on the Character page)">“{c.nickname.trim()}”</span>}
            </div>
          </div>
          <div className="details">
            <Field label="Class" value={c.className} onChange={(v) => patch((d) => { d.className = v })}
              onFocus={fill.focus('class')} onBlur={fill.blur('class', 'Class')} after={inline(sym.cls, 'Class symbol')} />
            <Field label={ak ? 'Branch' : 'Subclass'} value={c.subclass} onChange={(v) => patch((d) => { d.subclass = v })}
              onFocus={fill.focus('subclass')} onBlur={fill.blur('subclass', ak ? 'Branch' : 'Subclass')} after={inline(sym.sub, ak ? 'Branch symbol' : 'Subclass symbol')} />
            <Field label="Species / Race" value={c.species} onChange={(v) => patch((d) => { d.species = v })}
              onFocus={fill.focus('species')} onBlur={fill.blur('species', 'Species')} />
            <div className="field">
              <div className="row" style={{ gap: 4 }}>
                <Num min={1} max={20} width={34} className="line-input" style={lineStyle} value={c.level} onChange={(n) => patch((d) => { d.level = n })} />
                <FitInput className="line-input" style={lineStyle} value={c.xp} placeholder="XP" onChange={(e) => patch((d) => { d.xp = e.target.value })} />
              </div>
              <label>Level · Experience</label>
            </div>
            <Field label="Background" value={c.background} onChange={(v) => patch((d) => { d.background = v })}
              onFocus={fill.focus('background')} onBlur={fill.blur('background', 'Background')} />
            {ak ? (
              <Field label="Nationality" value={c.nationality} onChange={(v) => patch((d) => { d.nationality = v })}
                onFocus={fill.focus('nationality')} onBlur={fill.blur('nationality', 'Nationality')} after={inline(sym.nat, 'Nationality symbol')} />
            ) : (
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

      <nav className={`nav tight-${tight}`} ref={setNavEl}>
        {(ak ? AK_TABS : TABS).map((t) => (
          <button key={t.id} className={`tab ${page === t.id ? 'active' : ''}`} onClick={() => go(t.id)}>{t.name}</button>
        ))}
        <span className="spacer" />
        {/* labels drop to just their icons when the window is too narrow for them */}
        <button className="btn sm ghost" onClick={() => set({ book: 'full' })} title="Read the sourcebooks full screen (Ctrl + B: side pane, Ctrl + F: search)">📖<span className="nav-l"> Sourcebooks</span></button>
        <button className="btn sm ghost" onClick={shortRest} title="Short rest">☾<span className="nav-l"> Short rest</span></button>
        <button className="btn sm ghost" onClick={longRest} title="Long rest">☀<span className="nav-l"> Long rest</span></button>
        <button className="btn sm ghost" onClick={() => set({ charListOpen: true })} title="Characters">👥<span className="nav-l"> Characters</span></button>
        <button className="btn sm ghost" onClick={() => set({ themeOpen: true })} title="UI style (Ctrl + T)">◐</button>
      </nav>
      <Toast msg={toast.msg} />
      {fill.popover}
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
  const spell = spellStats(c, fx)

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
      {/* spell save DC (and attack bonus): features use it too, so it's here as well as on the Spells page */}
      {/* save DCs features use: the spell DC, and on Arknights sheets the martial DC in the same box (both can be typed over) */}
      {ak ? (
        <div className="vbox dc-box" style={{ cursor: 'default' }}>
          <div className="l">DC</div>
          <div className="dc-line"><span>Spell</span><OverrideNum value={c.spellDcOverride} auto={spell.auto.dc} title="Spell save DC" onChange={(v) => patch((d) => { d.spellDcOverride = v })} /></div>
          <div className="dc-line"><span>Martial</span><OverrideNum value={c.martialDcOverride} auto={martialDcAuto(c, fx)} title="Martial DC: 8 + STR or DEX (the better) + proficiency" onChange={(v) => patch((d) => { d.martialDcOverride = v })} /></div>
        </div>
      ) : spell.dc != null && (
        <div className="vbox spell-box" style={{ cursor: 'default' }}>
          <div className="l">Spell DC</div>
          <div className="v"><OverrideNum value={c.spellDcOverride} auto={spell.auto.dc} title="Spell save DC" onChange={(v) => patch((d) => { d.spellDcOverride = v })} /></div>
          <div className="sub" />
        </div>
      )}
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

/**
 * The character's name, never cut off: the text shrinks to fit the line, then wraps onto a second line (shrinking
 * more if it has to), and a very long name gets a third line rather than losing its end.
 */
function NameBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      el.style.fontSize = ''
      el.style.height = 'auto'
      const base = parseFloat(getComputedStyle(el).fontSize)
      const lines = () => {
        el.style.height = 'auto'
        const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(el.style.fontSize || String(base)) * 1.2
        return Math.round((el.scrollHeight - parseFloat(getComputedStyle(el).paddingTop) - parseFloat(getComputedStyle(el).paddingBottom)) / lh)
      }
      let size = base
      // one line, down to a readable size
      while (lines() > 1 && size > 13) { size -= 0.5; el.style.fontSize = `${size}px` }
      // then two lines, smaller again if it must
      while (lines() > 2 && size > 9) { size -= 0.5; el.style.fontSize = `${size}px` }
      // the box's own underline isn't part of scrollHeight
      el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el.parentElement ?? el)
    return () => ro.disconnect()
  }, [value])
  return (
    <textarea ref={ref} className="name-in" rows={1} value={value} placeholder="Character name" spellCheck={false}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }} />
  )
}
