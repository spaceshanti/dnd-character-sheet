import { spLimits } from './calc'
import { useStore } from './store'
import type { Character, Spell } from './types'

/* Arknights 5e actions that change the sheet. Each returns the message to show. */

const patch = (fn: (c: Character) => void) => useStore.getState().patch(fn)

export function activateOp(c: Character, id: string): string {
  const s = c.ak.opSkills.find((x) => x.id === id)
  if (!s) return ''
  if (c.ak.activeSkill && c.ak.activeSkill !== id) {
    const cur = c.ak.opSkills.find((x) => x.id === c.ak.activeSkill)
    return `${cur?.name || 'Another skill'} is still active. Only one Operator Skill at a time`
  }
  if (c.ak.sp < s.spCost) return `Not enough SP: ${s.name || 'this skill'} needs ${s.spCost}, you have ${c.ak.sp}`
  const lasts = s.duration && !/^instant/i.test(s.duration.trim())
  patch((d) => { d.ak.sp -= s.spCost; d.ak.activeSkill = lasts ? id : '' })
  return `${s.name || 'Operator Skill'} activated (−${s.spCost} SP)${lasts ? ` · lasts ${s.duration}` : ''}`
}

export function endOp() {
  patch((d) => { d.ak.activeSkill = '' })
}

/** Add (or remove) Skill Points, kept between 0 and your max. No SP is gained while a skill is active. */
export function gainSp(c: Character, n: number): string {
  if (n > 0 && c.ak.activeSkill) return 'No SP is gained while an Operator Skill is active'
  const max = spLimits(c).max
  patch((d) => { d.ak.sp = Math.max(0, Math.min(max || 999, d.ak.sp + n)) })
  return ''
}

/** Arts cost Arts Points equal to the level they're cast at. */
export function castArt(c: Character, sp: Spell, level: number): string {
  if (sp.level === 0) return `${sp.name} cast`
  const ak = c.ak
  if (ak.maxArtLevel && level > ak.maxArtLevel) return `Your maximum Art level is ${ak.maxArtLevel}`
  if (level >= 9 && ak.ninthUsed) return 'You already cast a 9th-level Art this long rest'
  const left = ak.ap.max - ak.ap.used
  if (left < level) return `Not enough Arts Points: needs ${level}, ${left} left`
  patch((d) => { d.ak.ap.used += level; if (level >= 9) d.ak.ninthUsed = true })
  return `Cast ${sp.name} at level ${level} (−${level} AP, ${left - level} left)`
}

export const DEATHS_DOOR: [string, number, string][] = [
  ['Lash Out', 1, 'Make a single attack.'],
  ['Stagger Away', 1, 'Move up to half your Speed.'],
  ['Take Action', 2, 'Take an Action or Bonus Action you could normally take.'],
  ['Stabilise', 6, 'Next turn: no death save, leave Dying, and go to 1 HP if at 0.'],
]
