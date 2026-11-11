import { useRef, useState, type FocusEvent } from 'react'
import { duplicates, fillAvailable, fillSnapshot, hasFeaturesFor, planFill, undoFill, type Applied, type FillKind, type FillPlan } from '../autofill'
import { choiceOptions, choicePicks, defaultAnswer, type Answers, type PlanChoice } from '../ak5e/fill'
import { useChar, useStore } from '../store'
import { Popover } from './ui'

const KIND_NAME: Record<FillKind, string> = { class: 'class', subclass: 'subclass', species: 'species', background: 'background', nationality: 'nationality' }
const RECHARGE: Record<string, string> = { long: 'long rest', short: 'short rest', shortOne: '1 per short rest', dawn: 'dawn', none: 'not on a rest' }

/**
 * Offers to fill in features when you finish typing a class, subclass / branch, species, background or nationality —
 * only when the character has none of that kind yet (so fixing the spelling later doesn't ask again). Choices a
 * feature needs (spellcasting ability, skills, Ancient Versatility…) are asked in the same box.
 */
export function useAutoFill() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const typedAt = useRef<Record<string, string>>({})
  const dismissed = useRef(new Set<string>())
  const [offer, setOffer] = useState<{ plan: FillPlan; anchor: HTMLElement; label: string; answers: Answers } | null>(null)
  const [done, setDone] = useState<{ plan: FillPlan; added: Applied; anchor: HTMLElement; before: ReturnType<typeof fillSnapshot> } | null>(null)

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
    setOffer({ plan, anchor, label, answers: Object.fromEntries(plan.choices.map((ch) => [ch.key, defaultAnswer(ch.def)])) })
  }

  const accept = () => {
    if (!offer) return
    const before = fillSnapshot(c)
    let added: Applied = { features: [], resources: [], spells: [] }
    patch((d) => { added = offer.plan.apply(d, offer.answers) })
    setDone({ plan: offer.plan, added, anchor: offer.anchor, before })
    setOffer(null)
  }
  const decline = () => {
    if (offer) dismissed.current.add(`${offer.plan.kind}:${offer.plan.name}`)
    setOffer(null)
  }
  const answer = (key: string, i: number, v: string) => setOffer((o) => {
    if (!o) return o
    const cur = [...(o.answers[key] ?? [])]
    cur[i] = v
    return { ...o, answers: { ...o.answers, [key]: cur } }
  })

  const popover = offer ? (
    <Popover anchor={offer.anchor} onClose={decline} width={420}>
      <div className="fill-offer">
        <b>Fill in {offer.plan.name} {offer.label === 'Branch' ? 'branch ' : ''}features?</b>
        <div className="small muted" style={{ margin: '4px 0 6px' }}>
          Up to level {c.level}, from {c.system === 'ak5e' ? 'the Arknights 5e book' : 'the 2024 rules (SRD 5.2.1)'}, linked up with their uses and actions.
        </div>
        <ul className="fill-list">
          {offer.plan.features.map((f) => {
            const rs = offer.plan.resources.filter((x) => x.featureId === f.id)
            const acts = [...new Set([f.actionType, ...f.actions.map((a) => a.actionType)].filter((t) => t !== 'none'))]
            return (
              <li key={f.id}>
                {f.name}
                {rs.map((r) => <span key={r.id} className="chip" title={r.name}>{r.name !== f.name ? `${r.name}: ` : ''}{r.max}{r.die ? ` × ${r.die}` : ''} / {RECHARGE[r.recharge] ?? r.recharge}</span>)}
                {acts.map((t) => <span key={t} className="chip">{t === 'bonus' ? 'bonus action' : t}</span>)}
                {f.effects.length > 0 && <span className="chip" title={f.effects.map((e) => `${e.target} ${e.type}`).join(', ')}>effects</span>}
                {f.restEffects.length > 0 && <span className="chip" title={f.restEffects.map((r) => r.note).join('\n')}>rest reminder</span>}
              </li>
            )
          })}
        </ul>
        {offer.plan.choices.length > 0 && (
          <div className="fill-choices">
            <div className="field-lbl">Choose</div>
            {offer.plan.choices.map((ch) => <ChoiceRow key={ch.key} ch={ch} value={offer.answers[ch.key] ?? []} onChange={(i, v) => answer(ch.key, i, v)} />)}
          </div>
        )}
        {(offer.plan.spells.length > 0 || offer.plan.notes.length > 0) && (
          <div className="small" style={{ marginTop: 6 }}>
            {offer.plan.spells.length > 0 && <>Always prepared: {offer.plan.spells.map((s) => s.name).join(', ')}. </>}
            {offer.plan.notes.length > 0 && <>Also sets {[...new Set(offer.plan.notes)].join(', ')}.</>}
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
          Added {done.added.features.length} {KIND_NAME[done.plan.kind]} feature{done.added.features.length === 1 ? '' : 's'}
          {done.added.resources.length ? `, ${done.added.resources.length} resource${done.added.resources.length === 1 ? '' : 's'}` : ''}
          {done.added.spells.length ? `, ${done.added.spells.length} spell${done.added.spells.length === 1 ? '' : 's'}` : ''}.
        </span>
        <button className="btn sm" onClick={() => { patch((d) => undoFill(d, done.added, done.before)); setDone(null) }}>Undo</button>
      </div>
    </Popover>
  ) : null

  return { focus, blur, popover }
}

/** one choice: a dropdown per pick (the same option can't be picked twice) */
function ChoiceRow({ ch, value, onChange }: { ch: PlanChoice; value: string[]; onChange: (i: number, v: string) => void }) {
  const opts = choiceOptions(ch.def)
  const picks = choicePicks(ch.def)
  const prompt = 'prompt' in ch.def ? ch.def.prompt : ch.feature
  return (
    <div className="fill-choice">
      <span className="small">{prompt}{prompt === ch.feature || prompt.startsWith(ch.feature) ? '' : <span className="muted"> · {ch.feature}</span>}</span>
      <span className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
        {Array.from({ length: picks }, (_, i) => (
          <select key={i} value={value[i] ?? ''} onChange={(e) => onChange(i, e.target.value)}>
            {opts.map((o) => <option key={o.id} value={o.id} disabled={value.some((v, j) => j !== i && v === o.id)}>{o.label}</option>)}
          </select>
        ))}
      </span>
    </div>
  )
}
