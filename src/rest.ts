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

export function ago(t: number): string {
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(t).toLocaleString()
}
