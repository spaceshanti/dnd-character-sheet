import type { AbilityKey, ActionType, EffectType, Rarity, SkillKey } from './types'

export const ABILITIES: { key: AbilityKey; name: string; short: string }[] = [
  { key: 'str', name: 'Strength', short: 'STR' },
  { key: 'dex', name: 'Dexterity', short: 'DEX' },
  { key: 'con', name: 'Constitution', short: 'CON' },
  { key: 'int', name: 'Intelligence', short: 'INT' },
  { key: 'wis', name: 'Wisdom', short: 'WIS' },
  { key: 'cha', name: 'Charisma', short: 'CHA' },
]

export const SKILLS: { key: SkillKey; name: string; ability: AbilityKey }[] = [
  { key: 'athletics', name: 'Athletics', ability: 'str' },
  { key: 'acrobatics', name: 'Acrobatics', ability: 'dex' },
  { key: 'sleightOfHand', name: 'Sleight of Hand', ability: 'dex' },
  { key: 'stealth', name: 'Stealth', ability: 'dex' },
  { key: 'arcana', name: 'Arcana', ability: 'int' },
  { key: 'history', name: 'History', ability: 'int' },
  { key: 'investigation', name: 'Investigation', ability: 'int' },
  { key: 'nature', name: 'Nature', ability: 'int' },
  { key: 'religion', name: 'Religion', ability: 'int' },
  { key: 'animalHandling', name: 'Animal Handling', ability: 'wis' },
  { key: 'insight', name: 'Insight', ability: 'wis' },
  { key: 'medicine', name: 'Medicine', ability: 'wis' },
  { key: 'perception', name: 'Perception', ability: 'wis' },
  { key: 'survival', name: 'Survival', ability: 'wis' },
  { key: 'deception', name: 'Deception', ability: 'cha' },
  { key: 'intimidation', name: 'Intimidation', ability: 'cha' },
  { key: 'performance', name: 'Performance', ability: 'cha' },
  { key: 'persuasion', name: 'Persuasion', ability: 'cha' },
]

export const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated',
  'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
  'Concentrating',
]

export const ALIGNMENTS = [
  '', 'Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral',
  'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil', 'Unaligned',
]

export const SLOT_IDS = [
  { id: 'head', name: 'Head', icon: '🪖' },
  { id: 'face', name: 'Eyes / Face', icon: '👓' },
  { id: 'neck', name: 'Neck', icon: '📿' },
  { id: 'cloak', name: 'Cloak', icon: '🧣' },
  { id: 'body', name: 'Armor / Body', icon: '🥋' },
  { id: 'hands', name: 'Hands', icon: '🧤' },
  { id: 'waist', name: 'Belt', icon: '🪢' },
  { id: 'feet', name: 'Feet', icon: '🥾' },
  { id: 'ring1', name: 'Ring', icon: '💍' },
  { id: 'ring2', name: 'Ring', icon: '💍' },
  { id: 'main', name: 'Main Hand', icon: '⚔️' },
  { id: 'off', name: 'Off Hand', icon: '🛡️' },
]

export const ITEM_CATEGORIES: { name: string; icon: string }[] = [
  { name: 'Weapon', icon: '⚔️' },
  { name: 'Armor', icon: '🛡️' },
  { name: 'Wondrous', icon: '✨' },
  { name: 'Potion', icon: '🧪' },
  { name: 'Scroll', icon: '📜' },
  { name: 'Wand / Rod', icon: '🪄' },
  { name: 'Ring', icon: '💍' },
  { name: 'Tool', icon: '🛠️' },
  { name: 'Gear', icon: '🎒' },
  { name: 'Ammo', icon: '🏹' },
  { name: 'Food', icon: '🍖' },
  { name: 'Clothing', icon: '👕' },
  { name: 'Treasure', icon: '💎' },
  { name: 'Misc', icon: '📦' },
]

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact']

export const ACTION_TYPES: { id: ActionType; name: string }[] = [
  { id: 'none', name: '— none —' },
  { id: 'action', name: 'Action' },
  { id: 'bonus', name: 'Bonus Action' },
  { id: 'reaction', name: 'Reaction' },
  { id: 'free', name: 'Free / No Action' },
  { id: 'special', name: 'Special / Other' },
]

export const EFFECT_TYPES: { id: EffectType; name: string }[] = [
  { id: 'bonus', name: 'Bonus (+/-)' },
  { id: 'advantage', name: 'Advantage' },
  { id: 'disadvantage', name: 'Disadvantage' },
  { id: 'proficiency', name: 'Grants proficiency' },
  { id: 'expertise', name: 'Grants expertise' },
  { id: 'minScore', name: 'Sets score to at least' },
  { id: 'note', name: 'Note only' },
]

export interface TargetGroup {
  label: string
  options: { id: string; name: string }[]
}

export const EFFECT_TARGETS: TargetGroup[] = [
  {
    label: 'Stats',
    options: [
      { id: 'ac', name: 'Armor Class' },
      { id: 'speed', name: 'Speed' },
      { id: 'initiative', name: 'Initiative' },
      { id: 'hpMax', name: 'Max HP' },
      { id: 'attack', name: 'Attack rolls' },
      { id: 'spellDc', name: 'Spell save DC' },
      { id: 'spellAttack', name: 'Spell attack bonus' },
    ],
  },
  { label: 'Ability scores', options: ABILITIES.map((a) => ({ id: `ability:${a.key}`, name: `${a.name} score` })) },
  {
    label: 'Saving throws',
    options: [{ id: 'save:all', name: 'All saving throws' }, ...ABILITIES.map((a) => ({ id: `save:${a.key}`, name: `${a.name} save` }))],
  },
  {
    label: 'Skills',
    options: [{ id: 'skill:all', name: 'All skill checks' }, ...SKILLS.map((s) => ({ id: `skill:${s.key}`, name: s.name }))],
  },
]

export function targetName(id: string): string {
  for (const g of EFFECT_TARGETS) {
    const o = g.options.find((x) => x.id === id)
    if (o) return o.name
  }
  return id
}

export const SPELL_LEVEL_NAMES = ['Cantrips', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']
