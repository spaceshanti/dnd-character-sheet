import { useState, type ReactNode } from 'react'
import { ACTION_TYPES, RECHARGES } from '../constants'
import { WEAPON_NAMES } from '../data/gear'
import { newEffect, newFeatureAction, newResource, newSpell, uid } from '../blank'
import { useChar, useStore, useUI } from '../store'
import { applyLib, bestLib } from '../spellLib'
import { EffectsEditor, Num, Pips, Select, Switch, DieSlot } from './ui'
import type { ActionMod, Character, Feature, FeatureAction, RestEffect, Resource } from '../types'

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

/** Additions other features make to an action, e.g. Telekinetic Techniques on Telekinetic Propel. */
export function modsFor(c: Character, actionId: string): { from: string; text: string }[] {
  return c.features.flatMap((f) => (f.active ? f.actionMods.filter((m) => m.actionId === actionId).map((m) => ({ from: f.name || 'Feature', text: m.text })) : []))
}

/** "Psionic Power › Telekinetic Propel" for every action on the sheet (optionally leaving one feature out) */
export function actionChoices(c: Character, exceptFeatureId = '') {
  return c.features.filter((f) => f.id !== exceptFeatureId).flatMap((f) => f.actions.map((a) => ({ id: a.id, name: `${f.name || 'Feature'} › ${a.name || 'action'}` })))
}

export const restText = (e: RestEffect) =>
  `${e.rest === 'long' ? 'Long' : 'Short'} rest: ${e.kind === 'inspiration' ? 'Heroic Inspiration' : e.kind === 'tempHp' ? `${e.value} temp HP` : e.note || 'reminder'}`

/** Read view: granted spells, rest effects, weapon mastery, resources (optional) and actions with Use buttons. */
export function FeatureUsage({ f, onUsed, showResources = true }: { f: Feature; onUsed: (msg: string) => void; showResources?: boolean }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const resources = showResources ? c.resources.filter((r) => r.featureId === f.id) : []
  const spells = c.spells.filter((sp) => sp.grantedBy === f.id).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  if (!resources.length && !f.actions.length && !f.masteries.length && !f.restEffects.length && !spells.length && !f.actionMods.length) return null
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
          {modsFor(c, a.id).map((m, i) => <div key={i} className="act-mod"><b>+ {m.from}:</b> {m.text}</div>)}
        </div>
      ))}
      {f.actionMods.filter((m) => m.actionId).map((m) => (
        <div key={m.id} className="feat-res" style={{ flexWrap: 'wrap' }}>
          <b>Adds to {actionChoices(c).find((x) => x.id === m.actionId)?.name ?? 'a removed action'}</b>
          <span className="small">{m.text}</span>
        </div>
      ))}
    </div>
  )
}

/** A folding section of the feature editor; starts open when it has something in it. */
function Fold({ title, count, onAdd, addLabel, hint, children }: {
  title: string; count: number; onAdd: () => void; addLabel: string; hint: string; children: ReactNode
}) {
  const [open, setOpen] = useState(count > 0)
  return (
    <details className="item-sec" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <span className="grow">{title}{count > 0 && <span className="muted"> · {count}</span>}</span>
        <button className="btn sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(); setOpen(true) }}>＋ {addLabel}</button>
      </summary>
      <div className="col" style={{ gap: 6, paddingTop: 6 }}>
        {count === 0 && <div className="muted small">{hint}</div>}
        {children}
      </div>
    </details>
  )
}

/** Edit view: the feature's resources, actions and rest effects, each folded away until used. */
export function FeatureUsageEditor({ f }: { f: Feature }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const resources = c.resources.filter((r) => r.featureId === f.id)
  const upF = (fn: (x: Feature) => void) => patch((d) => { const x = d.features.find((y) => y.id === f.id); if (x) fn(x) })
  const upA = (id: string, fn: (a: FeatureAction) => void) => upF((x) => { const a = x.actions.find((y) => y.id === id); if (a) fn(a) })
  const upR = (id: string, fn: (r: Resource) => void) => patch((d) => { const r = d.resources.find((y) => y.id === id); if (r) fn(r) })
  const upE = (id: string, fn: (e: RestEffect) => void) => upF((x) => { const e = x.restEffects.find((y) => y.id === id); if (e) fn(e) })
  // actions may spend this feature's resources or any other resource on the sheet
  const resOptions = [{ id: '', name: 'Free (no cost)' }, ...c.resources.map((r) => ({ id: r.id, name: resLabel(r) }))]
  // a die only for resources that have one; ⚙ offers adding one
  const [dieFor, setDieFor] = useState('')

  return (
    <div className="col" style={{ gap: 8 }}>
      <Fold title="Resources" count={resources.length} addLabel="Resource" hint="e.g. Psionic Energy Dice, Rage, Channel Divinity. Tracked under Class Resources."
        onAdd={() => patch((d) => { d.resources.push(newResource(f.id, resources.length ? '' : `${f.name || 'Feature'} uses`)) })}>
        {resources.map((r) => (
          <div key={r.id} className="fx-row feat-res-edit">
            <input className="box-input grow" style={{ minWidth: 120 }} placeholder="Resource name" value={r.name} onChange={(e) => upR(r.id, (x) => { x.name = e.target.value })} />
            <span className="small">max</span>
            <Num min={0} max={999} className="box-input" width={44} value={r.max} onChange={(n) => upR(r.id, (x) => { x.max = n; x.used = Math.min(x.used, n) })} />
            {(r.die || dieFor === r.id) && <DieSlot value={r.die} width={52} onChange={(v) => upR(r.id, (x) => { x.die = v })} />}
            <Select value={r.recharge} onChange={(v) => upR(r.id, (x) => { x.recharge = v })} options={RECHARGES} />
            {!r.die && dieFor !== r.id && <button className="btn icon sm ghost" title="Give this resource a die (e.g. Psionic Energy Dice: d6)" onClick={() => setDieFor(r.id)}>⚙</button>}
            <button className="btn icon sm" title="Remove resource" onClick={() => patch((d) => {
              d.resources = d.resources.filter((y) => y.id !== r.id)
              for (const ft of d.features) for (const a of ft.actions) if (a.resourceId === r.id) a.resourceId = ''
            })}>✕</button>
          </div>
        ))}
      </Fold>

      <Fold title="Actions" count={f.actions.length} addLabel="Action" hint="e.g. Telekinetic Propel (Bonus Action, 1 die). Each one shows on the Actions page with a Use button."
        onAdd={() => upF((x) => { x.actions.push({ ...newFeatureAction(), resourceId: resources[0]?.id ?? '' }) })}>
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
      </Fold>

      <Fold title="On a rest" count={f.restEffects.length} addLabel="Rest effect" hint="e.g. Resourceful: gain Heroic Inspiration on a long rest. Applied when you press Long / Short rest."
        onAdd={() => upF((x) => { x.restEffects.push({ id: uid(), rest: 'long', kind: 'inspiration', value: 0, note: '' }) })}>
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
      </Fold>
    </div>
  )
}

/**
 * "What this changes on my sheet": stat / skill links, spells it grants and weapon mastery, all in one place,
 * added from a single menu.
 */
export function FeatureChangesEditor({ f }: { f: Feature }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const [addingSpell, setAddingSpell] = useState(false)
  const upF = (fn: (x: Feature) => void) => patch((d) => { const x = d.features.find((y) => y.id === f.id); if (x) fn(x) })
  const spells = c.spells.filter((sp) => sp.grantedBy === f.id).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  const nothing = !f.effects.some((e) => e.formula === undefined) && !spells.length && !f.masteries.length && !addingSpell && !f.actionMods.length
  const choices = actionChoices(c, f.id)
  const upM = (id: string, fn: (m: ActionMod) => void) => upF((x) => { const m = x.actionMods.find((y) => y.id === id); if (m) fn(m) })

  const addSpell = (name: string, fallbackLevel: number) => {
    const lib = bestLib(name)
    const level = lib && !lib.stub ? lib.l : fallbackLevel
    let sp = newSpell(level, name)
    if (lib) sp = { ...applyLib(sp, lib), level }
    sp = { ...sp, prepared: true, alwaysPrepared: true, grantedBy: f.id }
    patch((d) => { d.spells.push(sp) })
  }
  const add = (what: string) => {
    if (what === 'effect') upF((x) => { x.effects.push(newEffect()) })
    if (what === 'spell') setAddingSpell(true)
    if (what === 'mastery') upF((x) => { x.masteries.push(WEAPON_NAMES.find((n) => !x.masteries.includes(n)) ?? '*') })
    if (what === 'actionmod') upF((x) => { x.actionMods.push({ id: uid(), actionId: choices[0]?.id ?? '', text: '' }) })
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 4 }}>
        <div className="field-lbl grow">What this changes on my sheet</div>
        <label className="row small"><Switch on={f.active} onChange={(b) => upF((x) => { x.active = b })} /> Applied</label>
      </div>
      <div className="fx">
        {nothing && <div className="muted small" style={{ marginBottom: 6 }}>Nothing yet. Add a bonus or proficiency, a spell it grants, weapon mastery, or something it adds to another feature's action.</div>}
        <EffectsEditor bare effects={f.effects.filter((e) => e.formula === undefined)}
          onChange={(e) => upF((x) => { x.effects = [...e, ...x.effects.filter((y) => y.formula !== undefined)] })} />

        {spells.map((sp) => (
          <div key={sp.id} className="fx-row change-row">
            <span className="change-kind">Spell</span>
            <b className="grow">{sp.name}</b>
            <span className="muted small">{sp.level === 0 ? 'cantrip' : `level ${sp.level}`} · always prepared</span>
            <button className="btn icon sm" title="Remove from the spell book" onClick={() => patch((d) => { d.spells = d.spells.filter((y) => y.id !== sp.id) })}>✕</button>
          </div>
        ))}
        {addingSpell && (
          <form className="fx-row change-row" onSubmit={(e) => {
            e.preventDefault()
            const form = e.currentTarget
            const input = form.elements.namedItem('spell') as HTMLInputElement
            if (input.value.trim()) addSpell(input.value.trim(), +(form.elements.namedItem('lvl') as HTMLSelectElement).value)
            input.value = ''
            setAddingSpell(false)
          }}>
            <span className="change-kind">Spell</span>
            <input name="spell" autoFocus className="box-input grow" placeholder="Spell name + Enter (fills from the library)" />
            <select name="lvl" defaultValue="0" title="Level, if it isn't in the library">
              <option value="0">Cantrip</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => <option key={l} value={l}>Level {l}</option>)}
            </select>
            <button className="btn sm" type="submit">Add</button>
            <button className="btn icon sm" type="button" title="Cancel" onClick={() => setAddingSpell(false)}>✕</button>
          </form>
        )}

        {f.masteries.map((m, i) => (
          <div key={`${m}-${i}`} className="fx-row change-row">
            <span className="change-kind">Mastery</span>
            <select value={m} onChange={(e) => upF((x) => { x.masteries[i] = e.target.value })}>
              <option value="*">Any weapon</option>
              {WEAPON_NAMES.filter((n) => n === m || !f.masteries.includes(n)).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="muted small grow">can use this weapon's mastery property</span>
            <button className="btn icon sm" title="Remove" onClick={() => upF((x) => { x.masteries.splice(i, 1) })}>✕</button>
          </div>
        ))}

        {f.actionMods.map((m) => (
          <div key={m.id} className="fx-row change-row">
            <span className="change-kind">Adds to</span>
            {choices.length ? (
              <select value={m.actionId} onChange={(e) => upM(m.id, (x) => { x.actionId = e.target.value })}>
                {!choices.some((ch) => ch.id === m.actionId) && <option value="">Choose an action…</option>}
                {choices.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
              </select>
            ) : <span className="muted small">No other feature has actions yet</span>}
            <input className="box-input grow" style={{ minWidth: 160 }} placeholder="What it adds, e.g. Boost / Disorient / Telekinetic Bolt" value={m.text}
              onChange={(e) => upM(m.id, (x) => { x.text = e.target.value })} />
            <button className="btn icon sm" title="Remove" onClick={() => upF((x) => { x.actionMods = x.actionMods.filter((y) => y.id !== m.id) })}>✕</button>
          </div>
        ))}

        <select className="add-change" value="" onChange={(e) => { add(e.target.value); e.target.value = '' }}>
          <option value="">＋ Add…</option>
          <option value="effect">Bonus / advantage / proficiency</option>
          <option value="spell">A spell or cantrip</option>
          <option value="mastery">Weapon mastery</option>
          <option value="actionmod">Add onto another feature's action</option>
        </select>
      </div>
    </div>
  )
}
