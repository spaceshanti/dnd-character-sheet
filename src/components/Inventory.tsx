import { useRef, useState, type ReactNode } from 'react'
import { ABILITIES, ACTION_TYPES, ITEM_CATEGORIES, RARITIES, SLOT_IDS } from '../constants'
import { attackInfo, carryCapacity, itemAttacks, masterySource, signed, totalWeight } from '../calc'
import { newItem } from '../blank'
import { isAK } from '../systems'
import { bestItemFor } from '../itemLib'
import { systemOf, type SystemId } from '../systems'
import { ammoOptions, ammoText } from '../consume'
import { MASTERIES, MASTERY_INFO, akGearExtras, lookupArmor, lookupWeapon, weaponNames } from '../data/gear'
import { PropertyEditor, WeaponTags } from './WeaponTags'
import { imageToDataUrl, useChar, useStore, useUI } from '../store'
import { EffectsEditor, Modal, Num, Select, Switch } from './ui'
import { RichArea } from './RichText'
import { Icon, ICONS, itemIcon } from './Icon'
import type { ArmorStats, Item, WeaponStats } from '../types'

const rarityClass = (i: Item) => `r-${i.rarity.replace(' ', '-')}`
const slotName = (id: string) => SLOT_IDS.find((s) => s.id === id)?.name ?? ''
const slotOptions = [{ id: '', name: 'Not equipped' }, ...SLOT_IDS.map((s) => ({ id: s.id, name: s.name + (s.id.startsWith('ring') ? ` (${s.id.slice(-1)})` : '') }))]

export function Inventory() {
  const open = useUI((s) => s.inventoryOpen)
  const set = useUI((s) => s.set)
  if (!open) return null
  return <InventoryInner onClose={() => set({ inventoryOpen: false })} />
}

/** "16 rations" / "rations x16" / "Torches (9)" → { qty, name } */
function parseGear(text: string): { qty: number; name: string } {
  const t = text.trim()
  let m = t.match(/^(\d+)\s*[x×]?\s+(.+)$/i)
  if (m) return { qty: +m[1], name: m[2] }
  m = t.match(/^(.+?)\s*(?:[x×]\s*(\d+)|\((\d+)\))$/i)
  if (m) return { qty: +(m[2] ?? m[3]), name: m[1] }
  return { qty: 1, name: t }
}

/** A new item from a typed line, pre-filled with standard weapon / armor stats when the name matches. */
function itemFromText(text: string, sys: SystemId): Item {
  const { qty, name } = parseGear(text)
  // "Longsword +1", "+2 Chain Mail": the number becomes the magic bonus
  const plus = +((name.match(/(?:^|\s)\+([1-3])\b/) || [])[1] || 0)
  const lib = bestItemFor(name, sys)
  // a named magic weapon / armour ("Blacksteel": "Weapon (Handgun), Artifact") takes its base item's stats
  const base = /^(?:Weapon|Armou?r)\s*\(([^)]+)\)/i.exec(lib?.d ?? '')?.[1] ?? ''
  const weapon = lookupWeapon(name, sys) ?? (base ? lookupWeapon(base, sys) : null)
  const armor = weapon ? null : lookupArmor(name, sys) ?? (base ? lookupArmor(base, sys) : null)
  if (weapon) weapon.magicBonus = plus
  if (armor) armor.bonus = plus
  // Arknights gear: armour Damage Reduction / Conductive spell bonus while equipped, plus the table's notes
  const ak = sys === 'ak5e' && (weapon || armor) ? akGearExtras(name) ?? (base ? akGearExtras(base) : null) : null
  return {
    ...newItem(), name, qty, weapon, armor,
    category: weapon ? 'Weapon' : armor ? 'Armor' : lib?.k ?? 'Misc',
    description: lib?.d || ak?.description || '', weight: lib?.w || ak?.weight || 0, value: lib?.m ? lib.c : lib?.c || ak?.value || '',
    effects: ak?.effects ?? [],
    rarity: plus ? (plus === 1 ? 'uncommon' : plus === 2 ? 'rare' : 'very rare') : lib?.r ?? 'common',
    attunement: lib?.a ?? false,
  }
}

function InventoryInner({ onClose }: { onClose: () => void }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const sel = useUI((s) => s.inventorySelected)
  const set = useUI((s) => s.set)
  const [q, setQ] = useState('')
  const [over, setOver] = useState('')
  const [draft, setDraft] = useState('')

  const w = totalWeight(c)
  const cap = carryCapacity(c)
  const ratio = w / Math.max(1, cap)
  const attuned = c.items.filter((i) => i.attunement && i.attuned).length
  const selected = c.items.find((i) => i.id === sel)
  const list = c.items.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()))

  const equip = (itemId: string, slot: string) =>
    patch((d) => {
      const it = d.items.find((i) => i.id === itemId)
      if (!it) return
      if (slot) {
        const other = d.items.find((i) => i.slot === slot && i.id !== itemId)
        if (other) other.slot = ''
      }
      it.slot = slot
    })
  const up = (id: string, fn: (i: Item) => void) => patch((d) => { const x = d.items.find((y) => y.id === id); if (x) fn(x) })

  const add = () => {
    if (!draft.trim()) return
    const it = itemFromText(draft, systemOf(c))
    patch((d) => { d.items.push(it) })
    setDraft('')
  }

  const drag = (i: Item) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData('text/item', i.id); e.dataTransfer.effectAllowed = 'move' },
  })

  return (
    <Modal
      wide
      title={<span className="row" style={{ gap: 8 }}><Icon name="pack" /> Inventory</span>}
      onClose={onClose}
      tools={
        <div className="row small" style={{ gap: 14 }}>
          <input className="box-input" style={{ width: 150 }} placeholder="search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span title="Attuned magic items (max 3)" style={{ color: attuned > 3 ? 'var(--dis)' : undefined }}>✦ Attuned {attuned}/3</span>
          <div style={{ width: 150 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><b>{w}</b><span className="muted">/ {cap} lb</span></div>
            <div className={`weight-bar ${ratio > 1 ? 'over' : ratio > 0.66 ? 'heavy' : ''}`}><i style={{ width: Math.min(100, ratio * 100) + '%' }} /></div>
          </div>
        </div>
      }
    >
      <div className="inv">
        {/* equipped */}
        <div>
          <div className="field-lbl" style={{ marginBottom: 6 }}>Equipped</div>
          <div className="slot-grid">
            {SLOT_IDS.map((s) => {
              const it = c.items.find((i) => i.slot === s.id)
              return (
                <div
                  key={s.id}
                  className={`eq-slot ${it ? rarityClass(it) : ''} ${over === s.id ? 'drop' : ''} ${it && it.id === sel ? 'sel' : ''}`}
                  title={it ? `${it.name} — ${s.name}` : s.name}
                  onDragOver={(e) => { e.preventDefault(); setOver(s.id) }}
                  onDragLeave={() => setOver('')}
                  onDrop={(e) => { e.preventDefault(); setOver(''); const id = e.dataTransfer.getData('text/item'); if (id) equip(id, s.id) }}
                  onClick={() => it && set({ inventorySelected: it.id })}
                  {...(it ? drag(it) : {})}
                >
                  {it ? (
                    <>
                      <Icon name={itemIcon(it)} />
                      <span className="cap">{it.name || 'Unnamed'}</span>
                      {it.qty > 1 && <span className="qty">{it.qty}</span>}
                      {it.attunement && <span className="att">{it.attuned ? '✦' : '✧'}</span>}
                    </>
                  ) : (
                    <><span className="ph"><Icon name={s.icon} /></span><span className="cap" style={{ background: 'transparent', color: '#888' }}>{s.name}</span></>
                  )}
                </div>
              )
            })}
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>Drag items here from the list to equip them. Worn armor and shields count toward AC.</div>
        </div>

        {/* the list: every item, added by typing a line */}
        <div className="col" style={{ minWidth: 0, gap: 12 }}>
          <div
            className={over === 'list' ? 'inv-drop' : ''}
            onDragOver={(e) => { e.preventDefault(); setOver('list') }}
            onDragLeave={() => setOver('')}
            onDrop={(e) => { e.preventDefault(); setOver(''); const id = e.dataTransfer.getData('text/item'); if (id) equip(id, '') }}
          >
            <div className="gear-list">
              <div className="gear-row head"><span /><span>Item</span><span style={{ textAlign: 'center' }}>Qty</span><span style={{ textAlign: 'right' }}>lb ea.</span><span /><span /></div>
              {list.map((it) => (
                <div key={it.id} className={`gear-row ${it.id === sel ? 'sel' : ''} ${it.slot ? 'worn' : ''}`} onClick={() => set({ inventorySelected: it.id })}>
                  <span className={`grip ${rarityClass(it)}`} title="Drag to an equipment slot" {...drag(it)}><Icon name={itemIcon(it)} className="gico" /></span>
                  <span className="row" style={{ gap: 6, minWidth: 0 }}>
                    <input value={it.name} placeholder="item" onChange={(e) => up(it.id, (x) => { x.name = e.target.value })} />
                    {it.weapon && <span className="itag" title="Weapon: listed under Weapons & Attacks">ATK</span>}
                    {it.armor && <span className="itag" title={it.armor.kind === 'shield' ? 'Shield' : 'Armor'}>{it.armor.kind === 'shield' ? `+${it.armor.ac + it.armor.bonus}` : it.armor.ac + it.armor.bonus} AC</span>}
                    {it.rarity !== 'common' && <span className={`rdot ${rarityClass(it)}`} title={it.rarity} />}
                    {it.attunement && <span title={it.attuned ? 'Attuned' : 'Needs attunement'}>{it.attuned ? '✦' : '✧'}</span>}
                    {it.slot && <span className="itag worn-tag">{slotName(it.slot)}</span>}
                  </span>
                  <span className="qty-step" onClick={(e) => e.stopPropagation()}>
                    <Num min={0} className="qty-in" value={it.qty} onChange={(n) => up(it.id, (x) => { x.qty = n })} />
                    <span className="arrows">
                      <button type="button" title="One more" onClick={() => up(it.id, (x) => { x.qty += 1 })}>▲</button>
                      <button type="button" title="One fewer" onClick={() => up(it.id, (x) => { x.qty = Math.max(0, x.qty - 1) })}>▼</button>
                    </span>
                  </span>
                  <Num min={0} className="lb-in" value={it.weight} onChange={(n) => up(it.id, (x) => { x.weight = n })} />
                  <button className="btn sm ghost" title="Details" onClick={(e) => { e.stopPropagation(); set({ inventorySelected: it.id }) }}>›</button>
                  <button className="btn sm ghost" title="Remove"
                    onClick={(e) => { e.stopPropagation(); if (sel === it.id) set({ inventorySelected: '' }); patch((d) => { d.items = d.items.filter((y) => y.id !== it.id) }) }}>✕</button>
                </div>
              ))}
              <div className="gear-add">
                <span className="muted">＋</span>
                <input value={draft} placeholder="Type an item and press Enter, e.g. “Longsword”, “Chain Mail”, “16 rations”"
                  onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
              </div>
            </div>
            <div className="muted small" style={{ marginTop: 6 }}>Standard weapons and armor fill in their stats automatically. Click a line to add more detail.</div>
          </div>

          {isAK(c) ? (
            <div className="row">
              <div className="coin lmd">
                <Num min={0} max={999999999} value={c.ak.lmd} onChange={(n) => patch((d) => { d.ak.lmd = n })} />
                <span>LMD</span>
              </div>
              <span className="muted small" style={{ marginLeft: 8 }}>Lungmen Dollars</span>
            </div>
          ) : (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map((k) => (
              <div className="coin" key={k}>
                <Num min={0} value={c.coins[k]} onChange={(n) => patch((d) => { d.coins[k] = n })} />
                <span>{k.toUpperCase()}</span>
              </div>
            ))}
            <span className="muted small" style={{ marginLeft: 8 }}>Coins weigh 1 lb per 50.</span>
          </div>
          )}
        </div>

        {/* details */}
        <div>
          {selected ? <ItemEditor key={selected.id} item={selected} />
            : <div className="empty">Click an item to expand it: weapon stats, armor, magic properties, notes.</div>}
        </div>
      </div>
    </Modal>
  )
}

function Section({ title, open, children, right }: { title: string; open: boolean; children: ReactNode; right?: ReactNode }) {
  return (
    <details className="item-sec" open={open}>
      <summary><span className="grow">{title}</span>{right}</summary>
      <div className="col" style={{ gap: 8, paddingTop: 6 }}>{children}</div>
    </details>
  )
}

const DEFAULT_WEAPON: WeaponStats = { damage: '1d6', damageType: '', ability: 'str', proficient: true, magicBonus: 0, range: '', properties: '', kind: '', mastery: '', ammoId: '', ammoCost: 1 }
const DEFAULT_ARMOR: ArmorStats = { kind: 'light', ac: 11, bonus: 0 }

/** One editor for every item; the extra sections are folded away until you need them. */
function ItemEditor({ item }: { item: Item }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const set = useUI((s) => s.set)
  const [picking, setPicking] = useState(false)
  const up = (fn: (i: Item) => void) => patch((d) => { const x = d.items.find((y) => y.id === item.id); if (x) fn(x) })
  const upW = (fn: (w: WeaponStats) => void) => up((x) => { if (x.weapon) fn(x.weapon) })
  const upA = (fn: (a: ArmorStats) => void) => up((x) => { if (x.armor) fn(x.armor) })
  const setSlot = (v: string) => patch((d) => {
    if (v) { const o = d.items.find((i) => i.slot === v && i.id !== item.id); if (o) o.slot = '' }
    const x = d.items.find((y) => y.id === item.id)
    if (x) x.slot = v
  })
  // a picture of your own for this item (kept small; transparent PNGs stay transparent)
  const pictureFile = useRef<HTMLInputElement>(null)
  const ownPicture = async (f?: File) => {
    if (!f || !f.type.startsWith('image/')) return
    const url = await imageToDataUrl(f, 256, true)
    up((x) => { x.icon = url })
    setPicking(false)
  }
  const atk = item.weapon ? itemAttacks(c).find((a) => a.itemId === item.id) : undefined
  const atkInfo = atk ? attackInfo(c, atk) : null
  const armorSlot = item.armor?.kind === 'shield' ? 'off' : 'body'
  const armorCounts = item.armor && (item.armor.kind === 'shield' ? item.slot === 'off' || item.slot === 'main' : item.slot === 'body')
  const magicish = item.rarity !== 'common' || item.attunement || item.effects.length > 0 || item.actionType !== 'none'

  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row">
        <button className={`icon-pick-btn ${rarityClass(item)}`} title="Change icon (or drop a picture here)" onClick={() => setPicking(!picking)}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); ownPicture(e.dataTransfer.files[0]) }}>
          <Icon name={itemIcon(item)} />
        </button>
        <input ref={pictureFile} type="file" accept="image/*" hidden onChange={(e) => { ownPicture(e.target.files?.[0]); e.target.value = '' }} />
        <input className="box-input grow" placeholder="Item name" value={item.name} onChange={(e) => up((x) => { x.name = e.target.value })} />
      </div>
      {picking && (
        <div>
        <div className="icon-own">
          <button className="btn sm" onClick={() => pictureFile.current?.click()}>Use my own picture…</button>
          {item.icon.startsWith('data:') && <button className="btn sm ghost" onClick={() => up((x) => { x.icon = 'box' })}>Remove picture</button>}
          <span className="muted small">or drop one on the icon</span>
        </div>
        <div className="icon-grid">
          {Object.entries(ICONS).map(([key, ic]) => (
            <button key={key} className={itemIcon(item) === key ? 'on' : ''} title={ic.name} onClick={() => { up((x) => { x.icon = key }); setPicking(false) }}>
              <Icon name={key} />
            </button>
          ))}
        </div>
        </div>
      )}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <span className="field-lbl">Qty</span>
        <button className="btn icon sm" onClick={() => up((x) => { x.qty = Math.max(0, x.qty - 1) })}>−</button>
        <Num min={0} className="box-input" width={50} style={{ textAlign: 'center' }} value={item.qty} onChange={(n) => up((x) => { x.qty = n })} />
        <button className="btn icon sm" onClick={() => up((x) => { x.qty += 1 })}>＋</button>
        <span className="field-lbl" style={{ marginLeft: 4 }}>Lb ea.</span>
        <Num min={0} className="box-input" width={50} value={item.weight} onChange={(n) => up((x) => { x.weight = n })} />
      </div>
      <div className="row"><span className="field-lbl">Worn in</span><Select value={item.slot} onChange={setSlot} options={slotOptions} /></div>

      <Section title="Weapon" open={!!item.weapon}
        right={<Switch on={!!item.weapon} title="Can attack with this" onChange={(b) => up((x) => { x.weapon = b ? (lookupWeapon(x.name, systemOf(c)) ?? { ...DEFAULT_WEAPON }) : null; if (b && x.category === 'Misc') x.category = 'Weapon' })} />}>
        {!item.weapon ? <div className="muted small">Switch on to list this under Weapons & Attacks.</div> : (
          <>
            {atkInfo && atk && (
              <div className="atk-line">
                <b>{signed(atkInfo.bonus)}</b> to hit · <b>{atkInfo.damage}</b> {item.weapon.damageType}
                <WeaponTags properties={item.weapon.properties} mastery={item.weapon.mastery} masteryFrom={atk.masteryFrom} />
              </div>
            )}
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <input className="box-input" style={{ width: 70 }} placeholder="1d8" value={item.weapon.damage} onChange={(e) => upW((w) => { w.damage = e.target.value })} />
              <input className="box-input" style={{ width: 100 }} placeholder="piercing" value={item.weapon.damageType} onChange={(e) => upW((w) => { w.damageType = e.target.value })} />
              <input className="box-input" style={{ width: 80 }} placeholder="range" value={item.weapon.range} onChange={(e) => upW((w) => { w.range = e.target.value })} />
            </div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <Select value={item.weapon.ability} onChange={(v) => upW((w) => { w.ability = v })}
                options={[...ABILITIES.map((a) => ({ id: a.key as WeaponStats['ability'], name: a.short })), { id: 'finesse' as const, name: 'Finesse (STR/DEX)' }]} />
              <label className="row small"><Switch on={item.weapon.proficient} onChange={(b) => upW((w) => { w.proficient = b })} /> Proficient</label>
              <span className="small">Magic +</span><Num className="box-input" width={40} value={item.weapon.magicBonus} onChange={(n) => upW((w) => { w.magicBonus = n })} />
            </div>
            <div className="field-lbl">Properties</div>
            <PropertyEditor value={item.weapon.properties} onChange={(v) => upW((w) => { w.properties = v })} />
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <span className="field-lbl">Uses up</span>
              <Select value={item.weapon.ammoId} onChange={(v) => upW((w) => { w.ammoId = v })} options={ammoOptions(c, item.id)} />
              {item.weapon.ammoId && <><span className="small">×</span><Num min={1} max={20} className="box-input" width={36} value={item.weapon.ammoCost} onChange={(n) => upW((w) => { w.ammoCost = n })} /><span className="small">per attack</span></>}
            </div>
            {item.weapon.ammoId && <div className="small muted">{ammoText(c, item.weapon.ammoId, item.weapon.ammoCost)}: the Use button in Weapons & Attacks counts it down.</div>}
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <span className="field-lbl">Kind</span>
              <Select value={item.weapon.kind} onChange={(v) => upW((w) => { const std = lookupWeapon(v, systemOf(c)); w.kind = v; if (std) w.mastery = std.mastery })}
                options={[{ id: '', name: 'Custom / other' }, ...weaponNames(systemOf(c)).map((n) => ({ id: n, name: n }))]} />
              <span className="field-lbl">Mastery</span>
              <Select value={item.weapon.mastery} onChange={(v) => upW((w) => { w.mastery = v })}
                options={[{ id: '', name: 'None' }, ...MASTERIES.map((m) => ({ id: m, name: m }))]} />
            </div>
            {item.weapon.mastery && (masterySource(c, item.weapon)
              ? <div className="small" style={{ color: 'var(--good)' }} title={MASTERY_INFO[item.weapon.mastery]}>◆ {item.weapon.mastery} unlocked by {masterySource(c, item.weapon)}: {MASTERY_INFO[item.weapon.mastery]}</div>
              : <div className="small muted" title={MASTERY_INFO[item.weapon.mastery]}>◇ {item.weapon.mastery} is locked: needs a feature that grants weapon mastery with {item.weapon.kind ? `${item.weapon.kind}s` : 'this weapon'}.</div>)}
          </>
        )}
      </Section>

      <Section title="Armor / shield" open={!!item.armor}
        right={<Switch on={!!item.armor} title="Counts toward AC when worn" onChange={(b) => up((x) => { x.armor = b ? (lookupArmor(x.name, systemOf(c)) ?? { ...DEFAULT_ARMOR }) : null; if (b && x.category === 'Misc') x.category = 'Armor' })} />}>
        {!item.armor ? <div className="muted small">Switch on for armor or a shield.</div> : (
          <>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <Select value={item.armor.kind} onChange={(v) => upA((a) => { a.kind = v; if (v === 'shield' && a.ac > 5) a.ac = 2 })}
                options={[{ id: 'light', name: 'Light (+ DEX)' }, { id: 'medium', name: 'Medium (+ DEX, max 2)' }, { id: 'heavy', name: 'Heavy (no DEX)' }, { id: 'shield', name: 'Shield' }]} />
              <span className="small">{item.armor.kind === 'shield' ? 'AC +' : 'Base AC'}</span>
              <Num min={0} className="box-input" width={44} value={item.armor.ac} onChange={(n) => upA((a) => { a.ac = n })} />
              <span className="small">Magic +</span><Num className="box-input" width={40} value={item.armor.bonus} onChange={(n) => upA((a) => { a.bonus = n })} />
            </div>
            {armorCounts
              ? <div className="small" style={{ color: 'var(--good)' }}>✓ Counting toward your AC.</div>
              : <div className="row small"><span className="muted">Not counted until worn in {item.armor.kind === 'shield' ? 'a hand' : 'Armor / Body'}.</span>
                <button className="btn sm" onClick={() => setSlot(armorSlot)}>Equip</button></div>}
          </>
        )}
      </Section>

      <Section title="Magic & effects" open={magicish}>
        <div className="row">
          <Select value={item.category} onChange={(v) => up((x) => { x.category = v; const cat = ITEM_CATEGORIES.find((k) => k.name === v); if (cat && x.icon === 'box') x.icon = cat.icon })}
            options={ITEM_CATEGORIES.map((k) => ({ id: k.name, name: k.name }))} />
          <Select value={item.rarity} onChange={(v) => up((x) => { x.rarity = v })} options={RARITIES.map((r) => ({ id: r, name: r }))} />
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 14 }}>
          <label className="row small"><Switch on={item.attunement} onChange={(b) => up((x) => { x.attunement = b; if (!b) x.attuned = false })} /> Requires attunement</label>
          {item.attunement && <label className="row small"><Switch on={item.attuned} onChange={(b) => up((x) => { x.attuned = b })} /> Attuned</label>}
        </div>
        <div className="row">
          <span className="field-lbl">Usable as</span>
          <Select value={item.actionType} onChange={(v) => up((x) => { x.actionType = v })} options={ACTION_TYPES} />
        </div>
        <div className="field-lbl">What it changes (while equipped{item.attunement ? ' & attuned' : ''})</div>
        <EffectsEditor effects={item.effects} onChange={(e) => up((x) => { x.effects = e })} />
      </Section>

      <Section title="Description" open={!!item.description || !!item.value}>
        <ItemTextSource item={item} />
        <div className="row">
          <span className="field-lbl">Value</span>
          <input className="box-input grow" placeholder="e.g. 50 gp" value={item.value} onChange={(e) => up((x) => { x.value = e.target.value })} />
        </div>
        <RichArea className="box-input" minRows={3} placeholder="Description / properties" value={item.description} onChange={(v) => up((x) => { x.description = v })} />
      </Section>

      <button className="btn danger" onClick={() => {
        if (!window.confirm(`Delete ${item.name || 'this item'}?`)) return
        set({ inventorySelected: '' })
        patch((d) => { d.items = d.items.filter((y) => y.id !== item.id) })
      }}>Delete item</button>
    </div>
  )
}

/** Fill an item's description from the bundled SRD library, or fetch it from wikidot by name / link. */
function ItemTextSource({ item }: { item: Item }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const up = (fn: (i: Item) => void) => patch((d) => { const x = d.items.find((y) => y.id === item.id); if (x) fn(x) })
  const lib = bestItemFor(item.name, systemOf(c))
  const replaceOk = () => !item.description.trim() || window.confirm('Replace the current description?')
  const fetchIt = async () => {
    setMsg('')
    if (!window.sheetApi?.fetchItem) { setMsg('Fetching only works in the desktop app.'); return }
    setBusy(true)
    const r = await window.sheetApi.fetchItem(item.url || item.name)
    setBusy(false)
    if (r.error) { setMsg(r.error); return }
    if (!replaceOk()) return
    up((x) => {
      x.description = r.description || x.description
      if (r.url) x.url = r.url
      if (r.rarity) x.rarity = r.rarity as Item['rarity']
      if (r.attunement) x.attunement = true
    })
    setMsg('Fetched ✓')
  }
  return (
    <div className="col" style={{ gap: 4 }}>
      <div className="row" style={{ gap: 4 }}>
        <input className="box-input grow" placeholder="wikidot link (optional) — or leave empty to look up by name" value={item.url} onChange={(e) => up((x) => { x.url = e.target.value })} />
        <button className="btn sm" disabled={busy} onClick={fetchIt}>{busy ? 'Fetching…' : 'Fetch'}</button>
      </div>
      {lib && lib.d && (
        <div className="row small" style={{ gap: 4 }}>
          <span className="muted">Built-in library:</span>
          <button className="btn sm" onClick={() => { if (replaceOk()) up((x) => { x.description = lib.d; if (!x.weight && lib.w) x.weight = lib.w; if (!x.value && lib.c) x.value = lib.c; if (lib.m) { x.rarity = lib.r; x.attunement = lib.a } }) }}>
            Use {lib.n} ({lib.e} SRD)
          </button>
        </div>
      )}
      {msg && <div className="small" style={{ color: msg.endsWith('✓') ? 'var(--good)' : 'var(--dis)' }}>{msg}</div>}
    </div>
  )
}
