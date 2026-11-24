/*
 * The app's own printable sheet: drawn from scratch (no template, no images, nothing of anyone else's), for D&D 5e and
 * Arknights 5e. Page 1 is a fixed layout (header, combat boxes, abilities, saves and skills, attacks, resources,
 * proficiencies); everything else flows in two columns over as many pages as it needs: features, spells / Arts and
 * Operator Skills, inventory, and the character's story. "Compact" keeps descriptions short.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { ABILITIES, skillsFor } from '../constants'
import { apMax, artLevelMax, carryCapacity, damageReduction, martialDc, maxPreparedOf, resourceMax, signed, spLimits, totalWeight } from '../calc'
import { plainText } from '../rich'
import { isAK } from '../systems'
import type { Character, Spell } from '../types'
import { embedImage, pdfText, sheetData, wrap } from './export'

const W = 612
const H = 792
const M = 28
const INK = rgb(0.1, 0.1, 0.12)
const SOFT = rgb(0.42, 0.42, 0.46)
const LINE = rgb(0.62, 0.62, 0.66)
const FILL = rgb(0.93, 0.93, 0.94)

const plain = (s: string) => pdfText(plainText(s || '')).replace(/\n{3,}/g, '\n\n').trim()
const firstSentence = (s: string, max = 160) => {
  const t = plain(s).replace(/\s+/g, ' ')
  const m = /^(.{20,}?[.!?])\s/.exec(t)
  const one = m ? m[1] : t
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one
}

interface Fonts { reg: PDFFont; bold: PDFFont; ital: PDFFont }

/** single-line text, shrunk to fit its width */
function put(p: PDFPage, f: Fonts, raw: string | number, x: number, y: number, o: { size?: number; w?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: 'left' | 'center' | 'right'; italic?: boolean } = {}) {
  const s = pdfText(String(raw ?? '')).replace(/\s*\n+\s*/g, ' ').trim()
  if (!s) return
  const font = o.bold ? f.bold : o.italic ? f.ital : f.reg
  let size = o.size ?? 9
  if (o.w) while (size > 4.5 && font.widthOfTextAtSize(s, size) > o.w) size -= 0.25
  const tw = font.widthOfTextAtSize(s, size)
  const px = o.align === 'center' ? x - tw / 2 : o.align === 'right' ? x - tw : x
  p.drawText(s, { x: px, y, size, font, color: o.color ?? INK })
}

/** a box with a small label along its top edge */
function frame(p: PDFPage, f: Fonts, x: number, y: number, w: number, h: number, label = '', fill = false) {
  p.drawRectangle({ x, y, width: w, height: h, borderColor: LINE, borderWidth: 0.8, color: fill ? FILL : undefined })
  if (label) put(p, f, label.toUpperCase(), x + 4, y + h - 8, { size: 5.8, bold: true, color: SOFT, w: w - 8 })
}

/** a labelled box with one value in the middle */
function statBox(p: PDFPage, f: Fonts, x: number, y: number, w: number, h: number, label: string, value: string | number, sub = '') {
  frame(p, f, x, y, w, h, label)
  put(p, f, value, x + w / 2, y + h / 2 - (sub ? 2 : 6), { size: 15, bold: true, align: 'center', w: w - 6 })
  if (sub) put(p, f, sub, x + w / 2, y + 4, { size: 6.5, align: 'center', color: SOFT, w: w - 6 })
}

const dot = (p: PDFPage, x: number, y: number, on: number) => {
  // proficiency marker: empty, half (½ proficiency), full, double ring (expertise)
  p.drawCircle({ x, y, size: 2.6, borderColor: INK, borderWidth: 0.7, color: on >= 1 ? INK : undefined })
  if (on === 0.5) p.drawRectangle({ x: x - 2.6, y: y - 2.6, width: 2.6, height: 5.2, color: INK })
  if (on >= 2) p.drawCircle({ x, y, size: 4, borderColor: INK, borderWidth: 0.6 })
}

/**
 * Two-column flowing text over as many pages as needed. Headings keep with their first line; each entry is a bold
 * title plus wrapped body text.
 */
class Flow {
  private page!: PDFPage
  private col = 0
  private y = 0
  private readonly colW = (W - 2 * M - 16) / 2
  constructor(private doc: PDFDocument, private f: Fonts, private title: string) { this.newPage() }
  private newPage() {
    this.page = this.doc.addPage([W, H])
    put(this.page, this.f, this.title, M, H - M + 6, { size: 8, color: SOFT })
    this.col = 0
    this.y = H - M - 12
  }
  private x() { return M + this.col * (this.colW + 16) }
  /** make room for `h` points, moving to the next column / page */
  private need(h: number) {
    if (this.y - h >= M) return
    if (this.col === 0) { this.col = 1; this.y = H - M - 12 } else this.newPage()
  }
  heading(t: string, sub = '') {
    this.need(40)
    this.y -= 4
    this.page.drawRectangle({ x: this.x(), y: this.y - 13, width: this.colW, height: 15, color: INK })
    put(this.page, this.f, t.toUpperCase(), this.x() + 5, this.y - 9, { size: 8.5, bold: true, color: rgb(1, 1, 1), w: this.colW - 10 })
    if (sub) put(this.page, this.f, sub, this.x() + this.colW - 5, this.y - 9, { size: 7, color: rgb(0.85, 0.85, 0.88), align: 'right', w: this.colW / 2 })
    this.y -= 19
  }
  /** a line of small grey text (e.g. "Spell save DC 15 · Attack +7") */
  note(t: string) {
    const lines = wrap(pdfText(t), this.f.ital, 7.5, this.colW)
    for (const l of lines) { this.need(10); put(this.page, this.f, l, this.x(), this.y - 7, { size: 7.5, italic: true, color: SOFT }); this.y -= 9.5 }
    this.y -= 2
  }
  /** a bold title (with a right-hand detail) and wrapped body text */
  entry(title: string, body = '', right = '', size = 7.6) {
    const lines = body ? wrap(body, this.f.reg, size, this.colW - 4) : []
    this.need(12 + Math.min(lines.length, 2) * (size * 1.22))
    put(this.page, this.f, title, this.x(), this.y - 8, { size: 8.6, bold: true, w: right ? this.colW * 0.62 : this.colW })
    if (right) put(this.page, this.f, right, this.x() + this.colW, this.y - 8, { size: 7, color: SOFT, align: 'right', w: this.colW * 0.36 })
    this.y -= 11.5
    for (const l of lines) {
      this.need(size * 1.22)
      if (l) put(this.page, this.f, l, this.x() + 2, this.y - size + 1, { size })
      this.y -= size * 1.22
    }
    this.y -= 4
  }
  /** a table row: cells at fractions of the column width */
  row(cells: { t: string | number; at: number; w: number; bold?: boolean; align?: 'left' | 'right' | 'center' }[], rule = true) {
    this.need(12)
    for (const c of cells) {
      const x = this.x() + c.at * this.colW
      const w = c.w * this.colW
      put(this.page, this.f, c.t, c.align === 'right' ? x + w : c.align === 'center' ? x + w / 2 : x, this.y - 8, { size: 7.8, bold: c.bold, w: w - 2, align: c.align })
    }
    if (rule) this.page.drawLine({ start: { x: this.x(), y: this.y - 11 }, end: { x: this.x() + this.colW, y: this.y - 11 }, thickness: 0.3, color: LINE })
    this.y -= 12.5
  }
  gap(h = 6) { this.y -= h }
  /** a picture, scaled into the column (at most `maxH` tall) */
  async image(src: string, maxH = 220) {
    const img = await embedImage(this.doc, src)
    if (!img) return
    const s = Math.min(this.colW / img.width, maxH / img.height)
    const w = img.width * s
    const h = img.height * s
    this.need(h + 6)
    this.page.drawImage(img, { x: this.x() + (this.colW - w) / 2, y: this.y - h, width: w, height: h })
    this.y -= h + 8
  }
}

export interface AppSheetOptions { compact?: boolean }

export async function appSheet(c: Character, opts: AppSheetOptions = {}): Promise<Uint8Array> {
  const ak = isAK(c)
  const compact = !!opts.compact
  const doc = await PDFDocument.create()
  doc.setTitle(`${c.name || 'Character'}${ak ? ' - Arknights 5e' : ''}`)
  doc.setCreator('Character Sheet')
  const f: Fonts = { reg: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold), ital: await doc.embedFont(StandardFonts.HelveticaOblique) }
  const d = sheetData(c)
  const fx = d.fx
  const p = doc.addPage([W, H])

  /* ---- header ---- */
  let y = H - M
  if (ak && c.ak.codename.trim()) put(p, f, c.ak.codename.toUpperCase(), M, y - 8, { size: 8, bold: true, color: SOFT, w: 250 })
  put(p, f, c.name || 'Unnamed', M, y - 30, { size: 22, bold: true, w: 250 })
  const nick = c.nickname?.trim()
  p.drawLine({ start: { x: M, y: y - 36 }, end: { x: M + 250, y: y - 36 }, thickness: 1.2, color: INK })
  put(p, f, nick ? `CHARACTER NAME · "${nick}"` : 'CHARACTER NAME', M, y - 44, { size: 6, bold: true, color: SOFT })
  const cls = `${c.className}${c.level ? ` ${c.level}` : ''}`.trim()
  const fields: [string, string][] = ak
    ? [['Class & level', cls], [c.subclass ? 'Branch' : 'Branch', c.subclass], ['Species', c.species], ['Background', c.background], ['Nationality', c.nationality], ['Player', c.player]]
    : [['Class & level', cls], ['Subclass', c.subclass], ['Species', c.species], ['Background', c.background], ['Alignment', c.alignment], ['Player', c.player]]
  const fx0 = M + 266
  const fw = (W - M - fx0) / 3
  fields.forEach(([label, v], i) => {
    const x = fx0 + (i % 3) * fw
    const yy = y - 14 - Math.floor(i / 3) * 24
    put(p, f, v || '', x, yy, { size: 9.5, bold: true, w: fw - 8 })
    p.drawLine({ start: { x, y: yy - 3 }, end: { x: x + fw - 8, y: yy - 3 }, thickness: 0.5, color: LINE })
    put(p, f, label.toUpperCase(), x, yy - 10, { size: 5.8, bold: true, color: SOFT })
  })
  y -= 58

  /* ---- combat boxes ---- */
  const hpText = `${c.hp.current} / ${d.hpMax}`
  const boxes: [string, string | number, string?][] = [
    ['Armor Class', d.ac], ['Initiative', signed(d.init)], ['Speed', `${d.speed} ft`], ['Prof. bonus', signed(d.pb)],
    ['Hit points', hpText, c.hp.temp ? `+${c.hp.temp} temp` : ''], ['Hit dice', d.hdLeft || '-', d.hdText ? `of ${d.hdText}` : ''],
  ]
  if (ak) {
    const dr = damageReduction(c, fx).total
    boxes.push(['Dmg. reduction', dr], ['Martial DC', martialDc(c, fx)])
  } else {
    boxes.push(['Death saves', `${c.deathSaves.successes} · ${c.deathSaves.failures}`, 'saved · failed'])
    const dr = damageReduction(c, fx).total
    boxes.push(dr ? ['Dmg. reduction', dr] : ['Spell DC', d.spell.dc ?? '-'])
  }
  const bw = (W - 2 * M - (boxes.length - 1) * 5) / boxes.length
  boxes.forEach(([l, v, sub], i) => statBox(p, f, M + i * (bw + 5), y - 44, bw, 44, l, v, sub))
  y -= 54

  /* ---- abilities | saves & skills | attacks, resources, proficiencies ---- */
  const top = y
  const colA = { x: M, w: 92 }
  const colB = { x: M + 100, w: 172 }
  const colC = { x: M + 280, w: W - M - (M + 280) }
  // abilities
  const abH = (top - M - 34) / 6
  ABILITIES.forEach((a, i) => {
    const ab = d.ab[a.key]
    const by = top - (i + 1) * abH
    frame(p, f, colA.x, by + 3, colA.w, abH - 6, a.name)
    put(p, f, signed(ab.mod), colA.x + colA.w / 2, by + abH / 2 - 6, { size: 20, bold: true, align: 'center' })
    put(p, f, `score ${ab.score}`, colA.x + colA.w / 2, by + 7, { size: 7, align: 'center', color: SOFT })
  })
  // inspiration / passive perception under the abilities
  frame(p, f, colA.x, M, colA.w, 28, 'Passive Perception')
  put(p, f, d.passive, colA.x + colA.w / 2, M + 7, { size: 12, bold: true, align: 'center' })

  // saves and skills
  let sy = top - 4
  frame(p, f, colB.x, top - 6 * 12.5 - 16, colB.w, 6 * 12.5 + 16, 'Saving throws')
  sy -= 14
  for (const a of ABILITIES) {
    const sv = d.sv[a.key]
    dot(p, colB.x + 8, sy + 2.5, sv.profLevel)
    put(p, f, signed(sv.total), colB.x + 34, sy, { size: 8.5, bold: true, align: 'right' })
    put(p, f, a.name, colB.x + 40, sy, { size: 8.5 })
    sy -= 12.5
  }
  const skills = skillsFor(c.system)
  const skTop = top - 6 * 12.5 - 24
  const skH = skills.length * 12 + 20
  frame(p, f, colB.x, skTop - skH, colB.w, skH, 'Skills')
  sy = skTop - 18
  for (const s of skills) {
    const r = d.sk(s.key)
    dot(p, colB.x + 8, sy + 2.5, r.profLevel)
    put(p, f, signed(r.total), colB.x + 34, sy, { size: 8.2, bold: true, align: 'right' })
    put(p, f, s.name, colB.x + 40, sy, { size: 8.2, w: colB.w - 70 })
    put(p, f, s.ability.toUpperCase(), colB.x + colB.w - 6, sy, { size: 6.5, color: SOFT, align: 'right' })
    sy -= 12
  }
  // conditions / inspiration under the skills
  const extraY = skTop - skH - 6
  if (extraY - M > 24) {
    frame(p, f, colB.x, M, colB.w, extraY - M, 'Equipment & notes')
    const coins = ak ? (c.ak.lmd ? `${c.ak.lmd.toLocaleString('en-US')} LMD` : '') : (['pp', 'gp', 'ep', 'sp', 'cp'] as const).filter((k) => c.coins[k]).map((k) => `${c.coins[k]} ${k}`).join(', ')
    const gear = d.items.map((i) => `${i.name || 'Item'}${i.qty > 1 ? ` x${i.qty}` : ''}${i.slot ? ' (worn)' : ''}`).join(', ')
    const lines = [
      c.inspiration ? 'Heroic Inspiration' : '', c.conditions.length ? `Conditions: ${c.conditions.join(', ')}` : '',
      ak && c.ak.infection ? `Infection status: ${c.ak.infection}` : '',
      gear ? `Carrying: ${gear}` : '', coins ? `${ak ? 'Money' : 'Coins'}: ${coins}` : '',
    ].filter(Boolean)
    let size = 7.5
    const fit = () => lines.flatMap((l) => wrap(pdfText(l), f.reg, size, colB.w - 10))
    let wrapped = fit()
    while (wrapped.length * size * 1.25 > extraY - M - 20 && size > 5) { size -= 0.5; wrapped = fit() }
    let ny = extraY - 18
    for (const w of wrapped) { if (ny < M + 4) break; put(p, f, w, colB.x + 5, ny, { size }); ny -= size * 1.25 }
  }

  // attacks
  let cy = top
  const atk = d.weapons.slice(0, compact ? 6 : 8)
  const atkH = 18 + Math.max(2, atk.length) * 12.5
  frame(p, f, colC.x, cy - atkH, colC.w, atkH, 'Weapons & attacks')
  let ay = cy - 18
  put(p, f, 'NAME', colC.x + 5, ay + 1, { size: 5.5, bold: true, color: SOFT }); put(p, f, 'ATK', colC.x + colC.w * 0.5, ay + 1, { size: 5.5, bold: true, color: SOFT }); put(p, f, 'DAMAGE', colC.x + colC.w * 0.62, ay + 1, { size: 5.5, bold: true, color: SOFT })
  ay -= 11
  for (const w of atk) {
    put(p, f, w.name, colC.x + 5, ay, { size: 8.5, bold: true, w: colC.w * 0.44 })
    put(p, f, w.bonus, colC.x + colC.w * 0.5, ay, { size: 8.5, w: 30 })
    put(p, f, w.damage, colC.x + colC.w * 0.62, ay, { size: 8, w: colC.w * 0.37 })
    ay -= 12.5
  }
  cy -= atkH + 6
  // resources
  if (c.resources.length) {
    const list = c.resources.slice(0, 10)
    const rh = 20 + list.length * 13
    frame(p, f, colC.x, cy - rh, colC.w, rh, ak ? 'Resources' : 'Class resources & charges')
    let ry = cy - 20
    for (const r of list) {
      const max = resourceMax(c, r, fx)
      put(p, f, `${r.name || 'Resource'}${r.die ? ` (${r.die})` : ''}`, colC.x + 5, ry, { size: 8.2, bold: true, w: colC.w * 0.46 })
      // one box per use (ticked = used), or the number when there are many
      if (max <= 12) for (let k = 0; k < max; k++) {
        const bx = colC.x + colC.w * 0.5 + k * 9
        p.drawRectangle({ x: bx, y: ry - 1, width: 7, height: 7, borderColor: INK, borderWidth: 0.6, color: k < r.used ? INK : undefined })
      } else put(p, f, `${Math.max(0, max - r.used)} / ${max}`, colC.x + colC.w * 0.5, ry, { size: 8.5, bold: true })
      put(p, f, ({ long: 'long rest', short: 'short rest', shortOne: '1/short', dawn: 'dawn', none: '' } as Record<string, string>)[r.recharge] ?? '', colC.x + colC.w - 5, ry, { size: 6.5, color: SOFT, align: 'right' })
      ry -= 13
    }
    cy -= rh + 6
  }
  // AK: Arts Points, SP · D&D: spellcasting summary
  if (ak) {
    const lim = spLimits(c)
    const bw2 = (colC.w - 10) / 3
    statBox(p, f, colC.x, cy - 38, bw2, 38, 'Arts points', `${Math.max(0, apMax(c, fx) - c.ak.ap.used)} / ${apMax(c, fx)}`)
    statBox(p, f, colC.x + bw2 + 5, cy - 38, bw2, 38, 'Max Art level', artLevelMax(c, fx) || '-')
    statBox(p, f, colC.x + 2 * (bw2 + 5), cy - 38, bw2, 38, 'Skill points', `${c.ak.sp} / ${lim.max || '-'}`)
    cy -= 44
  } else if (c.spellAbility) {
    const bw2 = (colC.w - 10) / 3
    statBox(p, f, colC.x, cy - 38, bw2, 38, 'Spell ability', c.spellAbility.toUpperCase())
    statBox(p, f, colC.x + bw2 + 5, cy - 38, bw2, 38, 'Spell save DC', d.spell.dc ?? '-')
    statBox(p, f, colC.x + 2 * (bw2 + 5), cy - 38, bw2, 38, 'Spell attack', d.spell.attack == null ? '-' : signed(d.spell.attack))
    cy -= 44
  }
  // proficiencies & languages fill the rest
  const ph = cy - M
  if (ph > 30) {
    frame(p, f, colC.x, M, colC.w, ph, 'Proficiencies, languages & features')
    // then the names of every feature (their text follows on the next pages)
    const feats = c.features.map((x) => x.name).filter(Boolean)
    const text = [`Armor: ${d.profs('armor') || '-'}`, `Weapons: ${d.profs('weapons') || '-'}`, `Tools: ${d.profs('tools') || '-'}`, `Languages: ${d.profs('languages') || '-'}`,
      ...(feats.length ? ['', `Features & traits (details overleaf): ${feats.join(', ')}`] : [])].join('\n')
    let py = cy - 18
    let size = 8
    let lines = wrap(text, f.reg, size, colC.w - 10)
    while (lines.length * size * 1.2 > ph - 22 && size > 5) { size -= 0.5; lines = wrap(text, f.reg, size, colC.w - 10) }
    for (const l of lines) { if (py < M + 3) break; put(p, f, l, colC.x + 5, py, { size }); py -= size * 1.2 }
  }

  /* ---- the rest flows ---- */
  const flow = new Flow(doc, f, `${c.name || 'Character'}${ak ? ' · Arknights 5e' : ''}`)

  // features
  const cats: [string, string][] = [['class', ak ? 'Class & branch features' : 'Class features'], ['species', 'Species traits'], ['background', 'Background'], ['feat', 'Feats'], ['other', 'Other features'], ['buff', 'Buffs']]
  for (const [cat, title] of cats) {
    const list = c.features.filter((x) => x.category === cat)
    if (!list.length) continue
    flow.heading(title)
    for (const x of list) flow.entry(x.name || 'Feature', compact ? firstSentence(x.description) : plain(x.description), x.source)
  }

  // spells / Arts
  const spells = d.spellsSorted
  if (spells.length) {
    const word = ak ? 'Arts' : 'Spells'
    flow.heading(word, ak ? `AP ${Math.max(0, apMax(c, fx) - c.ak.ap.used)}/${apMax(c, fx)} · max level ${artLevelMax(c, fx) || '-'}` : c.spellAbility ? `DC ${d.spell.dc} · attack ${signed(d.spell.attack ?? 0)}` : '')
    if (!ak) {
      const slots = Object.entries(c.slots).filter(([, s]) => s.total > 0).map(([l, s]) => `${l}: ${s.total - s.used}/${s.total}`)
      if (slots.length) flow.note(`Spell slots (left/total) · ${slots.join('  ')}`)
      const mp = maxPreparedOf(c, fx)
      if (mp) flow.note(`Prepared ${spells.filter((s) => s.level > 0 && s.prepared && !s.alwaysPrepared).length} of ${mp}`)
    }
    let level = -1
    for (const s of spells) {
      if (s.level !== level) { level = s.level; flow.gap(2); flow.note(level === 0 ? (ak ? 'Level 0' : 'Cantrips') : `Level ${level}`) }
      flow.entry(`${spellMark(s, ak)}${s.name}`, compact ? '' : [spellLine(s), plain(s.notes) || firstSentence(s.description, 260)].filter(Boolean).join('\n'), compact ? spellLine(s) : s.school)
    }
  }

  // operator skills
  if (ak && c.ak.opSkills.length) {
    flow.heading('Operator skills', `SP ${c.ak.sp}`)
    for (const s of c.ak.opSkills) {
      flow.entry(s.name || 'Operator Skill', compact ? firstSentence(s.effect) : plain(s.effect), `${s.tier} · ${s.spCost} SP (start ${s.startSp}) · ${[s.charging, s.activation, s.duration].filter(Boolean).join(' · ')}`)
    }
  }

  // inventory
  const items = d.items
  if (items.length || !ak) {
    flow.heading('Inventory', `${totalWeight(c)} / ${carryCapacity(c, fx)} lb`)
    flow.row([{ t: 'QTY', at: 0, w: 0.1, bold: true }, { t: 'ITEM', at: 0.1, w: 0.52, bold: true }, { t: 'LB', at: 0.62, w: 0.13, bold: true, align: 'right' }, { t: 'WORTH', at: 0.77, w: 0.23, bold: true, align: 'right' }])
    for (const i of items) {
      const tags = [i.slot ? 'worn' : '', i.attunement ? (i.attuned ? 'attuned' : 'needs attunement') : ''].filter(Boolean).join(', ')
      flow.row([{ t: i.qty, at: 0, w: 0.1 }, { t: `${i.name || 'Item'}${tags ? ` (${tags})` : ''}`, at: 0.1, w: 0.52 }, { t: i.weight ? +(i.weight * i.qty).toFixed(2) : '', at: 0.62, w: 0.13, align: 'right' }, { t: i.value, at: 0.77, w: 0.23, align: 'right' }])
    }
    flow.gap(2)
    flow.note(ak ? `LMD: ${c.ak.lmd.toLocaleString('en-US')}` : `Coins: ${(['pp', 'gp', 'ep', 'sp', 'cp'] as const).filter((k) => c.coins[k]).map((k) => `${c.coins[k]} ${k}`).join(', ') || 'none'}`)
    if (!compact) for (const i of items.filter((x) => x.rarity !== 'common' || x.attunement)) if (i.description) flow.entry(i.name, firstSentence(i.description, 300))
  }

  // the character: appearance, story (only when there's something to show), allies, notes
  const looks = (['age', 'height', 'weight', 'eyes', 'skin', 'hair'] as const).filter((k) => c.appearance[k]).map((k) => `${k[0].toUpperCase()}${k.slice(1)}: ${c.appearance[k]}`)
  const story: [string, string][] = [
    ['Backstory', c.story.backstory], ['Personality', c.story.trait1], ['Ideals', c.story.ideals], ['Bonds', c.story.bonds], ['Flaws', c.story.flaws],
    ['Roleplaying', c.story.roleplay], ['Physical expression', c.story.expression],
  ]
  const pic = c.appearanceImage || c.portrait
  if (looks.length || pic || story.some(([, v]) => plain(v))) {
    flow.heading(ak ? 'Personnel file' : 'Character')
    if (looks.length) flow.note(looks.join(' · '))
    if (pic) await flow.image(pic, compact ? 150 : 240)
    for (const [t, v] of story) if (plain(v)) flow.entry(t, compact ? firstSentence(v, 400) : plain(v))
  }
  if (c.factions.some((x) => x.name || plain(x.notes))) {
    flow.heading(c.story.alliesTitle || 'Allies & organizations')
    for (const x of c.factions) flow.entry(x.name || 'Faction', compact ? firstSentence(x.notes) : plain(x.notes))
  }
  for (const n of c.extraNotes) if (plain(n.text)) flow.entry(n.title || 'Notes', compact ? firstSentence(n.text, 400) : plain(n.text))

  return doc.save()
}

/** "* " for prepared / always-prepared spells (not for Arts, which are always ready) */
const spellMark = (s: Spell, ak: boolean) => (!ak && s.level > 0 && (s.prepared || s.alwaysPrepared) ? '* ' : '')

const spellLine = (s: Spell) =>
  [s.castingTime, s.range, s.duration ? `${s.concentration ? 'C, ' : ''}${s.duration}` : s.concentration ? 'Concentration' : '', s.ritual ? 'ritual' : '', s.components.replace(/\s*\(.*$/, '')]
    .filter(Boolean).join(' · ')
