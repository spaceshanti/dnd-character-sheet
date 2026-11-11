import { activeEffects, spLimits, statInfo } from './calc'
import { isAK } from './systems'
import type { Character, RestSnapshot } from './types'

/* Undoing a rest you took too early: each rest saves what it's about to change, and Settings can put it back. */

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

/** the parts of a character a rest changes */
export function restSnapshot(c: Character): RestSnapshot {
  return clone({ hp: c.hp, deathSaves: c.deathSaves, slots: c.slots, hitDice: c.hitDice, resources: c.resources, inspiration: c.inspiration, ak: c.ak })
}

/** call inside the rest's patch: remember how things were */
export function rememberRest(d: Character, kind: 'long' | 'short', before: RestSnapshot) {
  d.restUndo = { ...d.restUndo, [kind]: { at: Date.now(), before } }
}

/** put back how things were before the last long / short rest */
export function undoRest(d: Character, kind: 'long' | 'short') {
  const u = d.restUndo?.[kind]
  if (!u) return
  Object.assign(d, clone(u.before))
  const rest = { ...d.restUndo }
  delete rest[kind]
  d.restUndo = rest
}

/** apply every active feature's effects for this kind of rest; returns what happened */
export function restEffects(d: Character, rest: 'long' | 'short'): string[] {
  const done: string[] = []
  for (const f of d.features) {
    if (!f.active) continue
    for (const e of f.restEffects) {
      if (e.rest !== rest) continue
      if (e.kind === 'inspiration') { d.inspiration = true; done.push(`Heroic Inspiration (${f.name || 'feature'})`) }
      else if (e.kind === 'tempHp') { d.hp.temp = Math.max(d.hp.temp, e.value); done.push(`${e.value} temp HP (${f.name || 'feature'})`) }
      else if (e.kind === 'reminder') done.push(`Reminder: ${e.note || f.name}`)
    }
  }
  return done
}

/** a long rest, inside a patch; hitDice: false for a rest you switch Alternate Class on (no hit dice back) */
export function longRestOn(d: Character, opts: { hitDice?: boolean } = {}): string[] {
  const ak = isAK(d)
  d.hp.current = statInfo(d, 'hpMax', activeEffects(d)).total
  d.hp.temp = 0
  if (ak) {
    // AK5e: failed death saves only go away one per long rest
    d.deathSaves = { successes: 0, failures: Math.max(0, d.deathSaves.failures - 1) }
    d.ak.mettle = 0
    d.ak.ap.used = 0
    d.ak.ninthUsed = false
    d.ak.activeSkill = ''
    d.ak.sp = Math.max(d.ak.sp, spLimits(d).start)
  } else d.deathSaves = { successes: 0, failures: 0 }
  for (const k of Object.keys(d.slots)) d.slots[+k].used = 0
  if (opts.hitDice !== false) {
    let regain = Math.max(1, Math.floor(d.hitDice.reduce((s, h) => s + h.total, 0) / 2))
    for (const h of d.hitDice) { const r = Math.min(h.spent, regain); h.spent -= r; regain -= r }
  }
  for (const r of d.resources) if (r.recharge !== 'none') r.used = 0
  return restEffects(d, 'long')
}

export function ago(t: number): string {
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(t).toLocaleString()
}
