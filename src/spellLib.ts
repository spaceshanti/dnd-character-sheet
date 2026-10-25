import raw from './data/spells.json'
import { isConsumed, newSpell, uid } from './blank'
import type { CustomSpell, Spell } from './types'
import { useStore } from './store'

export interface LibSpell {
  n: string
  l: number
  s: string
  ct: string
  r: string
  c: string
  d: string
  co: boolean
  ri: boolean
  cl: string[]
  /** '2014' | '2024' SRD, or 'UA' for spells imported from a PDF */
  e: string
  t: string
  /** material component flagged as specific / costly by the source */
  m?: boolean
  /** name-only entry from an imported class list (no description available) */
  stub?: boolean
  /** where an imported spell came from */
  src?: string
  /** set for your own library spells */
  id?: string
}

/** Files written by tools/import_ua_spells.py */
interface ExtraFile {
  source: string
  spells: LibSpell[]
  classLists: Record<string, Record<string, { n: string; s: string; special: string }[]>>
}

/** Match names regardless of apostrophe style or the SRD dropping "Tasha's" etc. */
export const nameKey = (n: string) =>
  n.toLowerCase().replace(/[’`]/g, "'").replace(/^[a-z]+'s\s+/, '').replace(/[^a-z0-9/]+/g, ' ').trim()

function buildLibrary(): LibSpell[] {
  const lib: LibSpell[] = (raw as LibSpell[]).map((s) => ({ ...s, cl: [...s.cl] }))
  const extras = import.meta.glob('./data/extra/*.json', { eager: true, import: 'default' }) as Record<string, ExtraFile>
  for (const file of Object.values(extras)) {
    for (const s of file.spells ?? []) lib.push({ ...s, e: s.e || 'UA', src: file.source })
    for (const [cls, levels] of Object.entries(file.classLists ?? {})) {
      for (const [lv, rows] of Object.entries(levels)) {
        for (const row of rows) {
          const special = row.special.toUpperCase()
          const matches = lib.filter((s) => nameKey(s.n) === nameKey(row.n))
          for (const s of matches) {
            if (!s.cl.includes(cls)) s.cl.push(cls)
            if (s.e === 'UA' && s.m == null) s.m = special.includes('M')
          }
          if (!matches.length) {
            lib.push({
              n: row.n.replace(/’/g, "'"), l: +lv, s: row.s, ct: '', r: '', c: '', d: '',
              co: special.includes('C'), ri: special.includes('R'), m: special.includes('M'),
              cl: [cls], e: 'UA', t: '', stub: true, src: file.source,
            })
          }
        }
      }
    }
  }
  return lib
}

export const LIB = buildLibrary()

const fromCustom = (c: CustomSpell): LibSpell => ({ ...c, e: 'Custom', src: 'My library' })
/** Bundled spells plus the ones you've added yourself. */
export function allLib(custom = useStore.getState().customSpells): LibSpell[] {
  return custom.length ? [...LIB, ...custom.map(fromCustom)] : LIB
}

/** Turn a spell from a character sheet into a library entry. */
export function toCustom(sp: Spell, id: string, keep?: CustomSpell): CustomSpell {
  return {
    id, n: sp.name.trim(), l: sp.level, s: sp.school, ct: sp.castingTime, r: sp.range, c: sp.components, d: sp.duration,
    co: sp.concentration, ri: sp.ritual, m: sp.materialConsumed, cl: keep?.cl ?? [], t: sp.description, url: sp.url || keep?.url, fromSpell: sp.id,
  }
}

/** A bundled (not your own) library entry with real text for this name, if there is one. */
export function bundledLib(name: string): LibSpell | undefined {
  const k = nameKey(name)
  const rank = (s: LibSpell) => (s.e === '2024' ? 0 : s.e === 'UA' ? 1 : 2)
  return LIB.filter((s) => !s.stub && nameKey(s.n) === k).sort((a, b) => rank(a) - rank(b))[0]
}

/*
 * Every spell on a character's list that the bundled library doesn't have goes into your own library,
 * a moment after you stop editing. Entries stay linked to the spell they came from, so renaming or
 * editing it updates the same entry instead of leaving half-typed copies behind.
 */
let syncTimer: ReturnType<typeof setTimeout> | undefined
function syncLibrary() {
  const st = useStore.getState()
  const c = st.chars[st.activeId]
  if (!c) return
  let custom = st.customSpells
  let changed = false
  for (const sp of c.spells) {
    const name = sp.name.trim()
    if (!name) continue
    const linked = custom.find((x) => x.fromSpell === sp.id)
    if (bundledLib(name) && !linked) continue // already in the bundled library
    const byName = custom.find((x) => nameKey(x.n) === nameKey(name))
    const target = linked ?? byName
    if (!target) {
      custom = [...custom, toCustom(sp, uid())]
      changed = true
      continue
    }
    // keep the linked entry in step with its spell; never overwrite someone else's entry with less text
    if (target === linked) {
      const next = toCustom(sp, target.id, target)
      if (JSON.stringify(next) !== JSON.stringify(target)) { custom = custom.map((x) => (x.id === target.id ? next : x)); changed = true }
    } else if (!target.t && sp.description) {
      custom = custom.map((x) => (x.id === target.id ? { ...x, t: sp.description } : x))
      changed = true
    }
  }
  if (changed) useStore.setState({ customSpells: custom })
}
useStore.subscribe((s, prev) => {
  if (!s.loaded || s.chars === prev.chars) return
  clearTimeout(syncTimer)
  syncTimer = setTimeout(syncLibrary, 1200)
})

export const LIB_CLASSES = Array.from(new Set(LIB.flatMap((s) => s.cl))).sort()
export const LIB_SCHOOLS = Array.from(new Set(LIB.map((s) => s.s))).sort()

const editionOk = (e: string, filter: string) =>
  filter === 'all' || (filter === 'modern' ? e === '2024' || e === 'UA' || e === 'Custom' : e === filter)

export function searchLib(q: string, o: { level: number | 'all'; cls: string; school: string; edition: string }): LibSpell[] {
  const t = q.trim().toLowerCase()
  return allLib().filter(
    (s) =>
      (!t || s.n.toLowerCase().includes(t) || (s.t.toLowerCase().includes(t) && t.length > 3)) &&
      (o.level === 'all' || s.l === o.level) &&
      (!o.cls || s.cl.includes(o.cls)) &&
      (!o.school || s.s === o.school) &&
      editionOk(s.e, o.edition),
  ).sort((a, b) => {
    const an = a.n.toLowerCase().startsWith(t) ? 0 : 1
    const bn = b.n.toLowerCase().startsWith(t) ? 0 : 1
    return an - bn || a.l - b.l || a.n.localeCompare(b.n) || a.e.localeCompare(b.e)
  })
}

export function findLib(name: string): LibSpell[] {
  const k = nameKey(name)
  return k ? allLib().filter((s) => nameKey(s.n) === k) : []
}

export function fromLib(l: LibSpell): Spell {
  const sp = newSpell(l.l, l.n)
  return applyLib(sp, l)
}

export function applyLib(sp: Spell, l: LibSpell): Spell {
  return {
    ...sp, name: l.n, level: l.l, school: l.s, castingTime: l.ct || sp.castingTime, range: l.r, components: l.c, duration: l.d,
    concentration: l.co, ritual: l.ri, materialConsumed: l.m ?? isConsumed(l.c), description: l.t,
  }
}

/** Best library match for a typed name: full text first (2024, then UA, then 2014), name-only entries last. */
export function bestLib(name: string): LibSpell | undefined {
  const rank = (s: LibSpell) => (s.stub ? 9 : s.e === 'Custom' ? -1 : s.e === '2024' ? 0 : s.e === 'UA' ? 1 : 2)
  return findLib(name).sort((a, b) => rank(a) - rank(b))[0]
}
