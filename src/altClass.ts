import type { AbilityKey, Character, ClassSide } from './types'

/*
 * Arknights 5e optional rule, Alternate Classes: from 7th level a character can have a second class and switch between
 * the two as part of a long rest (regaining no hit dice that rest). The classes share name, story, inventory and level;
 * max HP, speed and features (and everything hanging off them) are separate, and two chosen ability scores swap values
 * while in the alternate class.
 */

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

/** the class-specific parts of the character as it is now */
export function takeSide(c: Character): ClassSide {
  return clone({
    className: c.className, subclass: c.subclass, classSymbol: c.classSymbol, subclassSymbol: c.subclassSymbol,
    hpMax: c.hpMax, hpCurrent: c.hp.current, hitDice: c.hitDice, speed: c.speed, saveProf: c.saveProf, spellAbility: c.spellAbility,
    features: c.features, resources: c.resources, spells: c.spells,
    profs: { weapons: c.proficiencies.weapons, armor: c.proficiencies.armor, tools: c.proficiencies.tools },
    ak: { opSkills: c.ak.opSkills, ap: c.ak.ap, maxArtLevel: c.ak.maxArtLevel, activeSkill: c.ak.activeSkill, sp: c.ak.sp },
  })
}

function putSide(d: Character, s: ClassSide) {
  const x = clone(s)
  Object.assign(d, {
    className: x.className, subclass: x.subclass, classSymbol: x.classSymbol, subclassSymbol: x.subclassSymbol,
    hpMax: x.hpMax, hitDice: x.hitDice, speed: x.speed, saveProf: x.saveProf, spellAbility: x.spellAbility,
    features: x.features, resources: x.resources, spells: x.spells,
  })
  d.hp.current = x.hpCurrent
  d.hp.temp = 0
  Object.assign(d.proficiencies, x.profs)
  Object.assign(d.ak, x.ak)
}

/** a fresh alternate class: just its name, the same walking speed, and nothing else yet */
export function newSide(c: Character, className: string, subclass: string): ClassSide {
  const none = Object.fromEntries(Object.keys(c.saveProf).map((k) => [k, 0])) as ClassSide['saveProf']
  return {
    className, subclass, classSymbol: '', subclassSymbol: '',
    hpMax: { base: 10, mods: [] }, hpCurrent: 10, hitDice: [], speed: clone(c.speed), saveProf: none, spellAbility: '',
    features: [], resources: [], spells: [], profs: { weapons: '', armor: '', tools: '' },
    ak: { opSkills: [], ap: { max: 0, used: 0, recharge: 'long' }, maxArtLevel: 0, activeSkill: '', sp: 0 },
  }
}

function swapScores(d: Character, [a, b]: [AbilityKey, AbilityKey]) {
  if (a === b) return
  const t = d.abilities[a]
  d.abilities[a] = d.abilities[b]
  d.abilities[b] = t
}

/** inside a patch: change to the other class (call longRestOn afterwards for the rest that goes with it) */
export function switchClass(d: Character) {
  const alt = d.altClass
  if (!alt) return
  const now = takeSide(d)
  putSide(d, alt.other)
  alt.other = now
  // the swapped scores trade places going in and again coming back out
  swapScores(d, alt.swap)
  alt.active = !alt.active
  // a rest from before the switch can't be undone onto the other class
  d.restUndo = {}
}

/** change which two scores swap (only while in the original class, so nothing is swapped at the time) */
export function setSwap(d: Character, swap: [AbilityKey, AbilityKey]) {
  if (d.altClass && !d.altClass.active) d.altClass.swap = swap
}

/** the other class's name, for buttons */
export const otherName = (c: Character) => {
  const o = c.altClass?.other
  return o ? [o.subclass, o.className].filter(Boolean).join(' ') || 'the other class' : ''
}
