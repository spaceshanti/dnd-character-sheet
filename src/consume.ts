import { useStore } from './store'
import type { Character } from './types'

/** Take `cost` of an inventory item (arrows, bolts, components...). Returns a message for a toast. */
export function useItem(c: Character, itemId: string, cost: number, what: string): string {
  const it = c.items.find((i) => i.id === itemId)
  if (!it) return `${what}: its linked item is gone. Pick another in its details.`
  if (it.qty < cost) return `Out of ${it.name || 'ammo'}!`
  useStore.getState().patch((d) => { const x = d.items.find((i) => i.id === itemId); if (x) x.qty = Math.max(0, x.qty - cost) })
  return `${what} · used ${cost} ${it.name} · ${it.qty - cost} left`
}

/** "Crossbow Bolts · 59 left" for showing next to a weapon / spell */
export function ammoText(c: Character, itemId: string, cost: number): string {
  const it = c.items.find((i) => i.id === itemId)
  if (!it) return ''
  return `${cost > 1 ? `${cost} × ` : ''}${it.name || 'item'} · ${it.qty} left`
}

/** Options for an "uses up" dropdown: every other inventory item, ammo-looking ones first. */
export function ammoOptions(c: Character, excludeId = '') {
  const ammoLike = (n: string, k: string) => k === 'Ammo' || /arrow|bolt|bullet|needle|dart|shot|ammo/i.test(n)
  const items = c.items.filter((i) => i.id !== excludeId)
  items.sort((a, b) => Number(ammoLike(b.name, b.category)) - Number(ammoLike(a.name, a.category)) || a.name.localeCompare(b.name))
  return [{ id: '', name: 'Nothing' }, ...items.map((i) => ({ id: i.id, name: `${i.name || 'Unnamed'} (${i.qty})` }))]
}
