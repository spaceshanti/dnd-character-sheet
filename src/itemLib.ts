import raw from './data/items.json'
import type { Rarity } from './types'

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
  e: '2014' | '2024'
}

export const ITEM_LIB = raw as LibItem[]

/** "Crossbow Bolts" / "crossbow bolt", "Rope, hempen (50 feet)" / "rope": compare loosely. */
const key = (n: string) => n.toLowerCase().replace(/[’']/g, "'").replace(/\s*\(.*?\)\s*/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
const singular = (k: string) => k.split(' ').map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ')

/** Best library entry for a name: exact name first, then singular/plural, then the part before a comma. Prefers text, then 2024. */
export function bestItem(name: string): LibItem | undefined {
  const k = key(name.replace(/(?:^|\s)\+[1-3]\b/, ' '))
  if (!k) return undefined
  const rank = (i: LibItem) => (i.d ? 0 : 2) + (i.e === '2024' ? 0 : 1)
  const pick = (list: LibItem[]) => list.sort((a, b) => rank(a) - rank(b))[0]
  let m = ITEM_LIB.filter((i) => key(i.n) === k)
  if (m.length) return pick(m)
  m = ITEM_LIB.filter((i) => singular(key(i.n)) === singular(k))
  if (m.length) return pick(m)
  m = ITEM_LIB.filter((i) => singular(key(i.n.split(',')[0])) === singular(k))
  return m.length ? pick(m) : undefined
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
