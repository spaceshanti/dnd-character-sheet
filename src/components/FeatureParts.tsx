import { ACTION_TYPES, RECHARGES } from '../constants'
import { newFeatureAction, newResource } from '../blank'
import { useChar, useStore } from '../store'
import { Num, Pips, Select } from './ui'
import type { Character, Feature, FeatureAction, Resource } from '../types'

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
  if (!resources.length && !f.actions.length) return null
  return (
    <div className="col" style={{ gap: 10 }}>
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
