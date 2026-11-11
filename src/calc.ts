import { ALL_SKILLS } from './constants'
import { isAK } from './systems'
import { tryFormula } from './formula'
import type { AbilityKey, Attack, Character, Effect, Item, ProfLevel, SkillKey, Spell, Stat, WeaponStats } from './types'

export interface Part {
  label: string
  value: number
}
export interface Tagged {
  source: string
  note?: string
}
export interface ActiveEffect {
  effect: Effect
  source: string
  kind: 'feature' | 'item' | 'spell'
  sourceId: string
}

export const mod = (score: number) => Math.floor((score - 10) / 2)
export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export function itemIsActive(i: Item): boolean {
  return !!i.slot && (!i.attunement || i.attuned)
}

export function activeEffects(c: Character): ActiveEffect[] {
  const out: ActiveEffect[] = []
  for (const f of c.features) if (f.active) for (const e of f.effects) out.push({ effect: e, source: f.name || 'Feature', kind: 'feature', sourceId: f.id })
  for (const i of c.items) if (itemIsActive(i)) for (const e of i.effects) out.push({ effect: e, source: i.name || 'Item', kind: 'item', sourceId: i.id })
  for (const s of c.spells) if (s.active) for (const e of s.effects) out.push({ effect: e, source: s.name || 'Spell', kind: 'spell', sourceId: s.id })
  return withFormulas(c, out)
}

/**
 * The variables a custom formula can use (see src/formula.ts). Ability modifiers count every effect except other
 * formulas, so a formula can't end up depending on itself.
 */
export function formulaVars(c: Character, effects: ActiveEffect[] = activeEffects(c)): Record<string, number> {
  const fixed = effects.filter((a) => !a.effect.formula)
  const v: Record<string, number> = {
    level: Math.max(1, Math.floor(c.level) || 1), prof: profBonus(c), hitDice: c.hitDice.reduce((s, h) => s + h.total, 0),
    ap: c.ak?.ap.max ?? 0, artLevel: c.ak?.maxArtLevel ?? 0,
  }
  for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as AbilityKey[]) {
    const a = ability(c, k, fixed)
    v[k] = a.mod
    v[`${k}Score`] = a.score
  }
  v.spellMod = c.spellAbility ? v[c.spellAbility] : 0
  return v
}

/** effects with a formula get their value worked out now */
function withFormulas(c: Character, list: ActiveEffect[]): ActiveEffect[] {
  if (!list.some((a) => a.effect.formula)) return list
  const vars = formulaVars(c, list)
  return list.map((a) => (a.effect.formula ? { ...a, effect: { ...a.effect, value: tryFormula(a.effect.formula, vars).value } } : a))
}

/** Effects that exist but are switched off (shown dimmed in breakdowns). */
export function inactiveEffects(c: Character): ActiveEffect[] {
  const out: ActiveEffect[] = []
  for (const f of c.features) if (!f.active) for (const e of f.effects) out.push({ effect: e, source: f.name || 'Feature', kind: 'feature', sourceId: f.id })
  for (const i of c.items) if (!itemIsActive(i)) for (const e of i.effects) out.push({ effect: e, source: i.name || 'Item', kind: 'item', sourceId: i.id })
  for (const s of c.spells) if (!s.active) for (const e of s.effects) out.push({ effect: e, source: s.name || 'Spell', kind: 'spell', sourceId: s.id })
  return withFormulas(c, out)
}

const forTargets = (list: ActiveEffect[], targets: string[]) => list.filter((a) => targets.includes(a.effect.target))

export function profBonus(c: Character): number {
  if (c.profOverride != null) return c.profOverride
  const lvl = Math.min(20, Math.max(1, Math.floor(c.level) || 1))
  return 2 + Math.floor((lvl - 1) / 4)
}

export interface AbilityInfo {
  score: number
  base: number
  mod: number
  parts: Part[]
  changed: boolean
}

export function ability(c: Character, k: AbilityKey, effects = activeEffects(c)): AbilityInfo {
  const base = c.abilities[k]
  let score = base
  const parts: Part[] = [{ label: 'Base score', value: base }]
  for (const a of forTargets(effects, [`ability:${k}`])) {
    if (a.effect.type === 'bonus') {
      score += a.effect.value ?? 0
      parts.push({ label: a.source, value: a.effect.value ?? 0 })
    }
  }
  for (const a of forTargets(effects, [`ability:${k}`])) {
    if (a.effect.type === 'minScore' && (a.effect.value ?? 0) > score) {
      parts.push({ label: `${a.source} (sets to ${a.effect.value})`, value: (a.effect.value ?? 0) - score })
      score = a.effect.value ?? 0
    }
  }
  return { score, base, mod: mod(score), parts, changed: score !== base }
}

export interface RollInfo {
  total: number
  parts: Part[]
  adv: string[]
  dis: string[]
  notes: string[]
  profLevel: number
  baseProf: number
}

function collect(effects: ActiveEffect[], targets: string[]) {
  const adv: string[] = []
  const dis: string[] = []
  const notes: string[] = []
  const bonuses: Part[] = []
  let prof = 0
  // proficiency that adds on top of the rest (each its own line in the breakdown)
  const stacked: { label: string; level: number }[] = []
  for (const a of forTargets(effects, targets)) {
    const e = a.effect
    if (e.type === 'advantage') adv.push(a.source + (e.note ? ` — ${e.note}` : ''))
    else if (e.type === 'disadvantage') dis.push(a.source + (e.note ? ` — ${e.note}` : ''))
    else if (e.type === 'note') notes.push(`${a.source}: ${e.note ?? ''}`)
    else if (e.type === 'bonus') bonuses.push({ label: a.source, value: e.value ?? 0 })
    else if (e.type === 'proficiency' || e.type === 'halfProf' || e.type === 'expertise') {
      const level = e.type === 'expertise' ? 2 : e.type === 'halfProf' ? 0.5 : 1
      if (e.stacks) stacked.push({ label: a.source, level })
      else prof = Math.max(prof, level)
    }
  }
  return { adv, dis, notes, bonuses, prof, stacked }
}

/** what proficiency adds at a level: ½ (rounded down), 1× or 2× the bonus */
function profPart(level: number, pb: number, label?: string): Part {
  const what = level === 0.5 ? 'Half proficiency' : level === 2 ? 'Expertise' : 'Proficiency'
  return { label: label ? `${label} (${what.toLowerCase()}, stacks)` : what, value: level === 0.5 ? Math.floor(pb / 2) : pb * level }
}

/** the proficiency lines for a roll: the best one, then any that stack; and the level shown on its pip */
function profParts(level: number, stacked: { label: string; level: number }[], pb: number): { parts: Part[]; shown: number } {
  const parts = level ? [profPart(level, pb)] : []
  for (const s of stacked) parts.push(profPart(s.level, pb, s.label))
  return { parts, shown: Math.min(2, level + stacked.reduce((n, s) => n + s.level, 0)) }
}

export function save(c: Character, k: AbilityKey, effects = activeEffects(c)): RollInfo {
  const ab = ability(c, k, effects)
  const col = collect(effects, [`save:${k}`, 'save:all'])
  const base = c.saveProf[k]
  const level = Math.max(base, col.prof)
  const pp = profParts(level, col.stacked, profBonus(c))
  const parts: Part[] = [{ label: `${k.toUpperCase()} modifier`, value: ab.mod }, ...pp.parts, ...col.bonuses]
  return {
    total: parts.reduce((s, p) => s + p.value, 0),
    parts, adv: col.adv, dis: col.dis, notes: col.notes, profLevel: pp.shown, baseProf: base,
  }
}

export function skill(c: Character, key: SkillKey, effects = activeEffects(c)): RollInfo {
  const def = ALL_SKILLS.find((s) => s.key === key)!
  const ab = ability(c, def.ability, effects)
  const col = collect(effects, [`skill:${key}`, 'skill:all'])
  const base: ProfLevel = c.skillProf[key]
  let level: number = Math.max(base, col.prof)
  if (level === 0 && c.halfProfAll) level = 0.5
  const pp = profParts(level, col.stacked, profBonus(c))
  const parts: Part[] = [{ label: `${def.ability.toUpperCase()} modifier`, value: ab.mod }, ...pp.parts, ...col.bonuses]
  return {
    total: parts.reduce((s, p) => s + p.value, 0),
    parts, adv: col.adv, dis: col.dis, notes: col.notes, profLevel: pp.shown, baseProf: base,
  }
}

export function netAdvantage(r: { adv: string[]; dis: string[] }): 'adv' | 'dis' | 'none' {
  if (r.adv.length && r.dis.length) return 'none'
  if (r.adv.length) return 'adv'
  if (r.dis.length) return 'dis'
  return 'none'
}

export function passivePerception(c: Character, effects = activeEffects(c)): number {
  const r = skill(c, 'perception', effects)
  const n = netAdvantage(r)
  return 10 + r.total + (n === 'adv' ? 5 : n === 'dis' ? -5 : 0)
}

export type StatKey = 'ac' | 'speed' | 'initiative' | 'hpMax'

export interface StatInfo {
  total: number
  /** The "base" portion, then everything that adds to it */
  baseLabel: string
  baseValue: number
  adds: (Part & { fromEffect?: boolean })[]
  adv: string[]
  dis: string[]
  notes: string[]
}

export function statInfo(c: Character, key: StatKey, effects = activeEffects(c)): StatInfo {
  const stat: Stat = c[key]
  let baseLabel = 'Base'
  let baseValue = stat.base
  const adds: StatInfo['adds'] = []
  // armor counts only when worn on the body, shields only in a hand
  const worn = key === 'ac' ? c.items.filter((i) => i.armor && (i.armor.kind === 'shield' ? i.slot === 'off' || i.slot === 'main' : i.slot === 'body')) : []
  const bodyArmor = worn.find((i) => i.armor!.kind !== 'shield')
  if (key === 'ac' && bodyArmor) {
    const a = bodyArmor.armor!
    const dex = ability(c, 'dex', effects).mod
    const fromDex = a.kind === 'light' ? dex : a.kind === 'medium' ? Math.min(dex, 2) : 0
    baseLabel = `${bodyArmor.name || 'Armor'} (${a.kind}${a.kind === 'heavy' ? '' : a.kind === 'medium' ? ', DEX max 2' : ' + DEX'})`
    baseValue = a.ac + fromDex + (a.bonus || 0)
  } else if (key === 'ac' && c.ac.mode === 'unarmored') {
    baseLabel = '10 + DEX'
    baseValue = 10 + ability(c, 'dex', effects).mod
  } else if (key === 'initiative') {
    baseLabel = 'DEX modifier'
    baseValue = ability(c, 'dex', effects).mod
    if (stat.base) adds.push({ label: 'Misc', value: stat.base })
    // Alert's proficiency, Jack of All Trades' half
    const ic = collect(effects, ['initiative'])
    for (const p of profParts(ic.prof, ic.stacked, profBonus(c)).parts) adds.push({ ...p, fromEffect: true })
  } else if (key === 'speed') baseLabel = 'Walking speed'
  else if (key === 'hpMax') baseLabel = 'Hit point maximum'
  for (const sh of worn.filter((i) => i.armor!.kind === 'shield')) adds.push({ label: sh.name || 'Shield', value: sh.armor!.ac + (sh.armor!.bonus || 0), fromEffect: true })
  for (const m of stat.mods) if (m.on) adds.push({ label: m.name || 'Modifier', value: m.value })
  const col = collect(effects, [key])
  for (const b of col.bonuses) adds.push({ ...b, fromEffect: true })
  return {
    total: baseValue + adds.reduce((s, p) => s + p.value, 0),
    baseLabel, baseValue, adds, adv: col.adv, dis: col.dis, notes: col.notes,
  }
}

export function spellStats(c: Character, effects = activeEffects(c)) {
  const typed = { dc: c.spellDcOverride ?? null, attack: c.spellAttackOverride ?? null }
  if (!c.spellAbility) return { dc: typed.dc, attack: typed.attack, mod: 0, auto: { dc: null as number | null, attack: null as number | null } }
  const m = ability(c, c.spellAbility, effects).mod
  const pb = profBonus(c)
  const dcB = collect(effects, ['spellDc']).bonuses.reduce((s, p) => s + p.value, 0)
  const atB = collect(effects, ['spellAttack']).bonuses.reduce((s, p) => s + p.value, 0)
  const auto = { dc: 8 + pb + m + dcB, attack: pb + m + atB }
  return { dc: typed.dc ?? auto.dc, attack: typed.attack ?? auto.attack, mod: m, auto }
}

/** AK5e: 8 + STR or DEX (the better one) + proficiency */
export function martialDc(c: Character, effects = activeEffects(c)) {
  return c.martialDcOverride ?? martialDcAuto(c, effects)
}

export function martialDcAuto(c: Character, effects = activeEffects(c)) {
  const m = Math.max(ability(c, 'str', effects).mod, ability(c, 'dex', effects).mod)
  return 8 + profBonus(c) + m + collect(effects, ['martialDc']).bonuses.reduce((s, p) => s + p.value, 0)
}

/** AK5e Damage Reduction: the base you set plus anything linked to it. */
export function damageReduction(c: Character, effects = activeEffects(c)) {
  const adds = collect(effects, ['dr']).bonuses
  return { total: c.ak.dr + adds.reduce((s, p) => s + p.value, 0), adds }
}

/** AK5e: max SP is the highest SP cost among your Operator Skills; start SP the highest start value. */
export function spLimits(c: Character) {
  return {
    max: c.ak.opSkills.reduce((m, s) => Math.max(m, s.spCost), 0),
    start: c.ak.opSkills.reduce((m, s) => Math.max(m, s.startSp), 0),
  }
}

export interface AttackInfo {
  bonus: number
  damage: string
  mod: number
  adv: string[]
  dis: string[]
}

export function attackInfo(c: Character, a: Attack, effects = activeEffects(c)): AttackInfo {
  const mods = (k: AbilityKey) => ability(c, k, effects).mod
  const m = a.ability === 'finesse' ? Math.max(mods('str'), mods('dex')) : mods(a.ability)
  const col = collect(effects, ['attack'])
  const extra = col.bonuses.reduce((s, p) => s + p.value, 0)
  const bonus = m + (a.proficient ? profBonus(c) : 0) + a.magicBonus + extra
  const flat = (a.addMod ? m : 0) + a.magicBonus
  const damage = a.damage ? `${a.damage}${flat ? signed(flat) : ''}` : ''
  return { bonus, damage, mod: m, adv: col.adv, dis: col.dis }
}

export function totalWeight(c: Character): number {
  const w = c.items.reduce((s, i) => s + i.qty * i.weight, 0)
  const coins = isAK(c) ? 0 : Object.values(c.coins).reduce((s, n) => s + n, 0) / 50
  return Math.round((w + coins) * 100) / 100
}

export function carryCapacity(c: Character): number {
  return Math.round(ability(c, 'str').score * (c.carryMultiplier || 15))
}

export function preparedCount(c: Character): number {
  return c.spells.filter((s) => s.level > 0 && s.prepared && !s.alwaysPrepared).length
}

export function spellActionType(castingTime: string): 'action' | 'bonus' | 'reaction' | 'special' {
  const t = castingTime.toLowerCase()
  if (t.includes('bonus')) return 'bonus'
  if (t.includes('reaction')) return 'reaction'
  if (/^\s*1\s*action/.test(t)) return 'action'
  if (!t.trim()) return 'action'
  return 'special'
}

/** shown on the Actions page unless set otherwise: bonus-action and reaction spells are, action spells aren't */
export const spellOnActions = (s: Spell) => s.onActions ?? ['bonus', 'reaction'].includes(spellActionType(s.castingTime))

/** The feature (if any) that lets this character use the weapon's mastery property. */
export function masterySource(c: Character, w: WeaponStats): string {
  if (!w.mastery) return ''
  const kind = w.kind.toLowerCase()
  const f = c.features.find((x) => x.active && x.masteries.some((m) => m === '*' || (kind && m.toLowerCase() === kind)))
  return f ? f.name || 'a feature' : ''
}

/** Inventory items with weapon stats, shaped like attacks so they share the same maths. */
export function itemAttacks(c: Character): (Attack & { itemId: string; equipped: boolean; weapon: WeaponStats; masteryFrom: string })[] {
  return c.items.filter((i) => i.weapon && i.qty > 0).map((i) => {
    const w = i.weapon!
    return {
      id: 'item:' + i.id, itemId: i.id, equipped: !!i.slot, name: i.name || 'Weapon', ability: w.ability, proficient: w.proficient,
      magicBonus: w.magicBonus, damage: w.damage, damageType: w.damageType, addMod: true, range: w.range, notes: w.properties,
      weapon: w, masteryFrom: masterySource(c, w),
    }
  })
}
