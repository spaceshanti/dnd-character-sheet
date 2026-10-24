import { ACTION_TYPES, RECHARGES } from '../constants'
import { WEAPON_NAMES } from '../data/gear'
import { newFeatureAction, newResource, newSpell, uid } from '../blank'
import { useChar, useStore, useUI } from '../store'
import { applyLib, bestLib } from '../spellLib'
import { Num, Pips, Select } from './ui'
import type { Character, Feature, FeatureAction, RestEffect, Resource } from '../types'

export const actionTypeName = (t: string) => ACTION_TYPES.find((a) => a.id === t)?.name ?? ''
export const left = (r: Resource) => Math.max(0, r.max - r.used)
const resName = (r: Resource) => r.name || 'Resource'
export const resLabel = (r: Resource) => (r.die ? `${resName(r)} (${r.die})` : resName(r))

/** Spend a feature action's cost. Returns a message for a toast, or '' if it's free. */
export function spendAction(c: Character, a: FeatureAction): string {
  const r = c.resources.find((x) => x.id === a.resourceId)
  if (!r) return ''
  if (left(r) < a.cost) return `Not enough ${resName(r)} left`
  useStore.getState().patch((d) => { const x = d.resources.find((y) => y.id === r.id); if (x) x.used = Math.min(x.max, x.used + a.cost) })
  const remaining = left(r) - a.cost
  return `${a.name || 'Used'}: spent ${a.cost} ${resName(r)} · ${remaining} left${r.die ? ` (roll ${r.die})` : ''}`
}

export function costText(c: Character, a: FeatureAction): string {
  const r = c.resources.find((x) => x.id === a.resourceId)
  return r ? `${a.cost} × ${resName(r)} · ${left(r)} left` : ''
}

/** Read view inside the feature drawer: its resources (with pips) and its actions (with Use). */
export function FeatureUsage({ f, onUsed }: { f: Feature; onUsed: (msg: string) => void }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const resources = c.resources.filter((r) => r.featureId === f.id)
  const spells = c.spells.filter((sp) => sp.grantedBy === f.id).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  if (!resources.length && !f.actions.length && !f.masteries.length && !f.restEffects.length && !spells.length) return null
  return (
    <div className="col" style={{ gap: 10 }}>
      {spells.length > 0 && (
        <div className="feat-res" style={{ flexWrap: 'wrap' }}>
          <b>Spells</b>
          {spells.map((sp) => (
            <button key={sp.id} className="chip accent" style={{ cursor: 'pointer' }} onClick={() => useUI.getState().set({ drawer: { kind: 'spell', id: sp.id } })}
              title="Always prepared · click to read">
              {sp.name}{sp.level === 0 ? ' (cantrip)' : ` (${sp.level})`}
            </button>
          ))}
        </div>
      )}
      {f.restEffects.length > 0 && (
        <div className="feat-res" style={{ flexWrap: 'wrap' }}>
          <b>On rest</b>
          {f.restEffects.map((e) => <span key={e.id} className="chip">{restText(e)}</span>)}
        </div>
      )}
      {f.masteries.length > 0 && (
        <div className="feat-res">
          <b className="grow">Weapon mastery</b>
          <span className="small">{f.masteries.includes('*') ? 'Any weapon' : f.masteries.join(', ')}</span>
        </div>
      )}
      {resources.map((r) => (
        <div key={r.id} className="feat-res">
          <b className="grow">{resName(r)}{r.die && <span className="muted"> · {r.die}</span>}</b>
          <Pips total={r.max} used={r.used} onChange={(u) => patch((d) => { const x = d.resources.find((y) => y.id === r.id); if (x) x.used = u })} />
          <span className="muted small">{left(r)}/{r.max}</span>
        </div>
      ))}
      {f.actions.map((a) => (
        <div key={a.id} className="feat-act">
          <div className="row">
            <b className="grow">{a.name || 'Unnamed action'}</b>
            {a.actionType !== 'none' && <span className="chip accent">{actionTypeName(a.actionType)}</span>}
            <button className="btn sm primary" onClick={() => { const m = spendAction(c, a); onUsed(m || `${a.name || 'Action'} used`) }}>Use</button>
          </div>
          {costText(c, a) && <div className="small muted">Costs {costText(c, a)}</div>}
          {a.description && <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{a.description}</div>}
        </div>
      ))}
    </div>
  )
}

/** Edit view: the feature's own resources and actions. */
export function FeatureUsageEditor({ f }: { f: Feature }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const resources = c.resources.filter((r) => r.featureId === f.id)
  const upF = (fn: (x: Feature) => void) => patch((d) => { const x = d.features.find((y) => y.id === f.id); if (x) fn(x) })
  const upA = (id: string, fn: (a: FeatureAction) => void) => upF((x) => { const a = x.actions.find((y) => y.id === id); if (a) fn(a) })
  const upR = (id: string, fn: (r: Resource) => void) => patch((d) => { const r = d.resources.find((y) => y.id === id); if (r) fn(r) })
  // actions may spend this feature's resources or any other resource on the sheet
  const resOptions = [{ id: '', name: 'Free (no cost)' }, ...c.resources.map((r) => ({ id: r.id, name: resLabel(r) }))]

  return (
    <div className="col" style={{ gap: 12 }}>
      <div>
        <div className="row" style={{ marginBottom: 4 }}>
          <div className="field-lbl grow">Resources from this feature</div>
          <button className="btn sm" onClick={() => patch((d) => { d.resources.push(newResource(f.id, resources.length ? '' : `${f.name || 'Feature'} uses`)) })}>＋ Resource</button>
        </div>
        {resources.length === 0 && <div className="muted small">e.g. Psionic Energy Dice, Rage, Channel Divinity. They also appear under Class Resources.</div>}
        {resources.map((r) => (
          <div key={r.id} className="fx-row feat-res-edit">
            <input className="box-input grow" style={{ minWidth: 120 }} placeholder="Resource name" value={r.name} onChange={(e) => upR(r.id, (x) => { x.name = e.target.value })} />
            <span className="small">max</span>
            <Num min={0} max={999} className="box-input" width={44} value={r.max} onChange={(n) => upR(r.id, (x) => { x.max = n; x.used = Math.min(x.used, n) })} />
            <input className="box-input" style={{ width: 52 }} placeholder="die" title="Optional die size, e.g. d8" value={r.die} onChange={(e) => upR(r.id, (x) => { x.die = e.target.value })} />
            <Select value={r.recharge} onChange={(v) => upR(r.id, (x) => { x.recharge = v })} options={RECHARGES} />
            <button className="btn icon sm" title="Remove resource" onClick={() => patch((d) => {
              d.resources = d.resources.filter((y) => y.id !== r.id)
              for (const ft of d.features) for (const a of ft.actions) if (a.resourceId === r.id) a.resourceId = ''
            })}>✕</button>
          </div>
        ))}
      </div>

      <MasteryEditor f={f} />
      <SpellGrantEditor f={f} />
      <RestEditor f={f} />

      <div>
        <div className="row" style={{ marginBottom: 4 }}>
          <div className="field-lbl grow">Actions this feature gives</div>
          <button className="btn sm" onClick={() => upF((x) => { x.actions.push({ ...newFeatureAction(), resourceId: resources[0]?.id ?? '' }) })}>＋ Action</button>
        </div>
        {f.actions.length === 0 && <div className="muted small">e.g. Telekinetic Propel (Bonus Action, 1 die). Each one shows on the Actions page with a Use button.</div>}
        {f.actions.map((a) => (
          <div key={a.id} className="feat-act-edit">
            <div className="fx-row">
              <input className="box-input grow" style={{ minWidth: 130 }} placeholder="Action name" value={a.name} onChange={(e) => upA(a.id, (x) => { x.name = e.target.value })} />
              <Select value={a.actionType} onChange={(v) => upA(a.id, (x) => { x.actionType = v })} options={ACTION_TYPES} />
              <button className="btn icon sm" title="Remove action" onClick={() => upF((x) => { x.actions = x.actions.filter((y) => y.id !== a.id) })}>✕</button>
            </div>
            <div className="fx-row">
              <span className="small">Costs</span>
              <Num min={0} max={99} className="box-input" width={40} value={a.cost} onChange={(n) => upA(a.id, (x) => { x.cost = n })} />
              <Select value={a.resourceId} onChange={(v) => upA(a.id, (x) => { x.resourceId = v })} options={resOptions} />
            </div>
            <textarea className="box-input" rows={2} placeholder="Short description (optional)" value={a.description} onChange={(e) => upA(a.id, (x) => { x.description = e.target.value })} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Which weapon kinds this feature lets you use mastery properties with (e.g. Fighter: Weapon Mastery). */
function MasteryEditor({ f }: { f: Feature }) {
  const patch = useStore((s) => s.patch)
  const set = (list: string[]) => patch((d) => { const x = d.features.find((y) => y.id === f.id); if (x) x.masteries = list })
  const any = f.masteries.includes('*')
  const options = WEAPON_NAMES.filter((n) => !f.masteries.includes(n))
  return (
    <div>
      <div className="row" style={{ marginBottom: 4 }}>
        <div className="field-lbl grow">Weapon mastery</div>
        {f.masteries.length > 0 && <span className="muted small">{any ? 'any weapon' : `${f.masteries.length} kind${f.masteries.length > 1 ? 's' : ''}`}</span>}
      </div>
      {f.masteries.length === 0 && <div className="muted small" style={{ marginBottom: 4 }}>For features like Weapon Mastery: choose the weapon kinds whose mastery property you can use.</div>}
      <div className="wtags" style={{ marginBottom: 5 }}>
        {f.masteries.map((m) => (
          <span key={m} className="wtag mastery">{m === '*' ? 'Any weapon' : m}<button type="button" title="Remove" onClick={() => set(f.masteries.filter((x) => x !== m))}>✕</button></span>
        ))}
      </div>
      {!any && (
        <div className="row" style={{ gap: 4 }}>
          <select value="" onChange={(e) => { if (e.target.value) set([...f.masteries, e.target.value]) }}>
            <option value="">＋ Add a weapon kind…</option>
            {options.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button className="btn sm" onClick={() => set(['*'])} title="Mastery with every weapon">Any weapon</button>
        </div>
      )}
    </div>
  )
}

export const restText = (e: RestEffect) =>
  `${e.rest === 'long' ? 'Long' : 'Short'} rest: ${e.kind === 'inspiration' ? 'Heroic Inspiration' : e.kind === 'tempHp' ? `${e.value} temp HP` : e.note || 'reminder'}`

/** Things this feature does on a rest (Resourceful: Heroic Inspiration on a long rest). */
function RestEditor({ f }: { f: Feature }) {
  const patch = useStore((s) => s.patch)
  const upF = (fn: (x: Feature) => void) => patch((d) => { const x = d.features.find((y) => y.id === f.id); if (x) fn(x) })
  const upE = (id: string, fn: (e: RestEffect) => void) => upF((x) => { const e = x.restEffects.find((y) => y.id === id); if (e) fn(e) })
  return (
    <div>
      <div className="row" style={{ marginBottom: 4 }}>
        <div className="field-lbl grow">On a rest</div>
        <button className="btn sm" onClick={() => upF((x) => { x.restEffects.push({ id: uid(), rest: 'long', kind: 'inspiration', value: 0, note: '' }) })}>＋ Rest effect</button>
      </div>
      {f.restEffects.length === 0 && <div className="muted small">e.g. Resourceful: gain Heroic Inspiration on a long rest. Applied when you press Long / Short rest.</div>}
      {f.restEffects.map((e) => (
        <div key={e.id} className="fx-row feat-res-edit">
          <Select value={e.rest} onChange={(v) => upE(e.id, (x) => { x.rest = v })} options={[{ id: 'long', name: 'Long rest' }, { id: 'short', name: 'Short rest' }]} />
          <Select value={e.kind} onChange={(v) => upE(e.id, (x) => { x.kind = v })}
            options={[{ id: 'inspiration', name: 'Gain Heroic Inspiration' }, { id: 'tempHp', name: 'Gain temp HP' }, { id: 'reminder', name: 'Show a reminder' }]} />
          {e.kind === 'tempHp' && <Num min={0} className="box-input" width={48} value={e.value} onChange={(n) => upE(e.id, (x) => { x.value = n })} />}
          {e.kind === 'reminder' && <input className="box-input grow" placeholder="e.g. Swap a Psionic Discipline" value={e.note} onChange={(ev) => upE(e.id, (x) => { x.note = ev.target.value })} />}
          <button className="btn icon sm" title="Remove" onClick={() => upF((x) => { x.restEffects = x.restEffects.filter((y) => y.id !== e.id) })}>✕</button>
        </div>
      ))}
    </div>
  )
}

/** Spells and cantrips the feature grants: added to the spell book as always prepared. */
function SpellGrantEditor({ f }: { f: Feature }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const granted = c.spells.filter((sp) => sp.grantedBy === f.id).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  const add = (input: HTMLInputElement, levelSel: HTMLSelectElement) => {
    const name = input.value.trim()
    if (!name) return
    const lib = bestLib(name)
    const level = lib && !lib.stub ? lib.l : +levelSel.value
    let sp = newSpell(level, name)
    if (lib) sp = { ...applyLib(sp, lib), level }
    sp = { ...sp, prepared: true, alwaysPrepared: true, grantedBy: f.id }
    patch((d) => { d.spells.push(sp) })
    input.value = ''
  }
  return (
    <div>
      <div className="field-lbl" style={{ marginBottom: 4 }}>Spells from this feature</div>
      {granted.length === 0 && <div className="muted small" style={{ marginBottom: 4 }}>e.g. Spellfire Spark → Sacred Flame. They go in your spell book as always prepared.</div>}
      <div className="wtags" style={{ marginBottom: 5 }}>
        {granted.map((sp) => (
          <span key={sp.id} className="wtag mastery">{sp.name}{sp.level === 0 ? ' · cantrip' : ` · ${sp.level}`}
            <button type="button" title="Remove from the spell book" onClick={() => patch((d) => { d.spells = d.spells.filter((y) => y.id !== sp.id) })}>✕</button>
          </span>
        ))}
      </div>
      <form className="row" style={{ gap: 4 }} onSubmit={(e) => {
        e.preventDefault()
        const form = e.currentTarget
        add(form.elements.namedItem('spell') as HTMLInputElement, form.elements.namedItem('lvl') as HTMLSelectElement)
      }}>
        <input name="spell" className="box-input grow" placeholder="Spell name + Enter (fills from the library)" />
        <select name="lvl" defaultValue="0" title="Level, if it isn't in the library">
          <option value="0">Cantrip</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => <option key={l} value={l}>Level {l}</option>)}
        </select>
        <button className="btn sm" type="submit">Add</button>
      </form>
    </div>
  )
}
