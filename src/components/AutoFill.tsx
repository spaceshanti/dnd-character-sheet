import { useRef, useState, type FocusEvent } from 'react'
import { duplicates, fillAvailable, fillSnapshot, hasFeaturesFor, planFill, undoFill, type FillKind, type FillPlan } from '../autofill'
import { useChar, useStore } from '../store'
import { Popover } from './ui'

const KIND_NAME: Record<FillKind, string> = { class: 'class', subclass: 'subclass', species: 'species', background: 'background', nationality: 'nationality' }

/**
 * Offers to fill in features when you finish typing a class, subclass / branch, species, background or nationality —
 * only when the character has none of that kind yet (so fixing the spelling later doesn't ask again).
 */
export function useAutoFill() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const typedAt = useRef<Record<string, string>>({})
  const dismissed = useRef(new Set<string>())
  const [offer, setOffer] = useState<{ plan: FillPlan; anchor: HTMLElement; label: string } | null>(null)
  const [done, setDone] = useState<{ plan: FillPlan; anchor: HTMLElement; before: ReturnType<typeof fillSnapshot> } | null>(null)

  const focus = (kind: FillKind) => () => { typedAt.current[kind] = currentValue(kind) }
  const currentValue = (kind: FillKind) => (kind === 'class' ? c.className : kind === 'subclass' ? c.subclass : kind === 'species' ? c.species : kind === 'background' ? c.background : c.nationality)

  const blur = (kind: FillKind, label: string) => (e: FocusEvent<HTMLInputElement>) => {
    const value = e.target.value.trim()
    if (!value || value === typedAt.current[kind]?.trim() || !fillAvailable(c) || hasFeaturesFor(c, kind)) return
    const plan = planFill(c, kind, value)
    const key = `${kind}:${plan?.name}`
    if (!plan || !plan.features.length || dismissed.current.has(key) || duplicates(c, plan)) return
    const anchor = (e.target.closest('.field') as HTMLElement) ?? e.target
    setDone(null)
    setOffer({ plan, anchor, label })
  }

  const accept = () => {
    if (!offer) return
    const before = fillSnapshot(c)
    patch((d) => offer.plan.apply(d))
    setDone({ plan: offer.plan, anchor: offer.anchor, before })
    setOffer(null)
  }
  const decline = () => {
    if (offer) dismissed.current.add(`${offer.plan.kind}:${offer.plan.name}`)
    setOffer(null)
  }

  const popover = offer ? (
    <Popover anchor={offer.anchor} onClose={decline} width={380}>
      <div className="fill-offer">
        <b>Fill in {offer.plan.name} {offer.label === 'Branch' ? 'branch ' : ''}features?</b>
        <div className="small muted" style={{ margin: '4px 0 6px' }}>
          Up to level {c.level}, from {c.system === 'ak5e' ? 'the Arknights 5e book' : 'the 2024 rules (SRD 5.2.1)'} — linked up with their resources and actions.
        </div>
        <ul className="fill-list">
          {offer.plan.features.map((f) => {
            const r = offer.plan.resources.find((x) => x.featureId === f.id)
            const acts = f.actions.length ? f.actions[0].actionType : f.actionType
            return (
              <li key={f.id}>
                {f.name}
                {r && <span className="chip">{r.max}{r.die ? ` × ${r.die}` : ''} / {r.recharge === 'long' || r.recharge === 'dawn' ? 'long rest' : 'short rest'}</span>}
                {acts !== 'none' && <span className="chip">{acts === 'bonus' ? 'bonus action' : acts}</span>}
              </li>
            )
          })}
        </ul>
        {(offer.plan.spells.length > 0 || offer.plan.notes.length > 0) && (
          <div className="small" style={{ marginTop: 6 }}>
            {offer.plan.spells.length > 0 && <>Always prepared: {offer.plan.spells.map((s) => s.name).join(', ')}. </>}
            {offer.plan.notes.length > 0 && <>Also sets {offer.plan.notes.join(', ')}.</>}
          </div>
        )}
        <div className="row" style={{ gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
          <button className="btn sm ghost" onClick={decline}>No thanks</button>
          <button className="btn sm primary" onClick={accept}>Fill in</button>
        </div>
      </div>
    </Popover>
  ) : done ? (
    <Popover anchor={done.anchor} onClose={() => setDone(null)} width={320}>
      <div className="row" style={{ gap: 8 }}>
        <span className="grow small">
          Added {done.plan.features.length} {KIND_NAME[done.plan.kind]} feature{done.plan.features.length === 1 ? '' : 's'}
          {done.plan.resources.length ? `, ${done.plan.resources.length} resource${done.plan.resources.length === 1 ? '' : 's'}` : ''}
          {done.plan.spells.length ? `, ${done.plan.spells.length} spell${done.plan.spells.length === 1 ? '' : 's'}` : ''}.
        </span>
        <button className="btn sm" onClick={() => { patch((d) => undoFill(d, done.plan, done.before)); setDone(null) }}>Undo</button>
      </div>
    </Popover>
  ) : null

  return { focus, blur, popover }
}
