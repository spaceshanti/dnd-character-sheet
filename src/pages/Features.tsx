import { useState } from 'react'
import { ACTION_TYPES, targetName } from '../constants'
import { useChar, useStore, useUI } from '../store'
import { Frame, Switch } from '../components/ui'
import { addFeature } from '../components/Drawers'
import type { FeatureCategory } from '../types'

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
  const set = useUI((s) => s.set)
  const [cat, setCat] = useState<FeatureCategory | 'all'>('all')
  const [q, setQ] = useState('')
  const list = c.features.filter((f) => (cat === 'all' || f.category === cat) && (!q || (f.name + f.description).toLowerCase().includes(q.toLowerCase())))

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
        <button className="btn primary" onClick={() => addFeature(cat === 'all' ? 'class' : cat)}>＋ Add feature</button>
      </div>

      {list.length === 0 && <div className="empty">{c.features.length ? 'Nothing matches.' : 'No features yet. Add class features, species traits and feats — you can link them to skills, AC and more.'}</div>}

      <div style={{ columns: '3 340px', columnGap: 14 }}>
        <style>{`.fcard { break-inside: avoid; margin-bottom: 14px; cursor: pointer; }`}</style>
        {list.map((f) => (
          <div key={f.id} className="fcard" onClick={() => set({ drawer: { kind: 'feature', id: f.id } })}>
            <Frame>
              <div className="row" style={{ marginBottom: 4 }}>
                <h3 style={{ fontSize: 14, flex: 1, textDecoration: 'underline', textUnderlineOffset: 3 }}>{f.name || 'Unnamed'}</h3>
                {f.effects.length > 0 && <Switch on={f.active} onChange={(b) => patch((d) => { const x = d.features.find((y) => y.id === f.id); if (x) x.active = b })} title="Apply linked effects" />}
              </div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                <span className="tag alt">{f.category}</span>
                {f.source && <span className="tag alt">{f.source}</span>}
                {f.actionType !== 'none' && <span className="chip accent">{ACTION_TYPES.find((a) => a.id === f.actionType)?.name}</span>}
              </div>
              <div className="prose" style={{ display: '-webkit-box', WebkitLineClamp: 9, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 13.5 }}>{f.description || <span className="muted">No description.</span>}</div>
              {f.effects.length > 0 && (
                <div className="row" style={{ flexWrap: 'wrap', gap: 4, marginTop: 8, opacity: f.active ? 1 : 0.5 }}>
                  {f.effects.map((e) => <span key={e.id} className={`chip ${e.type === 'advantage' ? 'adv' : e.type === 'disadvantage' ? 'dis' : ''}`}>{targetName(e.target)}</span>)}
                </div>
              )}
            </Frame>
          </div>
        ))}
      </div>
    </div>
  )
}
