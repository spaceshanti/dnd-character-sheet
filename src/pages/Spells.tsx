import { useMemo, useState } from 'react'
import { ABILITIES, SPELL_LEVEL_NAMES } from '../constants'
import { activeEffects, preparedCount, signed, spellStats } from '../calc'
import { newSpell, uid } from '../blank'
import { fromLib, LIB, LIB_CLASSES, LIB_SCHOOLS, searchLib, type LibSpell } from '../spellLib'
import { useChar, useStore, useUI } from '../store'
import { Frame, Modal, Num, Pips, Toast, useToast } from '../components/ui'
import type { Spell } from '../types'

type View = 'mine' | 'library' | string

export function SpellsPage() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const { chars, order, activeId } = useStore()
  const [view, setView] = useState<View>('mine')
  const fx = activeEffects(c)
  const ss = spellStats(c, fx)
  const others = order.filter((id) => id !== activeId)

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
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
      </div>

      {view === 'mine' && (
        <>
          <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'stretch' }}>
            <Frame tight style={{ minWidth: 190 }}>
              <div className="field-lbl">Spellcasting ability</div>
              <select value={c.spellAbility} onChange={(e) => patch((d) => { d.spellAbility = e.target.value as typeof c.spellAbility })} style={{ width: '100%', marginTop: 4 }}>
                <option value="">— none —</option>
                {ABILITIES.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
              </select>
            </Frame>
            <Stat label="Spell Save DC" value={ss.dc == null ? '—' : String(ss.dc)} />
            <Stat label="Spell Attack" value={ss.attack == null ? '—' : signed(ss.attack)} />
            <Stat label="Prepared" value={String(preparedCount(c))} />
            <Frame title="Spell Slots" tight style={{ flex: 1, minWidth: 420 }}>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 18px' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => {
                  const s = c.slots[l] ?? { total: 0, used: 0 }
                  return (
                    <div key={l} className="row" style={{ gap: 5 }}>
                      <b style={{ width: 22, fontFamily: 'var(--font-head)' }}>{l}</b>
                      <Num min={0} max={9} className="box-input" width={34} style={{ textAlign: 'center' }} value={s.total}
                        onChange={(n) => patch((d) => { d.slots[l] = { total: n, used: Math.min(d.slots[l]?.used ?? 0, n) } })} />
                      <Pips total={s.total} used={s.used} onChange={(u) => patch((d) => { d.slots[l].used = u })} />
                    </div>
                  )
                })}
              </div>
            </Frame>
          </div>
          <MySpells />
        </>
      )}
      {view === 'library' && <Library />}
      {others.includes(view) && <PeekSpells id={view} />}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="vbox" style={{ cursor: 'default', minWidth: 96 }}>
      <div className="v">{value}</div><div className="l">{label}</div>
    </div>
  )
}

/* ------------------------------------------------------------- my spells */

function SpellGroups({ spells, onOpen, onToggle, adder }: {
  spells: Spell[]
  onOpen: (s: Spell) => void
  onToggle?: (s: Spell) => void
  adder?: (level: number, name: string) => void
}) {
  const [adding, setAdding] = useState<number | null>(null)
  const levels = adder ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((l) => spells.some((s) => s.level === l))
  const c = useChar()
  return (
    <div className="spell-cols">
      {levels.map((l) => {
        const list = spells.filter((s) => s.level === l).sort((a, b) => a.name.localeCompare(b.name))
        if (adder && l > 0 && !list.length && !(c.slots[l]?.total > 0)) return null
        return (
          <Frame key={l} tight>
            <div className="lvl-head">
              <div className="lvl-badge">{l}</div>
              <b className="grow caps" style={{ fontSize: 12 }}>{SPELL_LEVEL_NAMES[l]}{l > 0 ? ' level' : ''}</b>
              {adder && <button className="btn sm icon" title="Add spell" onClick={() => setAdding(adding === l ? null : l)}>＋</button>}
            </div>
            {adding === l && adder && (
              <input autoFocus className="box-input" style={{ marginBottom: 6 }} placeholder="Spell name + Enter"
                onKeyDown={(e) => {
                  const v = (e.target as HTMLInputElement).value.trim()
                  if (e.key === 'Enter' && v) { adder(l, v); setAdding(null) }
                  if (e.key === 'Escape') setAdding(null)
                }} onBlur={() => setAdding(null)} />
            )}
            {list.length === 0 && <div className="muted small">—</div>}
            {list.map((s) => (
              <div key={s.id} className="spell-row" onClick={() => onOpen(s)}>
                {l > 0 && (
                  onToggle ? (
                    <button className={`pip ${s.prepared || s.alwaysPrepared ? 'on' : ''}`} title={s.alwaysPrepared ? 'Always prepared' : s.prepared ? 'Prepared' : 'Not prepared'}
                      onClick={(e) => { e.stopPropagation(); if (!s.alwaysPrepared) onToggle(s) }} style={s.alwaysPrepared ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : undefined} />
                  ) : <span className={`pip ${s.prepared ? 'on' : ''}`} />
                )}
                <span className="nm">{s.name || 'Unnamed'}</span>
                {s.concentration && <span className="badge" title="Concentration">C</span>}
                {s.ritual && <span className="badge" title="Ritual">R</span>}
                {s.effects.length > 0 && <span className="chip accent" style={{ padding: '0 5px', opacity: s.active ? 1 : 0.5 }} title="Linked to your sheet">{s.active ? 'on' : 'fx'}</span>}
                {!s.description && onToggle && <span className="muted" title="No description stored yet">…</span>}
              </div>
            ))}
          </Frame>
        )
      })}
    </div>
  )
}

function MySpells() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const set = useUI((s) => s.set)
  const [q, setQ] = useState('')
  const spells = c.spells.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <div className="row">
        <input className="box-input" style={{ width: 240 }} placeholder="search my spells…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted small">Click a spell to read its description. Click the circle to prepare it.</span>
      </div>
      <SpellGroups
        spells={spells}
        onOpen={(s) => set({ drawer: { kind: 'spell', id: s.id } })}
        onToggle={(s) => patch((d) => { const x = d.spells.find((y) => y.id === s.id); if (x) x.prepared = !x.prepared })}
        adder={(level, name) => {
          const sp = newSpell(level, name)
          sp.prepared = level === 0
          patch((d) => { d.spells.push(sp) })
          set({ drawer: { kind: 'spell', id: sp.id } })
        }}
      />
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
          {subtitle && <span className="muted small">{subtitle}</span>}
        </div>
        <div className="kv">
          {spell.castingTime && <><b>Casting time</b><span>{spell.castingTime}</span></>}
          {spell.range && <><b>Range</b><span>{spell.range}</span></>}
          {spell.components && <><b>Components</b><span>{spell.components}</span></>}
          {spell.duration && <><b>Duration</b><span>{spell.duration}</span></>}
        </div>
        <div className="prose">{spell.description || <span className="muted">No description stored.</span>}</div>
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
  const [edition, setEdition] = useState('2024')
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
          <option value="2024">2024 rules</option><option value="2014">2014 rules</option><option value="all">Both</option>
        </select>
        <span className="muted small">{results.length} spells</span>
      </div>
      <div className="muted small" style={{ marginBottom: 8 }}>
        This is the free SRD set, stored inside the app. For spells that aren't in it, add the spell yourself and paste the description (or use the wikidot link).
      </div>
      <table className="t">
        <thead><tr><th>Name</th><th style={{ width: 70 }}>Level</th><th>School</th><th>Time</th><th>Classes</th><th style={{ width: 52 }}>Rules</th><th style={{ width: 70 }} /></tr></thead>
        <tbody>
          {results.slice(0, limit).map((s) => (
            <tr key={s.n + s.e} className="hov" onClick={() => setSel(s)}>
              <td><b>{s.n}</b> {s.co && <span className="badge">C</span>} {s.ri && <span className="badge">R</span>}</td>
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
        <SpellPreview spell={fromLib(sel)} subtitle={`${sel.e} SRD · ${sel.cl.join(', ')}`} onClose={() => setSel(null)}
          footer={have(sel.n)
            ? <span className="muted">Already in your spell list.</span>
            : <button className="btn primary" onClick={() => { const sp = add(sel); setSel(null); set({ drawer: { kind: 'spell', id: sp.id } }) }}>Add to my spells</button>} />
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
      {other.spells.length === 0 ? <div className="empty">{other.name} has no spells stored.</div> : <SpellGroups spells={other.spells} onOpen={setSel} />}
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
