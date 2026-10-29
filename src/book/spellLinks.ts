import { allLib, nameKey, type LibSpell } from '../spellLib'
import { useStore } from '../store'

/*
 * Spell / Art names in the sourcebooks become links that open the spell, so an Arts pool or a class's spell list can be
 * read without leaving the book. A name only counts where it's clearly being used as one: in a comma list or table
 * cell ("Acid Splash, Acid Surge"), standing alone in a column, or followed by "Art" / "spell" ("the Detect Magic Art").
 * That keeps "Light Shields", "Shield" in a sentence, "Command" and the like from lighting up everywhere.
 */

/** spelling the book uses vs the library's (British spelling, a few run-together names) */
const key = (s: string) => nameKey(s).replace(/armour/g, 'armor').replace(/\bstone skin\b/, 'stoneskin').replace(/\bwitchbolt\b/, 'witch bolt').replace(/\bfirestorm\b/, 'fire storm')
/** names the book writes differently, matched word by word on the page (book → library) */
const ALIASES: Record<string, string> = { 'melting mines': 'melting mine', 'stone skin': 'stoneskin', witchbolt: 'witch bolt', firestorm: 'fire storm' }

interface Entry { words: string[]; lib: LibSpell }
let cache: { size: number; ak: boolean; byFirst: Map<string, Entry[]>; byKey: Map<string, LibSpell> } | null = null

function index() {
  const lib = allLib()
  const st = useStore.getState()
  const ak = st.chars[st.activeId]?.system === 'ak5e'
  if (cache && cache.size === lib.length && cache.ak === ak) return cache
  const byFirst = new Map<string, Entry[]>()
  const byKey = new Map<string, LibSpell>()
  // full text wins over a name-only entry; on an Arknights sheet the book's own version of an Art, else 2024 over 2014
  const rank = (s: LibSpell) => (s.stub ? 9 : s.e === 'Custom' ? -1 : ak && s.e === 'AK5e' ? -0.5 : s.e === '2024' ? 0 : s.e === 'UA' || s.e === 'AK5e' ? 1 : 2)
  for (const s of [...lib].sort((a, b) => rank(a) - rank(b))) {
    const k = key(s.n)
    if (!k || byKey.has(k)) continue
    byKey.set(k, s)
    const words = k.split(' ')
    if (!byFirst.has(words[0])) byFirst.set(words[0], [])
    byFirst.get(words[0])!.push({ words, lib: s })
  }
  for (const [from, to] of Object.entries(ALIASES)) {
    const s = byKey.get(to)
    if (!s) continue
    const words = from.split(' ')
    if (!byFirst.has(words[0])) byFirst.set(words[0], [])
    byFirst.get(words[0])!.push({ words, lib: s })
  }
  for (const list of byFirst.values()) list.sort((a, b) => b.words.length - a.words.length)
  cache = { size: lib.length, ak, byFirst, byKey }
  return cache
}

/** the library spell a piece of text names exactly, if any */
export function spellNamed(text: string): LibSpell | undefined {
  return index().byKey.get(key(text.replace(/[*_]/g, '')))
}

const LEVEL_WORD = /^(cantrips?|\d+(st|nd|rd|th)|level|-|—|\|)$/i
const SMALL = new Set(['of', 'and', 'the', 'from', 'to', 'with', 'a', 'into', 'on', 'in', 'or'])
const titleCase = (raw: string, i: number) => /^[*_("“']*[A-Z0-9]/.test(raw) || (i > 0 && SMALL.has(raw.toLowerCase().replace(/[^a-z]/g, '')))

export interface WordRun { i0: number; i1: number; spell: LibSpell }

/**
 * Spell names in one line of words (in reading order). gapBefore / gapAfter say whether there's a column gap
 * around a word (page images); text mode leaves them out.
 */
export function findSpells(raw: string[], gap?: { before: (i: number) => boolean; after: (i: number) => boolean }): WordRun[] {
  const { byFirst } = index()
  const norm = raw.map((w) => key(w))
  const out: WordRun[] = []
  for (let i = 0; i < raw.length; i++) {
    // "Tasha's Caustic Brew": the library files it as Caustic Brew, so the owner's name is a prefix to the match
    const owner = /^[*_]*[A-Z][a-z]+['’]s$/.test(raw[i]) ? 1 : 0
    const s0 = i + owner
    if (s0 >= raw.length) continue
    const first = norm[s0].split(' ')[0]
    const cands = first ? byFirst.get(first) : undefined
    if (!cands) continue
    for (const c of cands) {
      // the candidate's words, matched against the line (a word like "Snilloc's" may hold two of them after nameKey)
      let j = s0
      let k = 0
      const got: string[] = []
      while (k < c.words.length && j < raw.length) {
        const parts = norm[j].split(' ').filter(Boolean)
        if (!parts.length) break
        got.push(...parts)
        k = got.length
        j++
      }
      if (got.join(' ') !== c.words.join(' ')) continue
      const i1 = j - 1
      // the owner's name has to be the spell's own ("Tasha's Caustic Brew", not "Dragon's" + Rage)
      if (owner && !c.lib.n.toLowerCase().replace(/’/g, "'").startsWith(raw[i].replace(/[*_]/g, '').toLowerCase().replace(/’/g, "'"))) continue
      if (![...Array(i1 - s0 + 1)].every((_, n) => titleCase(raw[s0 + n], n))) continue
      const prevRaw = raw[i - 1] ?? ''
      const nextRaw = raw[i1 + 1] ?? ''
      // "you learn the Detect Magic Art", "cast the Light cantrip"
      const learnThe = /^the$/i.test(prevRaw) && /^(learn|learns|know|knows|cast|casts|casting|gain|prepare)$/i.test(raw[i - 2] ?? '')
      const startOk = i === 0 || /[,;:|]$/.test(prevRaw) || LEVEL_WORD.test(prevRaw) || learnThe || !!gap?.before(i)
      // (not a full stop: "Darkvision. You can see…" is a feature's run-in heading)
      const endOk = i1 === raw.length - 1 || /[,;|)]$|\*\*$/.test(raw[i1]) || /^[,;|(]/.test(nextRaw) || /^(and|or)$/i.test(nextRaw) || !!gap?.after(i1)
      const nextIsArt = /^(art|arts|spell|spells|cantrip)[,.;:)]?$/i.test(nextRaw)
      if ((startOk && endOk) || nextIsArt) {
        out.push({ i0: i, i1, spell: c.lib })
        i = i1
        break
      }
    }
  }
  return out
}

/** text view: turn spell names in the rendered section into links (data-spell holds the library name) */
export function linkSpells(root: Element) {
  const doc = root.ownerDocument
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text
    if (t.parentElement?.closest('a, .bk-spell, h1, h2, h3, h4, h5, code')) continue
    if (/[A-Z]/.test(t.data)) nodes.push(t)
  }
  for (const t of nodes) {
    // a bold Art name in a table cell is its own text node: "**Acid Surge**", between commas
    const parent = t.parentElement
    if (parent && /^(STRONG|B|EM|I)$/.test(parent.tagName) && parent.textContent === t.data) {
      const s = spellNamed(t.data.trim())
      const inList = parent.closest('td, li') || /,\s*$/.test(parent.previousSibling?.textContent ?? '') || /^\s*[,.]/.test(parent.nextSibling?.textContent ?? '')
      const art = /^\s*Arts?\b/.test(parent.nextSibling?.textContent ?? '') && !/^\s*Arts\b/.test(parent.nextSibling?.textContent ?? '')
      if (s && (inList || art)) { wrap(doc, t, 0, t.data.length, s); continue }
    }
    const inCell = !!t.parentElement?.closest('td, li')
    const tokens = [...t.data.matchAll(/\S+/g)]
    if (!tokens.length) continue
    const raw = tokens.map((m) => m[0])
    // a whole table cell is its own list item
    const runs = findSpells(raw, inCell ? { before: (i) => i === 0, after: (i) => i === raw.length - 1 } : undefined)
    for (const r of runs.reverse()) {
      const a = tokens[r.i0].index!
      const lastTok = tokens[r.i1]
      const end = lastTok.index! + lastTok[0].replace(/[,;.:)*]+$/, '').length
      wrap(doc, t, a + (/^[("“*]+/.exec(tokens[r.i0][0])?.[0].length ?? 0), end, r.spell)
    }
  }
}

function wrap(doc: Document, t: Text, from: number, to: number, s: LibSpell) {
  const range = doc.createRange()
  range.setStart(t, from)
  range.setEnd(t, to)
  const a = doc.createElement('span')
  a.className = 'bk-spell'
  a.setAttribute('data-spell', s.n)
  a.setAttribute('role', 'link')
  a.title = `${s.n}: click to read it`
  range.surroundContents(a)
}
