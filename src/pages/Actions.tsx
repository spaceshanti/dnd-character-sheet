import { useState } from 'react'
import { attackInfo, itemAttacks, signed, spellActionType } from '../calc'
import { useChar, useUI } from '../store'
import { Frame } from '../components/ui'
import type { ActionType } from '../types'

interface Row { key: string; kind: string; name: string; right: string; onClick: () => void }

const STANDARD: Record<string, string> = {
  Attack: 'Make one melee or ranged attack (or more with Extra Attack).',
  Dash: 'Gain extra movement equal to your Speed.',
  Disengage: "Your movement doesn't provoke Opportunity Attacks this turn.",
  Dodge: 'Attacks against you have Disadvantage; you have Advantage on DEX saves.',
  Help: 'Give an ally Advantage on their next check or attack.',
  Hide: 'Make a Dexterity (Stealth) check to become hidden.',
  Influence: 'Make a Charisma check to alter a creature\'s attitude.',
  Magic: 'Cast a spell with a casting time of an action, or use a magic item.',
  Ready: 'Prepare a reaction triggered by a condition you choose.',
  Search: 'Make a Wisdom check to find something.',
  Study: 'Make an Intelligence check to recall or investigate.',
  Utilize: 'Use a nonmagical object or interact with something.',
}

export function ActionsPage() {
  const c = useChar()
  const set = useUI((s) => s.set)
  const go = useUI((s) => s.go)
  const [std, setStd] = useState('')

  const rows: Record<'action' | 'bonus' | 'reaction' | 'other', Row[]> = { action: [], bonus: [], reaction: [], other: [] }
  const put = (t: ActionType | 'special', r: Row) => {
    const k = t === 'action' || t === 'bonus' || t === 'reaction' ? t : 'other'
    rows[k].push(r)
  }

  for (const a of itemAttacks(c)) {
    const i = attackInfo(c, a)
    rows.action.push({ key: a.id, kind: 'Weapon', name: a.name, right: `${signed(i.bonus)} · ${i.damage} ${a.damageType}`, onClick: () => set({ inventoryOpen: true, inventorySelected: a.itemId }) })
  }
  for (const a of c.attacks) {
    const i = attackInfo(c, a)
    rows.action.push({ key: a.id, kind: 'Attack', name: a.name || 'Attack', right: `${signed(i.bonus)} · ${i.damage} ${a.damageType}`, onClick: () => go('overview') })
  }
  for (const s of c.spells) {
    if (s.level > 0 && !s.prepared && !s.alwaysPrepared) continue
    put(spellActionType(s.castingTime), {
      key: s.id, kind: s.level === 0 ? 'Cantrip' : `Spell ${s.level}`, name: s.name,
      right: [s.range, s.concentration ? 'Conc.' : ''].filter(Boolean).join(' · '), onClick: () => set({ drawer: { kind: 'spell', id: s.id } }),
    })
  }
  for (const f of c.features) {
    if (f.actionType === 'none') continue
    put(f.actionType, { key: f.id, kind: f.category, name: f.name, right: '', onClick: () => set({ drawer: { kind: 'feature', id: f.id } }) })
  }
  for (const i of c.items) {
    if (i.actionType === 'none' || i.qty <= 0) continue
    put(i.actionType, { key: i.id, kind: 'Item', name: i.name, right: i.qty > 1 ? `×${i.qty}` : '', onClick: () => set({ inventoryOpen: true, inventorySelected: i.id }) })
  }

  const cols: { id: keyof typeof rows; title: string }[] = [
    { id: 'action', title: 'Actions' }, { id: 'bonus', title: 'Bonus Actions' }, { id: 'reaction', title: 'Reactions' }, { id: 'other', title: 'Free & Other' },
  ]

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="muted small">
        Built automatically from your attacks, prepared spells (by casting time), and any feature or item you've given an action type.
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
        {cols.map((col) => (
          <Frame key={col.id} title={col.title} className="action-col">
            {rows[col.id].length === 0 && <div className="empty">Nothing yet</div>}
            {rows[col.id].map((r) => (
              <div key={r.key} className="act-item" onClick={r.onClick}>
                <span className="k">{r.kind}</span>
                <b className="grow">{r.name || 'Unnamed'}</b>
                <span className="muted small">{r.right}</span>
              </div>
            ))}
          </Frame>
        ))}
      </div>
      <Frame title="Standard Actions" tight>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {Object.keys(STANDARD).map((k) => (
            <button key={k} className={`chip ${std === k ? 'accent' : ''}`} style={{ cursor: 'pointer', padding: '3px 12px' }} onClick={() => setStd(std === k ? '' : k)}>{k}</button>
          ))}
        </div>
        {std && <div style={{ marginTop: 8 }}><b>{std}.</b> {STANDARD[std]}</div>}
      </Frame>
    </div>
  )
}
