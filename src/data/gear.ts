/** Standard weapons and armor (System Reference Document 5.2, CC-BY-4.0). Used to pre-fill items by name. */
import type { ArmorStats, Effect, WeaponStats } from '../types'
import type { SystemId } from '../systems'
import { extraFiles } from './runtime'

// local id helper (blank.ts imports this file, so it can't be imported back)
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36))

type W = [name: string, damage: string, type: string, properties: string, range?: string]

const WEAPONS: W[] = [
  ['Club', '1d4', 'bludgeoning', 'Light'],
  ['Dagger', '1d4', 'piercing', 'Finesse, Light, Thrown', '20/60'],
  ['Greatclub', '1d8', 'bludgeoning', 'Two-Handed'],
  ['Handaxe', '1d6', 'slashing', 'Light, Thrown', '20/60'],
  ['Javelin', '1d6', 'piercing', 'Thrown', '30/120'],
  ['Light Hammer', '1d4', 'bludgeoning', 'Light, Thrown', '20/60'],
  ['Mace', '1d6', 'bludgeoning', ''],
  ['Quarterstaff', '1d6', 'bludgeoning', 'Versatile (1d8)'],
  ['Sickle', '1d4', 'slashing', 'Light'],
  ['Spear', '1d6', 'piercing', 'Thrown, Versatile (1d8)', '20/60'],
  ['Dart', '1d4', 'piercing', 'Finesse, Thrown', '20/60'],
  ['Light Crossbow', '1d8', 'piercing', 'Ammunition, Loading, Two-Handed', '80/320'],
  ['Shortbow', '1d6', 'piercing', 'Ammunition, Two-Handed', '80/320'],
  ['Sling', '1d4', 'bludgeoning', 'Ammunition', '30/120'],
  ['Battleaxe', '1d8', 'slashing', 'Versatile (1d10)'],
  ['Flail', '1d8', 'bludgeoning', ''],
  ['Glaive', '1d10', 'slashing', 'Heavy, Reach, Two-Handed'],
  ['Greataxe', '1d12', 'slashing', 'Heavy, Two-Handed'],
  ['Greatsword', '2d6', 'slashing', 'Heavy, Two-Handed'],
  ['Halberd', '1d10', 'slashing', 'Heavy, Reach, Two-Handed'],
  ['Lance', '1d10', 'piercing', 'Heavy, Reach, Two-Handed (unless mounted)'],
  ['Longsword', '1d8', 'slashing', 'Versatile (1d10)'],
  ['Maul', '2d6', 'bludgeoning', 'Heavy, Two-Handed'],
  ['Morningstar', '1d8', 'piercing', ''],
  ['Pike', '1d10', 'piercing', 'Heavy, Reach, Two-Handed'],
  ['Rapier', '1d8', 'piercing', 'Finesse'],
  ['Scimitar', '1d6', 'slashing', 'Finesse, Light'],
  ['Shortsword', '1d6', 'piercing', 'Finesse, Light'],
  ['Trident', '1d8', 'piercing', 'Thrown, Versatile (1d10)', '20/60'],
  ['Warhammer', '1d8', 'bludgeoning', 'Versatile (1d10)'],
  ['War Pick', '1d8', 'piercing', 'Versatile (1d10)'],
  ['Whip', '1d4', 'slashing', 'Finesse, Reach'],
  ['Blowgun', '1', 'piercing', 'Ammunition, Loading', '25/100'],
  ['Hand Crossbow', '1d6', 'piercing', 'Ammunition, Light, Loading', '30/120'],
  ['Heavy Crossbow', '1d10', 'piercing', 'Ammunition, Heavy, Loading, Two-Handed', '100/400'],
  ['Longbow', '1d8', 'piercing', 'Ammunition, Heavy, Two-Handed', '150/600'],
  ['Musket', '1d12', 'piercing', 'Ammunition, Loading, Two-Handed', '40/120'],
  ['Pistol', '1d10', 'piercing', 'Ammunition, Loading', '30/90'],
]

const ARMOR: [name: string, kind: ArmorStats['kind'], ac: number][] = [
  ['Padded', 'light', 11], ['Leather', 'light', 11], ['Studded Leather', 'light', 12],
  ['Hide', 'medium', 12], ['Chain Shirt', 'medium', 13], ['Scale Mail', 'medium', 14], ['Breastplate', 'medium', 14], ['Half Plate', 'medium', 15],
  ['Ring Mail', 'heavy', 14], ['Chain Mail', 'heavy', 16], ['Splint', 'heavy', 17], ['Plate', 'heavy', 18],
  ['Shield', 'shield', 2],
]

const MASTERY_OF: Record<string, string> = {
  'Club': 'Slow',
  'Dagger': 'Nick',
  'Greatclub': 'Push',
  'Handaxe': 'Vex',
  'Javelin': 'Slow',
  'Light Hammer': 'Nick',
  'Mace': 'Sap',
  'Quarterstaff': 'Topple',
  'Sickle': 'Nick',
  'Spear': 'Sap',
  'Dart': 'Vex',
  'Light Crossbow': 'Slow',
  'Shortbow': 'Vex',
  'Sling': 'Slow',
  'Battleaxe': 'Topple',
  'Flail': 'Sap',
  'Glaive': 'Graze',
  'Greataxe': 'Cleave',
  'Greatsword': 'Graze',
  'Halberd': 'Cleave',
  'Lance': 'Topple',
  'Longsword': 'Sap',
  'Maul': 'Topple',
  'Morningstar': 'Sap',
  'Pike': 'Push',
  'Rapier': 'Vex',
  'Scimitar': 'Nick',
  'Shortsword': 'Vex',
  'Trident': 'Topple',
  'Warhammer': 'Push',
  'War Pick': 'Sap',
  'Whip': 'Slow',
  'Blowgun': 'Vex',
  'Hand Crossbow': 'Vex',
  'Heavy Crossbow': 'Push',
  'Longbow': 'Slow',
  'Musket': 'Slow',
  'Pistol': 'Vex',
}

// longest names first so "Studded Leather" wins over "Leather", "Half Plate" over "Plate"
const byLength = <T extends [string, ...unknown[]]>(a: T, b: T) => b[0].length - a[0].length
const W_SORTED = [...WEAPONS].sort(byLength)
const A_SORTED = [...ARMOR].sort(byLength)
const has = (name: string, key: string) => new RegExp(`\\b${key.replace(/ /g, '\\s*')}\\b`, 'i').test(name)

/* ---------- Arknights 5e equipment (from the book, which the app downloads onto your computer) ---------- */

interface AkWeapon { n: string; damage: string; type: string; props: string; range: string; cat: string; w: number; c: string }
interface AkArmour { n: string; kind: ArmorStats['kind']; cat: string; ac: number; dr: number; drType: string; str: number; special: string; w: number; c: string }
interface AkGear { weapons: AkWeapon[]; armour: AkArmour[]; properties: Record<string, string>; items: unknown[] }

const AK: AkGear = (() => {
  const g = extraFiles().find((f) => f.gear)?.gear as AkGear | undefined
  return g ?? { weapons: [], armour: [], properties: {}, items: [] }
})()
export const AK_ITEMS = AK.items
/** the book's weapon and armour tables (for browsing every known item) */
export const AK_WEAPON_LIST = AK.weapons
export const AK_ARMOUR_LIST = AK.armour
const AKW_SORTED = [...AK.weapons].sort((a, b) => b.n.length - a.n.length)
const AKA_SORTED = [...AK.armour].sort((a, b) => b.n.length - a.n.length)

export function akWeapon(name: string): AkWeapon | undefined { return AKW_SORTED.find((w) => has(name, w.n)) }
export function akArmour(name: string): AkArmour | undefined { return AKA_SORTED.find((a) => has(name, a.n)) }

function akWeaponStats(w: AkWeapon): WeaponStats {
  const ranged = /\b(Range|Firearm|Splash)\b/i.test(w.props)
  return {
    damage: w.damage, damageType: w.type, properties: w.props, range: w.range, proficient: true, magicBonus: 0, kind: w.n, mastery: '', ammoId: '', ammoCost: 1,
    ability: /finesse/i.test(w.props) ? 'finesse' : ranged ? 'dex' : 'str',
  }
}

/** What an AK5e weapon / armour does to your sheet while equipped (armour DR, Conductive spell bonus), and its notes. */
export function akGearExtras(name: string): { effects: Effect[]; description: string; weight: number; value: string } | null {
  const a = akArmour(name)
  if (a) {
    const effects: Effect[] = a.dr ? [{ id: uid(), target: 'dr', type: 'bonus', value: a.dr, note: a.drType }] : []
    const notes = [
      `${a.cat.replace(/\b\w/g, (x) => x.toUpperCase())}.`,
      a.dr ? `Damage Reduction ${a.dr}${a.drType ? ` (${a.drType})` : ''} while worn.` : '',
      a.str ? `Strength ${a.str} needed, or your Speed drops by 10 ft.` : '',
      a.special ? `${a.special}.` : '',
    ].filter(Boolean)
    return { effects, description: notes.join(' '), weight: a.w, value: a.c }
  }
  const w = akWeapon(name)
  if (w) {
    const cond = /Conductive\s*\((\d+)\)/i.exec(w.props)
    const effects: Effect[] = cond
      ? [{ id: uid(), target: 'spellAttack', type: 'bonus', value: +cond[1], note: 'Conductive' }, { id: uid(), target: 'spellDc', type: 'bonus', value: +cond[1], note: 'Conductive' }]
      : []
    return { effects, description: `${w.cat.replace(/s$/, '')}.`, weight: w.w, value: w.c }
  }
  return null
}

export function lookupWeapon(name: string, sys: SystemId = 'dnd5e'): WeaponStats | null {
  if (sys === 'ak5e') { const w = akWeapon(name); return w ? akWeaponStats(w) : null }
  const w = W_SORTED.find(([n]) => has(name, n))
  if (!w) return null
  const [kind, damage, damageType, properties, range = ''] = w
  const ranged = /ammunition/i.test(properties)
  return {
    damage, damageType, properties, range, proficient: true, magicBonus: 0, kind, mastery: MASTERY_OF[kind] ?? '', ammoId: '', ammoCost: 1,
    ability: /finesse/i.test(properties) ? 'finesse' : ranged ? 'dex' : 'str',
  }
}

// clothing that happens to share a word with an armor ("wolf hide cloak", "leather boots")
const NOT_ARMOR = /cloak|cape|robe|boot|glove|gauntlet|belt|hat|hood|bag|pouch|case|strap|scrap/i

export function lookupArmor(name: string, sys: SystemId = 'dnd5e'): ArmorStats | null {
  if (NOT_ARMOR.test(name) && !/shield/i.test(name)) return null
  if (sys === 'ak5e') {
    const a = akArmour(name)
    return a ? { kind: a.kind, ac: a.ac, bonus: 0 } : null
  }
  const a = A_SORTED.find(([n]) => has(name, n))
  return a ? { kind: a[1], ac: a[2], bonus: 0 } : null
}

export const WEAPON_NAMES = WEAPONS.map((w) => w[0])
export const ARMOR_NAMES = ARMOR.map((a) => a[0])
/** the standard weapon list for a game (for the weapon "kind" picker) */
export const weaponNames = (sys: SystemId) => (sys === 'ak5e' ? AK.weapons.map((w) => w.n) : WEAPON_NAMES)

/** Short reminders shown when hovering a property (paraphrased, not rules text). */
export const PROPERTY_INFO: Record<string, string> = {
  Ammunition: 'Each attack uses a piece of ammunition; you can usually recover about half after the fight.',
  Finesse: 'Use STR or DEX, your choice, for the attack and damage rolls.',
  Heavy: 'Disadvantage on attacks if your STR (melee) or DEX (ranged) is below 13.',
  Light: 'When you attack with it, you can make one extra attack with a different Light weapon as a Bonus Action (no ability bonus to that damage).',
  Loading: 'Only one shot per action, Bonus Action or reaction, however many attacks you get.',
  Reach: 'Adds 5 feet to how far you can hit with it.',
  Thrown: 'Can be thrown to make a ranged attack, using the same ability as in melee.',
  'Two-Handed': 'Needs both hands to attack with.',
  Versatile: 'Use it one- or two-handed; the bracketed damage is for two hands.',
  Silvered: 'Coated in silver, which some creatures are vulnerable to.',
  Range: 'A ranged weapon: normal range / long range in feet (Disadvantage beyond normal range).',
  // Arknights 5e's new properties, from your imported copy of the book
  ...Object.fromEntries(Object.entries(AK.properties).map(([k, v]) => [k, v.length > 420 ? v.slice(0, 417) + '…' : v])),
}

/** Weapon mastery properties (2024 rules), paraphrased. */
export const MASTERY_INFO: Record<string, string> = {
  Cleave: 'Once per turn, after a melee hit, attack a second creature within 5 ft of the first (no ability bonus to that damage).',
  Graze: 'On a miss, still deal damage equal to the ability modifier you attacked with.',
  Nick: 'The extra Light-weapon attack can be part of the Attack action instead of a Bonus Action (once per turn).',
  Push: 'On a hit, push a Large or smaller target up to 10 ft straight away from you.',
  Sap: 'On a hit, the target has Disadvantage on its next attack roll before your next turn starts.',
  Slow: 'On a damaging hit, the target loses 10 ft of Speed until your next turn starts.',
  Topple: 'On a hit, the target makes a CON save (DC 8 + your attack ability mod + PB) or falls Prone.',
  Vex: 'On a damaging hit, you have Advantage on your next attack against that target before the end of your next turn.',
}

export const MASTERIES = Object.keys(MASTERY_INFO)
export const PROPERTY_SUGGESTIONS = ['Ammunition', 'Finesse', 'Heavy', 'Light', 'Loading', 'Reach', 'Thrown', 'Two-Handed', 'Versatile', 'Silvered', 'Magical']

/** "Finesse, Versatile (1d10), Thrown" → ['Finesse', 'Versatile (1d10)', 'Thrown'] (commas inside brackets don't split) */
export const splitProps = (s: string) => s.split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean)
export const joinProps = (list: string[]) => list.join(', ')
/** "Versatile (1d10)" → "Versatile" for looking up its note */
export const propKey = (p: string) => p.replace(/\s*\(.*$/, '').trim()
