import raw from './data/items.json'
import type { Rarity } from './types'
import type { SystemId } from './systems'
import { AK_ARMOUR_LIST, AK_ITEMS, AK_WEAPON_LIST } from './data/gear'

/** Standard equipment and magic items from the SRD (2014 + 2024), CC-BY-4.0. */
export interface LibItem {
  n: string
  /** our item category name */
  k: string
  d: string
  w: number
  c: string
  r: Rarity
  a: boolean
  m: boolean
  /** '2014' / '2024' SRD, or 'AK5e' for the Arknights book */
  e: string
}

export const ITEM_LIB = raw as LibItem[]
/** Arknights 5e's own items (toolkits, gear, magic items), from your imported copy of the book */
const AK_LIB = AK_ITEMS as LibItem[]

/** D&D prices in LMD, by the book's conversion: 1 cp = 1 LMD, 1 sp = 10, 1 gp = 100 */
const toLmd = (c: string) => c.replace(/([\d,.]+)\s*(cp|sp|ep|gp|pp)\b/i, (_m, n: string, u: string) =>
  `${Math.round(parseFloat(n.replace(/,/g, '')) * ({ cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 } as Record<string, number>)[u.toLowerCase()]).toLocaleString('en-US')} LMD`)

/** For an Arknights sheet: the book's items first, then everyday 5e gear (priced in LMD). */
export function bestItemFor(name: string, sys: SystemId): LibItem | undefined {
  if (sys !== 'ak5e') return bestItem(name)
  const ak = bestIn(AK_LIB, name)
  if (ak) return ak
  const dnd = bestItem(name)
  return dnd && { ...dnd, c: toLmd(dnd.c) }
}

/** "Crossbow Bolts" / "crossbow bolt", "Rope, hempen (50 feet)" / "rope", "Travelers Clothes" / "Traveler's Clothes": compare loosely. */
const key = (n: string) => n.toLowerCase().replace(/[’']/g, '').replace(/armour/g, 'armor').replace(/\s*\(.*?\)\s*/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
/** an item name's words, singular, without filler words, in a fixed order */
const words = (k: string) => singular(k).split(' ').filter((w) => w && !['of', 'the', 'a', 'an', 'set'].includes(w)).sort().join(' ')
const singular = (k: string) => k.split(' ').map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ')

/** Best library entry for a name: exact name first, then singular/plural, then the part before a comma. Prefers text, then 2024. */
export function bestItem(name: string): LibItem | undefined {
  return bestIn(ITEM_LIB, name)
}

function bestIn(lib: LibItem[], name: string): LibItem | undefined {
  const k = key(name.replace(/(?:^|\s)\+[1-3]\b/, ' '))
  if (!k) return undefined
  const rank = (i: LibItem) => (i.d ? 0 : 2) + (i.e === '2024' || i.e === 'AK5e' ? 0 : 1)
  // the best text, with a weight from another edition when that one has none (packs only have one in 2024)
  const pick = (list: LibItem[]) => {
    const best = list.sort((a, b) => rank(a) - rank(b))[0]
    const w = best.w || list.find((i) => i.w)?.w || 0
    return w === best.w ? best : { ...best, w }
  }
  // "Arts Staff +1/+2/+3" in the book matches "Arts Staff +2"
  const base = (n: string) => key(n.replace(/\s*\+1\/\+2\/\+3/, ''))
  let m = lib.filter((i) => key(i.n) === k)
  if (m.length) return pick(m)
  m = lib.filter((i) => singular(key(i.n)) === singular(k))
  if (m.length) return pick(m)
  // "Clothes, Traveler's" in the book is "Traveler's Clothes" on a sheet
  m = lib.filter((i) => i.n.includes(',') && singular(key(i.n.split(',').slice(1).join(' ') + ' ' + i.n.split(',')[0])) === singular(k))
  if (m.length) return pick(m)
  m = lib.filter((i) => singular(key(i.n.split(',')[0])) === singular(k))
  if (m.length) return pick(m)
  // the same words in any order, ignoring "of" / "the": "Healing Potion" is a "Potion of Healing", "Hempen Rope" a "Rope, hempen"
  const bag = words(k)
  m = lib.filter((i) => words(key(i.n.replace(/\(.*?\)/g, ' '))) === bag)
  if (m.length) return pick(m)
  // magic "+N" versions: only when the name had a +N
  if (/\+[1-3]\b/.test(name)) { m = lib.filter((i) => /\+1\/\+2\/\+3/.test(i.n) && base(i.n) === k); if (m.length) return pick(m) }
  return undefined
}

/**
 * Every item a sheet knows about, for browsing and adding from the inventory: the SRD's equipment and magic items
 * (both editions); on an Arknights sheet, the book's weapons, armour and items first, then everyday 5e gear in LMD.
 */
export function libraryFor(sys: SystemId): LibItem[] {
  if (sys !== 'ak5e') return ITEM_LIB
  const out: LibItem[] = []
  const seen = new Set<string>()
  const push = (i: LibItem) => { const k = key(i.n); if (seen.has(k)) return; seen.add(k); out.push(i) }
  for (const w of AK_WEAPON_LIST) push({ n: w.n, k: 'Weapon', d: '', w: w.w, c: w.c, r: 'common', a: false, m: false, e: 'AK5e' })
  for (const a of AK_ARMOUR_LIST) push({ n: a.n, k: 'Armor', d: '', w: a.w, c: a.c, r: 'common', a: false, m: false, e: 'AK5e' })
  for (const i of AK_LIB) push(i)
  // everyday gear from 5e (not its weapons / armour: the book has its own)
  for (const i of ITEM_LIB) if (!i.m && i.k !== 'Weapon' && i.k !== 'Armor' && i.e === '2024') push({ ...i, c: toLmd(i.c), e: '5e' })
  return out
}

/** Search for the library browser. */
export function searchItems(q: string, opts: { magic: 'all' | 'magic' | 'mundane'; edition: string }): LibItem[] {
  const t = q.trim().toLowerCase()
  return ITEM_LIB.filter((i) =>
    (!t || i.n.toLowerCase().includes(t)) &&
    (opts.magic === 'all' || (opts.magic === 'magic') === i.m) &&
    (opts.edition === 'all' || i.e === opts.edition),
  ).slice(0, 200)
}

/** what a magic weapon / armour is made from ("Weapon (longsword)", "Armor (plate)"), for its weight */
export function baseItemWeight(text: string, sys: SystemId): number {
  const base = /^(?:Weapon|Armou?r)\s*\(([^)]+)\)/i.exec(text.trim())?.[1]?.split(/,| or /)[0]?.trim()
  if (!base || /^any\b/i.test(base)) return 0
  return bestItemFor(base, sys)?.w || bestItemFor(`${base} armor`, sys)?.w || 0
}
