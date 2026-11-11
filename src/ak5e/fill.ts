import { ALL_SKILLS, AK_SKILLS } from '../constants'
import { formulaVars } from '../calc'
import { tryFormula } from '../formula'
import { newFeature, newFeatureAction, newResource, uid } from '../blank'
import { bestLib, fromLib } from '../spellLib'
import { extraFiles } from '../data/runtime'
import { rulesHtml } from '../autofill'
import { BRANCH_BLOCKS, CLASS_BLOCKS, CLASS_CHOICES, FEAT_BLOCKS, SPECIES_BLOCKS, type Block, type ChoiceDef, type FxDef } from './blocks'
import type { AbilityKey, Character, Effect, Feature, FeatureCategory, Resource, Spell } from '../types'

/*
 * Filling in an Arknights 5e character from the hand-made blocks (./blocks.ts): the book's text for each feature,
 * wired up as the block says, with the choices it needs asked up front. Nothing is guessed from the wording.
 */

type Kind = 'class' | 'subclass' | 'species' | 'background' | 'nationality'
interface Table { columns: string[]; rows: Record<string, string[]> }
interface LevelFeature { level: number; name: string; text: string }
interface NamedText { name: string; text: string }
interface AkClass { name: string; table: Table | null; hitDie: number; armor: string; weapons: string; tools: string; saves: string; skills: string; features: LevelFeature[]; branches: { name: string; table: Table | null; features: LevelFeature[] }[] }
interface AkBackground { name: string; text: string; proficiencies: string; feat: NamedText | null }
interface AkRules {
  classes: AkClass[]
  species: { name: string; size: string; speed: string; asi: string; features: NamedText[]; parent?: string }[]
  nationalities: { name: string; languages: string; proficiencies: string; profChoices: string[]; feat: NamedText | null; background: AkBackground | null }[]
  backgrounds: AkBackground[]
}

const rules = (): AkRules | null => (extraFiles().find((f) => f.rules)?.rules as AkRules | undefined) ?? null

/** one question for the fill-in prompt; answers are keyed by `key` */
export interface PlanChoice {
  key: string
  /** what it's for (feature name) */
  feature: string
  def: ChoiceDef | { id: string; kind: 'saves'; prompt: string; from: string[]; pick: number } | { id: string; kind: 'abilities'; prompt: string; pick: number; amount: number; exclude: string[] }
}
export type Answers = Record<string, string[]>

const ABIL_NAME: Record<string, AbilityKey> = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' }
const NUMW: Record<string, number> = { one: 1, two: 2, three: 3 }
const skillKey = (name: string) => (AK_SKILLS.find((s) => s.name.toLowerCase() === name.toLowerCase().replace(/^tech$/, 'technology')) ?? ALL_SKILLS.find((s) => s.name.toLowerCase() === name.toLowerCase()))?.key
export const choiceOptions = (def: PlanChoice['def']): { id: string; label: string }[] => {
  const abil = (k: string) => ({ id: k, label: k.toUpperCase() })
  if (def.kind === 'one') return def.options.map((o, i) => ({ id: String(i), label: o.label }))
  if (def.kind === 'ability' || def.kind === 'saves') return def.from.map(abil)
  if (def.kind === 'abilities') return (['str', 'dex', 'con', 'int', 'wis', 'cha'] as string[]).filter((k) => !def.exclude.includes(k)).map(abil)
  const list = def.from === 'any' ? AK_SKILLS.map((s) => s.name) : def.from
  return list.map((n) => ({ id: skillKey(n) ?? n, label: n }))
}
export const choicePicks = (def: PlanChoice['def']) => ('pick' in def ? def.pick : 1)
/** the first distinct options, as the prompt's starting answers */
export const defaultAnswer = (def: PlanChoice['def']) => choiceOptions(def).slice(0, choicePicks(def)).map((o) => o.id)

/** book text without its tables (the sheet's text boxes can't show them) */
const noTables = (t: string) => t.split('\n').filter((l) => !/^\s*\|/.test(l) && !/^\s*:?-{3,}/.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim()

const tableValue = (table: Table | null | undefined, level: number, col: string) => {
  const row = table?.rows[String(level)]
  const i = table?.columns.findIndex((x) => x.trim().toLowerCase().startsWith(col.toLowerCase())) ?? -1
  return row && i >= 0 ? (row[i] ?? '').trim() : ''
}

interface Built { features: Feature[]; resources: Resource[]; spells: Spell[]; sets: ((d: Character) => void)[] }

/** a plan for the prompt: what it would add (with the default answers) and how to add it (with the real ones) */
export interface AkPlan {
  name: string
  choices: PlanChoice[]
  notes: string[]
  build: (c: Character, answers: Answers) => Built
}

export function planAk(c: Character, kind: Kind, typed: string, pick: <T extends { name: string }>(list: T[], typed: string, aliases?: Record<string, string>) => T | undefined, aliases: { cls: Record<string, string>; branch: Record<string, string> }): AkPlan | null {
  const R = rules()
  if (!R) return null
  const level = Math.max(1, Math.min(20, c.level || 1))
  const choices: PlanChoice[] = []
  const notes: string[] = []
  // features in the order to build them, with their block and where they come from
  const parts: { f: NamedText & { level?: number }; block?: Block; cat: FeatureCategory; source: string; table?: Table | null; tableRef?: { cls: string; branch?: string } }[] = []
  const sets: ((d: Character, a: Answers) => void)[] = []
  let name = ''

  const ask = (feature: string, def: PlanChoice['def']) => choices.push({ key: `${feature}:${def.id}`, feature, def })
  const add = (f: NamedText & { level?: number }, block: Block | undefined, cat: FeatureCategory, source: string, table?: Table | null, tableRef?: { cls: string; branch?: string }) => {
    if (block?.skip) return
    if (!noTables(f.text) && !block) return // a table on its own
    parts.push({ f, block, cat, source, table, tableRef })
    for (const ch of block?.choose ?? []) ask(f.name, ch)
  }

  if (kind === 'class' || kind === 'subclass') {
    const cls = pick(R.classes, kind === 'class' ? typed : c.className, aliases.cls)
    if (!cls) return null
    const blocks = CLASS_BLOCKS[cls.name] ?? {}
    if (kind === 'class') {
      name = cls.name
      for (const f of cls.features) if (f.level <= level && !/^(ability score improvement|(basic|advanced|elite) operator skill|(basic|advanced) (\w+ )?talent( module)?|9th level arts)$/i.test(f.name)) add(f, blocks[f.name], 'class', `${cls.name} ${f.level}`, cls.table, { cls: cls.name })
      const cc = CLASS_CHOICES[cls.name]
      if (cc) {
        if (cc.saves.pick) ask('Saving throws', { id: 'saves', kind: 'saves', prompt: `Saving throws${cc.saves.fixed.length ? ` (${cc.saves.fixed.map((x) => x.toUpperCase()).join(', ')} +)` : ''}`, from: cc.saves.from, pick: cc.saves.pick })
        ask('Skills', { id: 'skills', kind: 'skills', prompt: `Skills${cc.skills.fixed.length ? ` (${cc.skills.fixed.join(', ')} +)` : ''}`, from: cc.skills.from, pick: cc.skills.pick })
        sets.push((d, a) => {
          for (const k of [...cc.saves.fixed, ...(a['Saving throws:saves'] ?? [])]) d.saveProf[k as AbilityKey] = 1
          for (const n of [...cc.skills.fixed.map((x) => skillKey(x) ?? x), ...(a['Skills:skills'] ?? [])]) if (n in d.skillProf) d.skillProf[n as keyof Character['skillProf']] ||= 1
        })
        notes.push('saving throws', 'skills')
      }
      // hit dice and HP, proficiencies, Arts Points / max Art level from the table
      if (cls.hitDie) {
        notes.push(`hit dice d${cls.hitDie}`)
        sets.push((d) => {
          if (d.hitDice.length <= 1) d.hitDice = [{ id: d.hitDice[0]?.id ?? uid(), die: cls.hitDie, total: Math.max(1, d.level), spent: Math.min(d.hitDice[0]?.spent ?? 0, d.level) }]
          if (d.hpMax.base === 10 || d.hpMax.base === 0) {
            const con = Math.floor((d.abilities.con - 10) / 2)
            d.hpMax.base = Math.max(1, cls.hitDie + con + (d.level - 1) * (cls.hitDie / 2 + 1 + con))
            d.hp.current = d.hpMax.base
          }
        })
      }
      const prof = (field: keyof Character['proficiencies'], t: string) => {
        const v = t.replace(/<br>/g, '').trim()
        if (v) sets.push((d) => { const cur = d.proficiencies[field]; if (!cur.toLowerCase().includes(v.toLowerCase())) d.proficiencies[field] = cur ? `${cur}; ${v}` : v })
      }
      prof('armor', cls.armor); prof('weapons', cls.weapons); prof('tools', cls.tools)
      artsFromTable(cls.table, { cls: cls.name })
    } else {
      const br = pick(cls.branches, typed, aliases.branch)
      if (!br) return null
      name = `${br.name} (${cls.name})`
      const bb = BRANCH_BLOCKS[`${cls.name}/${br.name}`] ?? {}
      for (const f of br.features) if (f.level <= level) add(f, bb[f.name], 'class', `${br.name} ${cls.name} ${f.level}`, br.table, { cls: cls.name, branch: br.name })
      artsFromTable(br.table, { cls: cls.name, branch: br.name })
    }
  } else if (kind === 'species') {
    const sp = pick(R.species, typed)
    if (!sp) return null
    name = sp.name
    const parent = sp.parent ? R.species.find((x) => x.name === sp.parent) : undefined
    const base = parent ?? sp
    for (const [owner, list] of [[parent, parent?.features ?? []], [sp, sp.features]] as const) {
      if (!owner) continue
      const blocks = SPECIES_BLOCKS[owner.name] ?? {}
      for (const f of list) add(f, blocks[f.name], 'species', owner.name)
    }
    // Ability Score Improvement: fixed increases, and the ones you choose
    const asiText = [base.asi, sp !== base ? sp.asi : ''].filter(Boolean).join(' ')
    const fixed: { k: AbilityKey; n: number }[] = []
    for (const m of asiText.matchAll(/Your (\w+)\s+Score increases by (\d)/gi)) if (ABIL_NAME[m[1].toLowerCase()]) fixed.push({ k: ABIL_NAME[m[1].toLowerCase()], n: +m[2] })
    const anyTwo = /One Score of your choice increases by 2/i.test(asiText)
    const more = /(one|two|three) other (?:score|scores)s? of your choice increases? by (\d)/i.exec(asiText)
    if (asiText) {
      const pickAbilities = [...(anyTwo ? [{ id: 'asi2', amount: 2 }] : []), ...(more ? [{ id: 'asi1', amount: +more[2] }] : [])]
      parts.push({ f: { name: 'Ability Score Improvement', text: asiText }, cat: 'species', source: sp.name, block: { fx: fixed.map((x) => ({ target: `ability:${x.k}`, type: 'bonus' as const, value: x.n, note: 'Ability Score Improvement' })), pickAbilities } })
      if (anyTwo) ask('Ability Score Improvement', { id: 'asi2', kind: 'abilities', prompt: '+2 to', pick: 1, amount: 2, exclude: [] })
      if (more) ask('Ability Score Improvement', { id: 'asi1', kind: 'abilities', prompt: `+${more[2]} to`, pick: NUMW[more[1].toLowerCase()] ?? 1, amount: +more[2], exclude: fixed.map((x) => x.k) })
    }
    const size = base.size.match(/size is (Tiny|Small|Medium|Large)/i)?.[1]
    const speed = parseInt(base.speed.match(/Walking Speed is (\d+)/i)?.[1] ?? '')
    if (size) { notes.push('size'); sets.push((d) => { d.size = size[0].toUpperCase() + size.slice(1).toLowerCase() }) }
    if (speed) { notes.push('speed'); sets.push((d) => { d.speed.base = speed }) }
  } else if (kind === 'nationality') {
    const nat = pick(R.nationalities, typed)
    if (!nat) return null
    name = nat.name
    if (nat.feat) add(nat.feat, FEAT_BLOCKS[nat.feat.name], 'feat', `${nat.name} (nationality feat)`)
    if (nat.profChoices.length) {
      ask(`${nat.name} proficiencies`, { id: 'skills', kind: 'skills', prompt: `${nat.name}: ${nat.proficiencies} `.replace(/\s+$/, ''), from: nat.profChoices, pick: parseInt(nat.proficiencies) || NUMW[nat.proficiencies.split(' ')[0].toLowerCase()] || 3 })
      sets.push((d, a) => { for (const k of a[`${nat.name} proficiencies:skills`] ?? []) if (k in d.skillProf) d.skillProf[k as keyof Character['skillProf']] ||= 1 })
      notes.push('skills')
    }
    if (nat.languages) {
      notes.push('languages')
      sets.push((d) => { const cur = d.proficiencies.languages; if (!cur.includes(nat.languages)) d.proficiencies.languages = cur ? `${cur}; ${nat.languages}` : nat.languages })
    }
  } else if (kind === 'background') {
    const all = [...R.backgrounds, ...R.nationalities.flatMap((n) => (n.background ? [n.background] : []))]
    const bg = pick(all, typed)
    if (!bg || !bg.feat) return null
    name = bg.name
    add(bg.feat, FEAT_BLOCKS[bg.feat.name], 'background', `${bg.name} (background feat)`)
    const tools = bg.proficiencies.replace(/^You are Proficient (?:in|with) (?:the |a |an )?/i, '').replace(/\.$/, '')
    if (tools) {
      notes.push('tool proficiencies')
      sets.push((d) => { const cur = d.proficiencies.tools; if (!cur.includes(tools)) d.proficiencies.tools = cur ? `${cur}; ${tools}` : tools })
    }
  }

  function artsFromTable(table: Table | null, ref: { cls: string; branch?: string }) {
    const ap = parseInt(tableValue(table, level, 'Arts Points'))
    const mal = parseInt(tableValue(table, level, 'Maximum Art Level'))
    if (ap || mal) {
      notes.push('Arts Points and max Art level')
      // remembered so they follow the table when you level up
      sets.push((d) => { if (ap) d.ak.ap.max = ap; if (mal) d.ak.maxArtLevel = mal; d.artsTable = ref })
    }
  }

  return {
    name, choices, notes,
    build: (cc, answers) => buildParts(cc, parts, answers, sets, level),
  }
}

/* ---------------------------------------------------------------- building the features */

function fill(s: string, answers: Record<string, string>) {
  return s.replace(/\{(\w+)\}/g, (_m, k: string) => answers[k] ?? '0')
}

function buildParts(c: Character, parts: { f: NamedText & { level?: number }; block?: Block; cat: FeatureCategory; source: string; table?: Table | null; tableRef?: { cls: string; branch?: string } }[], answers: Answers, sets: ((d: Character, a: Answers) => void)[], level: number): Built {
  const out: Built = { features: [], resources: [], spells: [], sets: [] }
  const vars = formulaVars(c)
  const byName = (n: string) => out.resources.find((r) => r.name === n) ?? c.resources.find((r) => r.name === n)
  const pending: (() => void)[] = []

  for (const { f, block: bl, cat, source, table, tableRef } of parts) {
    const block = bl ?? {}
    const ft = { ...newFeature(cat), name: f.name, source, description: rulesHtml(noTables(f.text)), auto: undefined as Feature['auto'], onSpellPage: !!block.spell, collapsed: false }
    if (block.type) ft.actionType = block.type
    // this feature's answers, by choice id ({abil} etc. in formulas)
    const mine: Record<string, string> = {}
    for (const ch of block.choose ?? []) {
      const a = answers[`${f.name}:${ch.id}`] ?? []
      mine[ch.id] = a[0] ?? ''
      if (ch.kind === 'one') {
        const opt = ch.options[+(a[0] ?? 0)]
        if (opt) {
          ft.description += `<p><b>Chosen:</b> ${opt.label}</p>`
          for (const fx of opt.fx ?? []) ft.effects.push(effect(fx, mine))
        }
      } else if (ch.kind === 'skills') {
        // "Reliable: which skill?" only counts when Reliable was the pick
        if (ch.id === 'avskill' && (answers[`${f.name}:av`]?.[0] ?? '0') !== '1') continue
        for (const k of a) if (k) ft.effects.push({ id: uid(), target: `skill:${k}`, type: ch.as ?? 'proficiency', note: f.name })
      }
    }
    for (const fx of block.fx ?? []) ft.effects.push(effect(fx, mine))
    // the increases you picked ("two other scores of your choice increase by 1")
    for (const pa of block.pickAbilities ?? []) {
      for (const k of answers[`${f.name}:${pa.id}`] ?? []) if (k) ft.effects.push({ id: uid(), target: `ability:${k}`, type: 'bonus', value: pa.amount, note: f.name })
    }
    if (block.castWith && mine[block.castWith]) { const ab = mine[block.castWith] as AbilityKey; out.sets.push((d) => { d.spellAbility = ab }) }
    for (const r of block.rest ?? []) ft.restEffects.push({ id: uid(), rest: r.rest, kind: 'reminder', value: 0, note: r.note })

    // its uses, kept up to date as you level (a formula, or a column of the class / branch table)
    const own: Resource[] = []
    for (const rd of block.r ?? []) {
      const rname = rd.name ?? f.name
      if (byName(rname)) continue
      const res = { ...newResource(ft.id, rname), recharge: rd.recharge ?? 'long' } as Resource
      if (rd.col) {
        res.max = parseInt(tableValue(table, level, rd.col)) || 0
        if (tableRef) res.fromTable = { ...tableRef, col: rd.col }
      } else if (typeof rd.max === 'string') {
        res.maxFormula = fill(rd.max, mine)
        res.max = Math.max(0, tryFormula(res.maxFormula, vars).value)
      } else res.max = rd.max ?? 1
      if (rd.die) {
        const tv = tableValue(table, level, rd.die)
        res.die = /^d\d+$/i.test(rd.die) ? rd.die : tv ? `d${tv.replace(/^\d*d/i, '')}` : `d${Math.max(4, tryFormula(fill(rd.die, mine), vars).value)}`
      }
      own.push(res)
      out.resources.push(res)
    }
    // actions: spend this feature's resource, another one by name, or nothing
    for (const ad of block.a ?? []) {
      pending.push(() => {
        const res = ad.res === '' ? undefined : ad.res ? byName(ad.res) : own[0]
        ft.actions.push({ ...newFeatureAction(), name: ad.name ?? f.name, actionType: ad.type, resourceId: res?.id ?? '', cost: res ? ad.cost ?? 1 : 0 })
      })
    }
    // Arts it grants, always prepared
    for (const n of block.arts ?? []) {
      const lib = bestLib(n)
      if (!lib || out.spells.some((s) => s.name === lib.n) || c.spells.some((s) => s.name === lib.n)) continue
      out.spells.push({ ...fromLib(lib), prepared: true, alwaysPrepared: true, grantedBy: ft.id })
    }
    out.features.push(ft)
  }
  // resources by name resolve once every feature's are known (Shelter spends Resilience, made by another feature)
  for (const p of pending) p()
  for (const s of sets) out.sets.push((d) => s(d, answers))
  return out
}

function effect(fx: FxDef, answers: Record<string, string>): Effect {
  return { id: uid(), target: fill(fx.target, answers), type: fx.type, value: fx.value, note: fx.note, ...(fx.formula ? { formula: fill(fx.formula, answers) } : {}), ...(fx.stacks ? { stacks: true } : {}) }
}

/** the class / branch table's values at a level (Arts Points, max Art level, a resource's column) */
export function akTableValue(ref: { cls: string; branch?: string }, level: number, col: string): number {
  const R = rules()
  const cls = R?.classes.find((x) => x.name === ref.cls)
  const table = ref.branch ? cls?.branches.find((b) => b.name === ref.branch)?.table : cls?.table
  return parseInt(tableValue(table, level, col)) || 0
}
