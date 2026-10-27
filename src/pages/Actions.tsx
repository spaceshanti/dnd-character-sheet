import { useState, type ReactNode } from 'react'
import { WeaponTags } from '../components/WeaponTags'
import { attackInfo, itemAttacks, signed, spellActionType } from '../calc'
import { useChar, useUI } from '../store'
import { isAK } from '../systems'
import { activateOp } from '../ak'
import { Frame, Toast, useToast } from '../components/ui'
import { costText, modsFor, spendAction } from '../components/FeatureParts'
import { ammoText, useItem } from '../consume'
import type { ActionType } from '../types'

interface Row { key: string; kind: string; name: string; right: string; onClick: () => void; onUse?: () => void; tags?: ReactNode }

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
  const toast = useToast()

  const rows: Record<'action' | 'bonus' | 'reaction' | 'other', Row[]> = { action: [], bonus: [], reaction: [], other: [] }
  const put = (t: ActionType | 'special', r: Row) => {
    const k = t === 'action' || t === 'bonus' || t === 'reaction' ? t : 'other'
    rows[k].push(r)
  }

  for (const a of itemAttacks(c)) {
    const i = attackInfo(c, a)
    const w = a.weapon
    rows.action.push({
      key: a.id, kind: 'Weapon', name: a.name,
      right: `${signed(i.bonus)} · ${i.damage} ${a.damageType}${w.ammoId ? ` · ${ammoText(c, w.ammoId, w.ammoCost)}` : ''}`,
      onClick: () => set({ inventoryOpen: true, inventorySelected: a.itemId }),
      onUse: w.ammoId ? () => toast.show(useItem(c, w.ammoId, w.ammoCost, a.name)) : undefined,
      tags: <WeaponTags properties={a.weapon.properties} mastery={a.weapon.mastery} masteryFrom={a.masteryFrom} />,
    })
  }
  for (const a of c.attacks) {
    const i = attackInfo(c, a)
    rows.action.push({ key: a.id, kind: 'Attack', name: a.name || 'Attack', right: `${signed(i.bonus)} · ${i.damage} ${a.damageType}`, onClick: () => go('overview') })
  }
  const ak = isAK(c)
  for (const s of c.ak.opSkills) {
    if (!ak) break
    const a = s.activation.toLowerCase()
    const t: ActionType = a.includes('bonus') ? 'bonus' : a.includes('reaction') ? 'reaction' : /^\s*(1\s*)?action/.test(a) ? 'action' : 'free'
    put(t, {
      key: s.id, kind: 'Op. Skill', name: s.name || 'Operator Skill',
      right: `${s.spCost} SP · ${s.duration || 'instant'}${c.ak.activeSkill === s.id ? ' · ACTIVE' : ''}`,
      onClick: () => go('operator'),
      onUse: () => toast.show(activateOp(c, s.id)),
    })
  }
  for (const s of c.spells) {
    // AK5e: every Art you know is always prepared
    if (!ak && s.level > 0 && !s.prepared && !s.alwaysPrepared) continue
    put(spellActionType(s.castingTime), {
      key: s.id, kind: s.level === 0 ? 'Cantrip' : `${ak ? 'Art' : 'Spell'} ${s.level}`, name: s.name,
      right: [s.range, s.concentration ? 'Conc.' : '', s.ammoId ? ammoText(c, s.ammoId, s.ammoCost) : ''].filter(Boolean).join(' · '),
      onClick: () => set({ drawer: { kind: 'spell', id: s.id } }),
      onUse: s.ammoId ? () => toast.show(useItem(c, s.ammoId, s.ammoCost, s.name)) : undefined,
    })
  }
  for (const f of c.features) {
    const open = () => set({ drawer: { kind: 'feature', id: f.id } })
    if (f.actionType !== 'none') put(f.actionType, { key: f.id, kind: f.category, name: f.name, right: '', onClick: open })
    for (const a of f.actions) {
      if (a.actionType === 'none') continue
      put(a.actionType, {
        key: a.id, kind: 'Feature', name: `${f.name || 'Feature'} › ${a.name || 'action'}`, right: costText(c, a), onClick: open,
        onUse: () => toast.show(spendAction(c, a) || `${a.name || 'Action'} used`),
        tags: modsFor(c, a.id).length ? <>{modsFor(c, a.id).map((m, i) => <span key={i} className="act-mod"><b>+ {m.from}:</b> {m.text}</span>)}</> : undefined,
      })
    }
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
        {ak ? 'Built automatically from your attacks, Operator Skills, Arts (by casting time), and any feature or item you\'ve given an action type.'
          : 'Built automatically from your attacks, prepared spells (by casting time), and any feature or item you\'ve given an action type.'}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
        {cols.map((col) => (
          <Frame key={col.id} title={col.title} className="action-col">
            {rows[col.id].length === 0 && <div className="empty">Nothing yet</div>}
            {rows[col.id].map((r) => (
              <div key={r.key} className="act-item" onClick={r.onClick}>
                <span className="k">{r.kind}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <b>{r.name || 'Unnamed'}</b>
                  {r.right && <span className="muted small" style={{ display: 'block' }}>{r.right}</span>}
                  {r.tags}
                </span>
                {r.onUse && <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); r.onUse!() }}>Use</button>}
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
      <Toast msg={toast.msg} />
    </div>
  )
}
