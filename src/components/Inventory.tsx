import { useState } from 'react'
import { ACTION_TYPES, ITEM_CATEGORIES, RARITIES, SLOT_IDS } from '../constants'
import { carryCapacity, totalWeight } from '../calc'
import { newItem } from '../blank'
import { useChar, useStore, useUI } from '../store'
import { Area, EffectsEditor, Modal, Num, Select, Switch } from './ui'
import { guessIcon, Icon, ICONS, itemIcon } from './Icon'
import type { Item } from '../types'

const rarityClass = (i: Item) => (i.magic ? `r-${i.rarity.replace(' ', '-')}` : 'r-common')
const slotOptions = [{ id: '', name: 'Not equipped' }, ...SLOT_IDS.map((s) => ({ id: s.id, name: s.name + (s.id.startsWith('ring') ? ` (${s.id.slice(-1)})` : '') }))]

export function Inventory() {
  const open = useUI((s) => s.inventoryOpen)
  const set = useUI((s) => s.set)
  if (!open) return null
  return <InventoryInner onClose={() => set({ inventoryOpen: false })} />
}

/** "16 rations" / "rations x16" → { qty: 16, name: 'rations' } */
function parseGear(text: string): { qty: number; name: string } {
  const t = text.trim()
  let m = t.match(/^(\d+)\s*[x×]?\s+(.+)$/i)
  if (m) return { qty: +m[1], name: m[2] }
  m = t.match(/^(.+?)\s*(?:[x×]\s*(\d+)|\((\d+)\))$/i)
  if (m) return { qty: +(m[2] ?? m[3]), name: m[1] }
  return { qty: 1, name: t }
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
  const match = (i: Item) => !q || i.name.toLowerCase().includes(q.toLowerCase())
  const magic = c.items.filter((i) => i.magic && !i.slot && match(i))
  const gear = c.items.filter((i) => !i.magic && !i.slot && match(i))
  const cells = Math.max(12, Math.ceil((magic.length + 1) / 6) * 6)

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

  const addGear = () => {
    if (!draft.trim()) return
    const { qty, name } = parseGear(draft)
    const it = { ...newItem(false), name, qty }
    patch((d) => { d.items.push(it) })
    setDraft('')
  }
  const addMagic = () => {
    const it = newItem(true)
    patch((d) => { d.items.push(it) })
    set({ inventorySelected: it.id })
  }

  const drag = (i: Item) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData('text/item', i.id); e.dataTransfer.effectAllowed = 'move' },
  })
  const unequipDrop = (zone: string) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(zone) },
    onDragLeave: () => setOver(''),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setOver(''); const id = e.dataTransfer.getData('text/item'); if (id) equip(id, '') },
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
          <div className="muted small" style={{ marginTop: 8 }}>Drag any item here to equip it. Equipped magic items apply their linked bonuses.</div>
        </div>

        {/* backpack */}
        <div className="col" style={{ minWidth: 0, gap: 12 }}>
          <div className={over === 'magic' ? 'inv-drop' : ''} {...unequipDrop('magic')}>
            <div className="inv-sec-head">
              <span className="field-lbl">Magic items</span>
              <button className="btn primary sm" onClick={addMagic}>＋ Magic item</button>
            </div>
            <div className="magic-grid">
              {Array.from({ length: cells }, (_, n) => {
                const it = magic[n]
                return it ? (
                  <div key={it.id} className={`tile ${rarityClass(it)} ${it.id === sel ? 'sel' : ''}`} title={it.name}
                    onClick={() => set({ inventorySelected: it.id })} {...drag(it)}>
                    <Icon name={itemIcon(it)} />
                    {it.qty > 1 && <span className="qty">{it.qty}</span>}
                    {it.attunement && <span className="att">{it.attuned ? '✦' : '✧'}</span>}
                    <span className="cap">{it.name || 'Unnamed'}</span>
                  </div>
                ) : <div key={'e' + n} className="tile empty-slot" />
              })}
            </div>
          </div>

          <div className={over === 'gear' ? 'inv-drop' : ''} {...unequipDrop('gear')}>
            <div className="inv-sec-head"><span className="field-lbl">Equipment & gear</span></div>
            <div className="gear-list">
              <div className="gear-row head"><span /><span style={{ textAlign: 'center' }}>Qty</span><span>Item</span><span style={{ textAlign: 'right' }}>lb ea.</span><span /><span /></div>
              {gear.map((it) => (
                <div key={it.id} className={`gear-row ${it.id === sel ? 'sel' : ''}`} onClick={() => set({ inventorySelected: it.id })}>
                  <span className="grip" title="Drag to equip" {...drag(it)}><Icon name={itemIcon(it)} className="gico" /></span>
                  <Num min={0} className="qty-in" value={it.qty} onChange={(n) => up(it.id, (x) => { x.qty = n })} />
                  <input value={it.name} placeholder="item" onChange={(e) => up(it.id, (x) => { x.name = e.target.value })} />
                  <Num min={0} className="lb-in" value={it.weight} onChange={(n) => up(it.id, (x) => { x.weight = n })} />
                  <button className="btn sm ghost" title="Turn into a magic item (rarity, attunement, effects…)"
                    onClick={(e) => { e.stopPropagation(); up(it.id, (x) => { x.magic = true; if (x.icon === 'box') x.icon = guessIcon(x.name) }); set({ inventorySelected: it.id }) }}>✦</button>
                  <button className="btn sm ghost" title="Remove"
                    onClick={(e) => { e.stopPropagation(); patch((d) => { d.items = d.items.filter((y) => y.id !== it.id) }) }}>✕</button>
                </div>
              ))}
              <div className="gear-add">
                <span className="muted">＋</span>
                <input value={draft} placeholder="Add gear and press Enter, e.g. “16 rations” or “Torch x9”"
                  onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGear()} />
              </div>
            </div>
          </div>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map((k) => (
              <div className="coin" key={k}>
                <Num min={0} value={c.coins[k]} onChange={(n) => patch((d) => { d.coins[k] = n })} />
                <span>{k.toUpperCase()}</span>
              </div>
            ))}
            <span className="muted small" style={{ marginLeft: 8 }}>Coins weigh 1 lb per 50.</span>
          </div>
        </div>

        {/* detail */}
        <div>
          {selected
            ? selected.magic ? <MagicEditor key={selected.id} item={selected} /> : <GearEditor key={selected.id} item={selected} />
            : <div className="empty">Click a magic item (or any equipped item) to see its details. Everyday gear is edited right in the list.</div>}
        </div>
      </div>
    </Modal>
  )
}

function useItem(item: Item) {
  const patch = useStore((s) => s.patch)
  const set = useUI((s) => s.set)
  const up = (fn: (i: Item) => void) => patch((d) => { const x = d.items.find((y) => y.id === item.id); if (x) fn(x) })
  const setSlot = (v: string) => patch((d) => {
    if (v) { const o = d.items.find((i) => i.slot === v && i.id !== item.id); if (o) o.slot = '' }
    const x = d.items.find((y) => y.id === item.id)
    if (x) x.slot = v
  })
  const remove = () => {
    if (!window.confirm(`Delete ${item.name || 'this item'}?`)) return
    set({ inventorySelected: '' })
    patch((d) => { d.items = d.items.filter((y) => y.id !== item.id) })
  }
  return { up, setSlot, remove }
}

/** Everyday gear: name, amount, weight, a note, where it's worn. */
function GearEditor({ item }: { item: Item }) {
  const { up, setSlot, remove } = useItem(item)
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row">
        <span className={`icon-pick-btn ${rarityClass(item)}`}><Icon name={itemIcon(item)} /></span>
        <input className="box-input grow" placeholder="Item name" value={item.name} onChange={(e) => up((x) => { x.name = e.target.value })} />
      </div>
      <div className="row">
        <span className="field-lbl">Qty</span>
        <Num min={0} className="box-input" width={54} style={{ textAlign: 'center' }} value={item.qty} onChange={(n) => up((x) => { x.qty = n })} />
        <span className="field-lbl" style={{ marginLeft: 6 }}>Lb ea.</span>
        <Num min={0} className="box-input" width={54} value={item.weight} onChange={(n) => up((x) => { x.weight = n })} />
      </div>
      <div className="row"><span className="field-lbl">Worn in</span><Select value={item.slot} onChange={setSlot} options={slotOptions} /></div>
      <Area className="box-input" minRows={3} placeholder="Notes (optional)" value={item.description} onChange={(v) => up((x) => { x.description = v })} />
      <button className="btn" onClick={() => up((x) => { x.magic = true; if (x.icon === 'box') x.icon = guessIcon(x.name) })}>✦ Turn into a magic item</button>
      <button className="btn danger" onClick={remove}>Delete</button>
    </div>
  )
}

/** Magic items: the full detail. */
function MagicEditor({ item }: { item: Item }) {
  const { up, setSlot, remove } = useItem(item)
  const [picking, setPicking] = useState(false)
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row">
        <button className={`icon-pick-btn ${rarityClass(item)}`} title="Change icon" onClick={() => setPicking(!picking)}><Icon name={item.icon} /></button>
        <input className="box-input grow" placeholder="Item name" autoFocus={!item.name} value={item.name} onChange={(e) => up((x) => { x.name = e.target.value })} />
      </div>
      {picking && (
        <div className="icon-grid">
          {Object.entries(ICONS).map(([key, ic]) => (
            <button key={key} className={item.icon === key ? 'on' : ''} title={ic.name} onClick={() => { up((x) => { x.icon = key }); setPicking(false) }}>
              <Icon name={key} />
            </button>
          ))}
        </div>
      )}
      <div className="row">
        <Select value={item.category} onChange={(v) => up((x) => { x.category = v; const cat = ITEM_CATEGORIES.find((k) => k.name === v); if (cat) x.icon = cat.icon })}
          options={ITEM_CATEGORIES.map((k) => ({ id: k.name, name: k.name }))} />
        <Select value={item.rarity} onChange={(v) => up((x) => { x.rarity = v })} options={RARITIES.map((r) => ({ id: r, name: r }))} />
      </div>
      <div className="row">
        <span className="field-lbl">Qty</span>
        <button className="btn icon sm" onClick={() => up((x) => { x.qty = Math.max(0, x.qty - 1) })}>−</button>
        <Num min={0} className="box-input" width={54} style={{ textAlign: 'center' }} value={item.qty} onChange={(n) => up((x) => { x.qty = n })} />
        <button className="btn icon sm" onClick={() => up((x) => { x.qty += 1 })}>＋</button>
        <span className="field-lbl" style={{ marginLeft: 6 }}>Lb ea.</span>
        <Num min={0} className="box-input" width={54} value={item.weight} onChange={(n) => up((x) => { x.weight = n })} />
      </div>
      <div className="row">
        <span className="field-lbl">Value</span>
        <input className="box-input grow" placeholder="e.g. 50 gp" value={item.value} onChange={(e) => up((x) => { x.value = e.target.value })} />
      </div>
      <div className="row"><span className="field-lbl">Worn in</span><Select value={item.slot} onChange={setSlot} options={slotOptions} /></div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 14 }}>
        <label className="row small"><Switch on={item.attunement} onChange={(b) => up((x) => { x.attunement = b; if (!b) x.attuned = false })} /> Requires attunement</label>
        {item.attunement && <label className="row small"><Switch on={item.attuned} onChange={(b) => up((x) => { x.attuned = b })} /> Attuned</label>}
      </div>
      <Area className="box-input" minRows={4} placeholder="Description / properties" value={item.description} onChange={(v) => up((x) => { x.description = v })} />
      <div className="row">
        <span className="field-lbl">Usable as</span>
        <Select value={item.actionType} onChange={(v) => up((x) => { x.actionType = v })} options={ACTION_TYPES} />
      </div>
      <div>
        <div className="field-lbl" style={{ marginBottom: 4 }}>What it changes (applies while equipped{item.attunement ? ' & attuned' : ''})</div>
        <EffectsEditor effects={item.effects} onChange={(e) => up((x) => { x.effects = e })} />
      </div>
      <button className="btn" onClick={() => {
        if ((item.effects.length || item.attunement) && !window.confirm('Make this everyday gear? Its linked effects and attunement will be removed.')) return
        up((x) => { x.magic = false; x.effects = []; x.attunement = false; x.attuned = false; x.rarity = 'common'; x.actionType = 'none' })
      }}>Make everyday gear</button>
      <button className="btn danger" onClick={remove}>Delete item</button>
    </div>
  )
}
