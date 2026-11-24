import { useRef, useState, type FocusEvent } from 'react'
import { duplicates, fillAvailable, fillSnapshot, hasFeaturesFor, planFill, undoFill, type Applied, type FillKind, type FillPlan } from '../autofill'
import { bookmarkRules } from '../ruleMarks'
import { useChar, useStore } from '../store'
import { Popover } from './ui'

const KIND_NAME: Record<FillKind, string> = { class: 'Class', subclass: 'Subclass', species: 'Species', background: 'Background', nationality: 'Nationality' }

/**
 * Offers to lay out a class, subclass / branch, species, background or nationality when you finish typing it (only
 * when the character has nothing of that kind yet, so fixing the spelling later doesn't ask again): its features as
 * empty headings to fill in yourself, its weapon / armor / tool proficiencies and languages, and a bookmark to it.
 */
export function useAutoFill() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const typedAt = useRef<Record<string, string>>({})
  const dismissed = useRef(new Set<string>())
  const [offer, setOffer] = useState<{ plan: FillPlan; anchor: HTMLElement; label: string } | null>(null)
  const [done, setDone] = useState<{ plan: FillPlan; added: Applied; anchor: HTMLElement; before: ReturnType<typeof fillSnapshot>; marks: number } | null>(null)

  const focus = (kind: FillKind) => () => { typedAt.current[kind] = currentValue(kind) }
  const currentValue = (kind: FillKind) => (kind === 'class' ? c.className : kind === 'subclass' ? c.subclass : kind === 'species' ? c.species : kind === 'background' ? c.background : c.nationality)

  const blur = (kind: FillKind, label: string) => (e: FocusEvent<HTMLInputElement>) => {
    const value = e.target.value.trim()
    if (!value || value === typedAt.current[kind]?.trim() || !fillAvailable(c) || hasFeaturesFor(c, kind)) return
    const plan = planFill(c, kind, value)
    const key = `${kind}:${plan?.name}`
    if (!plan || (!plan.features.length && !plan.notes.length) || dismissed.current.has(key) || duplicates(c, plan)) return
    const anchor = (e.target.closest('.field') as HTMLElement) ?? e.target
    setDone(null)
    setOffer({ plan, anchor, label })
  }

  const accept = async () => {
    if (!offer) return
    const before = fillSnapshot(c)
    let added: Applied = { features: [], resources: [], spells: [] }
    patch((d) => { added = offer.plan.apply(d) })
    const plan = offer.plan
    setOffer(null)
    setDone({ plan, added, anchor: offer.anchor, before, marks: 0 })
    // bookmark the entry in its book for this character (when a book has it)
    try {
      const marks = await bookmarkRules(c, plan.marks.map((name) => ({ kind: KIND_NAME[plan.kind], name })))
      if (marks) setDone((d) => (d && d.plan === plan ? { ...d, marks } : d))
    } catch { /* no books: nothing to bookmark */ }
  }
  const decline = () => {
    if (offer) dismissed.current.add(`${offer.plan.kind}:${offer.plan.name}`)
    setOffer(null)
  }

  const popover = offer ? (
    <Popover anchor={offer.anchor} onClose={decline} width={420}>
      <div className="fill-offer">
        <b>Set up {offer.plan.name}{offer.label === 'Branch' ? ' branch' : ''}?</b>
        <div className="small muted" style={{ margin: '4px 0 6px' }}>
          Adds what you get up to level {c.level} as empty headings for you to fill in from {c.system === 'ak5e' ? 'the Arknights 5e book' : 'the rules'}, and bookmarks {offer.plan.name} there.
        </div>
        {offer.plan.features.length > 0 && (
          <>
            <div className="field-lbl">Features to fill in</div>
            <ul className="fill-list">
              {offer.plan.features.map((f) => <li key={f.id}>{f.name}<span className="muted small"> · {f.source}</span></li>)}
            </ul>
          </>
        )}
        {offer.plan.notes.length > 0 && (
          <>
            <div className="field-lbl" style={{ marginTop: 6 }}>Also fills in</div>
            <ul className="fill-list">{offer.plan.notes.map((n) => <li key={n} className="small">{n}</li>)}</ul>
          </>
        )}
        <div className="row" style={{ gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
          <button className="btn sm ghost" onClick={decline}>No thanks</button>
          <button className="btn sm primary" onClick={accept}>Set up</button>
        </div>
      </div>
    </Popover>
  ) : done ? (
    <Popover anchor={done.anchor} onClose={() => setDone(null)} width={340}>
      <div className="row" style={{ gap: 8 }}>
        <span className="grow small">
          Added {done.added.features.length} heading{done.added.features.length === 1 ? '' : 's'} to fill in (Features page)
          {done.marks ? ` and ${done.marks} bookmark${done.marks === 1 ? '' : 's'}` : ''}.
        </span>
        <button className="btn sm" onClick={() => { patch((d) => undoFill(d, done.added, done.before)); setDone(null) }}>Undo</button>
      </div>
    </Popover>
  ) : null

  return { focus, blur, popover }
}
