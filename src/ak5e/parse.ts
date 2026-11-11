/*
 * The Arknights 5e homebrew (homebrewery.naturalcrit.com), read from its markdown source into what the sheet uses:
 * Arts pools and the new Arts, Operator Skill tables, the Equipment chapter, and classes / branches / species /
 * nationalities / backgrounds for filling in features. The app downloads the book onto your own computer the first
 * time it's needed, so none of the book's text ships with the app.
 *
 * A port of tools/import_ak5e.py + tools/ak_rules.py: keep the two in step (tools/check_ak5e_port compares them).
 */

export const AK5E_SOURCE_URL = 'https://homebrewery.naturalcrit.com/source/mt8mcG6iRDbv'
/** bumped when reading the book improves: a book already downloaded is read again (from the copy on this computer) */
export const AK5E_PARSE_VERSION = 2
const BOOK = 'Arknights 5e'

/* ---------- small helpers that behave like Python's string methods ---------- */

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** str.strip(chars) */
function strip(s: string, chars?: string): string {
  if (chars === undefined) return s.trim()
  const set = `[${esc(chars)}]+`
  return s.replace(new RegExp(`^${set}|${set}$`, 'g'), '')
}
/** text up to the first match (re.split(pattern, s, maxsplit=1)[0]) */
function before(s: string, re: RegExp): string {
  const m = re.exec(s)
  return m ? s.slice(0, m.index) : s
}
/** str.index: throws when missing, like Python */
function index(s: string, sub: string, from = 0): number {
  const i = s.indexOf(sub, from)
  if (i < 0) throw new Error(`"${sub}" not found in the book`)
  return i
}
const splitLines = (s: string) => s.split(/\r\n|\n|\r/).filter((l, i, a) => !(i === a.length - 1 && l === ''))
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean)
const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s)
const isDigits = (s: string) => /^\d+$/.test(s)

/** Homebrewery markdown → plain text the sheet can show. */
export function plain(s: string): string {
  s = s.replace(/<[^>]+>/g, '')
  s = s.replace(/\{\{[^\n}]*\n?|\}\}/g, '')
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  s = s.split('\\column').join('').split('\\page').join('')
  s = s.replace(/\*\*\*?([^*]+)\*\*\*?/g, '$1')
  s = s.replace(/(?<![\p{L}\p{N}_])\*([^*\n]+)\*(?![\p{L}\p{N}_])/gu, '$1')
  s = s.replace(/^:+\s*$/gm, '')
  s = s.replace(/^#+\s*/gm, '')
  s = s.replace(/[ \t]+\n/g, '\n')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

const cells = (row: string) => strip(row.trim(), '|').split('|').map((c) => c.trim())

function chapter(src: string, title: string, nxt: string): string {
  const a = index(src, '# ' + title)
  return src.slice(a, index(src, '# ' + nxt, a))
}

const LEVELS: Record<string, number> = { cantrip: 0, '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5, '6th': 6, '7th': 7, '8th': 8, '9th': 9 }

/** pool spellings → the name the SRD library uses */
const ALIASES: Record<string, string> = {
  'mage armour': 'Mage Armor', firestorm: 'Fire Storm', 'stone skin': 'Stoneskin', 'create/destroy water': 'Create or Destroy Water',
  'purify food/drink': 'Purify Food and Drink', witchbolt: 'Witch Bolt', "maximillian's earthen grasp": "Maximilian's Earthen Grasp",
  "rime's binding ice": "Rime's Binding Ice", "abi-dalzim's horrid wilting": "Abi-Dalzim's Horrid Wilting", 'melting mines': 'Melting Mine',
  'spirit shroud (necrotic only)': 'Spirit Shroud',
}

/* ---------- Chapter 5: Arts ---------- */

type PoolRow = { n: string; s: string; special: string; new?: boolean }

function artsPools(ch5: string): Record<string, Record<string, PoolRow[]>> {
  const pools: Record<string, Record<string, PoolRow[]>> = {}
  for (const m of ch5.matchAll(/^#### ([A-Z][\w' ]+ Arts)\s*$/gm)) {
    const body = before(ch5.slice(m.index! + m[0].length), /^#{1,4} /m)
    const t = /\|\s*Arts Level\s*\|.*?\n\|[-:| ]+\|\n((?:\|.*\n?)+)/.exec(body)
    if (!t) continue
    const levels: Record<string, PoolRow[]> = {}
    for (const row of splitLines(t[1])) {
      const c = cells(row)
      if (c.length < 2 || !(c[0].toLowerCase() in LEVELS)) continue
      const names: PoolRow[] = []
      for (const raw of c[1].split(/,(?![^()]*\))/)) {
        let n = raw.trim()
        if (!n || n === '-') continue
        const isNew = n.startsWith('**')
        n = strip(n, '* ').replace(/’/g, "'")
        n = ALIASES[n.toLowerCase()] ?? n
        names.push({ n, s: '', special: '', new: isNew })
      }
      levels[String(LEVELS[c[0].toLowerCase()])] = names
    }
    if (Object.keys(levels).length) pools[m[1]] = levels
  }
  return pools
}

function newArts(ch5: string) {
  const sec = ch5.slice(index(ch5, '## New Art Descriptions'))
  const out = []
  for (const b of sec.split(/^#### /m).slice(1)) {
    const nl = b.indexOf('\n')
    const name = (nl < 0 ? b : b.slice(0, nl)).trim().replace(/’/g, "'")
    const rest = nl < 0 ? '' : b.slice(nl + 1)
    const head = /^\*([^*\n]+)\*\s*$/m.exec(rest)
    if (!head) continue
    const kind = head[1].trim()
    const lv = kind.toLowerCase().includes('cantrip') ? 0 : parseInt(/^(\d)/.exec(kind)?.[1] ?? '0') || 0
    let school = strip(kind.replace(/(cantrip|\d\w*[- ]level)/gi, ''), ' -')
    school = school ? capitalize(words(school)[0]) : ''
    const field = (k: string) => (new RegExp(`\\*\\*${k}:\\*\\*\\s*:*\\s*(.+)`).exec(rest)?.[1] ?? '').trim()
    const dm = /\*\*Duration:\*\*[^\n]*\n/.exec(rest)
    let text = dm ? rest.slice(dm.index + dm[0].length) : rest
    text = plain(text.replace(/\[Credit\]\([^)]*\)/g, '')).replace(/^\s*Credit\s*$/gm, '').trim()
    const dur = field('Duration')
    out.push({
      n: name, l: lv, s: school, ct: field('Casting Time'), r: field('Range'), c: field('Components'),
      d: dur, co: dur.toLowerCase().startsWith('concentration'), ri: kind.toLowerCase().includes('ritual'), m: false,
      cl: [] as string[], e: 'AK5e', t: text,
    })
  }
  return out
}

/* ---------- Operator Skills ---------- */

const TIER: Record<string, string> = { basic: 'basic', advanced: 'advanced', elite: 'elite' }

function operatorSkills(src: string) {
  const out = []
  const pat = /^##### (.+?) Skills(?: Continued)?\s*\n\|\s*Name\s*\|\s*SP Cost.*\n\|[-:| ]+\|\n((?:\|.*\n?)+)/gm
  const num = (s: string) => parseInt(s.replace(/\D/g, '') || '0')
  for (const m of src.matchAll(pat)) {
    const ws = words(m[1])
    const tier = ws.map((w) => TIER[w.toLowerCase()]).find(Boolean) ?? ''
    const owner = ws.filter((w) => !(w.toLowerCase() in TIER)).join(' ')
    for (const row of splitLines(m[2])) {
      const c = cells(row)
      if (c.length < 7 || !c[0]) continue
      out.push({ n: c[0].replace(/’/g, "'"), cls: owner, tier, sp: num(c[1]), start: num(c[2]), charge: c[3], act: c[4], t: plain(c[5]), dur: c[6] })
    }
  }
  return out
}

/* ---------- Chapter 4: Equipment ---------- */

const lb = (s: string) => { const m = /([\d.]+)\s*lb/.exec(s || ''); return m ? parseFloat(m[1]) : 0 }

/** data rows of the first markdown table in block (skips the header and |:---| line) */
function tableRows(block: string): string[][] {
  const rows: string[][] = []
  for (const line of splitLines(block)) {
    if (!line.startsWith('|') || /^\|[\s:|-]+\|?\s*$/.test(line)) continue
    rows.push(cells(line))
  }
  return rows.slice(1)
}

function section(src: string, start: string, end: string): string {
  const a = index(src, start)
  return src.slice(a, index(src, end, a + start.length))
}

/** '#### Name' blocks → {name: plain text} */
function described(block: string, level = '####'): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of block.split(new RegExp(`^${level} `, 'm')).slice(1)) {
    const nl = part.indexOf('\n')
    const name = nl < 0 ? part : part.slice(0, nl)
    const body = before(nl < 0 ? '' : part.slice(nl + 1), /^#{1,4} /m)
    out[name.trim().replace(/’/g, "'")] = plain(body)
  }
  return out
}

const RARITIES = ['very rare', 'uncommon', 'common', 'rare', 'legendary', 'artifact']

function equipment(src: string) {
  const ch4 = chapter(src, 'Chapter 4: Equipment', 'Chapter 5')
  const weapons = []
  for (const title of ['##### Melee Weapons', '##### Ranged Weapons']) {
    let cat = ''
    for (const c of tableRows(section(ch4, title, '\\page'))) {
      if (c.length === 1 || (c[0].startsWith('*') && c.length < 3)) { cat = strip(c[0], '* '); continue }
      if (c.length < 5) continue
      const name = strip(c[0].split('&emsp;').join(''), ' *')
      const dmg = /(\S+)\s+(\w+)/.exec(c[1])
      const props = c[2].trim()
      const rng = /(?:Range|Thrown)\s*\(([^)]+)\)/.exec(props)
      weapons.push({ n: name, damage: dmg ? dmg[1] : c[1], type: dmg ? dmg[2].toLowerCase() : '', props, range: rng ? rng[1] : '', cat, w: lb(c[3]), c: c[4].split('*').join('').trim() })
    }
  }
  const armour = []
  let cat = ''
  for (const c of tableRows(section(ch4, '| Name | Armour Class', '##### Bastion'))) {
    if (c.length === 1 || (c[0].startsWith('*') && c.length < 3)) { cat = strip(c[0], '* ').toLowerCase(); continue }
    if (c.length < 7) continue
    const name = strip(c[0].split('&emsp;').join(''), ' *')
    const acText = c[1]
    const base = /\d+/.test(acText) ? parseInt(/\d+/.exec(acText)![0]) : 0
    let kind: string, dexMax: number | null
    if (cat.includes('shield')) { kind = 'shield'; dexMax = 0 }
    else if (acText.toLowerCase().includes('max 2')) { kind = 'medium'; dexMax = 2 }
    else if (acText.toLowerCase().includes('dex')) { kind = 'light'; dexMax = null }
    else { kind = 'heavy'; dexMax = 0 }
    void dexMax
    const drm = /^(\d+)\s*(?:\(([^)]+)\))?/.exec(c[2])
    armour.push({
      n: name, kind, cat, ac: base, dr: drm ? parseInt(drm[1]) : 0, drType: drm ? drm[2] ?? '' : '', str: isDigits(c[3]) ? parseInt(c[3]) : 0,
      special: c[4] === '-' ? '' : c[4], w: lb(c[5]), c: c[6].split('*').join('').trim(),
    })
  }
  let props = described(section(ch4, '### New Properties', '## Armour'))
  const bastion = /##### Bastion Special Property\n([\s\S]+?)\n\s*\n/.exec(ch4)
  if (bastion) props.Bastion = plain(bastion[1])
  // "Conductive (X)" → "Conductive"
  props = Object.fromEntries(Object.entries(props).map(([k, v]) => [k.replace(/\s*\(.*\)$/, ''), v]))

  const items = []
  const tools = section(ch4, '## Toolkits and other Equipment', '## Adventuring Gear')
  const toolDesc = described(tools)
  for (const c of tableRows(section(tools, '| Toolkit |', '\n\n'))) {
    if (c.length < 3) continue
    const n = c[0].trim()
    // the table says "Makeup Kit", its write-up is headed "Makeover Kit"
    const desc = toolDesc[n] || toolDesc[n.replace('Makeup', 'Makeover')] || ''
    items.push({ n, k: 'Tool', d: desc + (c.length > 3 && c[3] !== '' && c[3] !== 'N/A' ? `\n\nRefill cost: ${c[3]}` : ''), w: lb(c[1]), c: c[2], r: 'common', a: false, m: false, e: 'AK5e' })
  }
  const instDesc = toolDesc['Instrument (X)'] ?? ''
  for (const c of tableRows(section(tools, '| Instrument |', '\n\n'))) {
    if (c.length >= 3) items.push({ n: c[0].trim(), k: 'Tool', d: instDesc, w: lb(c[1]), c: c[2], r: 'common', a: false, m: false, e: 'AK5e' })
  }
  const gear = section(ch4, '## Adventuring Gear', '## Magic Items')
  const gearDesc = described(gear)
  for (const c of tableRows(section(gear, '| Gear |', '\n\n'))) {
    if (c.length < 3) continue
    const n = c[0].trim()
    items.push({ n, k: 'Gear', d: gearDesc[n] ?? '', w: lb(c[1]), c: c[2], r: 'common', a: false, m: false, e: 'AK5e' })
  }
  const magic = ch4.slice(index(ch4, '## Magic Items'))
  for (const part of magic.split(/^#### /m).slice(1)) {
    const nl = part.indexOf('\n')
    const name = nl < 0 ? part : part.slice(0, nl)
    const body = nl < 0 ? '' : part.slice(nl + 1)
    const head = /^\*([^*\n]+)\*/.exec(body.trim())
    if (!head) continue
    const low = head[1].toLowerCase()
    const rarity = RARITIES.find((r) => low.includes(r)) ?? 'rare'
    const text = before(body, /^#{1,4} /m)
    items.push({
      n: name.trim().replace(/’/g, "'"), k: low.startsWith('weapon') ? 'Weapon' : low.startsWith('armo') ? 'Armor' : 'Wondrous',
      d: plain(text), w: 0, c: '', r: rarity, a: low.includes('attunement'), m: true, e: 'AK5e',
    })
  }
  return { weapons, armour, properties: props, items }
}

/* ---------- Chapters 2 & 3: classes, species, nationalities, backgrounds ---------- */

const CLASSES = ['Caster', 'Defender', 'Guard', 'Marksman', 'Medic', 'Specialist', 'Supporter', 'Vanguard']
const LEVEL_H = /^#### (?:(\d+)(?:st|nd|rd|th) Level|Level (\d+)): *(.+?)\s*$/gm
const LEVEL_STOP = String.raw`^#### (?:\d+(?:st|nd|rd|th) Level|Level \d+)`

function boldField(block: string, name: string): string {
  const m = new RegExp(String.raw`\*\*\*?` + name + String.raw`:?\*\*\*?:?\s*(.*)`).exec(block)
  return m ? m[1].replace(/<br>\s*$/, '').trim() : ''
}

function levelFeatures(block: string, stop: string) {
  const out = []
  for (const m of block.matchAll(LEVEL_H)) {
    const rest = block.slice(m.index! + m[0].length)
    const body = before(rest, new RegExp(stop, 'm'))
    const name = m[3].replace(/\s*\(.*?\)\s*$/, '').trim()
    out.push({ level: parseInt(m[1] || m[2]), name, text: plain(body) })
  }
  return out
}

function table(block: string) {
  const m = /^##### [^\n]*\n(\| *Level *\|[^\n]*\n)\|[\s:|-]+\|?\s*\n((?:\|[^\n]*\n)+)/m.exec(block)
  if (!m) return null
  const cols = strip(m[1].trim(), '|').split('|').map((c) => c.trim())
  const rows: Record<string, string[]> = {}
  for (const line of splitLines(m[2])) {
    const cs = strip(line.trim(), '|').split('|').map((c) => c.trim())
    const lv = /^(\d+)/.exec(cs[0])
    if (lv) {
      cs[0] = lv[1]
      rows[lv[1]] = [...cs, ...Array(Math.max(0, cols.length - cs.length)).fill('')]
    }
  }
  return { columns: cols, rows }
}

function classes(src: string) {
  const ch = src.slice(index(src, '# Chapter 3'), index(src, '# Chapter 4'))
  const out = []
  for (const name of CLASSES) {
    const others = CLASSES.filter((c) => c !== name).join('|')
    const a = new RegExp(`^## ${name}\\s*$`, 'm').exec(ch)
    if (!a) continue
    const b = new RegExp(`^## (?:${others})\\s*$`, 'm').exec(ch.slice(a.index + a[0].length))
    const sec = ch.slice(a.index, b ? a.index + a[0].length + b.index : ch.length)
    // branch names come from the 1st-level Branch feature's list
    const bm = /^#### 1st Level: *\w+ Branch\s*\n([\s\S]*?)(?=^#{2,4} )/m.exec(sec)
    const branchNames = bm ? [...bm[1].matchAll(/^\s*- \*\*([^*:]+):?\*\*/gm)].map((x) => x[1].trim()) : []
    const heads = [...sec.matchAll(/^### (.+?)\s*$/gm)].map((x) => ({ p: x.index!, n: x[1].trim() }))
    // "Infuser" heads the Infusion branch; a heading has to be a single name to count ("Hunters, Assassins…" isn't)
    const same = (n: string, b: string) => n === b || (words(n)[0].slice(0, 5).toLowerCase() === b.slice(0, 5).toLowerCase() && words(n).length === words(b).length && !n.includes(','))
    const starts = heads.filter((h) => branchNames.some((b) => same(h.n, b))).map((h) => ({ p: h.p, n: branchNames.find((b) => same(h.n, b))! }))
    const core = sec.slice(0, starts.length ? starts[0].p : sec.length)
    const feats = levelFeatures(core, String.raw`^#{2,4} |^##### .*(?:Skills|Talents)\s*$`)
    const branches = starts.map(({ p, n }) => {
      const stop = Math.min(...starts.map((s) => s.p).filter((q) => q > p), sec.length)
      return { name: n, table: table(sec.slice(p, stop)), features: levelFeatures(sec.slice(p, stop), String.raw`^#{2,3} |` + LEVEL_STOP) }
    })
    const hp = /\*\*Hit Dice:\*\*\s*1?d(\d+)/.exec(core)
    out.push({
      name, table: table(core), hitDie: hp ? parseInt(hp[1]) : 0,
      armor: boldField(core, 'Armou?r'), weapons: boldField(core, 'Weapons'), tools: boldField(core, 'Tools'),
      saves: boldField(core, 'Saving Throws'), skills: boldField(core, 'Skills'), features: feats, branches,
    })
  }
  return out
}

function h5Features(block: string) {
  return block.split(/^##### /m).slice(1).map((part) => {
    const nl = part.indexOf('\n')
    return { name: (nl < 0 ? part : part.slice(0, nl)).trim(), text: plain(nl < 0 ? '' : part.slice(nl + 1)) }
  })
}

/** each '### Name' heading's block, to the next one */
function headBlocks(ch: string) {
  // a summon's stat block has its own "### Actions" / "### Reactions": those belong to the species around them
  // (Gargoyle's To Speak with Stone comes after its Earthen Golem stat block)
  const heads = [...ch.matchAll(/^### (.+?)\s*$/gm)].filter((m) => !/^(Bonus |Legendary )?(Actions|Reactions)$/i.test(m[1].trim()))
  return heads.map((m, i) => ({ name: m[1].trim(), block: ch.slice(m.index! + m[0].length, i + 1 < heads.length ? heads[i + 1].index : ch.length) }))
}

function species(src: string) {
  const ch = src.slice(index(src, '## Species'), index(src, '## Nationality'))
  const out = []
  let parent: string | null = null
  for (const { name, block } of headBlocks(ch)) {
    const t = /^#### [^\n]*Traits\s*$/m.exec(block)
    const f = /^#### [^\n]*Features\s*$/m.exec(block)
    if (!t && !f) continue
    const traits = t ? block.slice(t.index + t[0].length, f && f.index > t.index ? f.index : block.length) : ''
    const size = boldField(traits, 'Size')
    const speed = boldField(traits, 'Speed')
    const entry: { name: string; size: string; speed: string; asi: string; features: { name: string; text: string }[]; parent?: string } = {
      name, size: plain(size), speed: plain(speed), asi: plain(boldField(traits, 'Ability Score Improvement')),
      features: f ? h5Features(block.slice(f.index + f[0].length)) : [],
    }
    if (size) parent = entry.name
    else if (parent) entry.parent = parent
    out.push(entry)
  }
  return out
}

/** '***Nationality Feat (Name):*** text…' → {name, text} (text runs to the next heading or ***field***) */
function namedFeat(block: string, label: string) {
  const m = new RegExp(String.raw`\*\*\*` + label + String.raw` \(([^)]+)\):\*\*\*([\s\S]*?)(?=^#{1,5} |\n\*\*\*|(?![\s\S]))`, 'm').exec(block)
  return m ? { name: m[1].trim(), text: plain(m[2]) } : null
}

function choices(block: string, label: string): [string, string[]] {
  const m = new RegExp(String.raw`\*\*\*` + label + String.raw`:\*\*\*\s*([\s\S]*?)\n((?:\s*- [^\n]*\n)*)`).exec(block)
  if (!m) return ['', []]
  return [plain(m[1]), [...m[2].matchAll(/^\s*- (.+)$/gm)].map((x) => x[1].trim())]
}

function nationalities(src: string) {
  const ch = src.slice(index(src, '## Nationality'), index(src, '## Background'))
  const out = []
  for (const { name, block } of headBlocks(ch)) {
    if (!/^#### [^\n]*Features/m.test(block)) continue
    const languages = plain(boldField(block, 'Languages'))
    const [proficiencies, profChoices] = choices(block, 'Proficiencies')
    const bm = /^##### Unique Background \(([^)]+)\):?\s*\n([\s\S]*)/m.exec(block)
    let background = null
    if (bm) {
      const body = bm[2]
      background = { name: bm[1].trim(), text: plain(body.split('***')[0]), proficiencies: plain(boldField(body, 'Proficiencies')), feat: namedFeat(body, 'Background Feat') }
    }
    const natBlock = bm ? block.slice(0, bm.index) : block
    out.push({ name, languages, proficiencies, profChoices, feat: namedFeat(natBlock, 'Nationality Feat'), background })
  }
  return out
}

function backgrounds(src: string) {
  const ch = src.slice(index(src, '## Background'), index(src, '# Chapter 3'))
  const out = []
  for (const { name, block } of headBlocks(ch)) {
    const feat = namedFeat(block, 'Background Feat')
    if (!feat) continue
    out.push({ name, text: plain(block.split('***')[0]), proficiencies: plain(boldField(block, 'Proficiencies')), feat })
  }
  return out
}

/* ---------- everything ---------- */

/** the markdown inside Homebrewery's /source/ page (or the text itself, if it's already markdown) */
export function sourceFromPage(page: string): string {
  const m = /<pre[^>]*>([\s\S]*)<\/pre>/.exec(page)
  if (!m) return page.replace(/\r\n/g, '\n')
  const t = document.createElement('textarea')
  t.innerHTML = m[1]
  return t.value.replace(/\r\n/g, '\n')
}

/** the book's markdown → the data file the sheet loads (same shape as tools/import_ak5e.py writes) */
export function parseAk5e(src: string) {
  const ch5 = chapter(src, 'Chapter 5: Arts', 'Chapter 6')
  const pools = artsPools(ch5)
  const spells = newArts(ch5)
  for (const levels of Object.values(pools)) for (const rows of Object.values(levels)) for (const r of rows) delete r.new
  return {
    source: BOOK, system: 'ak5e', version: AK5E_PARSE_VERSION, spells, classLists: pools, opSkills: operatorSkills(src), gear: equipment(src),
    rules: { classes: classes(src), species: species(src), nationalities: nationalities(src), backgrounds: backgrounds(src) },
  }
}
