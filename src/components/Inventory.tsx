import { useMemo, useState } from 'react'
import { ACTION_TYPES, ITEM_CATEGORIES, RARITIES, SLOT_IDS } from '../constants'
import { carryCapacity, totalWeight } from '../calc'
import { newItem } from '../blank'
import { useChar, useStore, useUI } from '../store'
import { Area, EffectsEditor, Modal, Num, Select, Switch } from './ui'
import type { Item } from '../types'

const rarityClass = (i: Item) => `r-${i.rarity.replace(' ', '-')}`

export function Inventory() {
  const open = useUI((s) => s.inventoryOpen)
  const set = useUI((s) => s.set)
  if (!open) return null
  return <InventoryInner onClose={() => set({ inventoryOpen: false })} />
}

function InventoryInner({ onClose }: { onClose: () => void }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const sel = useUI((s) => s.inventorySelected)
  const set = useUI((s) => s.set)
  const [filter, setFilter] = useState('All')
  const [q, setQ] = useState('')
  const [over, setOver] = useState('')

  const w = totalWeight(c)
  const cap = carryCapacity(c)
  const ratio = w / Math.max(1, cap)
  const attuned = c.items.filter((i) => i.attunement && i.attuned).length
  const selected = c.items.find((i) => i.id === sel)

  const bag = useMemo(
    () => c.items.filter((i) => !i.slot && (filter === 'All' || i.category === filter) && (!q || i.name.toLowerCase().includes(q.toLowerCase()))),
    [c.items, filter, q],
  )
  const cats = ['All', ...Array.from(new Set(c.items.map((i) => i.category)))]
  const cells = Math.max(30, Math.ceil((bag.length + 1) / 6) * 6)

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

  const add = () => {
    const it = newItem()
    patch((d) => { d.items.push(it) })
    set({ inventorySelected: it.id })
  }

  const dragProps = (i: Item) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData('text/item', i.id); e.dataTransfer.effectAllowed = 'move' },
    onClick: () => set({ inventorySelected: i.id }),
  })

  return (
    <Modal
      wide
      title="🎒 Inventory"
      onClose={onClose}
      tools={
        <div className="row small" style={{ gap: 14 }}>
          <span title="Attuned magic items (max 3)" style={{ color: attuned > 3 ? 'var(--dis)' : undefined }}>✦ Attuned {attuned}/3</span>
          <div style={{ width: 160 }}>
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
                  {...(it ? dragProps(it) : {})}
                >
                  {it ? <>{it.icon}<span className="cap">{it.name || 'Unnamed'}</span>{it.attunement && <span className="att">{it.attuned ? '✦' : '✧'}</span>}</> : <><span className="ph">{s.icon}</span><span className="cap" style={{ background: 'transparent', color: '#888' }}>{s.name}</span></>}
                </div>
              )
            })}
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>Drag items here to equip them. Equipped (and attuned, if needed) items apply their linked bonuses.</div>
        </div>

        {/* bag */}
        <div className="col" style={{ minWidth: 0 }}>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div className="field-lbl">Backpack</div>
            <input className="box-input" style={{ width: 150 }} placeholder="search…" value={q} onChange={(e) => setQ(e.target.value)} />
            <span className="grow" />
            <button className="btn primary sm" onClick={add}>＋ New item</button>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
            {cats.map((x) => <button key={x} className={`chip ${filter === x ? 'accent' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setFilter(x)}>{x}</button>)}
          </div>
          <div
            className={`bag ${over === 'bag' ? 'drop' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver('bag') }}
            onDragLeave={() => setOver('')}
            onDrop={(e) => { e.preventDefault(); setOver(''); const id = e.dataTransfer.getData('text/item'); if (id) equip(id, '') }}
            style={over === 'bag' ? { outline: '2px dashed var(--accent)', outlineOffset: 4, borderRadius: 8 } : undefined}
          >
            {Array.from({ length: cells }, (_, n) => {
              const it = bag[n]
              return it ? (
                <div key={it.id} className={`tile ${rarityClass(it)} ${it.id === sel ? 'sel' : ''}`} title={it.name} {...dragProps(it)}>
                  {it.icon}
                  {it.qty > 1 && <span className="qty">{it.qty}</span>}
                  {it.attunement && <span className="att">{it.attuned ? '✦' : '✧'}</span>}
                  <span className="cap">{it.name || 'Unnamed'}</span>
                </div>
              ) : <div key={'e' + n} className="tile empty-slot" />
            })}
          </div>
          <div className="row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
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
          {selected ? <ItemEditor key={selected.id} item={selected} /> : <div className="empty">Select an item to see or edit its details.</div>}
        </div>
      </div>
    </Modal>
  )
}

function ItemEditor({ item }: { item: Item }) {
  const patch = useStore((s) => s.patch)
  const set = useUI((s) => s.set)
  const up = (fn: (i: Item) => void) => patch((d) => { const x = d.items.find((y) => y.id === item.id); if (x) fn(x) })
  const slotOptions = [{ id: '', name: 'In backpack' }, ...SLOT_IDS.map((s) => ({ id: s.id, name: s.name + (s.id.startsWith('ring') ? ` (${s.id.slice(-1)})` : '') }))]
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row">
        <input className="box-input" style={{ width: 52, textAlign: 'center', fontSize: 20 }} value={item.icon} title="Icon (type or paste any emoji)" onChange={(e) => up((x) => { x.icon = e.target.value.slice(-2) || '📦' })} />
        <input className="box-input grow" placeholder="Item name" autoFocus={!item.name} value={item.name} onChange={(e) => up((x) => { x.name = e.target.value })} />
      </div>
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
      <div className="row">
        <span className="field-lbl">Where</span>
        <Select value={item.slot} onChange={(v) => up((x) => {
          if (v) useStore.getState().patch((d) => { const o = d.items.find((i) => i.slot === v && i.id !== item.id); if (o) o.slot = '' })
          x.slot = v
        })} options={slotOptions} />
      </div>
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
      <button className="btn danger" onClick={() => { if (window.confirm(`Delete ${item.name || 'this item'}?`)) { set({ inventorySelected: '' }); patch((d) => { d.items = d.items.filter((y) => y.id !== item.id) }) } }}>Delete item</button>
    </div>
  )
}
