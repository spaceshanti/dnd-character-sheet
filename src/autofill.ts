import srd from './data/srd52.json'
import { ALL_SKILLS } from './constants'
import { mod } from './calc'
import { newFeature, newFeatureAction, newResource, uid } from './blank'
import { bestLib, fromLib } from './spellLib'
import { isAK } from './systems'
import { extraFiles } from './data/runtime'
import type { AbilityKey, ActionType, Character, Effect, Feature, Recharge, Resource, Spell } from './types'
import { defaultAnswer, planAk, type Answers, type PlanChoice } from './ak5e/fill'

/*
 * Filling in a character's features from the rules: type a class, subclass / branch, species, background or
 * nationality and the sheet offers to add everything it gives you at your level — features, the resources they
 * use (with their maximums from the class table), the actions that spend them, spell slots / Arts Points,
 * always-prepared spells, hit dice, saving throws and proficiencies — all linked up.
 * D&D comes from the SRD 5.2.1 (bundled); Arknights from the book the app downloaded onto this computer.
 */

export type FillKind = 'class' | 'subclass' | 'species' | 'background' | 'nationality'

interface Table { columns: string[]; rows: Record<string, string[]> }
interface LevelFeature { level: number; name: string; text: string }
interface NamedText { name: string; text: string }

interface SrdClass {
  name: string; core: Record<string, string>; spellAbility: string; table: Table | null; features: LevelFeature[]
  subclasses: { name: string; features: LevelFeature[]; spells: Record<string, string[]> }[]
}
interface SrdData {
  classes: SrdClass[]
  species: { name: string; size: string; speed: string; traits: NamedText[] }[]
  backgrounds: { name: string; abilities: string; feat: string; skills: string; tools: string; equipment: string }[]
  feats: { name: string; kind: string; text: string }[]
}
interface AkClass {
  name: string; table: Table | null; hitDie: number; armor: string; weapons: string; tools: string; saves: string; skills: string
  features: LevelFeature[]; branches: { name: string; table: Table | null; features: LevelFeature[] }[]
}
interface AkBackground { name: string; text: string; proficiencies: string; feat: NamedText | null }
interface AkRules {
  classes: AkClass[]
  species: { name: string; size: string; speed: string; asi: string; features: NamedText[]; parent?: string }[]
  nationalities: { name: string; languages: string; proficiencies: string; profChoices: string[]; feat: NamedText | null; background: AkBackground | null }[]
  backgrounds: AkBackground[]
}

const SRD = srd as unknown as SrdData
const AK: AkRules | null = (() => {
  return (extraFiles().find((f) => f.rules)?.rules as AkRules | undefined) ?? null
})()

/* ---------- names ---------- */

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/æ/gi, 'ae').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
/** the AK5e book's names for a few branches the game calls something else */
const AK_BRANCH_NAMES: Record<string, string> = {
  'arts protector': 'Artshield', 'arts fighter': 'Artsblade', fighter: 'Brawler', 'duelist': 'Duellist', soloblade: 'Musha',
  swordmaster: 'Weaponmaster', marksman: 'Anti-Air', heavyshooter: 'Heavyshot', spreadshooter: 'Spreadshot', 'medic': 'Physician',
  'multi target': 'Triage', watchman: 'Ward', incantation: 'Witchcraft', alchemist: 'Infusion', infuser: 'Infusion', geek: 'Inventor',
}
const AK_CLASS_NAMES: Record<string, string> = { sniper: 'Marksman' }

/** best match for a typed name: exact, then "Path of the Berserker" ⊃ "berserker", then a shared first word */
function pick<T extends { name: string }>(list: T[], typed: string, aliases: Record<string, string> = {}): T | undefined {
  const n = plain(typed)
  if (!n) return undefined
  const alias = aliases[n] ?? Object.entries(aliases).find(([k]) => n.split(' ').includes(k) || n === k)?.[1]
  const exact = list.find((x) => plain(x.name) === n) ?? (alias ? list.find((x) => plain(x.name) === plain(alias)) : undefined)
  if (exact) return exact
  const words = (s: string) => ` ${plain(s)} `
  return list.find((x) => words(x.name).includes(` ${n} `) || words(typed).includes(` ${plain(x.name)} `))
    ?? list.find((x) => plain(x.name).split(' ').some((w) => w.length > 3 && n.split(' ').includes(w)))
}

/* ---------- reading the rules text ---------- */

const ABIL: Record<string, AbilityKey> = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' }
const NUM: Record<string, number> = { one: 1, once: 1, two: 2, twice: 2, three: 3, four: 4, five: 5, six: 6, ten: 10 }
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** plain rules text → the simple HTML the sheet's text boxes use (paragraphs, bullet lists, bold run-in headings) */
export function rulesHtml(text: string): string {
  const out: string[] = []
  for (const para of text.split(/\n\s*\n/)) {
    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) continue
    const items = lines.filter((l) => /^[-•]\s/.test(l))
    const lead = lines.filter((l) => !/^[-•]\s/.test(l)).join(' ')
    if (lead) {
      const m = lead.match(/^((?:[A-Z][\w'’-]*(?: (?:of|the|and|to|a|[A-Z][\w'’-]*)){0,5}))\. (.*)$/)
      out.push(m && m[1].length < 48 ? `<p><b>${esc(m[1])}.</b> ${esc(m[2])}</p>` : `<p>${esc(lead)}</p>`)
    }
    if (items.length) out.push(`<ul>${items.map((l) => `<li>${esc(l.replace(/^[-•]\s*/, ''))}</li>`).join('')}</ul>`)
  }
  return out.join('')
}

function actionTypeOf(text: string): ActionType {
  // the opening paragraph says how you use it; later ones are options and riders
  const t = text.split(/\n\s*\n/)[0].slice(0, 500)
  if (/\bBonus Action\b/i.test(t)) return 'bonus'
  if (/\bas a Reaction\b|\btake a Reaction\b|\buse your Reaction\b|\bReaction to\b/i.test(t)) return 'reaction'
  if (/\b(?:Magic|Utilize) action\b|\bas an action\b|\btake an action\b|\bas an Action\b/i.test(t)) return 'action'
  return 'none'
}

function rechargeOf(text: string): Recharge {
  if (/regain (?:one|1) expended use[^.]*Short Rest[^.]*all[^.]*Long Rest/i.test(text)) return 'shortOne'
  if (/Short or Long Rest|Short Rest or Long Rest/i.test(text)) return 'short'
  if (/\bShort Rest\b/i.test(text) && !/\bLong Rest\b/i.test(text)) return 'short'
  return 'long'
}

/** how many uses a feature's text gives it (null = it doesn't say) */
function usesOf(text: string, c: Character, level: number, pb: number): number | null {
  let m = text.match(/(?:number of times|uses?) equal to (?:twice )?your (\w+) modifier/i)
  if (m && ABIL[m[1].toLowerCase()]) return Math.max(1, mod(c.abilities[ABIL[m[1].toLowerCase()]]) * (/twice your/i.test(m[0]) ? 2 : 1))
  if (/(?:number of times|uses?) equal to twice your Proficiency Bonus/i.test(text)) return pb * 2
  if (/(?:number of times|uses?) equal to your Proficiency Bonus/i.test(text)) return pb
  m = text.match(/(?:total|pool)[^.]*equal to (\w+) times your \w+ level/i)
  if (m && NUM[m[1].toLowerCase()]) return NUM[m[1].toLowerCase()] * level
  m = text.match(/(?:use (?:this|it) |has |have )(one|two|three|four|once|twice)(?: times| uses)?[^.]*(?:Short|Long) Rest/i)
  if (m) return NUM[m[1].toLowerCase()]
  if (/(?:can't|cannot|can’t) (?:use|do) (?:it|this|so|that)[^.]*again until you finish a (?:Short or )?Long Rest/i.test(text)) return 1
  if (/(?:once|one time) per (?:Short|Long) Rest/i.test(text)) return 1
  return null
}

/** spells a feature says you always have prepared / learn */
function grantedSpells(text: string): string[] {
  const names: string[] = []
  for (const m of text.matchAll(/always have (?:the )?(.+?) spells? prepared/gi)) names.push(...m[1].split(/,\s*(?:and\s+)?|\s+and\s+/))
  for (const m of text.matchAll(/You learn the (.+?) Arts?\b/g)) names.push(...m[1].split(/,\s*(?:and\s+)?|\s+and\s+/))
  return names.map((n) => n.replace(/^the\s+/i, '').trim()).filter((n) => n && n.length < 40)
}

/** effects safe to switch on all the time */
function effectsOf(f: Feature, text: string, level: number): Effect[] {
  const fx: Effect[] = []
  // Dwarven Toughness, Tough, AK's Durable: more HP per level (set for the level you're at now)
  const hp = /Hit Point maximum increases by (?:1, and it increases by 1 again whenever you gain a level|an amount equal to (twice )?your (?:character )?level)/i.exec(text)
  if (hp) fx.push({ id: uid(), target: 'hpMax', type: 'bonus', value: level * (hp[1] ? 2 : 1), note: f.name })
  const m = text.match(/Your (?:Walking )?Speed increases by (\d+) feet/i)
  if (m && !/\bwhile\b[^.]*Speed increases/i.test(text.slice(Math.max(0, (m.index ?? 0) - 80), (m.index ?? 0) + 40))) fx.push({ id: uid(), target: 'speed', type: 'bonus', value: +m[1], note: f.name })
  if (/When you roll Initiative, you can add your Proficiency Bonus/i.test(text)) fx.push({ id: uid(), target: 'initiative', type: 'proficiency', note: f.name })
  // Jack of All Trades: half proficiency on checks you're not proficient in (Initiative is a Dexterity check)
  if (/add half your Proficiency Bonus[^.]*ability check/i.test(text)) {
    fx.push({ id: uid(), target: 'skill:all', type: 'halfProf', note: f.name }, { id: uid(), target: 'initiative', type: 'halfProf', note: f.name })
  }
  // AK5e Tenacious: half proficiency on saving throws you're not proficient in
  if (/half (?:of )?your Proficiency Bonus[^.]*Saving Throws? you are not Proficient/i.test(text)) fx.push({ id: uid(), target: 'save:all', type: 'halfProf', note: f.name })
  return fx
}

const skillKeys = (text: string): string[] => {
  const t = text.replace(/\bTech\b(?!nology)/g, 'Technology')
  return ALL_SKILLS.filter((s) => new RegExp(`\\b${s.name}\\b`, 'i').test(t)).map((s) => s.key)
}

/* ---------- building a fill ---------- */

export interface FillPlan {
  kind: FillKind
  /** the rules entry that matched what was typed */
  name: string
  /** a preview (with the choices' first answers) */
  features: Feature[]
  resources: Resource[]
  spells: Spell[]
  /** the other things it sets, listed for the prompt ("hit dice d12", "spell slots"…) */
  notes: string[]
  /** things to choose first (Arknights blocks: spellcasting ability, skills, Ancient Versatility…) */
  choices: PlanChoice[]
  /** add it all; returns what was added, for Undo */
  apply: (d: Character, answers?: Answers) => Applied
}
export interface Applied { features: string[]; resources: string[]; spells: string[] }

/** the pieces a class table column can give a feature */
const NOT_RESOURCES = /^(level|proficiency bonus|(class )?features|cantrips|prepared spells|spell slots|slot level|[1-9]|weapon mastery|eldritch invocations|maximum art level|arts points( \(ap\))?|arts known)$/i

interface Builder {
  features: Feature[]
  resources: Resource[]
  spells: Spell[]
  notes: string[]
  sets: ((d: Character) => void)[]
}

function addFeature(b: Builder, c: Character, f: { name: string; text: string; level?: number }, category: Feature['category'], source: string, auto: FillKind, level: number, pb: number) {
  const ft = { ...newFeature(category), name: f.name, source, description: rulesHtml(f.text), auto } as Feature
  ft.effects = effectsOf(ft, f.text, level)
  const at = actionTypeOf(f.text)
  const uses = usesOf(f.text, c, level, pb)
  if (uses !== null) {
    const r = { ...newResource(ft.id, f.name), max: uses, recharge: rechargeOf(f.text) }
    b.resources.push(r)
    if (at !== 'none') ft.actions.push({ ...newFeatureAction(), name: f.name, actionType: at, resourceId: r.id, cost: 1 })
  } else ft.actionType = at
  if (/spellcasting|Arts Casting|cast(?:ing)? (?:spells|Arts)/i.test(f.name)) ft.onSpellPage = true
  for (const n of grantedSpells(f.text)) {
    const lib = bestLib(n)
    if (!lib || b.spells.some((s) => s.name === lib.n) || c.spells.some((s) => s.name === lib.n)) continue
    b.spells.push({ ...fromLib(lib), prepared: true, alwaysPrepared: true, grantedBy: ft.id })
  }
  b.features.push(ft)
  return ft
}

/** class-table columns at your level → resource maximums / dice / notes on the feature they belong to */
function linkTable(b: Builder, table: Table | null, level: number) {
  if (!table) return
  const row = table.rows[String(level)]
  if (!row) return
  table.columns.forEach((col, i) => {
    const v = (row[i] ?? '').trim()
    if (!v || v === '—' || v === '-' || NOT_RESOURCES.test(col.trim())) return
    const stem = plain(col).replace(/s$/, '')
    const f = b.features.find((x) => plain(x.name) === stem || plain(x.name) === plain(col))
      ?? b.features.find((x) => new RegExp(`\\b${col.replace(/[()]/g, '.')}\\b column`, 'i').test(x.description))
      ?? b.features.find((x) => stem.length > 3 && plain(x.name).startsWith(stem.split(' ')[0]))
    const res = f ? b.resources.find((r) => r.featureId === f.id) : undefined
    if (/^\d+$/.test(v)) {
      if (res) res.max = +v
      else {
        const r = { ...newResource(f?.id ?? '', f?.name ?? col.replace(/\s*\(.*\)$/, '')), max: +v, recharge: f ? rechargeOf(f.description) : 'long' as Recharge }
        b.resources.push(r)
        if (f) {
          const at = f.actionType
          if (at !== 'none') { f.actions.push({ ...newFeatureAction(), name: f.name, actionType: at, resourceId: r.id, cost: 1 }); f.actionType = 'none' }
        }
      }
    } else if (/^\d*[dD]\d+$/.test(v) && res) res.die = 'd' + v.split(/[dD]/)[1]
    else if (f) f.description += `<p><b>${esc(col)} at level ${level}:</b> ${esc(v)}</p>`
  })
}

function slotsFromTable(b: Builder, table: Table | null, level: number) {
  const row = table?.rows[String(level)]
  if (!table || !row) return
  const slots: Record<number, number> = {}
  table.columns.forEach((col, i) => { if (/^[1-9]$/.test(col.trim())) slots[+col] = parseInt(row[i]) || 0 })
  const pact = table.columns.findIndex((x) => /^spell slots$/i.test(x.trim()))
  const pactLvl = table.columns.findIndex((x) => /^slot level$/i.test(x.trim()))
  if (pact >= 0 && pactLvl >= 0) slots[parseInt(row[pactLvl]) || 1] = parseInt(row[pact]) || 0
  const prep = table.columns.findIndex((x) => /^prepared spells$/i.test(x.trim()))
  if (prep >= 0 && parseInt(row[prep])) { b.notes.push('max prepared spells'); b.sets.push((d) => { d.maxPrepared = parseInt(row[prep]) }) }
  if (!Object.values(slots).some(Boolean)) return
  b.notes.push('spell slots')
  b.sets.push((d) => { for (let l = 1; l <= 9; l++) d.slots[l] = { total: slots[l] ?? 0, used: Math.min(d.slots[l]?.used ?? 0, slots[l] ?? 0) } })
}

function setHitDie(b: Builder, die: number) {
  if (!die) return
  b.notes.push(`hit dice d${die}`)
  b.sets.push((d) => {
    if (d.hitDice.length <= 1) d.hitDice = [{ id: d.hitDice[0]?.id ?? uid(), die, total: Math.max(1, d.level), spent: Math.min(d.hitDice[0]?.spent ?? 0, d.level) }]
    // hit points: max at 1st level, the average after (CON added per level)
    if (d.hpMax.base === 10 || d.hpMax.base === 0) {
      const con = mod(d.abilities.con)
      d.hpMax.base = Math.max(1, die + con + (d.level - 1) * (die / 2 + 1 + con))
      d.hp.current = d.hpMax.base
    }
  })
}

function setSaves(b: Builder, text: string) {
  // "Strength and Constitution" / "Constitution + one of your choice…" (only the fixed ones; choices are yours)
  const fixed = text.split(/\+|choose|one of/i)[0]
  if (/^\s*choose/i.test(text)) return
  const keys = Object.entries(ABIL).filter(([n]) => new RegExp(`\\b${n}\\b`, 'i').test(fixed)).map(([, k]) => k)
  if (!keys.length) return
  b.notes.push('saving throws')
  b.sets.push((d) => { for (const k of keys) d.saveProf[k] = 1 })
}

function addProf(b: Builder, field: keyof Character['proficiencies'], text: string) {
  const t = text.replace(/<br>/g, '').trim()
  if (!t) return
  b.sets.push((d) => {
    const cur = d.proficiencies[field]
    if (!plain(cur).includes(plain(t))) d.proficiencies[field] = cur ? `${cur}; ${t}` : t
  })
}

const SKIP_FEATURE = /^(ability score improvement|epic boon|subclass feature|\w+ subclass|\w+ branch|branch feature|(basic|advanced|elite) operator skill|(basic|advanced) (\w+ )?talent( module)?|9th level arts)$/i

function finish(kind: FillKind, name: string, b: Builder): FillPlan {
  return {
    kind, name, features: b.features, resources: b.resources, spells: b.spells, notes: b.notes, choices: [],
    apply: (d) => {
      d.features.push(...b.features)
      d.resources.push(...b.resources)
      d.spells.push(...b.spells)
      for (const s of b.sets) s(d)
      return { features: b.features.map((x) => x.id), resources: b.resources.map((x) => x.id), spells: b.spells.map((x) => x.id) }
    },
  }
}

const pbFor = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4)

/** What filling in this entry would add — null when there's nothing in the rules for that name. */
export function planFill(c: Character, kind: FillKind, typed: string): FillPlan | null {
  const level = Math.max(1, Math.min(20, c.level || 1))
  const pb = pbFor(level)
  const b: Builder = { features: [], resources: [], spells: [], notes: [], sets: [] }
  const ak = isAK(c)

  if (!ak) {
    if (kind === 'class' || kind === 'subclass') {
      const cls = kind === 'class' ? pick(SRD.classes, typed) : pick(SRD.classes, c.className)
      if (!cls) return null
      if (kind === 'class') {
        for (const f of cls.features) if (f.level <= level && !SKIP_FEATURE.test(f.name)) addFeature(b, c, f, 'class', `${cls.name} ${f.level}`, 'class', level, pb)
        linkTable(b, cls.table, level)
        slotsFromTable(b, cls.table, level)
        setHitDie(b, parseInt((cls.core['Hit Point Die'] || '').replace(/\D+/g, ' ').trim()) || 0)
        setSaves(b, cls.core['Saving Throw Proficiencies'] || '')
        addProf(b, 'weapons', cls.core['Weapon Proficiencies'] || '')
        addProf(b, 'armor', cls.core['Armor Training'] || '')
        if (cls.core['Tool Proficiencies']) addProf(b, 'tools', cls.core['Tool Proficiencies'])
        const sa = ABIL[cls.spellAbility.toLowerCase()]
        if (sa) { b.notes.push('spellcasting ability'); b.sets.push((d) => { d.spellAbility = sa }) }
        return finish(kind, cls.name, b)
      }
      const sub = pick(cls.subclasses, typed)
      if (!sub) return null
      for (const f of sub.features) if (f.level <= level) addFeature(b, c, f, 'class', `${sub.name} ${f.level}`, 'subclass', level, pb)
      // the subclass's always-prepared spells, on the feature that lists them
      const spellNames = Object.entries(sub.spells).filter(([l]) => +l <= level).flatMap(([, n]) => n)
      const owner = b.features.find((f) => /spells$/i.test(f.name)) ?? b.features[0]
      for (const n of spellNames) {
        const lib = bestLib(n)
        if (!lib || !owner || c.spells.some((s) => s.name === lib.n) || b.spells.some((s) => s.name === lib.n)) continue
        b.spells.push({ ...fromLib(lib), prepared: true, alwaysPrepared: true, grantedBy: owner.id })
      }
      if (owner && spellNames.length) owner.onSpellPage = true
      linkTable(b, cls.table, level)
      // only the columns that belong to these features are wanted here
      b.resources = b.resources.filter((r) => b.features.some((f) => f.id === r.featureId))
      return finish(kind, sub.name, b)
    }
    if (kind === 'species') {
      const sp = pick(SRD.species, typed)
      if (!sp) return null
      for (const t of sp.traits) addFeature(b, c, t, 'species', sp.name, 'species', level, pb)
      const size = sp.size.match(/^(Tiny|Small|Medium|Large)/)?.[1]
      const speed = parseInt(sp.speed)
      if (size) { b.notes.push('size'); b.sets.push((d) => { d.size = size }) }
      if (speed) { b.notes.push('speed'); b.sets.push((d) => { d.speed.base = speed }) }
      return finish(kind, sp.name, b)
    }
    if (kind === 'background') {
      const bg = pick(SRD.backgrounds, typed)
      if (!bg) return null
      addFeature(b, c, { name: bg.name, text: `Ability Scores. ${bg.abilities}\n\nSkill Proficiencies. ${bg.skills}\n\nTool Proficiency. ${bg.tools}\n\nEquipment. ${bg.equipment}` }, 'background', 'Background', 'background', level, pb)
      const feat = SRD.feats.find((f) => plain(f.name) === plain(bg.feat.replace(/\s*\(.*\)/, '')))
      if (feat) addFeature(b, c, { name: bg.feat, text: feat.text }, 'feat', `${bg.name} (origin feat)`, 'background', level, pb)
      const skills = skillKeys(bg.skills)
      if (skills.length) { b.notes.push('skill proficiencies'); b.sets.push((d) => { for (const k of skills) d.skillProf[k as keyof Character['skillProf']] ||= 1 }) }
      addProf(b, 'tools', bg.tools)
      return finish(kind, bg.name, b)
    }
    return null
  }

  // ---------- Arknights 5e: the hand-made blocks (src/ak5e/blocks.ts)
  if (!AK) return null
  const ap = planAk(c, kind, typed, pick, { cls: AK_CLASS_NAMES, branch: AK_BRANCH_NAMES })
  if (!ap) return null
  const defaults: Answers = Object.fromEntries(ap.choices.map((ch) => [ch.key, defaultAnswer(ch.def)]))
  const preview = ap.build(c, defaults)
  return {
    kind, name: ap.name, features: preview.features, resources: preview.resources, spells: preview.spells, notes: ap.notes, choices: ap.choices,
    apply: (d, answers) => {
      const built = ap.build(d, { ...defaults, ...answers })
      for (const f of built.features) f.auto = kind
      d.features.push(...built.features)
      d.resources.push(...built.resources)
      d.spells.push(...built.spells)
      for (const set of built.sets) set(d)
      return { features: built.features.map((x) => x.id), resources: built.resources.map((x) => x.id), spells: built.spells.map((x) => x.id) }
    },
  }
}

/** Has this character already got features of this kind? (then the sheet doesn't offer to fill them in) */
export function hasFeaturesFor(c: Character, kind: FillKind): boolean {
  return c.features.some((f) => {
    if (f.auto) return f.auto === kind
    // features made by hand: class / species / background by category; subclass and nationality can't be told apart, so
    // hand-made class features count for the class only
    if (kind === 'class') return f.category === 'class'
    if (kind === 'species') return f.category === 'species'
    if (kind === 'background') return f.category === 'background'
    return false
  })
}

/** Remove what a fill added (the prompt's Undo). */
export function undoFill(d: Character, added: Applied, before: Pick<Character, 'hitDice' | 'hpMax' | 'hp' | 'saveProf' | 'skillProf' | 'slots' | 'spellAbility' | 'proficiencies' | 'size' | 'speed' | 'ak'>) {
  const f = new Set(added.features)
  const r = new Set(added.resources)
  const s = new Set(added.spells)
  d.features = d.features.filter((x) => !f.has(x.id))
  d.resources = d.resources.filter((x) => !r.has(x.id))
  d.spells = d.spells.filter((x) => !s.has(x.id))
  Object.assign(d, JSON.parse(JSON.stringify(before)))
}

export const fillSnapshot = (c: Character) => JSON.parse(JSON.stringify({
  hitDice: c.hitDice, hpMax: c.hpMax, hp: c.hp, saveProf: c.saveProf, skillProf: c.skillProf, slots: c.slots, spellAbility: c.spellAbility,
  proficiencies: c.proficiencies, size: c.size, speed: c.speed, ak: c.ak,
})) as Parameters<typeof undoFill>[2]

/** would this fill add a feature the character already has under the same name? */
export const duplicates = (c: Character, plan: FillPlan) => plan.features.some((f) => c.features.some((x) => plain(x.name) === plain(f.name)))

export const fillAvailable = (c: Character) => (isAK(c) ? !!AK : true)

/** class / branch names the rules know, for suggestions (branches of the given class) */
export function ruleNames(c: Character, kind: 'class' | 'subclass', className = ''): string[] {
  if (isAK(c)) {
    if (!AK) return []
    if (kind === 'class') return AK.classes.map((x) => x.name)
    return pick(AK.classes, className, AK_CLASS_NAMES)?.branches.map((b) => b.name) ?? []
  }
  if (kind === 'class') return SRD.classes.map((x) => x.name)
  return pick(SRD.classes, className)?.subclasses.map((s) => s.name) ?? []
}
