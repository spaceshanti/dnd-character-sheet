import { useStore } from './store'
import type { Character, Item } from './types'

/* ---------- ammunition ---------- */

const AMMO_NAME = /\b(arrows?|bolts?|bullets?|needles?|darts?|shots?|rounds?|cartridges?|shells?|magazines?|ammo|ammunition)\b/i

/** an item that's ammunition: its category is Ammo, or its name says so */
export const isAmmo = (i: Pick<Item, 'name' | 'category'>) => i.category === 'Ammo' || (AMMO_NAME.test(i.name) && !i.name.match(/\b(quiver|case|pouch|bag)\b/i))

/** a weapon that fires ammunition (D&D's Ammunition property, Arknights firearms / crossbows / bows) */
export const firesAmmo = (i: Item) => !!i.weapon && /\b(ammunition|firearm|reload|loading)\b/i.test(`${i.weapon.properties} ${i.weapon.kind}`)
  || !!i.weapon && /\b(bow|crossbow|sling|blowgun|pistol|musket|rifle|gun|firearm|launcher)\b/i.test(`${i.weapon.kind} ${i.name}`)

/** does this ammunition suit this weapon? (arrows for bows, bolts for crossbows, bullets for slings and guns…) */
export function ammoFits(weapon: Item, ammo: Item): boolean {
  const w = `${weapon.weapon?.kind ?? ''} ${weapon.name}`.toLowerCase()
  const a = ammo.name.toLowerCase()
  if (/crossbow/.test(w)) return /bolt/.test(a) || !/arrow|bullet|needle|round|cartridge|shell/.test(a)
  if (/\bbow\b|longbow|shortbow/.test(w)) return /arrow/.test(a) || !/bolt|bullet|needle|round|cartridge|shell/.test(a)
  if (/sling/.test(w)) return /sling|bullet|stone/.test(a) && !/firearm/.test(a)
  if (/blowgun/.test(w)) return /needle|dart/.test(a)
  if (/pistol|musket|rifle|gun|firearm|launcher|shotgun/.test(w)) return /bullet|round|cartridge|shell|magazine|firearm|ammo|ammunition/.test(a) && !/sling/.test(a)
  return true
}

/** ammunition in the pack that suits a weapon, best guesses first */
export function ammoFor(c: Character, weapon: Item): Item[] {
  return c.items.filter((i) => i.id !== weapon.id && isAmmo(i) && ammoFits(weapon, i))
}

/** link every ammunition weapon without ammo to the first suitable ammunition (after adding items) */
export function autoLinkAmmo(d: Character) {
  for (const w of d.items) {
    if (!w.weapon || !firesAmmo(w)) continue
    if (w.weapon.ammoId && d.items.some((i) => i.id === w.weapon!.ammoId)) continue
    const a = ammoFor(d, w)[0]
    if (a) { w.weapon.ammoId = a.id; w.weapon.ammoCost = w.weapon.ammoCost || 1 }
  }
}

/** gather up after a fight: half of what was fired since last time comes back (rounded down) */
export function recoverAmmo(d: Character, itemId?: string): number {
  let back = 0
  for (const i of d.items) {
    if (itemId && i.id !== itemId) continue
    if (!i.ammoSpent) continue
    const n = Math.floor(i.ammoSpent / 2)
    i.qty += n
    back += n
    i.ammoSpent = 0
  }
  return back
}

/** Take `cost` of an inventory item (arrows, bolts, components...). Returns a message for a toast. */
export function useItem(c: Character, itemId: string, cost: number, what: string): string {
  const it = c.items.find((i) => i.id === itemId)
  if (!it) return `${what}: its linked item is gone. Pick another in its details.`
  if (it.qty < cost) return `Out of ${it.name || 'ammo'}!`
  useStore.getState().patch((d) => {
    const x = d.items.find((i) => i.id === itemId)
    if (!x) return
    x.qty = Math.max(0, x.qty - cost)
    // fired ammunition can be partly gathered up again afterwards
    if (isAmmo(x)) x.ammoSpent = (x.ammoSpent ?? 0) + cost
  })
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
  const items = c.items.filter((i) => i.id !== excludeId)
  items.sort((a, b) => Number(isAmmo(b)) - Number(isAmmo(a)) || a.name.localeCompare(b.name))
  return [{ id: '', name: 'Nothing' }, ...items.map((i) => ({ id: i.id, name: `${i.name || 'Unnamed'} (${i.qty})` }))]
}
