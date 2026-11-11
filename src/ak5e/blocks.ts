import type { ActionType, EffectType, FeatureCategory } from '../types'

/*
 * Hand-made feature blocks for Arknights 5e: for each class / branch / species / nationality / background feature,
 * what it gives the sheet (its uses and how they come back, the actions that spend them, effects, rest reminders,
 * choices to make, Arts it grants). The feature's own text still comes from the book you downloaded; these only say
 * how it's wired up. A feature that isn't listed comes in as text only; `skip` leaves it out (choices made elsewhere).
 *
 * Numbers can be formulas (see src/formula.ts): "prof", "prof*2", "max(1, con)", "if(level>=7,2,1)". A resource can
 * also follow a column of the class / branch table ("col"), and both keep up as the character levels up.
 * In formulas and option effects, {name} is replaced by that choice's answer (e.g. {abil} → wis).
 */

export interface ResDef {
  /** defaults to the feature's name */
  name?: string
  /** a number or a formula; ignored when col is set */
  max?: number | string
  /** the class / branch table column whose value at your level is the maximum */
  col?: string
  recharge?: 'long' | 'short' | 'shortOne' | 'none'
  /** die shown with it ('d8'); a table column name works too ("Aid Die") */
  die?: string
}
export interface ActDef {
  /** defaults to the feature's name */
  name?: string
  type: ActionType
  /** the resource it spends, by name (this feature's first one if left out; '' = free) */
  res?: string
  cost?: number
}
export interface FxDef { target: string; type: EffectType; value?: number; formula?: string; note?: string; stacks?: boolean }
export interface RestDef { rest: 'long' | 'short'; note: string }

/** something to choose when filling in (each answer is stored by its id) */
export type ChoiceDef =
  | { id: string; kind: 'one'; prompt: string; options: { label: string; fx?: FxDef[]; note?: string }[] }
  | { id: string; kind: 'skills'; prompt: string; from: string[] | 'any'; pick: number; as?: 'proficiency' | 'expertise' }
  | { id: string; kind: 'ability'; prompt: string; from: string[] }

export interface Block {
  skip?: boolean
  cat?: FeatureCategory
  /** also on the Arts page */
  spell?: boolean
  /** the feature itself is used as… (when it has no resource of its own) */
  type?: ActionType
  r?: ResDef[]
  a?: ActDef[]
  fx?: FxDef[]
  rest?: RestDef[]
  choose?: ChoiceDef[]
  /** Arts it grants, always prepared */
  arts?: string[]
  /** the spellcasting ability is this choice's answer */
  castWith?: string
  /** ability score increases picked in the prompt: the answer to choice `id` gets `amount` each */
  pickAbilities?: { id: string; amount: number }[]
}

const R = (max: number | string, recharge: ResDef['recharge'] = 'long', more: Partial<ResDef> = {}): ResDef => ({ max, recharge, ...more })
const SPELLCASTING: ChoiceDef = { id: 'abil', kind: 'ability', prompt: 'Spellcasting ability', from: ['int', 'wis', 'cha'] }
/** "Choose one: Durable / Reliable / Tenacious" (most Ancient species) */
const ANCIENT: Block = {
  choose: [{
    id: 'av', kind: 'one', prompt: 'Ancient Versatility', options: [
      { label: 'Durable (+1 max HP per level)', fx: [{ target: 'hpMax', type: 'bonus', formula: 'level', note: 'Durable' }] },
      { label: 'Reliable (proficiency in a skill)', note: 'Reliable' },
      { label: 'Tenacious (½ proficiency on saves)', fx: [{ target: 'save:all', type: 'halfProf', note: 'Tenacious' }] },
    ],
  }, { id: 'avskill', kind: 'skills', prompt: 'Reliable: which skill? (only if you picked Reliable)', from: 'any', pick: 1 }],
}
const DEATH_SAVES: Block = { fx: [{ target: 'save:all', type: 'note', note: 'Cling to the World: add your Proficiency Bonus to Death Saving Throws' }] }
const EXTRA_ATTACK: Block = {}

/* ---------------------------------------------------------------- classes */

export const CLASS_BLOCKS: Record<string, Record<string, Block>> = {
  Caster: {
    'Caster Branch': { skip: true },
    'Arts Casting': { spell: true, choose: [SPELLCASTING], castWith: 'abil' },
    'Arts Detection': { spell: true, arts: ['Detect Magic'] },
    'Anti-Arts Training': { spell: true, arts: ['Counterspell', 'Dispel Magic'] },
    'Growing Power': { spell: true },
    'Additional Arts Pool': { spell: true },
    Unending: { spell: true },
    Doublecast: { spell: true, r: [R(1, 'short')] },
  },
  Defender: {
    'Defender Branch': { skip: true },
    Resilience: { r: [{ col: 'Resilience', recharge: 'long' }] },
    Shelter: { type: 'action', a: [{ name: 'Shelter (Bonus Action)', type: 'bonus', res: 'Resilience', cost: 1 }] },
    'Extra Attack': EXTRA_ATTACK,
    'Leaping Defence': { type: 'reaction', a: [{ name: 'Leaping Defence: regain Reaction', type: 'free', res: 'Resilience', cost: 1 }] },
    'Indestructible': { r: [R(1, 'short')], a: [{ type: 'reaction' }, { name: 'Indestructible: restore', type: 'free', res: 'Resilience', cost: 2 }] },
  },
  Guard: {
    'Guard Branch': { skip: true },
    'Press the Attack': { r: [{ name: 'Aggression', max: 'if(level>=14,8,if(level>=7,6,4))', recharge: 'short' }] },
    Unrelenting: { r: [R('if(level>=11,2,1)')], a: [{ type: 'reaction' }] },
    'Extra Attack': EXTRA_ATTACK,
    'Unrelenting Aggression': { a: [{ type: 'reaction', res: 'Aggression', cost: 2 }] },
  },
  Marksman: {
    'Marksman Branch': { skip: true },
    'Target Lock': { r: [R(1, 'short')], a: [{ type: 'free' }] },
    'Extra Attack': EXTRA_ATTACK,
    Unerring: { r: [R(1, 'short')], a: [{ type: 'free' }] },
    'Steel Rain': { r: [R(1, 'short')], a: [{ type: 'bonus' }] },
  },
  Medic: {
    'Medic Branch': { skip: true },
    'Arts Casting': { spell: true, choose: [SPELLCASTING], castWith: 'abil' },
    'Life Support': { spell: true, r: [{ col: 'Life Support', recharge: 'long' }], a: [{ name: 'Life Support', type: 'action', cost: 1 }] },
    'Medical Expertise': { fx: [{ target: 'skill:medicine', type: 'expertise' }] },
    'Self-Defence Protocol': { spell: true },
    Resuscitation: { spell: true, r: [R(1)], arts: ['Revivify'] },
    'To Rob the Ferryman': { spell: true },
    'Chosen of Asclepius': { spell: true },
  },
  Specialist: {
    'Specialist Branch': { skip: true },
    'Weapon Specialisation': { choose: [{ id: 'ws', kind: 'one', prompt: 'Weapon Specialisation', options: [{ label: 'Melee Combat', note: 'Melee Combat' }, { label: 'Ranged Combat', note: 'Ranged Combat' }] }] },
    'Show your Style': {
      r: [{ name: 'Prowess', max: 'prof', recharge: 'none' }],
      rest: [{ rest: 'short', note: 'Show your Style: gain 1 Prowess' }, { rest: 'long', note: 'Show your Style: gain 1 Prowess' }],
      a: [{ name: 'Reroll a failed Skill Check', type: 'free', res: 'Prowess', cost: 1 }],
    },
    'Weapon Expertise': { a: [{ type: 'bonus', res: 'Prowess', cost: 1 }] },
    'Falling Upwards': { a: [{ type: 'reaction', res: 'Prowess', cost: 3 }] },
  },
  Supporter: {
    'Supporter Branch': { skip: true },
    'Provide Aid': {
      choose: [{ id: 'aid', kind: 'ability', prompt: 'Aid Dice count from your…', from: ['int', 'wis', 'cha'] }],
      r: [{ name: 'Aid Dice', max: 'max(1, {aid})', recharge: 'long', die: 'Aid Die' }],
      a: [{ name: 'Provide Aid', type: 'bonus', cost: 1 }],
    },
    'Lighten the Load': { type: 'reaction' },
    'Ever Reliable': { rest: [{ rest: 'short', note: 'Ever Reliable: recover half your Aid Dice (round up)' }] },
  },
  Vanguard: {
    'Vanguard Branch': { skip: true },
    Landstrider: { fx: [{ target: 'speed', type: 'bonus', value: 10, note: 'Landstrider' }] },
    'Quick off the Mark': { fx: [{ target: 'initiative', type: 'bonus', formula: 'prof', note: 'Quick off the Mark' }] },
    'Extra Attack': EXTRA_ATTACK,
    'Uncanny Dodge': { type: 'reaction' },
  },
}

/** saving throws and skills each class chooses (the book's "Constitution + one of…", "Three from…") */
export const CLASS_CHOICES: Record<string, { saves: { fixed: string[]; from: string[]; pick: number }; skills: { fixed: string[]; from: string[]; pick: number } }> = {
  Caster: { saves: { fixed: [], from: ['int', 'wis', 'cha'], pick: 2 }, skills: { fixed: [], from: ['Arts', 'Lore', 'Investigation', 'Technology', 'Insight', 'Perception'], pick: 3 } },
  Defender: { saves: { fixed: ['con'], from: ['str', 'wis'], pick: 1 }, skills: { fixed: [], from: ['Athletics', 'Lore', 'Technology', 'Perception', 'Intimidation', 'Wilderness'], pick: 3 } },
  Guard: { saves: { fixed: ['str'], from: ['con', 'dex'], pick: 1 }, skills: { fixed: [], from: ['Acrobatics', 'Athletics', 'Lore', 'Insight', 'Intimidation', 'Wilderness'], pick: 3 } },
  Marksman: { saves: { fixed: ['dex'], from: ['wis', 'cha'], pick: 1 }, skills: { fixed: [], from: ['Acrobatics', 'Athletics', 'Perception', 'Sleight of Hand', 'Stealth', 'Wilderness'], pick: 3 } },
  Medic: { saves: { fixed: [], from: ['con', 'int', 'wis'], pick: 2 }, skills: { fixed: ['Medicine'], from: ['Lore', 'Arts', 'Technology', 'Insight', 'Perception', 'Persuasion'], pick: 2 } },
  Specialist: { saves: { fixed: ['dex'], from: ['wis', 'cha'], pick: 1 }, skills: { fixed: [], from: ['Acrobatics', 'Sleight of Hand', 'Stealth', 'Technology', 'Perception', 'Wilderness'], pick: 3 } },
  Supporter: { saves: { fixed: [], from: ['con', 'cha', 'wis'], pick: 2 }, skills: { fixed: [], from: ['Arts', 'Lore', 'Technology', 'Insight', 'Deception', 'Persuasion'], pick: 3 } },
  Vanguard: { saves: { fixed: ['dex'], from: ['str', 'cha'], pick: 1 }, skills: { fixed: [], from: ['Acrobatics', 'Athletics', 'Perception', 'Persuasion', 'Stealth', 'Wilderness'], pick: 3 } },
}

/* ---------------------------------------------------------------- branches ("Class/Branch") */

const ARTS_BRANCH: Block = { spell: true, choose: [SPELLCASTING], castWith: 'abil' }

export const BRANCH_BLOCKS: Record<string, Record<string, Block>> = {
  'Caster/Core': {
    'Versatile Caster': { spell: true, r: [R(1)], a: [{ type: 'action' }] },
    'Power from Within': { spell: true, r: [R(1)] },
    'Empowered Arts': { spell: true }, 'Master of the Elements': { spell: true }, Savant: { spell: true },
  },
  'Caster/Chain': {
    'Chain Art': { spell: true, r: [R('prof')], a: [{ type: 'free' }] },
    'Subtle Spark': { spell: true, r: [{ name: 'Sparks', max: 6, recharge: 'long' }] },
    Ouroboros: { spell: true }, 'Subtle Spark Upgraded': { spell: true },
    'Great Chain of Being': { spell: true, rest: [{ rest: 'short', note: 'Great Chain of Being: regain 1 use of Chain Art' }] },
  },
  'Caster/Mech-Accord': {
    'Indistinguishable from Magic': { spell: true },
    'Jury Rigging': { spell: true, type: 'bonus' },
    'Synergetic Casting': { spell: true }, 'Army of One': { spell: true }, 'Death from Above': { spell: true },
  },
  'Caster/Mystic': {
    'Mystic Charge': { spell: true, r: [{ name: 'Mystic Charge', max: 'if(level>=10,3,2)', recharge: 'none' }] },
    'Potent Cantrip': { spell: true }, 'Power Surge': { spell: true }, Turbocharger: { spell: true }, 'Feedback Loop': { spell: true },
  },
  'Caster/Primal': {
    'Residual Suffering': { spell: true, r: [R('prof*2')], a: [{ type: 'free' }] },
    'Debilitate and Destroy': { spell: true },
    'Elemental Burst': { spell: true, r: [R(1, 'short')], a: [{ type: 'bonus' }] },
    'Enduring Affliction': { spell: true }, 'Cardinal Punishment': { spell: true },
  },
  'Caster/Splash': {
    'Controlled Detonation': { spell: true, fx: [{ target: 'spellDc', type: 'note', note: '+2 when casting Arts that target an area (Controlled Detonation)' }] },
    'Splashing Cantrips': { spell: true }, 'Sculpt Arts': { spell: true }, 'Implements of Destruction': { spell: true },
    Unavoidable: { spell: true, r: [R(1, 'short')], a: [{ type: 'free' }] },
  },
  'Defender/Artshield': {
    'Against the Storm': { fx: [{ target: 'save:all', type: 'note', note: 'Advantage on saves against Arts (Against the Storm)' }] },
    'Weapons of the Enemy': { type: 'action' },
    'Eye of the Storm': { r: [R(1)], a: [{ type: 'reaction' }] },
  },
  'Defender/Dreadnought': {
    "Dreadnought's Advance": { r: [R(1, 'short')], a: [{ type: 'bonus' }, { name: "Dreadnought's Advance: restore", type: 'free', res: 'Resilience', cost: 2 }] },
    'Wrecking Wall': { r: [R(1)], a: [{ type: 'action' }] },
    'Sword of Damocles': { a: [{ type: 'free', res: 'Resilience', cost: 1 }] },
    'Legendary Might': { fx: [{ target: 'ability:str', type: 'bonus', value: 6, note: 'Legendary Might (max 26)' }] },
  },
  'Defender/Fortress': {
    'Fire for Effect': { r: [{ name: 'Munitions Dice', max: 5, recharge: 'long', die: 'if(level>=14,8,if(level>=7,6,4))' }], a: [{ name: 'Load Munitions', type: 'action', cost: 0 }] },
    Stronghold: { a: [{ type: 'reaction', res: 'Resilience', cost: 1 }] },
  },
  'Defender/Guardian': {
    'Guardian of Life': ARTS_BRANCH,
    'Not Today': { spell: true, a: [{ type: 'free', res: 'Resilience', cost: 1 }] },
    Anaesthesia: { spell: true },
    'Aura of Mercy': { spell: true },
    'The Best Medicine': { spell: true, r: [R(1)], a: [{ type: 'bonus' }] },
  },
  'Defender/Juggernaut': {
    Superheavy: { type: 'action', a: [{ name: 'Reform Barrier (Bonus Action)', type: 'bonus', res: 'Resilience', cost: 1 }] },
    Bullrush: { r: [R(1, 'short')], a: [{ type: 'action' }, { name: 'Bullrush: restore', type: 'free', res: 'Resilience', cost: 2 }] },
    Groundbreaker: { r: [R(1)], a: [{ type: 'action' }] },
  },
  'Defender/Protector': {
    'Centre of Attention': { r: [R('max(1, con)')], a: [{ type: 'action' }, { name: 'Centre of Attention (Bonus Action)', type: 'bonus', res: 'Resilience', cost: 2 }] },
    'Anchor Point': { a: [{ type: 'reaction', res: 'Resilience', cost: 1 }] },
    'Stone Wall': { type: 'reaction' },
  },
  'Defender/Sentry': {
    Pavise: { type: 'bonus' },
    'Advance and Fire': { type: 'reaction', a: [{ name: 'Advance and Fire: regain Reaction', type: 'free', res: 'Resilience', cost: 1 }] },
    Firebase: { r: [R(1)], a: [{ type: 'free' }] },
  },
  'Guard/Artsblade': {
    'Sword and Sorcery': { spell: true, r: [{ name: 'Spellsword Points', col: 'Spellsword Points', recharge: 'short' }], choose: [SPELLCASTING], castWith: 'abil' },
    Resonance: { spell: true, fx: [{ target: 'skill:arts', type: 'proficiency', note: 'Resonance (Expertise if already proficient)' }] },
    'Cut Through Chaos': { type: 'reaction' },
    'Sharpened Mind, Sharpened Weapon': { spell: true }, 'High Fantasy': { spell: true },
    'Power Overwhelming': { spell: true, r: [R(1)], a: [{ type: 'free' }] },
  },
  'Guard/Brawler': {
    'Guns Out': { fx: [{ target: 'ac', type: 'note', note: 'Guns Out: base AC 10 + STR + DEX' }] },
    'No Ordinary Pugilist': {},
    Mountainbreaker: { r: [R(1)], a: [{ type: 'action' }] },
  },
  'Guard/Centurion': {
    'Shock Trooper': { fx: [{ target: 'skill:intimidation', type: 'proficiency', note: 'Shock Trooper (Expertise if already proficient)' }], a: [{ name: 'Brutal Execution', type: 'bonus', res: 'Aggression', cost: 2 }] },
    'Mow Them Down': { r: [R(1, 'short')] },
    Guillotine: { type: 'action' },
    'Storm of Blood': { type: 'action' },
  },
  'Guard/Crusher': {
    'Towering Might': { fx: [{ target: 'hpMax', type: 'bonus', formula: 'level*3', note: 'Towering Might' }] },
  },
  'Guard/Duellist': {
    'Singular Foe': { type: 'bonus' },
    'Parry and Riposte': { a: [{ name: 'Riposte', type: 'reaction', res: 'Aggression', cost: 1 }] },
    'Principles of Defence': { a: [{ name: 'Lightning Reflexes', type: 'reaction', res: 'Aggression', cost: 1 }] },
  },
  'Guard/Instructor': {
    'Squad Leader': { type: 'bonus' },
    Instruction: { r: [{ name: 'Instruction Dice', max: 4, recharge: 'short', die: 'd6' }] },
    'Once More Unto The Breach': { r: [R(1)], a: [{ type: 'action' }] },
  },
  'Guard/Liberator': {
    'Essence of the Liberator': { r: [{ name: 'Liberty', max: 6, recharge: 'none' }] },
    'Praxis': { a: [{ name: 'Face Me', type: 'bonus', res: 'Aggression', cost: 2 }] },
  },
  'Guard/Lord': {
    'Manifest Will': { r: [R('prof')] },
    'Force of Will': { r: [R('prof')] },
  },
  'Guard/Musha': {
    Tenacity: { type: 'bonus' },
    'Enduring Resolve': { fx: [{ target: 'save:wis', type: 'proficiency', note: 'Enduring Resolve' }] },
    'Warrior Spirit': { type: 'reaction', a: [{ name: 'Retaliator', type: 'reaction', res: 'Aggression', cost: 2 }] },
  },
  'Guard/Reaper': {
    'Fear the Reaper': { r: [R(1)], a: [{ type: 'bonus' }] },
  },
  'Guard/Weaponmaster': {
    'Judgement Cut': { type: 'bonus' },
    Untouchable: { r: [R(2)], a: [{ type: 'reaction' }] },
    'Song of Steel': { r: [R(1)], a: [{ type: 'bonus' }] },
  },
  'Marksman/Anti-Air': {
    'Versatile Approach': { r: [R('prof', 'short')], a: [{ type: 'bonus' }] },
    Unapproachable: { type: 'reaction' },
    'Always Another Option': {},
  },
  'Marksman/Artilleryman': {
    'Delayed Detonation': { r: [R(1, 'short')] },
    'Secondary Detonation': { r: [R('prof')] },
    'Force of Nature': { r: [R(1, 'short')] },
  },
  'Marksman/Besieger': {
    'Siege Mode': { type: 'free' },
    'Siege Bolt': { r: [R(1)], a: [{ type: 'action' }] },
    "Goliath's Bane": { r: [R('prof')], a: [{ type: 'free' }] },
  },
  'Marksman/Deadeye': {
    Deadshot: { type: 'bonus' },
    'Vital Strike': { type: 'action' },
    'Anti-Sniper Training': { fx: [{ target: 'skill:stealth', type: 'proficiency', note: 'Anti-Sniper Training' }] },
  },
  'Marksman/Flinger': {
    'Manipulation Arts': ARTS_BRANCH,
    'Kinetic Strike': { spell: true, r: [R(1)], a: [{ type: 'action' }] },
    'Whirling Death': { spell: true, type: 'action' },
  },
  'Marksman/Heavyshot': {
    'Savage Shots': { r: [R('prof')], a: [{ type: 'bonus' }] },
    Heartseeker: { r: [R(1)], a: [{ type: 'free' }] },
  },
  'Marksman/Hunter': {
    'Empowered Shots': { r: [{ name: 'Charges', max: 'if(level>=14,6,if(level>=7,4,2))', recharge: 'short' }], a: [{ name: 'Recharge Empowered Shots', type: 'action', cost: 0 }] },
    Railgun: { r: [R(1)], a: [{ type: 'action' }] },
    'Let the Light In': { r: [R(1)], a: [{ type: 'action' }] },
  },
  'Marksman/Spreadshot': {
    'Whites Of Their Eyes': { fx: [{ target: 'speed', type: 'bonus', value: 10, note: 'Whites Of Their Eyes' }] },
    'Break Their Lines': { type: 'reaction' },
    'Both Barrels': { type: 'action' },
  },
  'Medic/Physician': {
    'Focused Treatment': { spell: true },
    'Intravenous Line': { spell: true, a: [{ type: 'action', res: 'Life Support', cost: 10 }] },
    'Hypocritic Oath': { spell: true },
    'Inpatient Care': { spell: true, a: [{ type: 'reaction', res: 'Life Support', cost: 15 }] },
    'Surgeon-General': { spell: true },
  },
  'Medic/Therapist': {
    'Basic Therapy': { spell: true },
    'The Doctor Is In': { spell: true, r: [R(1)], a: [{ type: 'bonus' }] },
    'Early Onset Treatment': { spell: true, r: [R('prof')], a: [{ type: 'reaction' }] },
    'Advanced Therapy': { spell: true }, 'Concentrated Treatment': { spell: true },
  },
  'Medic/Triage': {
    'Rapid Response': { spell: true, a: [{ type: 'action', res: 'Life Support', cost: 10 }] },
    'Urgent Care Centre': { spell: true },
    'Emergency Medicine': { spell: true, a: [{ type: 'action', res: 'Life Support', cost: 20 }] },
    'Touch of Life and Death': { spell: true },
    'Mobile Hospital': { spell: true, r: [R(1)], a: [{ type: 'bonus' }] },
  },
  'Medic/Ward': {
    'Prevention, not Cure': { spell: true },
    'Status Resistance': { spell: true },
    'Treat the Cause, not the Symptom': { spell: true, type: 'reaction', a: [{ name: 'Treat the Cause: regain Reaction', type: 'free', res: 'Life Support', cost: 15 }] },
    'Warding Surge': { spell: true, a: [{ type: 'reaction', res: 'Life Support', cost: 10 }, { name: 'Warding Surge: regain Reaction', type: 'free', res: 'Life Support', cost: 15 }] },
    'Community Care': { spell: true },
  },
  'Medic/Witchcraft': {
    'Halfway House': { spell: true, type: 'reaction' },
    Witchdoctor: {},
    Witchcurse: { spell: true, a: [{ type: 'bonus', res: 'Life Support', cost: 10 }] },
    'Life Support Specialist': { spell: true },
    'Life through Death': { spell: true },
  },
  'Specialist/Executor': {
    'The Wolf and the Shepherd': { choose: [{ id: 'path', kind: 'one', prompt: 'Your path', options: [{ label: 'Hunter', note: 'Hunter' }, { label: 'Bodyguard', note: 'Bodyguard' }] }] },
    'In Every Shadow': { fx: [{ target: 'skill:stealth', type: 'proficiency', note: 'In Every Shadow (Expertise if already proficient)' }] },
    'Spring the Ambush/Escape the Ambush': { a: [{ name: 'Spring the Ambush', type: 'action', res: 'Prowess', cost: 1 }, { name: 'Escape the Ambush', type: 'reaction', res: 'Prowess', cost: 1 }] },
    'Preysense/Dangersense': { type: 'reaction' },
    'In for the Kill/Blade Shield': { type: 'reaction' },
    'Mortal Blow/Ultimate Sword and Shield': { r: [R(1)], a: [{ type: 'action' }] },
  },
  'Specialist/Hookmaster': {
    'Ensnare and Entangle': { a: [{ type: 'action', res: 'Prowess', cost: 1 }] },
    'Mighty Push': { r: [R('prof')], a: [{ type: 'action' }] },
    "Spider's Essence": { type: 'action' },
    'Scorpion Sting': { r: [R(1)], a: [{ type: 'action' }] },
  },
  'Specialist/Infusion': {
    'Principle of Double Effect': { r: [{ name: 'Alchemical Infusions', max: 'prof*2', recharge: 'long' }], a: [{ name: 'Apply an Infusion', type: 'bonus', cost: 1 }] },
    'Double-Blind Trial': { a: [{ type: 'bonus', res: 'Prowess', cost: 1 }] },
    'To Defy Science': { r: [R(1)], a: [{ type: 'action' }] },
  },
  'Specialist/Inventor': {
    'Equipment Modification': { r: [{ name: 'Inventions', max: 'prof*2', recharge: 'long' }] },
    'Strange Contraption': { type: 'action' },
    'Mobile Modding': { a: [{ type: 'action', res: 'Prowess', cost: 1 }] },
    'The Big One': { type: 'action' },
  },
  'Specialist/Skyranger': {
    'Take Flight': { r: [{ name: 'Fuel', col: 'Maximum Fuel', recharge: 'long' }], a: [{ name: 'Fly', type: 'bonus', res: 'Fuel', cost: 1 }] },
    'Air Doctrine': { a: [{ type: 'action', res: 'Fuel', cost: 1 }] },
    Jink: { a: [{ type: 'reaction', res: 'Prowess', cost: 1 }] },
    Skyscreamer: { r: [R(1)], a: [{ type: 'free' }] },
  },
  'Specialist/Dollkeeper': {
    'Living Doll': { type: 'bonus' },
    'Musical Chairs': { a: [{ type: 'bonus', res: 'Prowess', cost: 1 }] },
    Masquerade: { r: [R('prof', 'short')], a: [{ type: 'reaction' }] },
    'Artistry is Violence': { r: [R(1)], a: [{ type: 'free' }] },
  },
  'Specialist/Trapmaster': {
    'Environmental Warfare': { r: [R('prof*2')], a: [{ type: 'bonus' }] },
    "Here's One I Made Earlier": { a: [{ type: 'action', res: 'Prowess', cost: 1 }] },
    'Bait the Trap': { r: [R('prof', 'short')] },
    'House of Horrors': { r: [R(1)], a: [{ type: 'action' }] },
  },
  'Supporter/Artificer': {
    'Master of Machines': { fx: [{ target: 'skill:technology', type: 'proficiency', note: 'Master of Machines (Expertise if already proficient)' }], type: 'action' },
  },
  'Supporter/Bard': {
    'A Magical Performance': { spell: true },
    'Soul of the Bard': { r: [R(1, 'short')], a: [{ type: 'free' }] },
    'Time Signature Change': { spell: true },
    'Emergency Improv': { type: 'action' },
  },
  'Supporter/Hexer': {
    "Hexer's Arts": ARTS_BRANCH,
    'Potent Hex': { spell: true, r: [R('prof')] },
    Cursemark: { spell: true, a: [{ type: 'bonus', res: 'Potent Hex', cost: 1 }] },
  },
  'Supporter/Ritualist': {
    'Ritual Arts': ARTS_BRANCH,
    'The Essence of Ritual': { spell: true },
    'Taking Shortcuts': { spell: true, r: [R(1)], a: [{ type: 'bonus' }] },
    'Pre-Preparation of Rites': { spell: true },
  },
  'Supporter/Summoner': {
    "Summoner's Arts": ARTS_BRANCH,
    'Creature Creation': { spell: true, r: [{ name: 'Sparks of Creation', col: 'Sparks of Creation', recharge: 'long' }], a: [{ name: 'Create a Summon', type: 'action', cost: 1 }] },
    Symbiosis: { spell: true, a: [{ type: 'bonus', res: 'Aid Dice', cost: 1 }] },
    'Greater Creature Creation': { spell: true, a: [{ type: 'action', res: 'Sparks of Creation', cost: 3 }] },
  },
  'Vanguard/Agent': {
    'Secret Agent': { r: [R('prof')], a: [{ type: 'bonus' }], choose: [{ id: 'exp', kind: 'skills', prompt: 'Secret Agent: Expertise in a skill you\'re proficient in', from: 'any', pick: 1, as: 'expertise' }] },
    'Consummate Professional': {},
    'Smoke and Mirrors': { r: [R(1, 'short')], a: [{ type: 'reaction' }] },
  },
  'Vanguard/Charger': {
    'Gathering Momentum': { r: [{ name: 'Momentum', max: 6, recharge: 'none' }], type: 'action' },
    'Onto the Next': { type: 'bonus' },
  },
  'Vanguard/Pioneer': {
    'Heavy Duty': { fx: [{ target: 'hpMax', type: 'bonus', formula: 'level*2', note: 'Heavy Duty' }] },
    Auramancy: { type: 'action' },
  },
  'Vanguard/Standard Bearer': {
    'Battle Standard': { type: 'bonus' },
    'Battle Cry': { r: [{ name: 'Fervour', max: 10, recharge: 'none' }] },
    Proclaimer: { type: 'reaction' },
    'The Last Stand': { type: 'action' },
  },
  'Vanguard/Tactician': {
    'Tactical Knowledge': { r: [{ name: 'Acumen', max: 'prof*2', recharge: 'long' }] },
    'Strategic Genius': { type: 'action' },
    'Fail to Plan, Plan to Fail.': { r: [R(1)] },
    Checkmate: { type: 'reaction' },
  },
}

/* ---------------------------------------------------------------- species */

export const SPECIES_BLOCKS: Record<string, Record<string, Block>> = {
  Aegir: { 'Ancient Versatility': ANCIENT, 'Ever the Student, Ever the Master': { rest: [{ rest: 'long', note: 'Ever the Student, Ever the Master: choose a Student / Teacher' }] }, 'Logic Engine': { rest: [{ rest: 'short', note: 'Logic Engine: study an item to become proficient with it' }] } },
  Anura: { 'Ancient Versatility': ANCIENT, 'Toxin Glands': { r: [R(1, 'short')], a: [{ type: 'action' }] }, 'Blood of the Swamp': { fx: [{ target: 'save:con', type: 'note', note: 'Advantage vs. Poisoned / toxins; Resistance to Poison' }] } },
  Archosauria: {
    'Ancient Versatility': ANCIENT,
    'Exult in Violence': { r: [R('prof')], a: [{ type: 'reaction' }] },
    Reckless: { type: 'reaction' },
    'Tail Strike': { choose: [{ id: 'tail', kind: 'one', prompt: 'Tail', options: [{ label: 'Thick Tail (Strength)', note: 'Thick Tail' }, { label: 'Thin Tail (Dexterity)', note: 'Thin Tail' }] }] },
  },
  Caprinae: {
    'Ancient Versatility': ANCIENT,
    'Arts Resistance': { fx: [{ target: 'save:all', type: 'note', note: 'Advantage on saves against Arts (Arts Resistance)' }] },
    'In Their Blood': { spell: true, fx: [{ target: 'skill:arts', type: 'proficiency', note: 'In Their Blood' }], r: [R(1, 'short')] },
    'Caprinae Arts Table': { skip: true },
  },
  Cautus: { 'Ancient Versatility': ANCIENT, 'Move First or Move Never': { fx: [{ target: 'initiative', type: 'bonus', formula: 'dex', note: 'Move First or Move Never (twice DEX)' }] } },
  Durin: {
    "Don't Look Down on Me!": { r: [R('prof')], a: [{ type: 'free' }] },
    'Hard Target': { fx: [{ target: 'ac', type: 'note', note: 'Hard Target: base AC 12 + DEX' }] },
    'Cling to the World': DEATH_SAVES,
  },
  Elafia: { 'Ancient Versatility': ANCIENT, 'Jack-of-Trades': { fx: [{ target: 'skill:all', type: 'halfProf', note: 'Jack-of-Trades (rounding up)' }] } },
  Feline: { 'Ancient Versatility': ANCIENT, "Cat's Agility": { type: 'reaction' }, 'Natural Skulkers': { fx: [{ target: 'skill:stealth', type: 'proficiency', note: 'Natural Skulkers' }] } },
  Kuranta: { 'Ancient Versatility': ANCIENT, 'Ever Onward': { type: 'reaction' }, 'Run Them Down': { type: 'bonus' }, 'Until the Last Breath': { r: [R(1)], a: [{ type: 'bonus' }] } },
  Liberi: {
    'Ancient Versatility': ANCIENT,
    'Avian Senses': { fx: [{ target: 'skill:perception', type: 'note', note: 'Avian Senses: reroll a failed sight / hearing check with Advantage' }] },
    'Birds of a Feather': {
      r: [{ name: 'Birds of Prey', max: 1, recharge: 'short' }, { name: 'Nestmakers', max: 1, recharge: 'short' }],
      a: [{ name: 'Birds of Prey', type: 'free', res: 'Birds of Prey', cost: 1 }, { name: 'Nestmakers', type: 'free', res: 'Nestmakers', cost: 1 }],
      rest: [{ rest: 'long', note: 'Birds of a Feather: you can add someone to your Flock' }],
    },
    'Preening Feathers': { r: [R(1)], rest: [{ rest: 'short', note: 'Preening Feathers: preen for Advantage on Persuasion or Intimidation' }] },
  },
  Lupo: {
    'Ancient Versatility': ANCIENT,
    'La Forza del Lupo': { choose: [{ id: 'lupo', kind: 'one', prompt: 'La Forza del Lupo', options: [{ label: 'Athletics', fx: [{ target: 'skill:athletics', type: 'proficiency', note: 'La Forza del Lupo' }] }, { label: 'Acrobatics', fx: [{ target: 'skill:acrobatics', type: 'proficiency', note: 'La Forza del Lupo' }] }] }] },
  },
  Oni: {
    'Demonic Strength': { fx: [{ target: 'save:str', type: 'advantage', note: 'Demonic Strength' }, { target: 'skill:athletics', type: 'advantage', note: 'Demonic Strength' }] },
    "Journey's End": { r: [R(1)], a: [{ name: 'Bloodfury', type: 'free' }] },
    'Cling to the World': DEATH_SAVES,
  },
  Perro: { 'Ancient Versatility': ANCIENT, Irrepressible: { type: 'bonus' }, 'Survive and Adapt': { r: [R(1, 'short')], a: [{ type: 'reaction' }] } },
  Phidia: { 'Ancient Versatility': ANCIENT, 'Example: Following your Agenda': { skip: true }, 'Ophidian Sonar': { type: 'action' } },
  Sankta: {
    Lawbringers: { r: [R('prof')], a: [{ type: 'free' }] },
    'Fallen Sankta Feature: Scorn': { skip: true },
    Scorn: {},
    'Cling to the World': DEATH_SAVES,
  },
  Sarkaz: {
    Witchcraft: { spell: true, r: [R('if(level>=7,2,1)')] },
    'Sarkaz Arts': { skip: true },
    'Cling to the World': DEATH_SAVES,
  },
  Banshee: { 'Voice of Ruin': { spell: true } },
  Clanless: { 'Born Survivors': { r: [R(1)], a: [{ type: 'free' }] }, 'Ties that Bind': { spell: true, arts: ['Guidance'] } },
  Cyclopes: { 'Divine the Spirits': { r: [R(1, 'short')] }, Precognitive: { type: 'reaction' } },
  Djall: { Cognitovore: { type: 'action' }, 'Key to the Heart': { spell: true } },
  Gargoyle: { 'To Mold Mud and Rock': { r: [R(1)] }, 'To Speak with Stone': { spell: true, arts: ['Commune with Nature'] } },
  Nachzehrer: { 'In Death, Life; In Life, Death': { r: [R(1, 'short'), { name: 'Rot', max: 'level', recharge: 'none' }] }, 'Rot and Ruin': { spell: true } },
  Vampire: { 'Blood Magic': { spell: true }, Haematophage: { type: 'action' } },
  Ursus: { 'Ancient Versatility': ANCIENT, 'Blood of Ursus': { type: 'action' } },
  Vouivre: {
    'Ancient Versatility': ANCIENT,
    Dragonscale: { fx: [{ target: 'dr', type: 'bonus', value: 3, note: 'Dragonscale (Physical)' }] },
    'Tough as Nails': { r: [R(1, 'short')], a: [{ type: 'reaction' }] },
  },
  Vulpo: {
    'Ancient Versatility': ANCIENT,
    "Fox's Guile": { fx: [{ target: 'skill:investigation', type: 'proficiency', note: "Fox's Guile" }, { target: 'skill:investigation', type: 'note', note: 'Advantage to see through illusions or disguises' }] },
    Inescapable: { r: [R(1, 'short')], a: [{ type: 'special' }] },
  },
  Zalak: {
    'Ancient Versatility': ANCIENT,
    Hyperfocus: { r: [R(1, 'short')], a: [{ type: 'free' }] },
    'Nervous Disposition': { fx: [{ target: 'skill:perception', type: 'note', note: '+5 to passive Perception (Nervous Disposition)' }] },
    'Prey Sense': { type: 'bonus' },
    'GM Discretion on Rare Species': { skip: true },
  },
  'Abyssal Hunter': { 'Ancient Versatility': ANCIENT, 'Dance Partner': { r: [R(1, 'short')] }, 'Example: Battle Rhythm': { skip: true } },
  Elf: { 'Flowing Shape': { type: 'action' }, 'Guardian of Terra': { spell: true }, 'Elven Magic': { spell: true } },
  Draco: { "Dragon's Rage": { spell: true, r: [R(1, 'short')], arts: ['Hellish Rebuke'] }, 'Draco Subspecies': { skip: true } },
  Doomfire: { 'Breath of Ill Omen': { type: 'action' } },
  Hearthfire: { 'Breath of Life': { type: 'bonus' } },
  Hellfire: { 'Breath of Destruction': { type: 'bonus' } },
  "K'uk'ulkan": { 'Variant Rule: A Painful Exchange': { skip: true }, Stormborne: { spell: true, r: [R(1)] }, "K'uk'ulkan Arts": { skip: true } },
  Lung: { 'Weight of History': { fx: [{ target: 'skill:lore', type: 'proficiency', note: 'Weight of History' }], r: [R(1)] } },
  'Nightzmora Kuranta': { Misdirection: { spell: true, arts: ['Minor Illusion'] }, 'Run Them Down': { type: 'bonus' }, 'Living Nightmares': { spell: true }, 'Illusory Arts': { spell: true, r: [R(1, 'short')] } },
}

/* ---------------------------------------------------------------- nationality feats & background feats (by feat name) */

export const FEAT_BLOCKS: Record<string, Block> = {
  'Legacy of The Predecessors': { fx: [{ target: 'skill:technology', type: 'proficiency', note: 'Legacy of The Predecessors' }], r: [R(1, 'short')] },
  'A Land Divided, A People United': { type: 'reaction' },
  'Frontier Knowledge': { rest: [{ rest: 'long', note: 'Frontier Knowledge: learn the flora and fauna where you rested' }] },
  'Joy of Living': { rest: [{ rest: 'short', note: 'Joy of Living: drink and make merry to roll a Hit Die without spending it' }] },
  'Bushido Spirit': { r: [{ name: 'Pride', max: 2, recharge: 'long' }], a: [{ name: 'Use Pride', type: 'free', cost: 1 }] },
  'One Nation under Kjeragandr': { fx: [{ target: 'skill:lore', type: 'proficiency', note: 'One Nation under Kjeragandr' }], r: [R(1)] },
  'Sound of Music': { fx: [{ target: 'skill:performance', type: 'proficiency', note: 'Sound of Music' }] },
  "Nature's Gift": { rest: [{ rest: 'long', note: "Nature's Gift: forage a makeshift Medical Kit (in woodland)" }] },
  'Demon Hunter': { type: 'action' },
  'Never Counted Out': {},
  'Life is Cheap, Friends are Priceless': { type: 'reaction' },
  'Hegemonic Culture': { rest: [{ rest: 'long', note: 'Hegemonic Culture: contact fellow Victorians in a major settlement' }] },
  Officer: { r: [{ name: 'Acumen', max: 3, recharge: 'long' }] },
  Wuxia: { r: [R('prof')], a: [{ name: 'Wuxia: Shove', type: 'bonus' }] },
  'We All Lift Together': { type: 'bonus' },
  'To Know your Own Place': { fx: [{ target: 'skill:insight', type: 'note', note: 'Advantage to tell if someone is hostile towards you' }] },
  Survivor: { rest: [{ rest: 'long', note: 'Survivor: shelter and food for you and PB others' }] },
  'Finger on the Pulse': { r: [R(1)], rest: [{ rest: 'short', note: 'Finger on the Pulse: perform to give temporary Inspiration' }] },
  'Breaking Common Ground': { fx: [{ target: 'hpMax', type: 'bonus', formula: 'level', note: 'Breaking Common Ground' }] },
  'Honour Among Thieves': { rest: [{ rest: 'long', note: 'Honour Among Thieves: contact someone for a favour (major settlement)' }] },
  'Professional Expertise': {
    choose: [
      { id: 'prof2', kind: 'skills', prompt: 'Professional Expertise: two skill proficiencies', from: 'any', pick: 2 },
      { id: 'exp1', kind: 'skills', prompt: 'Professional Expertise: Expertise in one skill', from: 'any', pick: 1, as: 'expertise' },
    ],
  },
}
