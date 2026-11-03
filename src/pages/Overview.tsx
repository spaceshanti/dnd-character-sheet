import { Fragment, useState } from 'react'
import { ABILITIES, RECHARGES, targetName } from '../constants'
import { attackInfo, itemAttacks, itemIsActive, martialDc, signed } from '../calc'
import { isAK } from '../systems'
import { activateOp } from '../ak'
import { SpTracker } from './OperatorSkills'
import { newAttack, newResource } from '../blank'
import { useChar, useStore, useUI } from '../store'
import { Frame, Num, Pips, Select, Switch, Toast, useToast, DieSlot } from '../components/ui'
import { ammoText, useItem } from '../consume'
import { RichArea } from '../components/RichText'
import { Icon, itemIcon } from '../components/Icon'
import { WeaponTags } from '../components/WeaponTags'
import { newSide, otherName, setSwap, switchClass } from '../altClass'
import { hasFeaturesFor, planFill, ruleNames, type FillPlan } from '../autofill'
import { longRestOn } from '../rest'
import type { AbilityKey, Attack, Effect } from '../types'

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
        {isAK(c) && <AltClassPanel />}
      </div>

      <div className="col" style={{ gap: 14 }}>
        {isAK(c) && <OperatorPanel />}
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
            {isAK(c) ? (
              <div className="coin lmd"><Num min={0} max={999999999} value={c.ak.lmd} onChange={(n) => patch((d) => { d.ak.lmd = n })} /><span>LMD</span></div>
            ) : (['cp', 'sp', 'ep', 'gp', 'pp'] as const).map((k) => (
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

/** AK5e optional rule: a second class from 7th level, switched to as part of a long rest. */
function AltClassPanel() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const toast = useToast()
  const alt = c.altClass
  const [form, setForm] = useState<{ cls: string; branch: string; a: AbilityKey; b: AbilityKey } | null>(null)
  if (!alt && !form && c.level < 7) return null
  const label = (cls: string, sub: string) => [sub, cls].filter(Boolean).join(' ') || 'no class yet'
  const abil = (k: AbilityKey) => ABILITIES.find((x) => x.key === k)?.short ?? k
  const abilOptions = ABILITIES.map((x) => ({ id: x.key, name: x.short }))
  const other = otherName(c)
  const sameClass = !!form && !!form.cls.trim() && form.cls.trim().toLowerCase() === c.className.trim().toLowerCase()

  const add = () => {
    if (!form) return
    patch((d) => { d.altClass = { active: false, swap: [form.a, form.b], other: newSide(d, form.cls.trim(), form.branch.trim()) } })
    setForm(null)
    toast.show(`Added ${label(form.cls.trim(), form.branch.trim())} as your alternate class`)
  }
  const doSwitch = (rest: boolean) => {
    const msg = rest
      ? `Take a long rest and switch to ${other}? You don't regain any hit dice on this rest.`
      : `Switch to ${other} without resting? (The rule is to switch as part of a long rest.)`
    if (!window.confirm(msg)) return
    let done: string[] = []
    patch((d) => { switchClass(d); if (rest) done = longRestOn(d, { hitDice: false }) })
    toast.show(`Now playing ${other}${rest ? ' · long rest taken, no hit dice regained' : ''}${done.length ? ' · ' + done.join(' · ') : ''}`)
  }
  // a new alternate class starts empty: offer to fill it in from the book, linked up like the top bar does
  const plans = alt && !hasFeaturesFor(c, 'class')
    ? [planFill(c, 'class', c.className), c.subclass ? planFill(c, 'subclass', c.subclass) : null].filter((p): p is FillPlan => !!p && p.features.length > 0)
    : []
  const fill = () => {
    patch((d) => { for (const p of plans) p.apply(d) })
    toast.show(`Filled in ${plans.map((p) => p.name).join(' and ')} features`)
  }

  return (
    <Frame title="Alternate Class" tight>
      {!alt && !form && (
        <>
          <div className="small muted" style={{ marginBottom: 8 }}>
            Optional rule: from 7th level you can take a second class and switch to it as part of a long rest. Features, max HP and
            speed are separate; name, story, inventory and level are shared, and two ability scores swap.
          </div>
          <button className="btn sm" onClick={() => setForm({ cls: '', branch: '', a: 'str', b: 'wis' })}>＋ Add an alternate class</button>
        </>
      )}
      {form && (
        <div className="col" style={{ gap: 6 }}>
          <div className="field-lbl">Class</div>
          <input className="box-input" list="alt-classes" value={form.cls} placeholder="e.g. Caster" onChange={(e) => setForm({ ...form, cls: e.target.value })} />
          <datalist id="alt-classes">{ruleNames(c, 'class').map((n) => <option key={n} value={n} />)}</datalist>
          <div className="field-lbl">Branch</div>
          <input className="box-input" list="alt-branches" value={form.branch} placeholder="optional" onChange={(e) => setForm({ ...form, branch: e.target.value })} />
          <datalist id="alt-branches">{ruleNames(c, 'subclass', form.cls).map((n) => <option key={n} value={n} />)}</datalist>
          <div className="field-lbl">Swap these two scores</div>
          <div className="row" style={{ gap: 4 }}>
            <Select value={form.a} options={abilOptions} onChange={(v) => setForm({ ...form, a: v as AbilityKey })} />
            <span>⇄</span>
            <Select value={form.b} options={abilOptions} onChange={(v) => setForm({ ...form, b: v as AbilityKey })} />
          </div>
          {sameClass && <div className="small" style={{ color: 'var(--dis)' }}>It has to be a different class from {c.className}.</div>}
          <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
            <button className="btn sm ghost" onClick={() => setForm(null)}>Cancel</button>
            <button className="btn sm primary" disabled={!form.cls.trim() || sameClass || form.a === form.b} onClick={add}>Add</button>
          </div>
        </div>
      )}
      {alt && (
        <div className="col" style={{ gap: 6 }}>
          <div className="alt-now">
            <span className="field-lbl">Playing</span>
            <b>{label(c.className, c.subclass)}</b>
            <span className={`chip ${alt.active ? 'accent' : ''}`}>{alt.active ? 'alternate' : 'original'}</span>
          </div>
          <div className="alt-now">
            <span className="field-lbl">Other</span>
            <span>{label(alt.other.className, alt.other.subclass)}</span>
          </div>
          <div className="alt-now">
            <span className="field-lbl">Swapped</span>
            {alt.active ? (
              <span title="Swapped while you're in the alternate class">{abil(alt.swap[0])} ⇄ {abil(alt.swap[1])} <span className="muted small">(now)</span></span>
            ) : (
              <span className="row" style={{ gap: 3 }}>
                <Select value={alt.swap[0]} options={abilOptions} onChange={(v) => patch((d) => setSwap(d, [v as AbilityKey, d.altClass!.swap[1]]))} />
                <span>⇄</span>
                <Select value={alt.swap[1]} options={abilOptions} onChange={(v) => patch((d) => setSwap(d, [d.altClass!.swap[0], v as AbilityKey]))} />
              </span>
            )}
          </div>
          <button className="btn sm primary" onClick={() => doSwitch(true)} title="Switch class as part of a long rest (no hit dice regained)">☀ Long rest &amp; switch to {other}</button>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm ghost grow" onClick={() => doSwitch(false)} title="For fixing things up; the rule is to switch on a long rest">Switch without resting</button>
            {!alt.active && (
              <button className="btn sm ghost" title="Remove the alternate class (its features and so on are deleted)"
                onClick={() => { if (window.confirm(`Remove ${other} and everything on it?`)) patch((d) => { d.altClass = null }) }}>Remove</button>
            )}
          </div>
          {plans.length > 0 && <button className="btn sm" onClick={fill}>Fill in {plans.map((p) => p.name).join(' / ')} features</button>}
        </div>
      )}
      <Toast msg={toast.msg} />
    </Frame>
  )
}

/** AK5e: SP and the Operator Skills you can fire off from here. */
function OperatorPanel() {
  const c = useChar()
  const go = useUI((s) => s.go)
  const toast = useToast()
  const msg = (m: string) => m && toast.show(m)
  return (
    <Frame title="Operator Skills" tools={<><span className="chip" title="8 + STR or DEX + proficiency">Martial DC {martialDc(c)}</span><button className="btn sm" onClick={() => go('operator')}>Open</button></>}>
      <SpTracker onMsg={msg} />
      {c.ak.opSkills.length === 0 && <div className="empty" style={{ marginTop: 8 }}>Pick your Basic skill at 2nd level on the Op. Skills page.</div>}
      {c.ak.opSkills.map((s) => {
        const active = c.ak.activeSkill === s.id
        return (
          <div key={s.id} className={`list-row op-row ${active ? 'active' : ''}`} onClick={() => go('operator')}>
            <span className="op-tier-dot" title={s.tier}>{s.tier[0].toUpperCase()}</span>
            <span className="grow"><b>{s.name || 'Unnamed'}</b> <span className="muted small">{s.activation} · {s.duration || '—'}</span></span>
            <span className="small muted">{s.spCost} SP</span>
            {active ? <span className="chip accent">active</span> : (
              <button className="btn sm primary" disabled={c.ak.sp < s.spCost} onClick={(e) => { e.stopPropagation(); msg(activateOp(c, s.id)) }}>Activate</button>
            )}
          </div>
        )
      })}
      <Toast msg={toast.msg} />
    </Frame>
  )
}

function AttacksPanel() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const [open, setOpen] = useState('')
  const set = useUI((s) => s.set)
  const toast = useToast()
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
                  <td onClick={(e) => e.stopPropagation()}>
                    {a.weapon.ammoId
                      ? <button className="btn sm primary" title={ammoText(c, a.weapon.ammoId, a.weapon.ammoCost)} onClick={() => toast.show(useItem(c, a.weapon.ammoId, a.weapon.ammoCost, a.name))}>Use</button>
                      : <Icon name="pack" className="list-ico" />}
                  </td>
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
      <Toast msg={toast.msg} />
    </Frame>
  )
}


function ResourcesPanel() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const set = useUI((s) => s.set)
  const feat = (id: string) => (id ? c.features.find((f) => f.id === id)?.name || 'a feature' : '')
  const [gear, setGear] = useState('')
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
            <DieSlot value={r.die} width={42} onChange={(v) => up((x) => { x.die = v })} />
            <span className="grow" />
            <span className="small muted">max</span>
            <Num min={0} max={999} className="box-input" width={48} style={{ textAlign: 'center' }} value={r.max} onChange={(n) => up((x) => { x.max = n; x.used = Math.min(x.used, n) })} />
            {/* when it comes back: tucked away behind ⚙ to keep the list simple */}
            {gear === r.id && <Select value={r.recharge} onChange={(v) => up((x) => { x.recharge = v })} options={RECHARGES} />}
            <button className={`btn icon sm ghost ${gear === r.id ? 'on' : ''}`} title={`Comes back: ${RECHARGES.find((x) => x.id === r.recharge)?.name ?? r.recharge} (click to change)`}
              onClick={() => setGear(gear === r.id ? '' : r.id)}>⚙</button>
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
