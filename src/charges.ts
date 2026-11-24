/*
 * Magic item charges: reading them from an item's description ("has 7 charges… regains 1d6 + 1 expended charges
 * daily at dawn"), and rolling what comes back on a rest when it isn't all of them.
 */
import { newResource } from './blank'
import type { Character, Recharge, Resource } from './types'

/** roll "1d6+1", "2d4", "d3", "5" (a plain number is just that) */
export function rollAmount(expr: string): number {
  const t = expr.replace(/\s+/g, '').toLowerCase()
  if (!t) return 0
  let total = 0
  for (const m of t.matchAll(/([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/g)) {
    if (m[3]) {
      const n = Math.max(1, +(m[2] || 1))
      let s = 0
      for (let i = 0; i < n; i++) s += 1 + Math.floor(Math.random() * +m[3])
      total += m[1] === '-' ? -s : s
    } else if (m[5]) total += (m[4] === '-' ? -1 : 1) * +m[5]
  }
  return total
}

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, twenty: 20 }
const num = (s: string) => (/^\d+$/.test(s) ? +s : WORDS[s.toLowerCase()] ?? 0)

/** charges described in an item's text, if any */
export function chargesFromText(text: string): { max: number; regain: string; recharge: Recharge } | null {
  const t = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  const m = /\b(?:has|have|holds?|with|starts? with|of its)\s+(\d+d\d+(?:\s*[+-]\s*\d+)?|\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty)\s+charges?\b/i.exec(t)
  if (!m) return null
  // "1d3 charges" (Luck Blade), "1d8 + 1 charges": rolled once, when you get the item
  const max = /d/i.test(m[1]) ? Math.max(1, rollAmount(m[1])) : num(m[1])
  if (!max) return null
  // what comes back: "regains 1d6 + 1 expended charges daily at dawn", "regains all expended charges", "regains 1 charge"
  const g = /\bregains?\s+(all(?:\s+(?:of\s+)?its)?|(?:\d*d\d+(?:\s*[+-]\s*\d+)?)|\d+|one|two|three|four|five|six)\b[^.]*?\b(dawn|dusk|long rest|short rest|day|daily)?/i.exec(t)
  let regain = ''
  if (g && !/^all/i.test(g[1])) regain = /\d*d\d+/i.test(g[1]) ? g[1].replace(/\s+/g, '') : String(num(g[1]))
  const when = (g?.[2] || '').toLowerCase()
  // no "regains" at all (Ring of Three Wishes, Luck Blade): spent charges stay spent
  const recharge: Recharge = !g ? 'none' : when.includes('short') ? 'short' : when.includes('long') ? 'long' : 'dawn'
  return { max, regain, recharge }
}

/** a charges pool for an item from its description (or undefined when it doesn't mention any) */
export function chargesFor(itemId: string, description: string): Resource | undefined {
  const ch = chargesFromText(description)
  if (!ch) return undefined
  return { ...newResource('', 'Charges'), itemId, max: ch.max, recharge: ch.recharge, regain: ch.regain || undefined }
}

/**
 * Inside a rest's patch: bring back resources that come back on this rest. Ones with a regain amount roll it
 * (a wand's d6 + 1); the rest come back in full. Returns lines for the rest's message.
 */
export function regainOnRest(d: Character, refill: (r: Resource) => boolean): string[] {
  const out: string[] = []
  for (const r of d.resources) {
    if (!refill(r)) continue
    if (r.regain?.trim() && r.used > 0) {
      const n = Math.max(0, rollAmount(r.regain))
      const back = Math.min(r.used, n)
      r.used -= back
      const owner = r.itemId ? d.items.find((i) => i.id === r.itemId)?.name : ''
      out.push(`${owner ? `${owner}: ` : ''}${r.name || 'charges'} +${back} (rolled ${r.regain} = ${n})`)
    } else r.used = 0
  }
  return out
}
