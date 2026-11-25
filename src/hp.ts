/*
 * Changing hit points. The HP box takes a number ("12" sets it exactly, temp HP untouched) or a change ("+5", "-7",
 * "-3+2"), which is healing / damage like the ± box beside it: damage comes off temporary HP first.
 */
import { isAK } from './systems'
import type { Character } from './types'

/**
 * What was typed into the HP box, given the current HP:
 *  "12" → set to 12 (exactly, temp HP untouched);
 *  "+5", "-7", "-3+2" → change by that;
 *  "12-3" (the current HP with a sum after it) → the change from current HP to the result, here -3.
 * Anything else → null.
 */
export function parseHp(text: string, current = 0): { set?: number; change?: number } | null {
  const t = text.replace(/\s+/g, '')
  if (!t) return null
  if (!/^[+-]?\d+([+-]\d+)*$/.test(t)) return null
  const sum = (t.match(/[+-]?\d+/g) ?? []).reduce((s, n) => s + parseInt(n, 10), 0)
  if (/^[+-]/.test(t)) return { change: sum }
  // a sum: "12-3" means take 3 off (damage, so temp HP first), not "overwrite with 9"
  if (/\d[+-]/.test(t)) return { change: sum - current }
  return { set: sum }
}

/** set current HP (within 0 and the maximum); getting up from 0 ends Dying */
export function setHp(d: Character, value: number, max: number) {
  const was = d.hp.current
  d.hp.current = Math.max(0, Math.min(max, Math.round(value)))
  if (was <= 0 && d.hp.current > 0) {
    // AK5e: you stop Dying (and lose your Mettle), but failed saves stay until a long rest
    if (isAK(d)) d.ak.mettle = 0
    else d.deathSaves = { successes: 0, failures: 0 }
  }
}

/** damage (negative) takes temporary HP first; healing (positive) never goes above the maximum */
export function hurtOrHeal(d: Character, amount: number, max: number) {
  if (!amount) return
  if (amount < 0) {
    let dmg = -amount
    const fromTemp = Math.min(d.hp.temp, dmg)
    d.hp.temp -= fromTemp
    dmg -= fromTemp
    setHp(d, d.hp.current - dmg, max)
  } else setHp(d, d.hp.current + amount, max)
}
