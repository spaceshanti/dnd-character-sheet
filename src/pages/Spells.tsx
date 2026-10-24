import { useMemo, useState } from 'react'
import { ABILITIES, SPELL_LEVEL_NAMES } from '../constants'
import { activeEffects, preparedCount, signed, spellStats } from '../calc'
import { newSpell, uid } from '../blank'
import { applyLib, bestLib, fromLib, LIB, LIB_CLASSES, LIB_SCHOOLS, searchLib, type LibSpell } from '../spellLib'
import { useChar, useStore, useUI } from '../store'
import { Frame, Modal, Num, Pips, Toast, useToast } from '../components/ui'
import type { Spell } from '../types'
import { RichText } from '../components/RichText'

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

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="seg">
          <button className={view === 'mine' ? 'on' : ''} onClick={() => setView('mine')}>My spells</button>
          <button className={view === 'library' ? 'on' : ''} onClick={() => setView('library')}>Spell library ({LIB.length})</button>
        </div>
        {others.length > 0 && (
          <select value={others.includes(view) ? view : ''} onChange={(e) => e.target.value && setView(e.target.value)}>
            <option value="">Peek at party member…</option>
            {others.map((id) => <option key={id} value={id}>{chars[id].name || 'Unnamed'} ({chars[id].spells.length})</option>)}
          </select>
        )}
        {view === 'mine' && (
          <>
            <span className="grow" />
            <div className="spell-stat">
              <select value={c.spellAbility} onChange={(e) => patch((d) => { d.spellAbility = e.target.value as typeof c.spellAbility })}>
                <option value="">—</option>
                {ABILITIES.map((a) => <option key={a.key} value={a.key}>{a.short}</option>)}
              </select>
              <span className="field-lbl">Casting ability</span>
            </div>
            <div className="spell-stat"><b>{ss.dc ?? '—'}</b><span className="field-lbl">Spell save DC</span></div>
            <div className="spell-stat"><b>{ss.attack == null ? '—' : signed(ss.attack)}</b><span className="field-lbl">Spell attack</span></div>
            <div className="spell-stat"><b>{preparedCount(c)}</b><span className="field-lbl">Prepared</span></div>
          </>
        )}
      </div>

      {view === 'mine' && <MySpells />}
      {view === 'library' && <Library />}
      {others.includes(view) && <PeekSpells id={view} />}
    </div>
  )
}

/* ------------------------------------------------------------- my spells */

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
  const list = [...spells].sort((a, b) => a.name.localeCompare(b.name))
  const blanks = !editable || filtering ? 0 : Math.max(MIN_LINES(level) - list.length, 1)

  return (
    <div className="spell-sec">
      <div className="sec-head">
        <div className="lvl-badge">{level}</div>
        <div className="sec-banner">
          {level === 0 ? <b className="caps sec-title">Cantrips</b> : editable ? (
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
            {level > 0 ? (
              <button
                className={`pip ${s.prepared || s.alwaysPrepared ? 'on' : ''} ${s.alwaysPrepared ? 'always' : ''}`}
                title={s.grantedBy ? `Always prepared · from ${c.features.find((f) => f.id === s.grantedBy)?.name || 'a feature'}` : s.alwaysPrepared ? 'Always prepared' : s.prepared ? 'Prepared (click to unprepare)' : 'Not prepared (click to prepare)'}
                onClick={(e) => { e.stopPropagation(); if (onToggle && !s.alwaysPrepared) onToggle(s) }}
              />
            ) : <span className="pip-dot" />}
            <span className="nm">{s.name || 'Unnamed'}</span>
            {s.effects.length > 0 && <span className="chip accent fx-chip" style={{ opacity: s.active ? 1 : 0.55 }} title="Linked to your sheet">{s.active ? 'active' : 'fx'}</span>}
            {!s.description && editable && <span className="muted small" title="No description stored yet">no desc</span>}
            <Crm s={s} />
          </div>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <div key={'b' + i} className="sline blank" onClick={() => !adding && setAdding(true)} title="Click to add a spell">
            {level > 0 ? <span className="pip" /> : <span className="pip-dot" />}
            {adding && i === 0 ? (
              <input
                autoFocus className="nm" placeholder="Spell name, Enter to add"
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
    sp.prepared = level === 0
    patch((d) => { d.spells.push(sp) })
    toast.show(lib ? `Added ${sp.name}, description filled in from the ${lib.e} SRD` : `Added ${name}. Click it to add a description`)
  }

  return (
    <>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <input className="box-input" style={{ width: 200 }} placeholder="search my spells…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted small">
          Click an empty line to add · click a spell to read it · click its circle to prepare · ◆C concentration · ◆R ritual · ◆M material consumed
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
  const [edition, setEdition] = useState('modern')
  const [sel, setSel] = useState<LibSpell | null>(null)
  const [limit, setLimit] = useState(80)
  const results = useMemo(() => searchLib(q, { level, cls, school, edition }), [q, level, cls, school, edition])
  const have = (n: string) => c.spells.some((s) => s.name.toLowerCase() === n.toLowerCase())

  const add = (l: LibSpell) => {
    const sp = fromLib(l)
    sp.prepared = l.l === 0
    patch((d) => { d.spells.push(sp) })
    toast.show(`Added ${l.n} to your spells`)
    return sp
  }

  return (
    <Frame title="Spell Library · SRD">
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
        <input className="box-input" style={{ width: 240 }} autoFocus placeholder="search spells by name…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(80) }} />
        <select value={String(level)} onChange={(e) => setLevel(e.target.value === 'all' ? 'all' : +e.target.value)}>
          <option value="all">Any level</option>
          {SPELL_LEVEL_NAMES.map((n, i) => <option key={i} value={i}>{i === 0 ? 'Cantrip' : `Level ${i}`}</option>)}
        </select>
        <select value={cls} onChange={(e) => setCls(e.target.value)}>
          <option value="">Any class</option>{LIB_CLASSES.map((x) => <option key={x}>{x}</option>)}
        </select>
        <select value={school} onChange={(e) => setSchool(e.target.value)}>
          <option value="">Any school</option>{LIB_SCHOOLS.map((x) => <option key={x}>{x}</option>)}
        </select>
        <select value={edition} onChange={(e) => setEdition(e.target.value)}>
          <option value="modern">2024 + UA</option><option value="2024">2024 SRD only</option><option value="UA">UA / imported only</option>
          <option value="2014">2014 SRD only</option><option value="all">Everything</option>
        </select>
        <span className="muted small">{results.length} spells</span>
      </div>
      <div className="muted small" style={{ marginBottom: 8 }}>
        The free SRD set plus anything imported from your own PDFs (<code>tools/import_ua_spells.py</code>). Entries marked <i>name only</i> come from a class list
        without their full text. Add them, then paste the description or use Fetch.
      </div>
      <table className="t">
        <thead><tr><th>Name</th><th style={{ width: 70 }}>Level</th><th>School</th><th>Time</th><th>Classes</th><th style={{ width: 52 }}>Rules</th><th style={{ width: 70 }} /></tr></thead>
        <tbody>
          {results.slice(0, limit).map((s) => (
            <tr key={s.n + s.e} className="hov" onClick={() => setSel(s)}>
              <td>
                <b style={s.stub ? { fontWeight: 600, opacity: 0.8 } : undefined}>{s.n}</b>{' '}
                {s.co && <span className="badge">C</span>} {s.ri && <span className="badge">R</span>} {s.m && <span className="badge">M</span>}
                {s.stub && <span className="muted small"> · name only</span>}
              </td>
              <td>{s.l === 0 ? 'Cantrip' : s.l}</td><td>{s.s}</td><td className="small">{s.ct}</td>
              <td className="small muted">{s.cl.join(', ')}</td><td><span className="tag alt">{s.e}</span></td>
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
        <SpellPreview spell={fromLib(sel)} subtitle={`${sel.src ?? `${sel.e} SRD`} · ${sel.cl.join(', ')}`} onClose={() => setSel(null)}
          footer={<>
            {sel.stub && <span className="muted small grow">This entry is from the class list only. Add it, then paste the description or Fetch it.</span>}
            {have(sel.n)
              ? <span className="muted">Already in your spell list.</span>
              : <button className="btn primary" onClick={() => { const sp = add(sel); setSel(null); set({ drawer: { kind: 'spell', id: sp.id } }) }}>Add to my spells</button>}
          </>} />
      )}
      <Toast msg={toast.msg} />
    </Frame>
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
