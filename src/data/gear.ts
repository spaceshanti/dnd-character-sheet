/** Standard weapons and armor (System Reference Document 5.2, CC-BY-4.0). Used to pre-fill items by name. */
import type { ArmorStats, WeaponStats } from '../types'

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

export function lookupWeapon(name: string): WeaponStats | null {
  const w = W_SORTED.find(([n]) => has(name, n))
  if (!w) return null
  const [kind, damage, damageType, properties, range = ''] = w
  const ranged = /ammunition/i.test(properties)
  return {
    damage, damageType, properties, range, proficient: true, magicBonus: 0, kind, mastery: MASTERY_OF[kind] ?? '',
    ability: /finesse/i.test(properties) ? 'finesse' : ranged ? 'dex' : 'str',
  }
}

// clothing that happens to share a word with an armor ("wolf hide cloak", "leather boots")
const NOT_ARMOR = /cloak|cape|robe|boot|glove|gauntlet|belt|hat|hood|bag|pouch|case|strap|scrap/i

export function lookupArmor(name: string): ArmorStats | null {
  if (NOT_ARMOR.test(name) && !/shield/i.test(name)) return null
  const a = A_SORTED.find(([n]) => has(name, n))
  return a ? { kind: a[1], ac: a[2], bonus: 0 } : null
}

export const WEAPON_NAMES = WEAPONS.map((w) => w[0])
export const ARMOR_NAMES = ARMOR.map((a) => a[0])

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
