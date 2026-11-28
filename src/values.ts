/*
 * Every value on the sheet that a feature's modifiers can change, and that a custom formula can read, under one name.
 * The same name works both ways: write `dr` as a formula modifier's target to change Damage Reduction, or use `dr` in
 * a formula to read it. Anything else you type becomes a custom value of your own (e.g. `rage_damage`) that other
 * features' formulas can use.
 *
 * Effect targets are stored as ids: 'ac', 'dr', 'ability:str', 'save:dex', 'skill:stealth', 'resource:<id>',
 * 'var:<name>'. `nameOf` gives the formula name for an id, `resolveTarget` turns typed text back into an id.
 */
import { ABILITIES, ALL_SKILLS, skillsFor } from './constants'
import { isAK } from './systems'
import type { Character } from './types'

export interface SheetValue {
  /** the effect target id */
  id: string
  /** the formula / typing name */
  name: string
  /** what it is, for people */
  label: string
  group: string
  /** what a modifier can do to it: 'all' = add, at least, at most, set to; 'add' = add only (rolls) */
  ops: 'all' | 'add'
}

/** a resource name as a formula name: "Psionic Energy Dice" → psionic_energy_dice */
export const slug = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unnamed'

const STATS: [string, string, string?][] = [
  ['ac', 'Armor Class'],
  ['acBase', 'Base AC (armor or unarmored, before shields & bonuses)'],
  ['unarmoredAc', 'Unarmored AC (10 + DEX, with no body armor)'],
  ['speed', 'Speed'],
  ['initiative', 'Initiative'],
  ['hpMax', 'Max HP'],
  ['dr', 'Damage Reduction'],
  ['carry', 'Max carry weight (lb)'],
  ['passivePerception', 'Passive Perception'],
  ['spellDc', 'Spell save DC'],
  ['spellAttack', 'Spell attack bonus'],
  ['maxPrepared', 'Max prepared spells'],
]
const AK_STATS: [string, string][] = [
  ['martialDc', 'Martial DC'],
  ['ap', 'Max Arts Points'],
  ['artLevel', 'Max Art level'],
]

/** every value this character's modifiers can target, grouped, with their formula names */
export function sheetValues(c: Character): SheetValue[] {
  const out: SheetValue[] = []
  for (const [id, label] of STATS) out.push({ id, name: id, label, group: 'Stats', ops: 'all' })
  if (isAK(c)) for (const [id, label] of AK_STATS) out.push({ id, name: id, label, group: 'Stats', ops: 'all' })
  out.push({ id: 'attack', name: 'attack', label: 'Attack rolls', group: 'Rolls', ops: 'add' })
  for (const a of ABILITIES) out.push({ id: `ability:${a.key}`, name: `${a.key}Score`, label: `${a.name} score`, group: 'Ability scores', ops: 'all' })
  out.push({ id: 'save:all', name: 'allSaves', label: 'All saving throws', group: 'Saving throws', ops: 'add' })
  for (const a of ABILITIES) out.push({ id: `save:${a.key}`, name: `${a.key}Save`, label: `${a.name} save`, group: 'Saving throws', ops: 'add' })
  out.push({ id: 'skill:all', name: 'allSkills', label: 'All skill checks', group: 'Skills', ops: 'add' })
  for (const s of skillsFor(c.system)) out.push({ id: `skill:${s.key}`, name: s.key, label: s.name, group: 'Skills', ops: 'add' })
  for (const r of c.resources) out.push({ id: `resource:${r.id}`, name: `res_${slug(r.name)}`, label: `${r.name || 'Resource'} (max uses)`, group: 'Resources', ops: 'all' })
  for (const n of customValueNames(c)) out.push({ id: `var:${n}`, name: n, label: `Custom value`, group: 'Custom values', ops: 'all' })
  return out
}

/** names of the custom values features define (targets 'var:<name>') */
export function customValueNames(c: Character): string[] {
  const names = new Set<string>()
  const add = (t: string) => { if (t.startsWith('var:') && t.length > 4) names.add(t.slice(4)) }
  for (const f of c.features) for (const e of f.effects) add(e.target)
  for (const i of c.items) for (const e of i.effects) add(e.target)
  for (const s of c.spells) for (const e of s.effects) add(e.target)
  return [...names].sort()
}

/** the formula name for a target id ('ability:str' → strScore, 'resource:x' → res_psionic_dice, 'var:n' → n) */
export function nameOf(c: Character, id: string): string {
  if (id.startsWith('var:')) return id.slice(4)
  return sheetValues(c).find((v) => v.id === id)?.name ?? id
}

/** what a target is, for people */
export function labelOf(c: Character | undefined, id: string): string {
  if (id.startsWith('var:')) return id.slice(4)
  if (c) { const v = sheetValues(c).find((x) => x.id === id); if (v) return v.label }
  const stat = [...STATS, ...AK_STATS].find(([k]) => k === id)
  if (stat) return stat[1]
  if (id === 'attack') return 'Attack rolls'
  const [kind, key] = id.split(':')
  const ab = ABILITIES.find((a) => a.key === key)
  if (kind === 'ability' && ab) return `${ab.name} score`
  if (kind === 'save') return key === 'all' ? 'All saving throws' : `${ab?.name ?? key} save`
  if (kind === 'skill') return key === 'all' ? 'All skill checks' : ALL_SKILLS.find((s) => s.key === key)?.name ?? key
  if (kind === 'resource') return 'Resource (max uses)'
  return id
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
/** names a custom value can't take (they're formula variables or functions already) */
const RESERVED = new Set(['level', 'prof', 'hitDice', 'spellMod', 'hp', 'tempHp', 'sp', 'spMax', 'mettle', 'lmd', 'floor', 'ceil', 'round', 'min', 'max', 'abs', 'half', 'if',
  'str', 'dex', 'con', 'int', 'wis', 'cha'])

export interface Resolved { id: string; label: string; kind: 'value' | 'new' | 'bad'; error?: string }

/** what a typed target means: a sheet value (by its name or label), an existing custom value, or a new custom value */
export function resolveTarget(c: Character, text: string): Resolved {
  const t = text.trim()
  if (!t) return { id: '', label: '', kind: 'bad', error: 'Type what this changes (e.g. dr, initiative, carry)' }
  const vals = sheetValues(c)
  const low = t.toLowerCase()
  const hit = vals.find((v) => v.name.toLowerCase() === low || v.id.toLowerCase() === low || v.label.toLowerCase() === low)
  if (hit) return { id: hit.id, label: hit.label, kind: 'value' }
  if (!IDENT.test(t)) return { id: '', label: '', kind: 'bad', error: 'Names are letters, numbers and _ (no spaces), e.g. rage_damage' }
  if (RESERVED.has(t)) return { id: '', label: '', kind: 'bad', error: `${t} is read-only (it comes from the sheet)` }
  return { id: `var:${t}`, label: 'new custom value', kind: 'new' }
}
