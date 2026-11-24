import srd from './data/srd52.json'
import { newFeature } from './blank'
import { isAK } from './systems'
import { extraFiles } from './data/runtime'
import { BRANCH_BLOCKS, CLASS_BLOCKS, SPECIES_BLOCKS } from './ak5e/blocks'
import type { Character, Feature, Resource, Spell } from './types'

/*
 * Auto-fill as a scaffold: type a class, subclass / branch, species, background or nationality and the sheet offers to
 * lay out what it gives you, for you to fill in yourself (which is how you get to know your character):
 *  - every feature / trait / feat you get up to your level, as a heading with no text (not ability score increases, size,
 *    speed, age and the like: only things that belong in your features);
 *  - weapon, armor and tool proficiencies;
 *  - languages: the ones you get and how many you choose;
 *  - a bookmark to the entry in its book, for this character (see ruleMarks.ts).
 * D&D comes from the SRD 5.2.1 (bundled); Arknights from the book the app downloaded onto this computer.
 */

export type FillKind = 'class' | 'subclass' | 'species' | 'background' | 'nationality'

interface LevelFeature { level: number; name: string; text: string }
interface NamedText { name: string; text: string }

interface SrdClass {
  name: string; core: Record<string, string>; spellAbility: string
  features: LevelFeature[]
  subclasses: { name: string; features: LevelFeature[] }[]
}
interface SrdData {
  classes: SrdClass[]
  species: { name: string; traits: NamedText[] }[]
  backgrounds: { name: string; feat: string; tools: string }[]
}
interface AkClass {
  name: string; armor: string; weapons: string; tools: string
  features: LevelFeature[]; branches: { name: string; features: LevelFeature[] }[]
}
interface AkBackground { name: string; proficiencies: string; feat: NamedText | null }
interface AkRules {
  classes: AkClass[]
  species: { name: string; features: NamedText[]; parent?: string }[]
  nationalities: { name: string; languages: string; feat: NamedText | null; background: AkBackground | null }[]
  backgrounds: AkBackground[]
}

const SRD = srd as unknown as SrdData
const AK: AkRules | null = (() => (extraFiles().find((f) => f.rules)?.rules as AkRules | undefined) ?? null)()

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

/* ---------- the scaffold ---------- */

export interface FillPlan {
  kind: FillKind
  /** the rules entry that matched what was typed */
  name: string
  /** the feature headings it adds (no text) */
  features: Feature[]
  /** kept for older callers: a scaffold adds no resources or spells */
  resources: Resource[]
  spells: Spell[]
  /** the other things it fills in ("weapon proficiencies: Simple and Martial weapons", "languages: …") */
  notes: string[]
  /** headings to bookmark in the book for this character ("Psion", "Human"…) */
  marks: string[]
  /** add it all; returns what was added, for Undo */
  apply: (d: Character) => Applied
}
export interface Applied { features: string[]; resources: string[]; spells: string[] }

/** not features: the rules' scaffolding, level-up choices, and a species' numbers and facts */
const SKIP_FEATURE = /^(ability score (improvement|increase)s?|epic boon|subclass feature|\w+ subclass|\w+ branch|branch feature|(basic|advanced|elite) operator skill|(basic|advanced) (\w+ )?talent( module)?|9th level arts|size|speed|age|lifespan|life span|creature type|type|alignment|languages?|names?|.+ names)$/i

interface Builder { features: Feature[]; notes: string[]; sets: ((d: Character) => void)[]; marks: string[] }

/** a feature heading with nothing in it yet, to fill in yourself */
function heading(b: Builder, name: string, category: Feature['category'], source: string, kind: FillKind) {
  if (!name.trim() || SKIP_FEATURE.test(name.trim())) return
  if (b.features.some((f) => plain(f.name) === plain(name))) return
  b.features.push({ ...newFeature(category), name: name.trim(), source, description: '', auto: kind } as Feature)
}

/** a proficiency line added to the Proficiencies box (unless it's already there) */
function prof(b: Builder, field: keyof Character['proficiencies'], label: string, text: string) {
  const t = text.replace(/<br>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t || /^none\.?$/i.test(t)) return
  b.notes.push(`${label}: ${t}`)
  b.sets.push((d) => {
    const cur = d.proficiencies[field]
    if (!plain(cur).includes(plain(t))) d.proficiencies[field] = cur ? `${cur}; ${t}` : t
  })
}

function finish(kind: FillKind, name: string, b: Builder): FillPlan {
  return {
    kind, name, features: b.features, resources: [], spells: [], notes: b.notes, marks: b.marks,
    apply: (d) => {
      d.features.push(...b.features)
      for (const s of b.sets) s(d)
      return { features: b.features.map((x) => x.id), resources: [], spells: [] }
    },
  }
}

/** languages some D&D features teach (Druidic, Thieves' Cant) */
const FEATURE_LANGUAGES = /^(druidic|thieves'? cant)$/i

/** What filling in this entry would lay out, or null when there's nothing in the rules for that name. */
export function planFill(c: Character, kind: FillKind, typed: string): FillPlan | null {
  const level = Math.max(1, Math.min(20, c.level || 1))
  const b: Builder = { features: [], notes: [], sets: [], marks: [] }

  if (!isAK(c)) {
    if (kind === 'class' || kind === 'subclass') {
      const cls = kind === 'class' ? pick(SRD.classes, typed) : pick(SRD.classes, c.className)
      if (!cls) return null
      if (kind === 'class') {
        for (const f of cls.features) if (f.level <= level) heading(b, f.name, 'class', `${cls.name} ${f.level}`, 'class')
        prof(b, 'weapons', 'weapon proficiencies', cls.core['Weapon Proficiencies'] || '')
        prof(b, 'armor', 'armor training', cls.core['Armor Training'] || '')
        prof(b, 'tools', 'tool proficiencies', cls.core['Tool Proficiencies'] || '')
        const langs = cls.features.filter((f) => f.level <= level && FEATURE_LANGUAGES.test(f.name)).map((f) => f.name)
        if (langs.length) language(b, langs.join(', '))
        b.marks.push(cls.name)
        return finish(kind, cls.name, b)
      }
      const sub = pick(cls.subclasses, typed)
      if (!sub) return null
      for (const f of sub.features) if (f.level <= level) heading(b, f.name, 'class', `${sub.name} ${f.level}`, 'subclass')
      b.marks.push(sub.name)
      return finish(kind, sub.name, b)
    }
    if (kind === 'species') {
      const sp = pick(SRD.species, typed)
      if (!sp) return null
      for (const t of sp.traits) heading(b, t.name, 'species', sp.name, 'species')
      // 2024 rules: everyone knows Common and picks two standard languages when making a character
      language(b, 'Common + 2 standard languages of your choice')
      b.marks.push(sp.name)
      return finish(kind, sp.name, b)
    }
    if (kind === 'background') {
      const bg = pick(SRD.backgrounds, typed)
      if (!bg) return null
      // the background's own text is ability scores, skills, tools and gear: only its origin feat is a feature
      if (bg.feat) heading(b, bg.feat, 'feat', `${bg.name} (origin feat)`, 'background')
      prof(b, 'tools', 'tool proficiencies', bg.tools)
      b.marks.push(bg.name)
      return finish(kind, bg.name, b)
    }
    return null
  }

  // ---------- Arknights 5e (the book on this computer; the hand-made blocks say which entries aren't features)
  if (!AK) return null
  if (kind === 'class' || kind === 'subclass') {
    const cls = pick(AK.classes, kind === 'class' ? typed : c.className, AK_CLASS_NAMES)
    if (!cls) return null
    if (kind === 'class') {
      const blocks = CLASS_BLOCKS[cls.name] ?? {}
      for (const f of cls.features) if (f.level <= level && !blocks[f.name]?.skip) heading(b, f.name, 'class', `${cls.name} ${f.level}`, 'class')
      prof(b, 'weapons', 'weapon proficiencies', cls.weapons)
      prof(b, 'armor', 'armor training', cls.armor)
      prof(b, 'tools', 'tool proficiencies', cls.tools)
      b.marks.push(cls.name)
      return finish(kind, cls.name, b)
    }
    const br = pick(cls.branches, typed, AK_BRANCH_NAMES)
    if (!br) return null
    const blocks = BRANCH_BLOCKS[`${cls.name}/${br.name}`] ?? {}
    for (const f of br.features) if (f.level <= level && !blocks[f.name]?.skip) heading(b, f.name, 'class', `${br.name} ${cls.name} ${f.level}`, 'subclass')
    b.marks.push(br.name)
    return finish(kind, `${br.name} (${cls.name})`, b)
  }
  if (kind === 'species') {
    const sp = pick(AK.species, typed)
    if (!sp) return null
    const parent = sp.parent ? AK.species.find((x) => x.name === sp.parent) : undefined
    for (const owner of [parent, sp]) {
      if (!owner) continue
      const blocks = SPECIES_BLOCKS[owner.name] ?? {}
      for (const f of owner.features) if (!blocks[f.name]?.skip) heading(b, f.name, 'species', owner.name, 'species')
    }
    b.marks.push(sp.name)
    return finish(kind, sp.name, b)
  }
  if (kind === 'nationality') {
    const nat = pick(AK.nationalities, typed)
    if (!nat) return null
    if (nat.feat) heading(b, nat.feat.name, 'feat', `${nat.name} (nationality feat)`, 'nationality')
    if (nat.languages) language(b, nat.languages.replace(/\.$/, ''))
    b.marks.push(nat.name)
    return finish(kind, nat.name, b)
  }
  if (kind === 'background') {
    const all = [...AK.backgrounds, ...AK.nationalities.flatMap((n) => (n.background ? [n.background] : []))]
    const bg = pick(all, typed)
    if (!bg) return null
    if (bg.feat) heading(b, bg.feat.name, 'background', `${bg.name} (background feat)`, 'background')
    prof(b, 'tools', 'tool proficiencies', bg.proficiencies.replace(/^You are Proficient (?:in|with) (?:the |a |an )?/i, '').replace(/\.$/, ''))
    b.marks.push(bg.name)
    return finish(kind, bg.name, b)
  }
  return null
}

/** languages you get / choose, added to the Languages box (unless already there) */
function language(b: Builder, text: string) {
  b.notes.push(`languages: ${text}`)
  b.sets.push((d) => {
    const cur = d.proficiencies.languages
    if (!plain(cur).includes(plain(text))) d.proficiencies.languages = cur ? `${cur}; ${text}` : text
  })
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
export function undoFill(d: Character, added: Applied, before: Pick<Character, 'proficiencies'>) {
  const f = new Set(added.features)
  d.features = d.features.filter((x) => !f.has(x.id))
  Object.assign(d, JSON.parse(JSON.stringify(before)))
}

export const fillSnapshot = (c: Character) => JSON.parse(JSON.stringify({ proficiencies: c.proficiencies })) as Parameters<typeof undoFill>[2]

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
