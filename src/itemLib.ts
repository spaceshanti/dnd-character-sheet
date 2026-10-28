import raw from './data/items.json'
import type { Rarity } from './types'
import type { SystemId } from './systems'
import { AK_ITEMS } from './data/gear'

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

/** "Crossbow Bolts" / "crossbow bolt", "Rope, hempen (50 feet)" / "rope": compare loosely. */
const key = (n: string) => n.toLowerCase().replace(/[’']/g, "'").replace(/\s*\(.*?\)\s*/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
const singular = (k: string) => k.split(' ').map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ')

/** Best library entry for a name: exact name first, then singular/plural, then the part before a comma. Prefers text, then 2024. */
export function bestItem(name: string): LibItem | undefined {
  return bestIn(ITEM_LIB, name)
}

function bestIn(lib: LibItem[], name: string): LibItem | undefined {
  const k = key(name.replace(/(?:^|\s)\+[1-3]\b/, ' '))
  if (!k) return undefined
  const rank = (i: LibItem) => (i.d ? 0 : 2) + (i.e === '2024' || i.e === 'AK5e' ? 0 : 1)
  const pick = (list: LibItem[]) => list.sort((a, b) => rank(a) - rank(b))[0]
  // "Arts Staff +1/+2/+3" in the book matches "Arts Staff +2"
  const base = (n: string) => key(n.replace(/\s*\+1\/\+2\/\+3/, ''))
  let m = lib.filter((i) => key(i.n) === k)
  if (m.length) return pick(m)
  m = lib.filter((i) => singular(key(i.n)) === singular(k))
  if (m.length) return pick(m)
  m = lib.filter((i) => singular(key(i.n.split(',')[0])) === singular(k))
  if (m.length) return pick(m)
  // magic "+N" versions: only when the name had a +N
  if (/\+[1-3]\b/.test(name)) { m = lib.filter((i) => /\+1\/\+2\/\+3/.test(i.n) && base(i.n) === k); if (m.length) return pick(m) }
  return undefined
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
