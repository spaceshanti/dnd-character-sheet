export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export type SkillKey =
  | 'acrobatics' | 'animalHandling' | 'arcana' | 'athletics' | 'deception' | 'history'
  | 'insight' | 'intimidation' | 'investigation' | 'medicine' | 'nature' | 'perception'
  | 'performance' | 'persuasion' | 'religion' | 'sleightOfHand' | 'stealth' | 'survival'
  // Arknights 5e: History + Religion → Lore, Nature + Survival → Wilderness, Arcana → Arts, plus Technology
  | 'arts' | 'lore' | 'wilderness' | 'technology'

/** 0 none, 1 proficient, 2 expertise */
export type ProfLevel = 0 | 1 | 2

export type EffectType = 'bonus' | 'advantage' | 'disadvantage' | 'proficiency' | 'expertise' | 'minScore' | 'note'

/**
 * Something a feature / item / spell does to the sheet.
 * target examples: 'ac', 'speed', 'initiative', 'hpMax', 'attack', 'spellDc', 'spellAttack',
 * 'ability:str', 'save:dex', 'save:all', 'skill:investigation', 'skill:all'
 */
export interface Effect {
  id: string
  target: string
  type: EffectType
  value?: number
  note?: string
}

export type ActionType = 'none' | 'action' | 'bonus' | 'reaction' | 'free' | 'special'

/** A manual, toggleable adjustment such as "Mage Armor +3" */
export interface Mod {
  id: string
  name: string
  value: number
  on: boolean
}

export interface Stat {
  base: number
  mods: Mod[]
}

export interface Spell {
  id: string
  name: string
  level: number
  prepared: boolean
  alwaysPrepared: boolean
  school: string
  castingTime: string
  range: string
  components: string
  duration: string
  concentration: boolean
  ritual: boolean
  /** material component is consumed (or has a cost) */
  materialConsumed: boolean
  description: string
  url: string
  notes: string
  effects: Effect[]
  active: boolean
  /** id of the feature that grants this spell ('' = added by hand) */
  grantedBy: string
  /** inventory item used up per cast (e.g. Telekinetic Fling's ammunition), '' = none */
  ammoId: string
  ammoCost: number
}

export type FeatureCategory = 'class' | 'species' | 'feat' | 'background' | 'buff' | 'other'

/** One thing a feature lets you do, e.g. Psionic Power → Telekinetic Propel (Bonus Action, 1 die). */
export interface FeatureAction {
  id: string
  name: string
  actionType: ActionType
  description: string
  /** resource spent when used ('' = free) */
  resourceId: string
  cost: number
}

export interface Feature {
  id: string
  name: string
  category: FeatureCategory
  source: string
  description: string
  actionType: ActionType
  effects: Effect[]
  active: boolean
  actions: FeatureAction[]
  /** weapon kinds this feature lets you use mastery properties with ('*' = any weapon) */
  masteries: string[]
  /** things that happen on a rest, e.g. Resourceful: Heroic Inspiration on a long rest */
  restEffects: RestEffect[]
  /** folded up on the Features page */
  collapsed: boolean
  /** additions this feature makes to other features' actions */
  actionMods: ActionMod[]
  /** also shown on the Spells / Arts page (for features about spellcasting or certain kinds of spells) */
  onSpellPage: boolean
}

/** e.g. Telekinetic Techniques adds Boost / Disorient / Telekinetic Bolt to Psionic Power's Telekinetic Propel */
export interface ActionMod {
  id: string
  actionId: string
  text: string
}

export interface RestEffect {
  id: string
  rest: 'long' | 'short'
  kind: 'inspiration' | 'tempHp' | 'reminder'
  value: number
  note: string
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary' | 'artifact'

export interface WeaponStats {
  damage: string
  damageType: string
  /** 'finesse' uses the better of STR / DEX */
  ability: AbilityKey | 'finesse'
  proficient: boolean
  magicBonus: number
  range: string
  /** comma-separated, e.g. "Finesse, Light, Thrown" */
  properties: string
  /** weapon kind from the standard list ("Longsword"), '' for something custom */
  kind: string
  /** the kind's mastery property ("Sap"); only usable when a feature grants mastery with this kind */
  mastery: string
  /** inventory item used up per attack (arrows, bolts...), '' = none */
  ammoId: string
  ammoCost: number
}

export interface ArmorStats {
  kind: 'light' | 'medium' | 'heavy' | 'shield'
  /** base AC for armor, or the bonus for a shield */
  ac: number
  /** magic bonus (+1 armor etc.) */
  bonus: number
}

export interface Item {
  id: string
  name: string
  /** legacy flag from the gear / magic split; no longer used */
  magic?: boolean
  icon: string
  category: string
  qty: number
  weight: number
  value: string
  rarity: Rarity
  description: string
  /** equipment slot id when worn/wielded, '' when in the pack */
  slot: string
  attunement: boolean
  attuned: boolean
  actionType: ActionType
  effects: Effect[]
  /** set when the item can be used to attack: it then shows up under Weapons & Attacks */
  weapon: WeaponStats | null
  /** set for armor and shields: counts toward AC while equipped */
  armor: ArmorStats | null
  /** wikidot (or other) page for the item */
  url: string
}

export interface Attack {
  id: string
  name: string
  /** 'finesse' picks the better of STR/DEX */
  ability: AbilityKey | 'finesse'
  proficient: boolean
  magicBonus: number
  damage: string
  damageType: string
  addMod: boolean
  range: string
  notes: string
}

/** shortOne = regain one on a short rest, all on a long rest */
export type Recharge = 'short' | 'shortOne' | 'long' | 'dawn' | 'none'

export interface Resource {
  id: string
  name: string
  max: number
  used: number
  recharge: Recharge
  /** optional die size shown with it, e.g. 'd8' for Psionic Energy Dice */
  die: string
  /** the feature this resource belongs to ('' = standalone) */
  featureId: string
}

export interface HitDie {
  id: string
  die: number
  total: number
  spent: number
}

export interface GalleryImage {
  id: string
  src: string
  caption: string
}

export interface ExtraNote {
  id: string
  title: string
  text: string
}

/** Arknights 5e: Basic (2nd), Advanced (7th) and Elite (14th level) Operator Skills */
export type SkillTier = 'basic' | 'advanced' | 'elite' | 'other'

export interface OperatorSkill {
  id: string
  tier: SkillTier
  name: string
  spCost: number
  startSp: number
  /** Automatic / Offensive / Defensive */
  charging: string
  /** Action, Bonus Action, Reaction, No Action… */
  activation: string
  duration: string
  effect: string
}

/** Everything only an Arknights 5e sheet has. */
export interface AkData {
  /** Lungmen Dollars */
  lmd: number
  /** spent on Death's Door actions while Dying, max 6 */
  mettle: number
  /** current Skill Points */
  sp: number
  /** the Operator Skill that's running right now ('' = none) */
  activeSkill: string
  opSkills: OperatorSkill[]
  ap: { max: number; used: number; recharge: 'long' | 'short' }
  maxArtLevel: number
  /** a 9th-level Art can only be cast once per long rest */
  ninthUsed: boolean
  infected: boolean
  /** Oripathy Hardcore: Originium Assimilation Value */
  assimilation: number
  /** flat Damage Reduction (applied before resistance) */
  dr: number
  drNote: string
  /** operator codename, if one's been assigned */
  codename: string
}


export interface Character {
  id: string
  /** which game this sheet is for; older saves are D&D 5e */
  system: 'dnd5e' | 'ak5e'
  name: string
  className: string
  subclass: string
  level: number
  species: string
  background: string
  alignment: string
  nationality: string
  player: string
  xp: string
  /** small square image in the top-left corner */
  portrait: string
  /** larger image in the Appearance box on the Character page */
  appearanceImage: string
  emblem: string
  appearance: { age: string; height: string; weight: string; eyes: string; skin: string; hair: string }

  abilities: Record<AbilityKey, number>
  saveProf: Record<AbilityKey, 0 | 1>
  skillProf: Record<SkillKey, ProfLevel>
  halfProfAll: boolean
  profOverride: number | null

  hp: { current: number; temp: number }
  hpMax: Stat
  hitDice: HitDie[]
  deathSaves: { successes: number; failures: number }
  inspiration: boolean
  ac: Stat & { mode: 'manual' | 'unarmored' }
  speed: Stat
  initiative: Stat
  size: string
  conditions: string[]

  spellAbility: AbilityKey | ''
  slots: Record<number, { total: number; used: number }>
  spells: Spell[]

  features: Feature[]
  items: Item[]
  attacks: Attack[]
  resources: Resource[]
  coins: { cp: number; sp: number; ep: number; gp: number; pp: number }
  carryMultiplier: number

  proficiencies: { weapons: string; armor: string; tools: string; languages: string }
  story: {
    backstory: string
    /** personality traits (one box) */
    trait1: string
    /** legacy — merged into trait1 on load */
    trait2: string
    trait3: string
    ideals: string
    bonds: string
    flaws: string
    allies: string
    alliesTitle: string
    roleplay: string
    expression: string
  }
  extraNotes: ExtraNote[]
  battleState: string
  gallery: GalleryImage[]
  ak: AkData
  updatedAt: number
}

/** A spell you added to the shared spell library (same fields as the bundled library entries). */
export interface CustomSpell {
  id: string
  n: string
  l: number
  s: string
  ct: string
  r: string
  c: string
  d: string
  co: boolean
  ri: boolean
  m: boolean
  cl: string[]
  t: string
  /** wikidot page it was fetched from */
  url?: string
  /** the character spell this entry was saved from; edits to that spell keep it up to date */
  fromSpell?: string
}

/** A saved spot in a sourcebook (shown at the top of the reader's contents). */
export interface Bookmark {
  id: string
  /** sourcebook id (folder name, e.g. ak5e, srd52) */
  book: string
  page: number
  title: string
  /** where on the page, 0–1 from the top */
  y: number
}

export interface AppData {
  version: 1
  chars: Record<string, Character>
  order: string[]
  activeId: string
  theme: 'light' | 'dark'
  skin?: string
  /** the UI style last used for each game, so switching characters switches the look too */
  skinBySystem?: Record<string, string>
  /** your own spells, available to every character */
  customSpells?: CustomSpell[]
  /** sourcebook bookmarks, shared by all characters */
  bookmarks?: Bookmark[]
}
