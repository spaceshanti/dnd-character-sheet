import { useState } from 'react'
import { MASTERY_INFO, PROPERTY_INFO, PROPERTY_SUGGESTIONS, joinProps, propKey, splitProps } from '../data/gear'

/** A weapon's properties as chips (hover for a reminder), plus its mastery when a feature unlocks it. */
export function WeaponTags({ properties, mastery, masteryFrom }: { properties: string; mastery?: string; masteryFrom?: string }) {
  const props = splitProps(properties)
  if (!props.length && !(mastery && masteryFrom)) return null
  return (
    <span className="wtags">
      {props.map((p) => <span key={p} className="wtag" title={PROPERTY_INFO[propKey(p)] ?? p}>{p}</span>)}
      {mastery && masteryFrom && (
        <span className="wtag mastery" title={`${MASTERY_INFO[mastery] ?? ''}\n(Weapon mastery from ${masteryFrom})`}>◆ {mastery}</span>
      )}
    </span>
  )
}

/** Edit a comma-separated property list as chips: remove with ✕, add from suggestions or type your own. */
export function PropertyEditor({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const [draft, setDraft] = useState('')
  const props = splitProps(value)
  const add = (p: string) => {
    const t = p.trim()
    if (!t || props.some((x) => x.toLowerCase() === t.toLowerCase())) return
    onChange(joinProps([...props, t]))
    setDraft('')
  }
  const suggestions = PROPERTY_SUGGESTIONS.filter((s) => !props.some((p) => propKey(p).toLowerCase() === s.toLowerCase()))
  return (
    <div className="col" style={{ gap: 5 }}>
      <div className="wtags">
        {props.length === 0 && <span className="muted small">No properties</span>}
        {props.map((p) => (
          <span key={p} className="wtag" title={PROPERTY_INFO[propKey(p)] ?? p}>
            {p}<button type="button" title="Remove" onClick={() => onChange(joinProps(props.filter((x) => x !== p)))}>✕</button>
          </span>
        ))}
      </div>
      <div className="row" style={{ gap: 4 }}>
        <input className="box-input grow" list="weapon-props" placeholder="Add a property (Finesse, Silvered, Returning…) + Enter" value={draft}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft) } }} />
        <button className="btn sm" onClick={() => add(draft)}>Add</button>
        <datalist id="weapon-props">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      </div>
    </div>
  )
}
