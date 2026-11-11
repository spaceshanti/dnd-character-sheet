import { useMemo, useState } from 'react'
import { ABILITIES, SPELL_LEVEL_NAMES } from '../constants'
import { activeEffects, preparedCount, signed, spellStats } from '../calc'
import { isAK } from '../systems'
import { isConsumed, newSpell, uid } from '../blank'
import { applyLib, bestLib, bundledLib, fetchStub, fromLib, isPool, nameKey, LIB, LIB_DND_CLASSES, LIB_POOLS, LIB_SCHOOLS, libLabel, searchLib, type LibSpell } from '../spellLib'
import { useChar, useStore, useUI } from '../store'
import { Frame, Modal, Num, Pips, Switch, Toast, useToast, OverrideNum } from '../components/ui'
import { RichArea } from '../components/RichText'
import type { CustomSpell, Spell } from '../types'
import { RichText } from '../components/RichText'
import { askConfirm } from '../components/Dialog'
import { cantripScale } from '../cantrip'

type View = 'mine' | 'library' | string

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

export function SpellsPage() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const { chars, order, activeId } = useStore()
  const [view, setView] = useState<View>('mine')
  const fx = activeEffects(c)
  const ss = spellStats(c, fx)
  const others = order.filter((id) => id !== activeId)
  const ak = isAK(c)

  return (
    <div className="col" style={{ gap: 12 }}>
      {/* one line: the page switch (and party peek) shrink first; the stat boxes stay together on the right */}
      <div className="spell-head">
        <div className="spell-head-left">
          <div className="seg">
            <button className={view === 'mine' ? 'on' : ''} onClick={() => setView('mine')}>{ak ? 'My Arts' : 'My spells'}</button>
            <button className={view === 'library' ? 'on' : ''} onClick={() => setView('library')}>{ak ? 'Arts library' : 'Spell library'}</button>
          </div>
          {others.length > 0 && (
            <select className="peek-pick" value={others.includes(view) ? view : ''} onChange={(e) => e.target.value && setView(e.target.value)}>
              <option value="">Peek at party member…</option>
              {others.map((id) => <option key={id} value={id}>{chars[id].name || 'Unnamed'} ({chars[id].spells.length})</option>)}
            </select>
          )}
        </div>
        {view === 'mine' && (
          <div className="spell-head-stats">
            <div className="spell-stat">
              <select value={c.spellAbility} onChange={(e) => patch((d) => { d.spellAbility = e.target.value as typeof c.spellAbility })}>
                <option value="">—</option>
                {ABILITIES.map((a) => <option key={a.key} value={a.key}>{a.short}</option>)}
              </select>
              <span className="field-lbl">Casting ability</span>
            </div>
            <div className="spell-stat">
              <OverrideNum value={c.spellDcOverride} auto={ss.auto.dc} title="8 + proficiency + casting ability modifier" onChange={(v) => patch((d) => { d.spellDcOverride = v })} />
              <span className="field-lbl">Spell save DC</span>
            </div>
            <div className="spell-stat">
              <OverrideNum value={c.spellAttackOverride} auto={ss.auto.attack} format={signed} title="Proficiency + casting ability modifier" onChange={(v) => patch((d) => { d.spellAttackOverride = v })} />
              <span className="field-lbl">Spell attack</span>
            </div>
            {/* Arknights: Arts are always prepared (martial DC is in the top bar) */}
            {!ak && (
              <div className="spell-stat" title={`How many spells you can have prepared. ${preparedCount(c)} prepared now.`}>
                <Num min={0} max={99} className="prep-max" value={c.maxPrepared ?? 0} onChange={(n) => patch((d) => { d.maxPrepared = n })} />
                <span className="field-lbl">Max prepared</span>
              </div>
            )}
          </div>
        )}
      </div>
      {view === 'mine' && ak && <ArtsPoints />}
      {view === 'mine' && <SpellFeatures />}

      {view === 'mine' && <MySpells />}
      {view === 'library' && <Library />}
      {others.includes(view) && <PeekSpells id={view} />}
    </div>
  )
}

/* ------------------------------------------------------------- my spells */

/** Features you've marked "show on the Spells / Arts page": rules that change how you cast, kept in view here. */
function SpellFeatures() {
  const c = useChar()
  const set = useUI((s) => s.set)
  const [opened, setOpened] = useState<Set<string>>(new Set())
  const list = c.features.filter((f) => f.onSpellPage)
  if (!list.length) return null
  return (
    <Frame title={isAK(c) ? 'Features for my Arts' : 'Spellcasting features'} tight>
      <div className="spell-feats">
        {list.map((f) => {
          const open = opened.has(f.id)
          return (
            <div key={f.id} className="spell-feat">
              <div className="row" style={{ gap: 6 }}>
                <button className="btn icon sm ghost" title={open ? 'Fold' : 'Unfold'} onClick={() => setOpened((s) => { const n = new Set(s); if (open) n.delete(f.id); else n.add(f.id); return n })}>{open ? '▾' : '▸'}</button>
                <b className="grow" style={{ cursor: 'pointer' }} onClick={() => set({ drawer: { kind: 'feature', id: f.id } })}>{f.name || 'Unnamed feature'}</b>
                {f.source && <span className="muted small">{f.source}</span>}
              </div>
              {open && (f.description ? <RichText className="prose small-prose" value={f.description} /> : <div className="muted small">No description yet.</div>)}
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

/** AK5e: one pool of Arts Points instead of spell slots, and a maximum Art level. */
function ArtsPoints() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const ap = c.ak.ap
  const left = Math.max(0, ap.max - ap.used)
  return (
    <div className="ap-panel">
      <div className="ap-num">
        <b>{left}</b><span>/</span>
        <Num min={0} max={999} value={ap.max} onChange={(n) => patch((d) => { d.ak.ap.max = n; d.ak.ap.used = Math.min(d.ak.ap.used, n) })} />
        <label>Arts Points left / max</label>
      </div>
      <div className="grow col" style={{ gap: 4, minWidth: 0 }}>
        <div className="sp-bar ap"><i style={{ width: (ap.max ? (left / ap.max) * 100 : 0) + '%' }} /></div>
        <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={() => patch((d) => { d.ak.ap.used = Math.min(d.ak.ap.max, d.ak.ap.used + 1) })}>−1 AP</button>
          <button className="btn sm" onClick={() => patch((d) => { d.ak.ap.used = Math.max(0, d.ak.ap.used - 1) })}>+1 AP</button>
          <button className="btn sm ghost" onClick={() => patch((d) => { d.ak.ap.used = 0 })}>Refill</button>
          <span className="muted small">Casting an Art costs AP equal to the level you cast it at.</span>
        </div>
      </div>
      <div className="spell-stat">
        <Num min={0} max={9} value={c.ak.maxArtLevel} onChange={(n) => patch((d) => { d.ak.maxArtLevel = n })} />
        <span className="field-lbl">Max Art level</span>
      </div>
      <div className="spell-stat">
        <select value={ap.recharge} onChange={(e) => patch((d) => { d.ak.ap.recharge = e.target.value as 'long' | 'short' })}>
          <option value="long">Long rest</option><option value="short">Short rest</option>
        </select>
        <span className="field-lbl">AP come back on</span>
      </div>
      {c.ak.maxArtLevel >= 9 && (
        <label className="spell-stat" title="Only one 9th-level Art per long rest">
          <Switch on={c.ak.ninthUsed} onChange={(b) => patch((d) => { d.ak.ninthUsed = b })} />
          <span className="field-lbl">9th used</span>
        </label>
      )}
    </div>
  )
}

/** How many ruled lines a section shows before it starts growing. */
const MIN_LINES = (l: number) => (l === 0 ? 6 : l <= 5 ? 7 : 5)

/** Concentration / Ritual / Material-consumed markers, like the 2024 sheet. */
function Crm({ s }: { s: Spell }) {
  const d = (on: boolean, letter: string, title: string) => (
    <span className={`crm ${on ? 'on' : ''}`} title={on ? title : ''}>{on ? '◆' : '◇'}{letter}</span>
  )
  return (
    <span className="crm-set">
      {d(s.concentration, 'C', 'Concentration')}
      {d(s.ritual, 'R', 'Ritual')}
      {d(s.materialConsumed, 'M', `Material consumed / costly: ${s.components}`)}
    </span>
  )
}

/** One level block like a paper sheet: slots on top, then ruled lines that grow with the list. */
function SpellSection({ level, spells, editable, filtering, onOpen, onToggle, onAdd }: {
  level: number
  spells: Spell[]
  editable: boolean
  filtering?: boolean
  onOpen: (s: Spell) => void
  onToggle?: (s: Spell) => void
  onAdd?: (level: number, name: string) => void
}) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const [adding, setAdding] = useState(false)
  const slot = c.slots[level] ?? { total: 0, used: 0 }
  const ak = isAK(c)
  const locked = ak && level > 0 && c.ak.maxArtLevel > 0 && level > c.ak.maxArtLevel
  const list = [...spells].sort((a, b) => a.name.localeCompare(b.name))
  const blanks = !editable || filtering ? 0 : Math.max(MIN_LINES(level) - list.length, 1)

  return (
    <div className={`spell-sec ${locked ? 'locked' : ''}`}>
      <div className="sec-head">
        <div className="lvl-badge">{level}</div>
        <div className="sec-banner">
          {level === 0 ? <b className="caps sec-title">Cantrips</b> : ak ? (
            <>
              <b className="caps sec-title">Level {level}</b>
              <span className="ap-cost" title="Arts Points spent to cast at this level">{level} AP</span>
              {locked && <span className="muted small">above your max Art level</span>}
            </>
          ) : editable ? (
            <>
              <div className="slot-total">
                <Num min={0} max={9} value={slot.total}
                  onChange={(n) => patch((d) => { d.slots[level] = { total: n, used: Math.min(d.slots[level]?.used ?? 0, n) } })} />
                <label>Slots total</label>
              </div>
              <div className="slot-remain">
                {slot.total > 0
                  ? <Pips total={slot.total} used={slot.used} onChange={(u) => patch((d) => { d.slots[level].used = u })} />
                  : <span className="muted small">—</span>}
                <label>Slots remaining</label>
              </div>
            </>
          ) : <b className="caps sec-title">Level {level}</b>}
        </div>
      </div>
      <div className="sec-lines">
        {list.map((s) => (
          <div key={s.id} className="sline" onClick={() => onOpen(s)}>
            {level > 0 && !ak ? (
              <button
                className={`pip ${s.prepared || s.alwaysPrepared ? 'on' : ''} ${s.alwaysPrepared ? 'always' : ''}`}
                title={s.grantedBy ? `Always prepared · from ${c.features.find((f) => f.id === s.grantedBy)?.name || 'a feature'}` : s.alwaysPrepared ? 'Always prepared' : s.prepared ? 'Prepared (click to unprepare)' : 'Not prepared (click to prepare)'}
                onClick={(e) => { e.stopPropagation(); if (onToggle && !s.alwaysPrepared) onToggle(s) }}
              />
            ) : <span className="pip-dot" />}
            <span className="nm">{s.name || 'Unnamed'}</span>
            {level === 0 && <CantripChip s={s} />}
            {s.effects.length > 0 && <span className="chip accent fx-chip" style={{ opacity: s.active ? 1 : 0.55 }} title="Linked to your sheet">{s.active ? 'active' : 'fx'}</span>}
            {!s.description && editable && <span className="muted small" title="No description stored yet">no desc</span>}
            <Crm s={s} />
          </div>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <div key={'b' + i} className="sline blank" onClick={() => !adding && setAdding(true)} title="Click to add a spell">
            {level > 0 && !ak ? <span className="pip" /> : <span className="pip-dot" />}
            {adding && i === 0 ? (
              <input
                autoFocus className="nm" placeholder={ak ? 'Art name, Enter to add' : 'Spell name, Enter to add'}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  const el = e.target as HTMLInputElement
                  const v = el.value.trim()
                  if (e.key === 'Enter' && v) { onAdd?.(level, v); el.value = '' }
                  if (e.key === 'Escape') setAdding(false)
                }}
                onBlur={() => setAdding(false)}
              />
            ) : <span className="nm" />}
          </div>
        ))}
      </div>
    </div>
  )
}

function MySpells() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const set = useUI((s) => s.set)
  const toast = useToast()
  const [q, setQ] = useState('')
  const spells = c.spells.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()))

  const add = (level: number, name: string) => {
    const lib = bestLib(name)
    let sp = newSpell(level, name)
    if (lib) sp = { ...applyLib(sp, lib), level }
    sp.prepared = level === 0 || isAK(c)
    patch((d) => { d.spells.push(sp) })
    toast.show(lib ? `Added ${sp.name}, description filled in from ${lib.e === 'Custom' ? 'your library' : lib.e === 'UA' ? 'the imported UA' : lib.e === 'AK5e' ? 'the AK5e book' : `the ${lib.e} SRD`}` : `Added ${name}. Click it to add a description`)
  }

  return (
    <>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <input className="box-input" style={{ width: 200 }} placeholder="search my spells…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted small">
          {isAK(c)
            ? 'Click an empty line to add · click an Art to read and cast it · Arts you know are always prepared and need no material components · ◆C concentration · ◆R ritual'
            : 'Click an empty line to add · click a spell to read it · click its circle to prepare · ◆C concentration · ◆R ritual · ◆M material consumed'}
        </span>
      </div>
      <div className="spell-book">
        {LEVELS.map((l) => (
          <SpellSection
            key={l} level={l} editable filtering={!!q}
            spells={spells.filter((s) => s.level === l)}
            onOpen={(s) => set({ drawer: { kind: 'spell', id: s.id } })}
            onToggle={(s) => patch((d) => { const x = d.spells.find((y) => y.id === s.id); if (x) x.prepared = !x.prepared })}
            onAdd={add}
          />
        ))}
      </div>
      <Toast msg={toast.msg} />
    </>
  )
}

/* ------------------------------------------------------- shared preview */

export function SpellPreview({ spell, onClose, footer, subtitle }: { spell: Spell; onClose: () => void; footer?: React.ReactNode; subtitle?: string }) {
  return (
    <Modal title={spell.name} onClose={onClose}>
      <div className="col" style={{ gap: 10 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="tag">{spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}</span>
          {spell.school && <span className="tag alt">{spell.school}</span>}
          {spell.concentration && <span className="tag alt">Concentration</span>}
          {spell.ritual && <span className="tag alt">Ritual</span>}
          {spell.materialConsumed && <span className="tag alt">Material consumed</span>}
          {subtitle && <span className="muted small">{subtitle}</span>}
        </div>
        <div className="kv">
          {spell.castingTime && <><b>Casting time</b><span>{spell.castingTime}</span></>}
          {spell.range && <><b>Range</b><span>{spell.range}</span></>}
          {spell.components && <><b>Components</b><span>{spell.components}</span></>}
          {spell.duration && <><b>Duration</b><span>{spell.duration}</span></>}
        </div>
        {spell.description ? <RichText className="prose" value={spell.description} /> : <div className="prose muted">No description stored.</div>}
        {footer && <div className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>{footer}</div>}
      </div>
    </Modal>
  )
}

/* --------------------------------------------------------------- library */

function Library() {
  const patch = useStore((s) => s.patch)
  const c = useChar()
  const set = useUI((s) => s.set)
  const toast = useToast()
  const [q, setQ] = useState('')
  const [level, setLevel] = useState<number | 'all'>('all')
  const [cls, setCls] = useState('')
  const [school, setSchool] = useState('')
  const ak = isAK(c)
  const [edition, setEdition] = useState(ak ? 'ak' : 'modern')
  const [sel, setSel] = useState<LibSpell | null>(null)
  const [limit, setLimit] = useState(80)
  const customSpells = useStore((s) => s.customSpells)
  const deleteCustomSpell = useStore((s) => s.deleteCustomSpell)
  const [editing, setEditing] = useState<CustomSpell | null>(null)
  const results = useMemo(() => searchLib(q, { level, cls, school, edition }), [q, level, cls, school, edition, customSpells])
  const have = (n: string) => c.spells.some((s) => s.name.toLowerCase() === n.toLowerCase())

  /** put fetched text into this character's copies that have none yet */
  const fillMine = (entry: CustomSpell) =>
    patch((d) => {
      for (const x of d.spells) if (!x.description.trim() && nameKey(x.name) === nameKey(entry.n)) Object.assign(x, applyLib(x, { ...entry, e: 'Custom' }), { level: x.level })
    })
  const add = (l: LibSpell) => {
    const sp = fromLib(l)
    sp.prepared = l.l === 0 || ak
    patch((d) => { d.spells.push(sp) })
    toast.show(l.stub && window.sheetApi ? `Added ${l.n}, fetching its D&D description…` : `Added ${l.n} to your spells`)
    if (l.stub && window.sheetApi) fetchStub(l).then((r) => { if (typeof r === 'string') toast.show(`${l.n}: ${r}`); else { fillMine(r); toast.show(`${l.n}: description filled in`) } })
    return sp
  }
  const stubs = results.filter((x) => x.stub)
  const [filling, setFilling] = useState('')
  const fillAll = async () => {
    let ok = 0
    const failed: string[] = []
    for (const [i, x] of stubs.entries()) {
      setFilling(`${i + 1} / ${stubs.length}`)
      const r = await fetchStub(x)
      if (typeof r === 'string') failed.push(x.n)
      else { ok++; fillMine(r) }
    }
    setFilling('')
    toast.show(`Filled in ${ok} spell${ok === 1 ? '' : 's'}${failed.length ? ` · not found: ${failed.slice(0, 4).join(', ')}${failed.length > 4 ? '…' : ''}` : ''}`)
  }

  return (
    <Frame title={ak ? 'Arts Library · AK5e pools' : 'Spell Library · SRD'}>
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
        <input className="box-input" style={{ width: 240 }} autoFocus placeholder="search spells by name…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(80) }} />
        <select value={String(level)} onChange={(e) => setLevel(e.target.value === 'all' ? 'all' : +e.target.value)}>
          <option value="all">Any level</option>
          {SPELL_LEVEL_NAMES.map((n, i) => <option key={i} value={i}>{i === 0 ? 'Cantrip' : `Level ${i}`}</option>)}
        </select>
        <select value={cls} onChange={(e) => setCls(e.target.value)}>
          <option value="">{ak ? 'Any Arts pool' : 'Any class'}</option>{(ak ? LIB_POOLS : LIB_DND_CLASSES).map((x) => <option key={x}>{x}</option>)}
        </select>
        <select value={school} onChange={(e) => setSchool(e.target.value)}>
          <option value="">Any school</option>{LIB_SCHOOLS.map((x) => <option key={x}>{x}</option>)}
        </select>
        <select value={edition} onChange={(e) => setEdition(e.target.value)}>
          {(ak || LIB_POOLS.length > 0) && <option value="ak">AK5e Arts pools + mine</option>}
          {LIB_POOLS.length > 0 && <option value="AK5e">AK5e new Arts only</option>}
          <option value="modern">2024 + UA + mine</option><option value="Custom">My spells only</option><option value="2024">2024 SRD only</option><option value="UA">UA / imported only</option>
          <option value="2014">2014 SRD only</option><option value="all">Everything</option>
        </select>
        <span className="muted small">{results.length} spells</span>
        {stubs.length > 0 && window.sheetApi && (
          <button className="btn sm" disabled={!!filling} title="Fetch the regular D&D text from wikidot for every name-only entry shown, and keep it in your library"
            onClick={fillAll}>{filling ? `Fetching ${filling}…` : `Get D&D text for ${stubs.length} name-only`}</button>
        )}
        <span className="grow" />
        <button className="btn sm primary" onClick={() => setEditing(blankCustom())}>＋ Add spell to library</button>
      </div>
      <div className="muted small" style={{ marginBottom: 8 }}>
        {ak ? <>The Arts pools and new Arts from the AK5e book (<code>tools/import_ak5e.py</code>), linked to the SRD text where the book reuses a 5e spell.
          Entries marked <i>name only</i> are 5e spells outside the SRD: add them, then paste the description or use Fetch.</>
          : <>The free SRD set plus anything imported from your own PDFs (<code>tools/import_ua_spells.py</code>). Entries marked <i>name only</i> come from a class list
          without their full text. Add them, then paste the description or use Fetch.</>}
      </div>
      <table className="t">
        <thead><tr><th>Name</th><th style={{ width: 70 }}>Level</th><th>School</th><th>Time</th><th>{ak ? 'Pools' : 'Classes'}</th><th style={{ width: 52 }}>Rules</th><th style={{ width: 70 }} /></tr></thead>
        <tbody>
          {results.slice(0, limit).map((s) => (
            <tr key={s.n + s.e} className="hov" onClick={() => setSel(s)}>
              <td>
                <b style={s.stub ? { fontWeight: 600, opacity: 0.8 } : undefined}>{s.n}</b>{' '}
                {s.co && <span className="badge">C</span>} {s.ri && <span className="badge">R</span>} {s.m && !ak && <span className="badge">M</span>}
                {s.stub && <span className="muted small"> · name only</span>}
              </td>
              <td>{s.l === 0 ? 'Cantrip' : s.l}</td><td>{s.s}</td><td className="small">{s.ct}</td>
              <td className="small muted">{s.cl.filter((x) => isPool(x) === ak).join(', ')}</td><td><span className="tag alt">{s.e === 'Custom' ? 'mine' : s.e}</span></td>
              <td onClick={(e) => e.stopPropagation()}>
                {have(s.n) ? <span className="muted small">added ✓</span> : <button className="btn sm" onClick={() => add(s)}>Add</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {results.length > limit && <div style={{ textAlign: 'center', marginTop: 10 }}><button className="btn" onClick={() => setLimit(limit + 120)}>Show more</button></div>}
      {results.length === 0 && <div className="empty">No spells match.</div>}
      {sel && (
        <SpellPreview spell={fromLib(sel)} subtitle={`${sel.src ?? `${sel.e} SRD`} · ${sel.cl.filter((x) => isPool(x) === ak).join(', ')}`} onClose={() => setSel(null)}
          footer={<>
            {sel.stub && <span className="muted small grow">This entry is from the class list only. Add it, then paste the description or Fetch it.</span>}
            {sel.e === 'Custom' && sel.id && (
              <>
                <button className="btn" onClick={() => { const x = customSpells.find((y) => y.id === sel.id); if (x) { setEditing(x); setSel(null) } }}>Edit</button>
                <button className="btn danger" onClick={async () => { if ((await askConfirm(`Remove ${sel.n} from your library? Characters that already have it keep their copy.`))) { deleteCustomSpell(sel.id!); setSel(null) } }}>Delete from library</button>
                <span className="grow" />
              </>
            )}
            {have(sel.n)
              ? <span className="muted">Already in your spell list.</span>
              : <button className="btn primary" onClick={() => { const sp = add(sel); setSel(null); set({ drawer: { kind: 'spell', id: sp.id } }) }}>Add to my spells</button>}
          </>} />
      )}
      {editing && <CustomSpellForm initial={editing} onClose={() => setEditing(null)} onSaved={(n) => toast.show(`${n} saved to your library`)} />}
      <Toast msg={toast.msg} />
    </Frame>
  )
}

const blankCustom = (): CustomSpell => ({ id: uid(), n: '', l: 1, s: '', ct: '1 action', r: '', c: '', d: '', co: false, ri: false, m: false, cl: [], t: '' })

/** Add or edit one of your own spells in the shared library. */
function CustomSpellForm({ initial, onClose, onSaved }: { initial: CustomSpell; onClose: () => void; onSaved: (name: string) => void }) {
  const save = useStore((s) => s.saveCustomSpell)
  const [f, setF] = useState<CustomSpell>(initial)
  const upd = (p: Partial<CustomSpell>) => setF((x) => ({ ...x, ...p }))
  const text = (k: 'n' | 's' | 'ct' | 'r' | 'c' | 'd', ph: string) => (
    <input className="box-input" placeholder={ph} value={f[k]} onChange={(e) => upd({ [k]: e.target.value } as Partial<CustomSpell>)} />
  )
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const srd = f.n.trim() ? bundledLib(f.n) : undefined
  const fetchIt = async () => {
    setMsg('')
    if (!window.sheetApi) { setMsg('Fetching only works in the desktop app.'); return }
    if (!f.url && !f.n.trim()) { setMsg('Type the spell name or paste its wikidot link first.'); return }
    setBusy(true)
    const r = await window.sheetApi.fetchSpell(f.url || f.n)
    setBusy(false)
    if (r.error) { setMsg(r.error); return }
    upd({
      n: f.n.trim() || r.name || '', url: r.url, l: r.level ?? f.l, s: r.school ? r.school[0].toUpperCase() + r.school.slice(1) : f.s,
      ct: r.castingTime || f.ct, r: r.range || f.r, c: r.components || f.c, d: r.duration || f.d,
      co: !!r.concentration, ri: !!r.ritual, m: r.components ? isConsumed(r.components) : f.m, t: r.description || f.t,
    })
    setMsg('Fetched ✓')
  }
  return (
    <Modal title={initial.n ? `Edit ${initial.n}` : 'Add a spell to your library'} onClose={onClose}>
      <div className="col" style={{ gap: 8, maxWidth: 640 }}>
        <div className="row">
          <input className="box-input grow" autoFocus placeholder="Spell name" value={f.n} onChange={(e) => upd({ n: e.target.value })} />
          <select value={f.l} onChange={(e) => upd({ l: +e.target.value })}>
            {SPELL_LEVEL_NAMES.map((_, i) => <option key={i} value={i}>{i === 0 ? 'Cantrip' : `Level ${i}`}</option>)}
          </select>
        </div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {text('s', 'School')}{text('ct', 'Casting time')}{text('r', 'Range')}{text('d', 'Duration')}
        </div>
        {text('c', 'Components')}
        <div className="fx" style={{ borderStyle: 'solid' }}>
          <div className="row" style={{ gap: 4 }}>
            <input className="box-input grow" placeholder="wikidot link (optional) — or leave empty to look up by name" value={f.url ?? ''} onChange={(e) => upd({ url: e.target.value })} />
            <button className="btn sm" disabled={busy} onClick={fetchIt}>{busy ? 'Fetching…' : 'Fetch'}</button>
          </div>
          {srd && (
            <div className="row small" style={{ gap: 4, marginTop: 5 }}>
              <span className="muted">Built-in library has it:</span>
              <button className="btn sm" onClick={() => upd({ l: srd.l, s: srd.s, ct: srd.ct, r: srd.r, c: srd.c, d: srd.d, co: srd.co, ri: srd.ri, m: srd.m ?? isConsumed(srd.c), cl: srd.cl, t: srd.t })}>
                Use {libLabel(srd.e)} text
              </button>
            </div>
          )}
          {msg && <div className="small" style={{ marginTop: 4, color: msg.endsWith('✓') ? 'var(--good)' : 'var(--dis)' }}>{msg}</div>}
        </div>
        <input className="box-input" placeholder="Classes, comma separated (Psion, Wizard…)" value={f.cl.join(', ')} onChange={(e) => upd({ cl: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
        <div className="row" style={{ gap: 16 }}>
          <label className="row small"><Switch on={f.co} onChange={(b) => upd({ co: b })} /> Concentration</label>
          <label className="row small"><Switch on={f.ri} onChange={(b) => upd({ ri: b })} /> Ritual</label>
          <label className="row small"><Switch on={f.m} onChange={(b) => upd({ m: b })} /> Material consumed</label>
        </div>
        <RichArea className="box-input" minRows={8} placeholder="Description" value={f.t} onChange={(v) => upd({ t: v })} />
        <div className="row">
          <span className="grow" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!f.n.trim()} onClick={() => { save({ ...f, n: f.n.trim() }); onSaved(f.n.trim()); onClose() }}>Save to library</button>
        </div>
      </div>
    </Modal>
  )
}

/* ----------------------------------------------------------- peek at party */

function PeekSpells({ id }: { id: string }) {
  const other = useStore((s) => s.chars[id])
  const patch = useStore((s) => s.patch)
  const mine = useChar()
  const set = useUI((s) => s.set)
  const toast = useToast()
  const [sel, setSel] = useState<Spell | null>(null)
  if (!other) return null
  const copy = (s: Spell) => {
    const sp: Spell = { ...JSON.parse(JSON.stringify(s)), id: uid(), prepared: false, alwaysPrepared: false, active: false }
    patch((d) => { d.spells.push(sp) })
    toast.show(`Copied ${s.name} to ${mine.name}`)
    return sp
  }
  return (
    <div className="col">
      <div className="row"><h3>{other.name}'s spells</h3><span className="muted small">read-only</span></div>
      {other.spells.length === 0 ? <div className="empty">{other.name} has no spells stored.</div> : (
        <div className="spell-book">
          {LEVELS.filter((l) => other.spells.some((s) => s.level === l)).map((l) => (
            <SpellSection key={l} level={l} editable={false} spells={other.spells.filter((s) => s.level === l)} onOpen={setSel} />
          ))}
        </div>
      )}
      {sel && (
        <SpellPreview spell={sel} subtitle={`from ${other.name}`} onClose={() => setSel(null)}
          footer={mine.spells.some((s) => s.name.toLowerCase() === sel.name.toLowerCase())
            ? <span className="muted">You already have this spell.</span>
            : <button className="btn primary" onClick={() => { const sp = copy(sel); setSel(null); set({ drawer: { kind: 'spell', id: sp.id } }) }}>Copy to my spells</button>} />
      )}
      <Toast msg={toast.msg} />
    </div>
  )
}

/** a cantrip's damage at the character's level, on its line in the list */
function CantripChip({ s }: { s: Spell }) {
  const level = useChar().level
  const sc = cantripScale(s.description, level)
  if (!sc || !sc.now) return null
  return <span className="chip cantrip-chip" title={`At level ${level}. ${sc.tiers.filter((x) => x[1]).map(([l, d]) => `${l}+: ${d}`).join(' · ')}`}>{sc.now}</span>
}
