import { PDFCheckBox, PDFDocument, PDFTextField, PDFButton, StandardFonts, rgb, type PDFForm, type PDFFont, type PDFPage } from 'pdf-lib'
import {
  ability, activeEffects, attackInfo, damageReduction, itemAttacks, martialDc, passivePerception, profBonus, save, signed, skill,
  spellStats, spLimits, statInfo, totalWeight, carryCapacity,
} from '../calc'
import { ABILITIES } from '../constants'
import { plainText } from '../rich'
import type { AbilityKey, Character, Feature, SkillKey, Spell } from '../types'
import layouts from './layouts.json'

/* ------------------------------------------------------------------ which sheet is it */

export type TemplateKind = 'wotc2014' | 'wotc2024' | 'cs14'

/** Recognise a fillable sheet by the names of its fields. */
export function detectKind(names: Set<string>): TemplateKind | null {
  if (names.has('NAME - WEAPON 1') && names.has('SPELL NAME0')) return 'wotc2024'
  if (names.has('ChBx Arcana') && names.has('TrackingTxt1')) return 'cs14'
  if (names.has('CharacterName') && names.has('Check Box 11') && names.has('ClassLevel')) return 'wotc2014'
  return null
}

export async function inspectTemplate(bytes: Uint8Array): Promise<TemplateKind | null> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  return detectKind(new Set(doc.getForm().getFields().map((f) => f.getName().trim())))
}

/* ------------------------------------------------------------------ text helpers */

/** The standard PDF fonts only know Windows-1252: swap or drop anything else. */
export function pdfText(s: string): string {
  return (s || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
    .replace(/−/g, '-').replace(/[→⇒]/g, '->').replace(/[★☆◆◇●○✓✔]/g, '*')
    .replace(/ /g, ' ')
    .replace(/[^\n\t\x20-\x7e¡-ÿ–—•…€™†‡‰]/g, '')
}
const plain = (s: string) => pdfText(plainText(s))

const featureText = (list: Feature[]) =>
  list.map((f) => `${f.name || 'Feature'}${f.source ? ` (${f.source})` : ''}. ${plain(f.description)}`.trim()).join('\n\n')

const byCat = (c: Character, ...cats: Feature['category'][]) => c.features.filter((f) => cats.includes(f.category))

/** Split a list into roughly equal halves (two text columns on a sheet). */
function halves<T>(list: T[], weight: (t: T) => number): [T[], T[]] {
  const total = list.reduce((s, x) => s + weight(x), 0)
  let acc = 0
  const a: T[] = []
  const b: T[] = []
  for (const x of list) { if (acc < total / 2) { a.push(x); acc += weight(x) } else b.push(x) }
  return [a, b]
}

const SKILL_DND: SkillKey[] = [
  'acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation',
  'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleightOfHand', 'stealth', 'survival',
]

/** Everything the sheets need, worked out once. */
function sheetData(c: Character) {
  const fx = activeEffects(c)
  const ab = Object.fromEntries(ABILITIES.map((a) => [a.key, ability(c, a.key, fx)])) as Record<AbilityKey, ReturnType<typeof ability>>
  const sv = Object.fromEntries(ABILITIES.map((a) => [a.key, save(c, a.key, fx)])) as Record<AbilityKey, ReturnType<typeof save>>
  const sk = (k: SkillKey) => skill(c, k, fx)
  const weapons = [...itemAttacks(c), ...c.attacks].map((a) => {
    const i = attackInfo(c, a, fx)
    return { name: a.name || 'Attack', bonus: signed(i.bonus), damage: `${i.damage} ${a.damageType}`.trim(), range: a.range, notes: a.notes, prof: a.proficient, finesse: a.ability === 'finesse' }
  })
  const spellsSorted = [...c.spells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  const items = c.items.filter((i) => i.qty > 0)
  const itemLine = (i: (typeof items)[number]) => `${i.name}${i.qty > 1 ? ` (${i.qty})` : ''}`
  return {
    fx, ab, sv, sk, weapons, spellsSorted, items, itemLine,
    pb: profBonus(c),
    ac: statInfo(c, 'ac', fx).total,
    init: statInfo(c, 'initiative', fx).total,
    speed: statInfo(c, 'speed', fx).total,
    hpMax: statInfo(c, 'hpMax', fx).total,
    passive: passivePerception(c, fx),
    spell: spellStats(c, fx),
    hdText: c.hitDice.map((h) => `${h.total}d${h.die}`).join(' + '),
    hdLeft: c.hitDice.map((h) => `${h.total - h.spent}d${h.die}`).join(' + '),
    hdTotal: c.hitDice.reduce((s, h) => s + h.total, 0),
    hdSpent: c.hitDice.reduce((s, h) => s + h.spent, 0),
    profs: (k: keyof Character['proficiencies']) => plain(c.proficiencies[k]),
    resources: c.resources.map((r) => `${r.name || 'Resource'}${r.die ? ` (${r.die})` : ''}: ${Math.max(0, r.max - r.used)}/${r.max}`),
  }
}

/* ------------------------------------------------------------------ form filling */

class Filler {
  private byName = new Map<string, ReturnType<PDFForm['getFields']>[number]>()
  constructor(form: PDFForm, private font: PDFFont) {
    for (const f of form.getFields()) this.byName.set(f.getName().trim(), f)
  }
  /** Empty every field first, so a filled-in template (someone's old sheet) doesn't leak through. */
  clear() {
    for (const f of this.byName.values()) {
      try {
        if (f instanceof PDFTextField) f.setText('')
        else if (f instanceof PDFCheckBox) f.uncheck()
      } catch { /* read-only or odd field */ }
    }
  }
  text(name: string, value: string | number | null | undefined, auto = false) {
    const f = this.byName.get(name)
    if (!(f instanceof PDFTextField)) return
    let v = pdfText(value == null ? '' : String(value))
    const max = f.getMaxLength()
    if (max && v.length > max) v = v.slice(0, max)
    // long text: largest size up to 9pt (10pt one-liners) that still fits the box
    if (v && (auto || v.length > 40 || f.isMultiline())) {
      try {
        const sz = Math.round(this.fit(f, v) * 4) / 4
        // fields without their own /DA inherit the form's (often "auto" size): give them one
        if (f.acroField.getDefaultAppearance()) f.setFontSize(sz)
        else f.acroField.setDefaultAppearance(`/Helv ${sz} Tf 0 g`)
        // widgets can carry their own size, which wins over the field's
        for (const w of f.acroField.getWidgets()) {
          const da = w.getDefaultAppearance()
          if (da) w.setDefaultAppearance(/[\d.]+\s+Tf/.test(da) ? da.replace(/[\d.]+(\s+Tf)/, `${sz}$1`) : da)
        }
      } catch { /* keep the sheet's size */ }
    }
    try { f.setText(v) } catch { /* comb fields etc. */ }
  }
  private fit(f: PDFTextField, v: string): number {
    const r = f.acroField.getWidgets()[0]?.getRectangle()
    if (!r) return 8
    const w = r.width - 4
    const h = r.height - 3
    if (!f.isMultiline()) {
      let sz = Math.min(10, h * 0.8)
      while (sz > 4 && this.font.widthOfTextAtSize(v, sz) > w) sz -= 0.25
      return sz
    }
    for (let sz = 9; sz > 4; sz -= 0.25) if (wrap(v, this.font, sz, w).length * sz * 1.17 <= h) return sz
    return 4
  }
  check(name: string, on: boolean) {
    const f = this.byName.get(name)
    if (!(f instanceof PDFCheckBox)) return
    try { if (on) f.check(); else f.uncheck() } catch { /* ignore */ }
  }
  async image(doc: PDFDocument, name: string, src: string) {
    const f = this.byName.get(name)
    if (!(f instanceof PDFButton)) return
    const img = await embedImage(doc, src || BLANK_PNG)
    if (img) try { f.setImage(img) } catch { /* ignore */ }
  }
}

const BLANK_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XzWbYAAAAASUVORK5CYII='

async function embedImage(doc: PDFDocument, src: string) {
  try {
    const bytes = new Uint8Array(await (await fetch(src)).arrayBuffer())
    const png = bytes[0] === 0x89 && bytes[1] === 0x50
    return png ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
  } catch { return null }
}

/** Fill one of the supported fillable sheets with a character. */
export async function fillTemplate(bytes: Uint8Array, c: Character): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form = doc.getForm()
  const kind = detectKind(new Set(form.getFields().map((f) => f.getName().trim())))
  if (!kind) throw new Error("This PDF isn't one of the supported fillable sheets.")
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const F = new Filler(form, font)
  F.clear()
  const d = sheetData(c)
  if (kind === 'wotc2014') await fill2014(doc, F, c, d)
  else if (kind === 'wotc2024') await fill2024(doc, F, c, d)
  else await fillCs14(doc, F, c, d)
  form.updateFieldAppearances(font)
  return doc.save()
}

type D = ReturnType<typeof sheetData>

const classLevel = (c: Character) => [c.className, c.subclass ? `(${c.subclass})` : '', c.level].filter(Boolean).join(' ')
const mod = (n: number) => signed(n)

/* ---------- official 2014 sheet ---------- */

const W14_SKILL_TEXT: Record<SkillKey, string> = {
  acrobatics: 'Acrobatics', animalHandling: 'Animal', arcana: 'Arcana', athletics: 'Athletics', deception: 'Deception', history: 'History',
  insight: 'Insight', intimidation: 'Intimidation', investigation: 'Investigation', medicine: 'Medicine', nature: 'Nature', perception: 'Perception',
  performance: 'Performance', persuasion: 'Persuasion', religion: 'Religion', sleightOfHand: 'SleightofHand', stealth: 'Stealth', survival: 'Survival',
  arts: '', lore: '', wilderness: '', technology: '',
}
const W14_SAVE: Record<AbilityKey, [string, string]> = {
  str: ['ST Strength', 'Check Box 11'], dex: ['ST Dexterity', 'Check Box 18'], con: ['ST Constitution', 'Check Box 19'],
  int: ['ST Intelligence', 'Check Box 20'], wis: ['ST Wisdom', 'Check Box 21'], cha: ['ST Charisma', 'Check Box 22'],
}
const ABBR: Record<AbilityKey, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }

/** Fill a level-by-level spell list (2014 sheet and CS v1.4 share this layout). */
function spellBlocks(F: Filler, c: Character, blocks: { level: number; names: string[]; prepared: string[] }[]) {
  for (const b of blocks) {
    const list = c.spells.filter((s) => s.level === b.level).sort((a, z) => a.name.localeCompare(z.name))
    b.names.forEach((n, i) => {
      const s = list[i]
      F.text(n, s ? s.name + (b.names.length === i + 1 && list.length > b.names.length ? ` (+${list.length - b.names.length} more)` : '') : '')
      if (b.prepared[i]) F.check(b.prepared[i], !!s && (s.prepared || s.alwaysPrepared))
    })
  }
}

async function fill2014(doc: PDFDocument, F: Filler, c: Character, d: D) {
  F.text('CharacterName', c.name); F.text('CharacterName 2', c.name)
  F.text('ClassLevel', classLevel(c)); F.text('Background', c.background); F.text('PlayerName', c.player)
  F.text('Race', c.species); F.text('Alignment', c.alignment); F.text('XP', c.xp)
  F.text('Inspiration', c.inspiration ? 'X' : '')
  F.text('ProfBonus', mod(d.pb))
  for (const a of ABILITIES) {
    F.text(ABBR[a.key], d.ab[a.key].score)
    F.text(a.key === 'cha' ? 'CHamod' : `${ABBR[a.key]}mod`, mod(d.ab[a.key].mod))
    F.text(W14_SAVE[a.key][0], mod(d.sv[a.key].total)); F.check(W14_SAVE[a.key][1], d.sv[a.key].profLevel >= 1)
  }
  SKILL_DND.forEach((k, i) => {
    const r = d.sk(k)
    F.text(W14_SKILL_TEXT[k], mod(r.total)); F.check(`Check Box ${23 + i}`, r.profLevel >= 1)
  })
  F.text('Passive', d.passive)
  F.text('AC', d.ac); F.text('Initiative', mod(d.init)); F.text('Speed', d.speed)
  F.text('HPMax', d.hpMax); F.text('HPCurrent', c.hp.current); F.text('HPTemp', c.hp.temp || '')
  F.text('HDTotal', d.hdText); F.text('HD', d.hdLeft)
  ;[12, 13, 14].forEach((n, i) => F.check(`Check Box ${n}`, c.deathSaves.successes > i))
  ;[15, 16, 17].forEach((n, i) => F.check(`Check Box ${n}`, c.deathSaves.failures > i))
  const names = ['Wpn Name', 'Wpn Name 2', 'Wpn Name 3']; const atk = ['Wpn1 AtkBonus', 'Wpn2 AtkBonus', 'Wpn3 AtkBonus']; const dmg = ['Wpn1 Damage', 'Wpn2 Damage', 'Wpn3 Damage']
  d.weapons.slice(0, 3).forEach((w, i) => { F.text(names[i], w.name); F.text(atk[i], w.bonus); F.text(dmg[i], w.damage) })
  F.text('AttacksSpellcasting', [
    ...d.weapons.slice(3).map((w) => `${w.name}: ${w.bonus}, ${w.damage}`),
    ...d.resources,
  ].join('\n'), true)
  F.text('ProficienciesLang', [
    `Weapons: ${d.profs('weapons')}`, `Armor: ${d.profs('armor')}`, `Tools: ${d.profs('tools')}`, `Languages: ${d.profs('languages')}`,
  ].join('\n'), true)
  ;(['cp', 'sp', 'ep', 'gp', 'pp'] as const).forEach((k) => F.text(k.toUpperCase(), c.coins[k] || ''))
  F.text('Equipment', d.items.map(d.itemLine).join('\n'), true)
  F.text('PersonalityTraits', plain(c.story.trait1), true); F.text('Ideals', plain(c.story.ideals), true)
  F.text('Bonds', plain(c.story.bonds), true); F.text('Flaws', plain(c.story.flaws), true)
  const [f1, f2] = halves(c.features, (f) => 40 + plain(f.description).length)
  F.text('Features and Traits', featureText(f1), true)
  F.text('Feat+Traits', featureText(f2), true)
  for (const k of ['age', 'height', 'weight', 'eyes', 'skin', 'hair'] as const) F.text(k[0].toUpperCase() + k.slice(1), c.appearance[k])
  F.text('Allies', plain(c.story.allies), true); F.text('FactionName', c.story.alliesTitle === 'Allies & Organizations' ? '' : c.story.alliesTitle)
  F.text('Backstory', plain(c.story.backstory), true)
  F.text('Treasure', c.extraNotes.map((n) => `${n.title}\n${plain(n.text)}`).join('\n\n'), true)
  await F.image(doc, 'CHARACTER IMAGE', c.appearanceImage || c.portrait)
  await F.image(doc, 'Faction Symbol Image', c.emblem)
  F.text('Spellcasting Class 2', c.spellAbility ? c.className : '')
  F.text('SpellcastingAbility 2', c.spellAbility ? ABBR[c.spellAbility] : '')
  F.text('SpellSaveDC  2', d.spell.dc ?? ''); F.text('SpellSaveDC 2', d.spell.dc ?? '')
  F.text('SpellAtkBonus 2', d.spell.attack == null ? '' : mod(d.spell.attack))
  for (let l = 1; l <= 9; l++) {
    const s = c.slots[l]
    F.text(`SlotsTotal ${18 + l}`, s?.total || ''); F.text(`SlotsRemaining ${18 + l}`, s?.total ? s.total - s.used : '')
  }
  spellBlocks(F, c, layouts.wotc2014)
}

/* ---------- official 2024 sheet ---------- */

const W24_SKILL: Partial<Record<SkillKey, [string, string]>> = {
  athletics: ['ATHLETICS', 'Check Box19'], acrobatics: ['ACROBATICS', 'Check Box8'], sleightOfHand: ['SLEIGHT OF HAND', 'Check Box9'],
  stealth: ['STEALTH', 'Check Box10'], arcana: ['ARCANA', 'Check Box24'], history: ['HISTORY', 'Check Box20'],
  investigation: ['INVESTIGATION', 'Check Box21'], nature: ['NATURE', 'Check Box22'], religion: ['RELIGION', 'Check Box23'],
  animalHandling: ['ANIMAL HANDLING', 'Check Box15'], insight: ['INSIGHT', 'Check Box13'], medicine: ['MEDICINE', 'Check Box12'],
  perception: ['PERCEPTION', 'Check Box14'], survival: ['SURVIVAL', 'Check Box16'], deception: ['DECEPTION', 'Check Box5'],
  intimidation: ['INTIMIDATE', 'Check Box4'], performance: ['PERFORMANCE', 'Check Box3'], persuasion: ['PERSUASION', 'Check Box2'],
}
const W24_SAVE: Record<AbilityKey, [string, string]> = {
  str: ['STR SAVE', 'Check Box18'], dex: ['DEX SAVE', 'Check Box11'], con: ['CON SAVE', 'Check Box7'],
  int: ['INT SAVE', 'Check Box25'], wis: ['Text Field71', 'Check Box17'], cha: ['CHA SAVE', 'Check Box6'],
}
/** spell slot "expended" diamonds, per level */
const W24_SLOTS: string[][] = [
  [], ['Check Box52', 'Check Box46', 'Check Box40', 'Check Box37'], ['Check Box49', 'Check Box38', 'Check Box43'], ['Check Box47', 'Check Box44', 'Check Box41'],
  ['Check Box50', 'Check Box53', 'Check Box39'], ['Check Box48', 'Check Box45', 'Check Box42'], ['Check Box51', 'Check Box54'],
  ['Check Box55', 'Check Box56'], ['Check Box58'], ['Check Box57'],
]

/** 2024 sheet shorthand: A, BA, R, or the time as written (1 minute, 10 minutes…) */
const shortTime = (t: string) => (/bonus/i.test(t) ? 'BA' : /reaction/i.test(t) ? 'R' : /^\s*(1\s+)?action\s*$/i.test(t) ? 'A' : t)

async function fill2024(doc: PDFDocument, F: Filler, c: Character, d: D) {
  F.text('Name', c.name); F.text('Background', c.background); F.text('Class', c.className); F.text('Species', c.species)
  F.text('Subclass', c.subclass); F.text('Level', c.level); F.text('XP Points', c.xp)
  F.text('Armor Class', d.ac)
  F.check('shield chk', c.items.some((i) => i.armor?.kind === 'shield' && (i.slot === 'off' || i.slot === 'main')))
  F.text('Current HP', c.hp.current); F.text('Temp HP', c.hp.temp || ''); F.text('Max HP', d.hpMax)
  F.text('Spent HD', d.hdSpent || ''); F.text('Max HD', d.hdText)
  ;['SUCCESS LEFT L chk', 'SUCCESS CTR chk', 'SUCCESS RIGHT chk'].forEach((n, i) => F.check(n, c.deathSaves.successes > i))
  ;['FAILURE LEFT chk', 'FAILURE CTR chk', 'FAILURE RIGHT chk'].forEach((n, i) => F.check(n, c.deathSaves.failures > i))
  F.text('PROF BONUS', mod(d.pb))
  for (const a of ABILITIES) {
    F.text(`${ABBR[a.key]} SCORE`, d.ab[a.key].score); F.text(`${ABBR[a.key]} MOD`, mod(d.ab[a.key].mod))
    F.text(W24_SAVE[a.key][0], mod(d.sv[a.key].total)); F.check(W24_SAVE[a.key][1], d.sv[a.key].profLevel >= 1)
  }
  for (const [k, [t, cb]] of Object.entries(W24_SKILL) as [SkillKey, [string, string]][]) {
    const r = d.sk(k)
    F.text(t, mod(r.total)); F.check(cb, r.profLevel >= 1)
  }
  F.check('Check Box1', c.inspiration)
  const armor = d.profs('armor').toLowerCase()
  F.check('Check Box33', /light|all armor/.test(armor)); F.check('Check Box34', /medium|all armor/.test(armor))
  F.check('Check Box35', /heavy|all armor/.test(armor)); F.check('Check Box36', /shield/.test(armor))
  F.text('init', mod(d.init)); F.text('SPEED', `${d.speed} ft`); F.text('SIZE', c.size); F.text('PASSIVE PERCEPTION', d.passive)
  d.weapons.slice(0, 6).forEach((w, i) => {
    F.text(`NAME - WEAPON ${i + 1}`, w.name); F.text(`BONUS/DC - WEAPON ${i + 1}`, w.bonus)
    F.text(`DAMAGE/TYPE - WEAPON ${i + 1}`, w.damage); F.text(`NOTES - WEAPON ${i + 1}`, [w.range, w.notes].filter(Boolean).join(', '))
  })
  const cls = byCat(c, 'class', 'other', 'buff')
  const [c1, c2] = halves(cls, (f) => 40 + plain(f.description).length)
  F.text('CLASS FEATURES 1', featureText(c1), true); F.text('CLASS FEATURES 2', featureText(c2), true)
  F.text('SPECIES TRAITS', featureText(byCat(c, 'species')), true)
  F.text('FEATS', featureText(byCat(c, 'feat', 'background')), true)
  F.text('WEAPON PROF', d.profs('weapons'), true); F.text('TOOL PROF', d.profs('tools'), true)
  // page 2
  F.text('SPELLCASTING ABILITY', c.spellAbility ? ABILITIES.find((a) => a.key === c.spellAbility)!.name : '')
  F.text('SPELLCASTING MOD', c.spellAbility ? mod(d.spell.mod) : '')
  F.text('SPELL SAVE DC', d.spell.dc ?? ''); F.text('SPELL ATTACK BONUS', d.spell.attack == null ? '' : mod(d.spell.attack))
  for (let l = 1; l <= 9; l++) {
    const s = c.slots[l]
    F.text(`LVL${l} TOTAL`, s?.total || '')
    W24_SLOTS[l].forEach((n, i) => F.check(n, !!s && i < s.used))
  }
  const shown = d.spellsSorted.filter((s) => s.level === 0 || s.prepared || s.alwaysPrepared)
  layouts.wotc2024.forEach((row, i) => {
    const s: Spell | undefined = shown[i]
    F.text(row.level, s ? (s.level === 0 ? 'C' : s.level) : ''); F.text(row.name, s?.name ?? '')
    F.text(row.time, s ? shortTime(s.castingTime) : '')
    F.text(row.range, s?.range ?? ''); F.text(row.notes, s?.duration ?? '')
    F.check(row.c, !!s?.concentration); F.check(row.r, !!s?.ritual); F.check(row.m, !!s?.materialConsumed)
  })
  F.text('PERSONALITY', [c.story.trait1, c.story.ideals && `Ideals: ${c.story.ideals}`, c.story.bonds && `Bonds: ${c.story.bonds}`, c.story.flaws && `Flaws: ${c.story.flaws}`]
    .map((x) => plain(x || '')).filter(Boolean).join('\n'), true)
  F.text('LANGUAGES', d.profs('languages'), true)
  F.text('EQUIPMENT', d.items.map(d.itemLine).join(', '), true)
  const attuned = c.items.filter((i) => i.attunement && i.attuned)
  ;['ATTUNMENT 1', 'ATTUNMENT 2', 'ATTUNMENT 3'].forEach((n, i) => F.text(n, attuned[i]?.name ?? ''))
  ;['Check Box63', 'Check Box62', 'Check Box61'].forEach((n, i) => F.check(n, !!attuned[i]))
  ;(['cp', 'sp', 'ep', 'gp', 'pp'] as const).forEach((k) => F.text(k.toUpperCase(), c.coins[k] || ''))
  await F.image(doc, 'Character Portrait', c.appearanceImage || c.portrait)
}

/* ---------- "Current Standard CS v1.4" 6-page sheet ---------- */

const CS_SKILL: Record<SkillKey, [string, string]> = {
  athletics: ['Athletics', 'Athletics'], acrobatics: ['Acrobatics', 'Acrobatics'], sleightOfHand: ['SleightofHand', 'Sleight'],
  stealth: ['Stealth', 'Stealth'], arcana: ['Arcana', 'Arcana'], history: ['History', 'History'], investigation: ['Investigation', 'Investigation'],
  nature: ['Nature', 'Nature'], religion: ['Religion', 'Religion'], animalHandling: ['Animal Handling', 'Animal'], insight: ['Insight', 'Insight'],
  medicine: ['Medicine', 'Medicine'], perception: ['Perception', 'Perception'], survival: ['Survival', 'Survival'], deception: ['Deception', 'Deception'],
  intimidation: ['Intimidation', 'Intimidation'], performance: ['Performance', 'Performance'], persuasion: ['Persuasion', 'Persuasion'],
  arts: ['', ''], lore: ['', ''], wilderness: ['', ''], technology: ['', ''],
}
const CS_SAVE: Record<AbilityKey, [string, string]> = {
  str: ['SavingThrows', 'ST Strength'], dex: ['SavingThrows2', 'ST Dexterity'], con: ['SavingThrows3', 'ST Constitution'],
  int: ['SavingThrows4', 'ST Intelligence'], wis: ['SavingThrows5', 'ST Wisdom'], cha: ['SavingThrows6', 'ST Charisma'],
}

async function fillCs14(doc: PDFDocument, F: Filler, c: Character, d: D) {
  F.text('CharacterName', c.name); F.text('ClassLevel', [c.className, c.subclass].filter(Boolean).join(' · ')); F.text('Level', c.level)
  F.text('Background', c.background); F.text('PlayerName', c.player); F.text('Race', c.species); F.text('Alignment', c.alignment); F.text('XP', c.xp)
  F.text('ProBonus', d.pb); F.check('ChBx Inspiration', c.inspiration)
  for (const a of ABILITIES) {
    F.text(ABBR[a.key], d.ab[a.key].score); F.text(`${ABBR[a.key]}mod`, d.ab[a.key].mod)
    F.text(CS_SAVE[a.key][0], d.sv[a.key].total); F.check(CS_SAVE[a.key][1], d.sv[a.key].profLevel >= 1)
  }
  for (const k of SKILL_DND) {
    const r = d.sk(k)
    const [t, cb] = CS_SKILL[k]
    F.text(t, r.total); F.check(`ChBx ${cb}`, r.profLevel >= 1); F.check(`Expert ${cb}`, r.profLevel >= 2)
  }
  F.text('Passive', d.passive)
  F.text('Conditions', c.conditions.join(', '), true)
  F.text('AC', d.ac); F.text('Initiative', mod(d.init)); F.text('Speed', `${d.speed}ft`)
  F.text('HPMax', d.hpMax); F.text('HPCurrent', c.hp.current); F.text('HPTemp', c.hp.temp || '')
  F.text('HDTotal', d.hdTotal || ''); F.text('HD', d.hdLeft || d.hdText)
  ;[12, 13, 14].forEach((n, i) => F.check(`Check Box ${n}`, c.deathSaves.successes > i))
  ;[15, 16, 17].forEach((n, i) => F.check(`Check Box ${n}`, c.deathSaves.failures > i))
  d.weapons.slice(0, 5).forEach((w, i) => {
    F.text(i === 0 ? 'Wpn Name' : `Wpn Name ${i + 1}`, w.name); F.text(`Wpn${i + 1} AtkBonus`, w.bonus); F.text(`Wpn${i + 1} Damage`, w.damage)
    F.check(`Wpn${i + 1} Proficieny`, w.prof); F.check(`Wpn${i + 1} Finesse`, w.finesse)
  })
  F.text('AttacksSpellcasting', c.features.flatMap((f) => f.actions.filter((a) => a.description).map((a) => `${a.name}: ${plain(a.description)}`)).join('\n\n'), true)
  c.resources.slice(0, 6).forEach((r, i) => {
    F.text(`TrackingTxt${i + 1}`, `${r.name}${r.die ? ` (${r.die})` : ''}`)
    for (let j = 0; j < 10; j++) F.check(`Tracking${i * 10 + j + 1}`, j < Math.min(r.used, 10))
  })
  F.text('ProficienciesLang', [
    `Weapon Proficiencies: ${d.profs('weapons')}`, `Tool Proficiencies: ${d.profs('tools')}`, `Armour Proficiencies: ${d.profs('armor')}`, `Languages: ${d.profs('languages')}`,
  ].join('\n\n'), true)
  ;(['cp', 'sp', 'ep', 'gp', 'pp'] as const).forEach((k) => F.text(k.toUpperCase(), c.coins[k] || ''))
  const [e1, e2] = halves(d.items, () => 1)
  F.text('Equipment', e1.map(d.itemLine).join('\n'), true); F.text('Equipment2', e2.map(d.itemLine).join('\n'), true)
  F.text('Current Weight', totalWeight(c)); F.text('MAX Weight', carryCapacity(c))
  F.text('Battle State', plain(c.battleState), true)
  // character page
  for (const k of ['age', 'height', 'weight', 'eyes', 'skin', 'hair'] as const) F.text(k[0].toUpperCase() + k.slice(1), c.appearance[k])
  F.text('Backstory', plain(c.story.backstory), true); F.text('Allies', plain(c.story.allies), true)
  F.text('FactionName', c.story.alliesTitle === 'Allies & Organizations' ? '' : c.story.alliesTitle)
  F.text('PersonalityTraits', plain(c.story.trait1), true); F.text('Ideals', plain(c.story.ideals), true)
  F.text('Bonds', plain(c.story.bonds), true); F.text('Flaws', plain(c.story.flaws), true)
  F.text('Text2', plain(c.story.expression), true); F.text('Text3', plain(c.story.roleplay), true)
  // features pages
  F.text('Features and Traits', featureText(byCat(c, 'species', 'background')), true)
  const [c1, c2] = halves(byCat(c, 'class'), (f) => 40 + plain(f.description).length)
  F.text('Features and Traits 1', featureText(c1), true); F.text('Features and Traits 2', featureText(c2), true)
  F.text('Feat List', byCat(c, 'feat').map((f) => f.name).join('\n'), true)
  F.text('Feat+Traits', featureText(byCat(c, 'feat')), true)
  F.text('Features and Traits 4', featureText(byCat(c, 'other', 'buff')), true)
  F.text('Features and Traits 3', c.extraNotes.map((n) => `${n.title}\n${plain(n.text)}`).join('\n\n'), true)
  // spells page
  F.text('Total Prepared Spells', c.spells.filter((s) => s.level > 0 && (s.prepared || s.alwaysPrepared)).length)
  F.text('SpellSaveDC', d.spell.dc ?? ''); F.text('SpellAtkBonus', d.spell.attack ?? '')
  for (let l = 1; l <= 9; l++) {
    const s = c.slots[l]
    F.text(`SlotsTotal ${18 + l}`, s?.total || '')
    for (let j = 0; j < 6; j++) F.check(`ChBx Slots${(l - 1) * 6 + j + 1}`, !!s && j < s.used)
  }
  spellBlocks(F, c, layouts.inanna)
  // pictures: the portrait on every page, the appearance picture in its own box
  for (const n of ['Image5_af_image', 'Image6_af_image', 'Image7_af_image', 'Image8_af_image', 'Image1_af_image']) await F.image(doc, n, c.portrait)
  await F.image(doc, 'Image9_af_image', c.appearanceImage || c.portrait)
  await F.image(doc, 'Faction Symbol Image', c.emblem)
  for (let i = 1; i <= 6; i++) { await F.image(doc, `party member img ${i}_af_image`, ''); F.text(`party member ${i}`, '') }
}

/* ------------------------------------------------------------------ Arknights 5e (image sheet) */

/**
 * The AK5e sheet is a set of page images (2550 × 3300). The export draws them onto US-letter pages and writes on top.
 * Coordinates below are in image pixels, measured from the sheet.
 */
export interface AkImages { main: string; second: string; arts: string }

const PX = 612 / 2550 // image px → PDF points

class Page {
  constructor(private page: PDFPage, private font: PDFFont, private bold: PDFFont) {}
  /** text centred on (x, y) image px, shrunk to fit `w` */
  center(s: string | number, x: number, y: number, w: number, size = 11, bold = true) {
    this.put(String(s ?? ''), x, y, w, size, bold, 'center')
  }
  /** text starting at x, vertically centred on y */
  left(s: string | number, x: number, y: number, w: number, size = 9) {
    this.put(String(s ?? ''), x, y, w, size, false, 'left')
  }
  private put(raw: string, x: number, y: number, w: number, size: number, bold: boolean, align: 'center' | 'left') {
    const s = pdfText(raw).replace(/\n+/g, ' ').trim()
    if (!s) return
    const f = bold ? this.bold : this.font
    let sz = size
    while (sz > 5 && f.widthOfTextAtSize(s, sz) > w * PX) sz -= 0.5
    const tw = f.widthOfTextAtSize(s, sz)
    const px = x * PX - (align === 'center' ? tw / 2 : 0)
    this.page.drawText(s, { x: px, y: 792 - y * PX - sz * 0.35, size: sz, font: f, color: rgb(0.08, 0.08, 0.1) })
  }
  /** wrapped text inside a box (x0, y0, x1, y1 in image px), shrinking until it fits */
  box(raw: string, x0: number, y0: number, x1: number, y1: number, size = 8.5) {
    const text = pdfText(raw).trim()
    if (!text) return
    const w = (x1 - x0) * PX
    const h = (y1 - y0) * PX
    let sz = size
    let lines: string[] = []
    for (; sz >= 4.5; sz -= 0.5) {
      lines = wrap(text, this.font, sz, w)
      if (lines.length * sz * 1.18 <= h) break
    }
    let y = 792 - y0 * PX - sz
    for (const l of lines) {
      if (y < 792 - y1 * PX) break
      this.page.drawText(l, { x: x0 * PX, y, size: sz, font: this.font, color: rgb(0.08, 0.08, 0.1) })
      y -= sz * 1.18
    }
  }
  dot(x: number, y: number, r = 9) {
    this.page.drawCircle({ x: x * PX, y: 792 - y * PX, size: r * PX, color: rgb(0.1, 0.1, 0.12) })
  }
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      const t = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(t, size) <= width) line = t
      else { if (line) out.push(line); line = word }
    }
    out.push(line)
  }
  return out
}

/** AK sheet page 1: row centre (y) of each skill / save line, in sheet order. */
const AK_ROWS: { save: AbilityKey; y: number; skills: [SkillKey, number][]; box: number }[] = [
  { save: 'str', y: 789, box: 765, skills: [['athletics', 829]] },
  { save: 'dex', y: 1073, box: 1050, skills: [['acrobatics', 1113], ['sleightOfHand', 1152], ['stealth', 1192]] },
  { save: 'con', y: 1357, box: 1332, skills: [] },
  { save: 'int', y: 1641, box: 1617, skills: [['arts', 1681], ['investigation', 1719], ['lore', 1756], ['technology', 1793]] },
  { save: 'wis', y: 1926, box: 1902, skills: [['animalHandling', 1965], ['insight', 2005], ['medicine', 2044], ['perception', 2084], ['wilderness', 2123]] },
  { save: 'cha', y: 2210, box: 2187, skills: [['deception', 2249], ['intimidation', 2289], ['performance', 2328], ['persuasion', 2368]] },
]
const ARTS_ROWS = [525, 777, 1011, 1245, 1488, 1737, 1974, 2217, 2469, 2703, 2949]

export async function akSheet(c: Character, imgs: AkImages): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`${c.name} - Arknights 5e`)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const d = sheetData(c)
  const fx = d.fx
  const addPage = async (src: string) => {
    const page = doc.addPage([612, 792])
    const img = await embedImage(doc, src)
    if (img) page.drawImage(img, { x: 0, y: 0, width: 612, height: 792 })
    return new Page(page, font, bold)
  }

  /* page 1 */
  const p = await addPage(imgs.main)
  p.center(c.name, 610, 300, 820, 20)
  p.left(c.player, 1126, 225, 440, 10); p.left(`${c.className}${c.subclass ? ` (${c.subclass})` : ''} ${c.level}`, 1610, 225, 380, 10); p.left(c.xp, 2032, 225, 330, 10)
  p.left(c.nationality, 1126, 330, 315, 10); p.left(c.species, 1474, 330, 280, 10); p.left(c.background, 1782, 330, 330, 10); p.left(c.ak.lmd ? `${c.ak.lmd.toLocaleString('en-US')}` : '', 2148, 330, 220, 10)
  p.center(signed(d.pb), 266, 556, 120, 16); p.center(c.inspiration ? '*' : '', 266, 676, 120, 18)
  for (const r of AK_ROWS) {
    const a = d.ab[r.save]
    p.center(a.score, 267, r.box + 36, 130, 13); p.center(signed(a.mod), 267, r.box + 140, 180, 24)
    const sv = d.sv[r.save]
    p.center(signed(sv.total), 497, r.y, 44, 8.5)
    if (sv.profLevel >= 1) p.dot(443, r.y + 4, 8)
    for (const [k, y] of r.skills) {
      const s = d.sk(k)
      p.center(signed(s.total), 497, y, 44, 8.5)
      if (s.profLevel >= 1) p.dot(443, y + 4, 8)
      if (s.profLevel >= 2) p.dot(810, y + 4, 8)
    }
  }
  p.center(d.passive, 266, 2497, 120, 14)
  // AC breakdown
  const acInfo = statInfo(c, 'ac', fx)
  const dex = d.ab.dex.mod
  const body = c.items.find((i) => i.armor && i.armor.kind !== 'shield' && i.slot === 'body')
  const shield = c.items.filter((i) => i.armor?.kind === 'shield' && (i.slot === 'off' || i.slot === 'main')).reduce((s, i) => s + i.armor!.ac + (i.armor!.bonus || 0), 0)
  const dexPart = body ? (body.armor!.kind === 'light' ? dex : body.armor!.kind === 'medium' ? Math.min(dex, 2) : 0) : c.ac.mode === 'unarmored' ? dex : 0
  const armorPart = body ? body.armor!.ac + (body.armor!.bonus || 0) : c.ac.mode === 'unarmored' ? 10 : acInfo.baseValue
  p.center(acInfo.total, 1000, 630, 150, 24)
  p.center(signed(dexPart), 1237, 585, 120, 12); p.center(armorPart, 1406, 585, 120, 12); p.center(shield || '', 1576, 585, 120, 12)
  p.center(acInfo.total - dexPart - armorPart - shield || '', 1747, 585, 120, 12)
  p.center(signed(d.init), 1970, 585, 200, 24); p.center(`${d.speed} ft`, 2205, 585, 280, 22)
  p.left(d.hpMax, 1240, 822, 330, 11); p.center(c.hp.current + (c.hp.temp ? ` (+${c.hp.temp})` : ''), 1270, 925, 560, 26)
  p.left(d.hdText, 1050, 1035, 180, 9); p.center(d.hdLeft, 1110, 1125, 280, 16)
  p.center(c.hp.current <= 0 || c.ak.mettle ? `${c.ak.mettle}` : '', 1430, 1110, 260, 22)
  if (c.deathSaves.failures) p.center(`${c.deathSaves.failures} failed save${c.deathSaves.failures > 1 ? 's' : ''}`, 1430, 1170, 260, 7)
  // operator skills
  const lim = spLimits(c)
  p.center(c.ak.sp, 1065, 1395, 160, 20); p.center(lim.max || '', 1480, 1395, 160, 20)
  const tierRow: Record<string, number> = { basic: 1588, advanced: 1732, elite: 1872 }
  for (const t of ['basic', 'advanced', 'elite'] as const) {
    const s = c.ak.opSkills.find((x) => x.tier === t)
    if (!s) continue
    p.left(s.name, 970, tierRow[t], 230, 9); p.center(s.spCost, 1266, tierRow[t], 90, 9); p.left(s.charging, 1342, tierRow[t], 260, 9)
  }
  // weapons
  const atkTop = [804, 1032, 1260, 1491]
  const atkLow = [915, 1146, 1374, 1602]
  d.weapons.slice(0, 4).forEach((w, i) => {
    p.left(w.name, 1726, atkTop[i] + 36, 410, 10); p.left(w.range, 2167, atkTop[i] + 36, 236, 9)
    p.left(w.notes, 1726, atkLow[i] + 33, 235, 7.5); p.center(w.bonus, 2041, atkLow[i] + 33, 125, 10); p.left(w.damage, 2131, atkLow[i] + 33, 272, 9)
  })
  if (d.weapons.length > 4) p.box(d.weapons.slice(4).map((w) => `${w.name}: ${w.bonus}, ${w.damage}`).join('\n'), 1716, 1690, 2409, 1830, 7)
  // resources
  const resRows: [number, number, number, number][] = [[930, 2121, 1425, 1480], [930, 2196, 1425, 1480], [930, 2265, 1236, 1290], [930, 2343, 1236, 1290], [930, 2418, 1044, 1098], [930, 2487, 1044, 1098]]
  c.resources.slice(0, 6).forEach((r, i) => {
    const [x0, y, x1, mx] = resRows[i]
    p.left(`${r.name}${r.die ? ` (${r.die})` : ''}`, x0 + 8, y, x1 - x0 - 16, 8); p.center(`${r.max - r.used}/${r.max}`, mx, y, 76, 8)
  })
  // features, proficiencies, equipment
  p.box(c.features.map((f) => `${f.name}${f.source ? ` (${f.source})` : ''}. ${plain(f.description)}`).join('\n\n'), 1716, 1990, 2409, 3190, 7.5)
  p.box([
    `Armour: ${d.profs('armor')}`, `Weapons: ${d.profs('weapons')}`, `Tools: ${d.profs('tools')}`, `Languages: ${d.profs('languages')}`,
    c.ak.infected ? 'Infected (Oripathy)' : '', c.ak.dr ? `Damage Reduction ${damageReduction(c, fx).total}${c.ak.drNote ? ` (${c.ak.drNote})` : ''}` : '',
    `Martial DC ${martialDc(c, fx)}`,
  ].filter(Boolean).join('\n'), 150, 2660, 830, 3190, 8)
  const attuned = c.items.filter((i) => i.attunement && i.attuned)
  p.box(c.items.filter((i) => i.qty > 0 && !(i.attunement && i.attuned)).map(d.itemLine).join(', '), 935, 2625, 1615, 2985, 8)
  ;[3030, 3104, 3176].forEach((y, i) => { if (attuned[i]) { p.left(attuned[i].name, 990, y, 620, 9); p.dot(945, y, 12) } })

  /* page 2 */
  const q = await addPage(imgs.second)
  q.center(c.name, 610, 300, 820, 20)
  q.left(c.appearance.age, 1117, 225, 440, 10); q.left(c.appearance.height, 1586, 225, 380, 10); q.left(c.appearance.weight, 1982, 225, 380, 10)
  q.left(c.appearance.eyes, 1117, 330, 440, 10); q.left(c.appearance.skin, 1586, 330, 380, 10); q.left(c.appearance.hair, 1982, 330, 380, 10)
  if (c.appearanceImage || c.portrait) {
    const img = await embedImage(doc, c.appearanceImage || c.portrait)
    if (img) {
      const bw = (850 - 135) * PX, bh = (1450 - 545) * PX
      const s = Math.min(bw / img.width, bh / img.height)
      const pg = doc.getPages()[1]
      pg.drawImage(img, { x: 135 * PX + (bw - img.width * s) / 2, y: 792 - 1450 * PX + (bh - img.height * s) / 2, width: img.width * s, height: img.height * s })
    }
  }
  const opRows = [576, 867, 1158]
  c.ak.opSkills.slice(0, 3).forEach((s, i) => {
    const y = opRows[i] + 35
    q.left(`${s.name}${s.tier !== 'other' ? ` (${s.tier})` : ''}`, 967, y, 410, 9); q.center(s.spCost, 1443, y, 86, 9); q.center(s.startSp, 1554, y, 86, 9)
    q.left(s.charging, 1630, y, 220, 9); q.left(s.activation, 1876, y, 220, 9); q.left(s.duration, 2128, y, 220, 9)
    q.box(plain(s.effect), 970, opRows[i] + 112, 2335, opRows[i] + 216, 7.5)
  })
  q.box(plain(c.story.backstory), 150, 1620, 830, 3150, 8)
  const extraOps = c.ak.opSkills.slice(3).map((s) => `${s.name} (${s.spCost} SP, ${s.activation}, ${s.duration}). ${plain(s.effect)}`)
  q.box([
    c.story.trait1 && `Personality: ${plain(c.story.trait1)}`, c.story.ideals && `Ideals: ${plain(c.story.ideals)}`,
    c.story.bonds && `Bonds: ${plain(c.story.bonds)}`, c.story.flaws && `Flaws: ${plain(c.story.flaws)}`,
    c.story.allies && `${c.story.alliesTitle}: ${plain(c.story.allies)}`, ...extraOps,
  ].filter(Boolean).join('\n\n'), 935, 1575, 2410, 2430, 8)
  q.box(c.extraNotes.map((n) => `${n.title}\n${plain(n.text)}`).join('\n\n'), 935, 2530, 2410, 3200, 8)

  /* arts pages, 11 Arts each */
  const arts = d.spellsSorted
  for (let start = 0; start === 0 || start < arts.length; start += ARTS_ROWS.length) {
    const r = await addPage(imgs.arts)
    r.center(c.ak.maxArtLevel || '', 394, 285, 400, 18); r.center(c.ak.ap.max ? `${c.ak.ap.max - c.ak.ap.used} / ${c.ak.ap.max}` : '', 847, 285, 400, 16)
    r.center(c.spellAbility ? ABBR[c.spellAbility] : '', 1303, 300, 240, 14); r.center(d.spell.dc ?? '', 1738, 300, 240, 16)
    r.center(d.spell.attack == null ? '' : signed(d.spell.attack), 2164, 300, 240, 16)
    arts.slice(start, start + ARTS_ROWS.length).forEach((s, i) => {
      const y = ARTS_ROWS[i] + 33
      r.left(s.name, 220, y, 545, 10); r.left(`${s.level === 0 ? 'Cantrip' : `Lv ${s.level}`}${s.school ? ` / ${s.school}` : ''}`, 815, y, 400, 8.5)
      r.center(s.level || '-', 1285, y, 80, 10); r.left(s.castingTime, 1358, y, 185, 8); r.left(s.range, 1580, y, 185, 8)
      r.left(s.components.replace(/\s*\(.*$/, ''), 1802, y, 130, 8); r.left(`${s.concentration ? 'C, ' : ''}${s.duration}`, 1970, y, 330, 8)
      r.left(s.notes ? plain(s.notes) : plain(s.description).slice(0, 190), 245, y + 111, 2030, 7)
    })
  }
  return doc.save()
}

