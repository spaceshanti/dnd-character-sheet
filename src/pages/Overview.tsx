import { Fragment, useState } from 'react'
import { ABILITIES, RECHARGES, targetName } from '../constants'
import { attackInfo, itemAttacks, itemIsActive, signed } from '../calc'
import { newAttack, newResource } from '../blank'
import { useChar, useStore, useUI } from '../store'
import { Frame, Num, Pips, Select, Switch } from '../components/ui'
import { RichArea } from '../components/RichText'
import { Icon, itemIcon } from '../components/Icon'
import { WeaponTags } from '../components/WeaponTags'
import type { Attack, Effect } from '../types'

const effectText = (e: Effect) =>
  `${targetName(e.target)} ${e.type === 'bonus' ? signed(e.value ?? 0) : e.type === 'minScore' ? `≥ ${e.value}` : e.type}`

export function Overview() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const set = useUI((s) => s.set)
  return (
    <div className="grid" style={{ gridTemplateColumns: '230px minmax(0,1.5fr) minmax(0,1fr)', alignItems: 'start' }}>
      <div className="col">
        <Frame title="Proficiencies & Languages" tight>
          {(['weapons', 'armor', 'tools', 'languages'] as const).map((k) => (
            <div key={k} style={{ marginBottom: 6 }}>
              <div className="field-lbl">{k}</div>
              <RichArea className="box-input" minRows={1} value={c.proficiencies[k]} onChange={(v) => patch((d) => { d.proficiencies[k] = v })} />
            </div>
          ))}
        </Frame>
      </div>

      <div className="col" style={{ gap: 14 }}>
        <AttacksPanel />
        <ResourcesPanel />
        <Frame title="Battle State / Scratchpad" tight>
          <RichArea className="sheet-ta" minRows={4} placeholder="Anything you track mid-fight: mirror image count, concentration target, initiative order…" value={c.battleState} onChange={(v) => patch((d) => { d.battleState = v })} />
        </Frame>
      </div>

      <div className="col" style={{ gap: 14 }}>
        <Frame title="Buffs & Item Effects">
          <EffectToggles />
        </Frame>
        <Frame title="Equipment" tight tools={<button className="btn sm" onClick={() => set({ inventoryOpen: true })}><Icon name="pack" /> Open</button>}>
          {c.items.filter((i) => i.slot).length === 0 && <div className="empty">Nothing equipped.</div>}
          {c.items.filter((i) => i.slot).map((i) => (
            <div key={i.id} className="list-row" onClick={() => set({ inventoryOpen: true, inventorySelected: i.id })}>
              <Icon name={itemIcon(i)} className="list-ico" /><span className="grow">{i.name}</span>
              {i.attunement && <span title={i.attuned ? 'Attuned' : 'Not attuned'}>{i.attuned ? '✦' : '✧'}</span>}
              {!itemIsActive(i) && i.effects.length > 0 && <span className="chip">effects off</span>}
            </div>
          ))}
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map((k) => (
              <div key={k} className="coin"><Num min={0} value={c.coins[k]} onChange={(n) => patch((d) => { d.coins[k] = n })} /><span>{k.toUpperCase()}</span></div>
            ))}
          </div>
        </Frame>
        <Frame title="Features & Traits" tight>
          {c.features.length === 0 && <div className="empty">Add features on the Features page.</div>}
          {c.features.map((f) => (
            <div key={f.id} className="list-row" onClick={() => set({ drawer: { kind: 'feature', id: f.id } })}>
              <span className="grow">{f.name || 'Unnamed'}</span>
              {f.actionType !== 'none' && <span className="badge">{f.actionType === 'bonus' ? 'BA' : f.actionType[0].toUpperCase()}</span>}
            </div>
          ))}
        </Frame>
      </div>
    </div>
  )
}

function AttacksPanel() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const [open, setOpen] = useState('')
  const set = useUI((s) => s.set)
  const fromItems = itemAttacks(c)
  const up = (id: string, fn: (a: Attack) => void) => patch((d) => { const x = d.attacks.find((y) => y.id === id); if (x) fn(x) })
  return (
    <Frame title="Weapons & Attacks" tools={<button className="btn sm" onClick={() => { const a = newAttack(); patch((d) => { d.attacks.push(a) }); setOpen(a.id) }}>＋ Add</button>}>
      {c.attacks.length === 0 && fromItems.length === 0 ? <div className="empty">No attacks yet. Add a weapon to your inventory (or here) and its bonus is worked out for you.</div> : (
        <table className="t">
          <thead><tr><th>Name</th><th style={{ width: 62 }}>Atk</th><th>Damage</th><th style={{ width: 28 }} /></tr></thead>
          <tbody>
            {fromItems.map((a) => {
              const info = attackInfo(c, a)
              return (
                <tr key={a.id} className="hov" title="From your inventory: click to edit" onClick={() => set({ inventoryOpen: true, inventorySelected: a.itemId })}>
                  <td>
                    <span className="row" style={{ gap: 6 }}><Icon name="sword" className="list-ico" />{a.name}{a.equipped && <span className="itag">in hand</span>}</span>
                    <WeaponTags properties={a.weapon.properties} mastery={a.weapon.mastery} masteryFrom={a.masteryFrom} />
                  </td>
                  <td style={{ fontWeight: 700, fontSize: 16 }}>{signed(info.bonus)}{info.adv.length > 0 && info.dis.length === 0 && <span className="adv a" style={{ marginLeft: 3, fontSize: 10, color: 'var(--adv)' }}>ADV</span>}</td>
                  <td>{info.damage} <span className="muted">{a.damageType}</span>{a.range && <span className="muted small"> · {a.range}</span>}</td>
                  <td><Icon name="pack" className="list-ico" /></td>
                </tr>
              )
            })}
            {c.attacks.map((a) => {
              const info = attackInfo(c, a)
              return (
                <Fragment key={a.id}>
                  <tr>
                    <td><input className="line-input" placeholder="Weapon" value={a.name} onChange={(e) => up(a.id, (x) => { x.name = e.target.value })} /></td>
                    <td style={{ fontWeight: 700, fontSize: 16 }}>{signed(info.bonus)}{info.adv.length > 0 && info.dis.length === 0 && <span className="adv a" style={{ marginLeft: 3, fontSize: 10, color: 'var(--adv)' }}>ADV</span>}</td>
                    <td>{info.damage} <span className="muted">{a.damageType}</span></td>
                    <td><button className="btn icon sm ghost" title="Edit details" onClick={() => setOpen(open === a.id ? '' : a.id)}>⚙</button></td>
                  </tr>
                  {open === a.id && (
                    <tr><td colSpan={4} style={{ background: 'var(--panel2)' }}>
                      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                        <Select value={a.ability} onChange={(v) => up(a.id, (x) => { x.ability = v })}
                          options={[...ABILITIES.map((b) => ({ id: b.key as Attack['ability'], name: b.short })), { id: 'finesse' as const, name: 'Finesse (best of STR/DEX)' }]} />
                        <label className="row small"><Switch on={a.proficient} onChange={(b) => up(a.id, (x) => { x.proficient = b })} /> Proficient</label>
                        <label className="row small"><Switch on={a.addMod} onChange={(b) => up(a.id, (x) => { x.addMod = b })} /> Add modifier to damage</label>
                        <span className="small">Magic +</span><Num className="box-input" width={44} value={a.magicBonus} onChange={(n) => up(a.id, (x) => { x.magicBonus = n })} />
                      </div>
                      <div className="row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
                        <input className="box-input" style={{ width: 80 }} placeholder="1d8" value={a.damage} onChange={(e) => up(a.id, (x) => { x.damage = e.target.value })} />
                        <input className="box-input" style={{ width: 110 }} placeholder="piercing" value={a.damageType} onChange={(e) => up(a.id, (x) => { x.damageType = e.target.value })} />
                        <input className="box-input" style={{ width: 100 }} placeholder="range" value={a.range} onChange={(e) => up(a.id, (x) => { x.range = e.target.value })} />
                        <input className="box-input grow" placeholder="notes (finesse, thrown…)" value={a.notes} onChange={(e) => up(a.id, (x) => { x.notes = e.target.value })} />
                        <button className="btn danger sm" onClick={() => patch((d) => { d.attacks = d.attacks.filter((y) => y.id !== a.id) })}>Delete</button>
                      </div>
                    </td></tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      )}
    </Frame>
  )
}


function ResourcesPanel() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const set = useUI((s) => s.set)
  const feat = (id: string) => (id ? c.features.find((f) => f.id === id)?.name || 'a feature' : '')
  return (
    <Frame title="Class Resources, Ammo & Charges" tools={<button className="btn sm" onClick={() => patch((d) => { d.resources.push(newResource()) })}>＋ Add</button>}>
      {c.resources.length === 0 && <div className="empty">Track things like Rage, Ki, Psionic Dice, Channel Divinity or ammo. Each one has its own max.</div>}
      {c.resources.map((r) => {
        const up = (fn: (x: typeof r) => void) => patch((d) => { const x = d.resources.find((y) => y.id === r.id); if (x) fn(x) })
        return (
          <div key={r.id} className="stat-line" style={{ flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: 6, marginBottom: 6 }}>
            <span className="col" style={{ gap: 0, width: 150 }}>
              <input className="line-input" placeholder="Resource name" value={r.name} onChange={(e) => up((x) => { x.name = e.target.value })} />
              {feat(r.featureId) && <button className="res-feat" onClick={() => set({ drawer: { kind: 'feature', id: r.featureId } })}>from {feat(r.featureId)}</button>}
            </span>
            <Pips total={r.max} used={r.used} onChange={(u) => up((x) => { x.used = u })} />
            <input className="box-input" style={{ width: 42 }} placeholder="die" title="Optional die size, e.g. d8" value={r.die} onChange={(e) => up((x) => { x.die = e.target.value })} />
            <span className="grow" />
            <span className="small muted">max</span>
            <Num min={0} max={999} className="box-input" width={48} style={{ textAlign: 'center' }} value={r.max} onChange={(n) => up((x) => { x.max = n; x.used = Math.min(x.used, n) })} />
            <Select value={r.recharge} onChange={(v) => up((x) => { x.recharge = v })} options={RECHARGES} />
            <button className="btn icon sm ghost" onClick={() => patch((d) => { d.resources = d.resources.filter((y) => y.id !== r.id) })}>✕</button>
          </div>
        )
      })}
    </Frame>
  )
}

function EffectToggles() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const set = useUI((s) => s.set)
  const rows = [
    ...c.features.filter((f) => f.effects.length).map((f) => ({ id: f.id, kind: 'feature' as const, name: f.name, on: f.active, effects: f.effects, note: '' })),
    ...c.spells.filter((s) => s.effects.length).map((s) => ({ id: s.id, kind: 'spell' as const, name: s.name, on: s.active, effects: s.effects, note: '' })),
    ...c.items.filter((i) => i.effects.length).map((i) => ({
      id: i.id, kind: 'item' as const, name: i.name, on: itemIsActive(i), effects: i.effects,
      note: !i.slot ? 'not equipped' : i.attunement && !i.attuned ? 'needs attunement' : '',
    })),
  ]
  if (!rows.length) return <div className="empty">Link a feature, item or spell to a skill, AC, speed… and it appears here with an on/off switch.</div>
  return (
    <div>
      {rows.map((r) => (
        <div key={r.kind + r.id} style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
          <div className="row">
            {r.kind === 'item' ? (
              <span className="chip" style={{ cursor: 'pointer' }} onClick={() => set({ inventoryOpen: true, inventorySelected: r.id })}><Icon name="pack" /></span>
            ) : (
              <Switch on={r.on} onChange={(b) => patch((d) => {
                const list = r.kind === 'feature' ? d.features : d.spells
                const x = (list as { id: string; active: boolean }[]).find((y) => y.id === r.id)
                if (x) x.active = b
              })} />
            )}
            <b className="grow" style={{ opacity: r.on ? 1 : 0.55, cursor: 'pointer' }}
              onClick={() => r.kind === 'item' ? set({ inventoryOpen: true, inventorySelected: r.id }) : set({ drawer: { kind: r.kind, id: r.id } })}>
              {r.name || 'Unnamed'}
            </b>
            <span className="tag alt">{r.kind}</span>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 4, margin: '4px 0 0 40px', opacity: r.on ? 1 : 0.5 }}>
            {r.effects.map((e) => (
              <span key={e.id} className={`chip ${e.type === 'advantage' ? 'adv' : e.type === 'disadvantage' ? 'dis' : ''}`}>{effectText(e)}</span>
            ))}
            {r.note && <span className="small muted">({r.note})</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
