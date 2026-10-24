import { useState } from 'react'
import { ACTION_TYPES } from '../constants'
import { useChar, useStore, useUI } from '../store'
import { Frame, Switch } from '../components/ui'
import { addFeature } from '../components/Drawers'
import { RichText } from '../components/RichText'
import { plainText } from '../rich'
import type { Feature, FeatureCategory } from '../types'

const CATS: { id: FeatureCategory | 'all'; name: string }[] = [
  { id: 'all', name: 'All' },
  { id: 'class', name: 'Class' },
  { id: 'species', name: 'Species' },
  { id: 'feat', name: 'Feats' },
  { id: 'background', name: 'Background' },
  { id: 'buff', name: 'Buffs' },
  { id: 'other', name: 'Other' },
]

export function FeaturesPage() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const [cat, setCat] = useState<FeatureCategory | 'all'>('all')
  const [q, setQ] = useState('')
  const matches = (f: Feature) => {
    const t = q.toLowerCase()
    return !t || (f.name + ' ' + plainText(f.description) + ' ' + f.actions.map((a) => a.name + ' ' + a.description).join(' ')).toLowerCase().includes(t)
  }
  const list = c.features.filter((f) => (cat === 'all' || f.category === cat) && matches(f))
  const setAllCollapsed = (v: boolean) => patch((d) => { for (const f of d.features) if (list.some((x) => x.id === f.id)) f.collapsed = v })

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {CATS.map((x) => (
          <button key={x.id} className={`chip ${cat === x.id ? 'accent' : ''}`} style={{ cursor: 'pointer', padding: '3px 12px' }} onClick={() => setCat(x.id)}>
            {x.name}{x.id !== 'all' ? ` ${c.features.filter((f) => f.category === x.id).length || ''}` : ` ${c.features.length || ''}`}
          </button>
        ))}
        <input className="box-input" style={{ width: 200 }} placeholder="search features…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="grow" />
        {list.length > 0 && (
          <>
            <button className="btn sm ghost" onClick={() => setAllCollapsed(false)}>Expand all</button>
            <button className="btn sm ghost" onClick={() => setAllCollapsed(true)}>Collapse all</button>
          </>
        )}
        <button className="btn primary" onClick={() => addFeature(cat === 'all' ? 'class' : cat)}>＋ Add feature</button>
      </div>

      {list.length === 0 && <div className="empty">{c.features.length ? 'Nothing matches.' : 'No features yet. Add class features, species traits and feats — you can link them to skills, AC and more.'}</div>}

      <div className="feat-cols">
        {list.map((f) => <FeatureCard key={f.id} f={f} />)}
      </div>
    </div>
  )
}

/** A feature card: just its description (actions and the rest live in the editor and on the Actions page). */
function FeatureCard({ f }: { f: Feature }) {
  const patch = useStore((s) => s.patch)
  const set = useUI((s) => s.set)
  const up = (fn: (x: Feature) => void) => patch((d) => { const x = d.features.find((y) => y.id === f.id); if (x) fn(x) })
  return (
    <div className="fcard">
      <Frame>
        <div className="row fcard-head">
          <button className="btn icon sm ghost fold" title={f.collapsed ? 'Expand' : 'Collapse'} onClick={() => up((x) => { x.collapsed = !x.collapsed })}>
            {f.collapsed ? '▸' : '▾'}
          </button>
          <h3 className="grow" onClick={() => up((x) => { x.collapsed = !x.collapsed })}>{f.name || 'Unnamed'}</h3>
          {f.effects.length > 0 && <Switch on={f.active} onChange={(b) => up((x) => { x.active = b })} title="Apply linked effects" />}
          <button className="btn icon sm ghost" title="Edit" onClick={() => set({ drawer: { kind: 'feature', id: f.id } })}>✎</button>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 4, margin: '2px 0 6px 30px' }}>
          <span className="tag alt">{f.category}</span>
          {f.source && <span className="tag alt">{f.source}</span>}
          {f.actionType !== 'none' && <span className="chip accent">{ACTION_TYPES.find((a) => a.id === f.actionType)?.name}</span>}
        </div>
        {!f.collapsed && (
          f.description ? <RichText className="prose" value={f.description} style={{ fontSize: 13.5 }} /> : <div className="muted small">No description.</div>
        )}
      </Frame>
    </div>
  )
}
