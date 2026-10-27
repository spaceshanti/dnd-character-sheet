import { ALL_SKILLS } from './constants'
import { EMOJI_TO_ICON } from './components/Icon'
import { lookupWeapon } from './data/gear'
import type { AkData, Attack, Character, Effect, Feature, FeatureAction, Item, Mod, OperatorSkill, Resource, SkillTier, Spell } from './types'
import type { SystemId } from './systems'

export const uid = () =>
  (globalThis.crypto && 'randomUUID' in globalThis.crypto ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))

export function newEffect(): Effect {
  return { id: uid(), target: 'skill:all', type: 'advantage' }
}
export function newMod(): Mod {
  return { id: uid(), name: '', value: 0, on: true }
}
export function newSpell(level = 1, name = ''): Spell {
  return {
    id: uid(), name, level, prepared: false, alwaysPrepared: false, school: '', castingTime: '1 action',
    range: '', components: '', duration: '', concentration: false, ritual: false, materialConsumed: false, description: '', url: '',
    notes: '', effects: [], active: false, grantedBy: '', ammoId: '', ammoCost: 1,
  }
}
export function newFeature(category: Feature['category'] = 'class'): Feature {
  return { id: uid(), name: '', category, source: '', description: '', actionType: 'none', effects: [], active: true, actions: [], masteries: [], restEffects: [], collapsed: false, actionMods: [] }
}
export function newItem(): Item {
  return {
    id: uid(), name: '', icon: 'box', category: 'Misc', qty: 1, weight: 0, value: '', rarity: 'common',
    description: '', slot: '', attunement: false, attuned: false, actionType: 'none', effects: [],
    weapon: null, armor: null, url: '',
  }
}
export function newAttack(): Attack {
  return {
    id: uid(), name: '', ability: 'str', proficient: true, magicBonus: 0, damage: '1d6', damageType: '',
    addMod: true, range: '', notes: '',
  }
}
export function newResource(featureId = '', name = ''): Resource {
  return { id: uid(), name, max: 2, used: 0, recharge: 'long', die: '', featureId }
}
export function newFeatureAction(): FeatureAction {
  return { id: uid(), name: '', actionType: 'action', description: '', resourceId: '', cost: 1 }
}

export function newOpSkill(tier: SkillTier = 'basic'): OperatorSkill {
  return { id: uid(), tier, name: '', spCost: 10, startSp: 0, charging: 'Automatic', activation: 'Bonus Action', duration: '', effect: '' }
}
export function blankAk(): AkData {
  return {
    lmd: 0, mettle: 0, sp: 0, activeSkill: '', opSkills: [], ap: { max: 0, used: 0, recharge: 'long' }, maxArtLevel: 0,
    ninthUsed: false, infected: false, assimilation: 0, dr: 0, drNote: '',
  }
}

export function blankCharacter(name = 'New Character', system: SystemId = 'dnd5e'): Character {
  const skillProf = Object.fromEntries(ALL_SKILLS.map((s) => [s.key, 0])) as Character['skillProf']
  const slots: Character['slots'] = {}
  for (let i = 1; i <= 9; i++) slots[i] = { total: 0, used: 0 }
  return {
    id: uid(), system, name, className: '', subclass: '', level: 1, species: '', background: '', alignment: '', nationality: '',
    player: '', xp: '', portrait: '', appearanceImage: '', emblem: '',
    appearance: { age: '', height: '', weight: '', eyes: '', skin: '', hair: '' },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saveProf: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    skillProf, halfProfAll: false, profOverride: null,
    hp: { current: 10, temp: 0 },
    hpMax: { base: 10, mods: [] },
    hitDice: [],
    deathSaves: { successes: 0, failures: 0 },
    inspiration: false,
    ac: { base: 10, mods: [], mode: 'unarmored' },
    speed: { base: 30, mods: [] },
    initiative: { base: 0, mods: [] },
    size: 'Medium', conditions: [],
    spellAbility: '', slots, spells: [],
    features: [], items: [], attacks: [], resources: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, carryMultiplier: 15,
    proficiencies: { weapons: '', armor: '', tools: '', languages: '' },
    story: {
      backstory: '', trait1: '', trait2: '', trait3: '', ideals: '', bonds: '', flaws: '', allies: '',
      alliesTitle: 'Allies & Organizations', roleplay: '', expression: '',
    },
    extraNotes: [], battleState: '', gallery: [], ak: blankAk(), updatedAt: Date.now(),
  }
}

/** Fill any fields missing from an older / hand-edited save so the UI never sees undefined. */
export function normalize(raw: Partial<Character>): Character {
  const b = blankCharacter()
  const c = { ...b, ...raw } as Character
  c.appearance = { ...b.appearance, ...raw.appearance }
  c.abilities = { ...b.abilities, ...raw.abilities }
  c.saveProf = { ...b.saveProf, ...raw.saveProf }
  c.skillProf = { ...b.skillProf, ...raw.skillProf }
  c.hp = { ...b.hp, ...raw.hp }
  c.hpMax = { ...b.hpMax, ...raw.hpMax }
  c.ac = { ...b.ac, ...raw.ac }
  c.speed = { ...b.speed, ...raw.speed }
  c.initiative = { ...b.initiative, ...raw.initiative }
  c.deathSaves = { ...b.deathSaves, ...raw.deathSaves }
  c.coins = { ...b.coins, ...raw.coins }
  c.proficiencies = { ...b.proficiencies, ...raw.proficiencies }
  c.story = { ...b.story, ...raw.story }
  c.slots = { ...b.slots, ...raw.slots }
  c.system = raw.system === 'ak5e' ? 'ak5e' : 'dnd5e'
  c.ak = { ...b.ak, ...raw.ak, ap: { ...b.ak.ap, ...raw.ak?.ap } }
  // the three personality boxes became one
  if (c.story.trait2 || c.story.trait3) {
    c.story.trait1 = [c.story.trait1, c.story.trait2, c.story.trait3].filter((t) => t.trim()).join('\n\n')
    c.story.trait2 = ''
    c.story.trait3 = ''
  }
  c.spells = c.spells.map((s) => ({ ...s, materialConsumed: s.materialConsumed ?? isConsumed(s.components) }))
  c.features = c.features.map((f) => ({ ...f, actions: f.actions ?? [], masteries: f.masteries ?? [], restEffects: f.restEffects ?? [], collapsed: f.collapsed ?? false, actionMods: f.actionMods ?? [] }))
  c.spells = c.spells.map((s) => ({ ...s, grantedBy: s.grantedBy ?? '', ammoId: s.ammoId ?? '', ammoCost: s.ammoCost ?? 1 }))
  c.resources = c.resources.map((r) => ({ ...r, die: r.die ?? '', featureId: r.featureId ?? '' }))
  c.items = c.items.map((i) => ({
    ...i,
    icon: EMOJI_TO_ICON[i.icon] ?? i.icon,
    weapon: i.weapon ? { ...i.weapon, kind: i.weapon.kind ?? (lookupWeapon(i.name)?.kind ?? ''), mastery: i.weapon.mastery ?? (lookupWeapon(i.name)?.mastery ?? ''), ammoId: i.weapon.ammoId ?? '', ammoCost: i.weapon.ammoCost ?? 1 } : null,
    url: i.url ?? '',
    armor: i.armor ?? null,
  }))
  // the Appearance box used to show the top-left portrait; start it off with the same picture
  if (raw.appearanceImage === undefined) c.appearanceImage = c.portrait
  return c
}

/** Material components that are used up or have a gold cost. */
export function isConsumed(components: string): boolean {
  return /consume|\d[\d,]*\s*\+?\s*gp/i.test(components || '')
}
