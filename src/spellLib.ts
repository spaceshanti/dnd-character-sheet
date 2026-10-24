import raw from './data/spells.json'
import { newSpell } from './blank'
import type { Spell } from './types'

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
  e: '2014' | '2024'
  t: string
}

export const LIB = raw as LibSpell[]

export const LIB_CLASSES = Array.from(new Set(LIB.flatMap((s) => s.cl))).sort()
export const LIB_SCHOOLS = Array.from(new Set(LIB.map((s) => s.s))).sort()

export function searchLib(q: string, o: { level: number | 'all'; cls: string; school: string; edition: string }): LibSpell[] {
  const t = q.trim().toLowerCase()
  return LIB.filter(
    (s) =>
      (!t || s.n.toLowerCase().includes(t) || s.t.toLowerCase().includes(t) && t.length > 3) &&
      (o.level === 'all' || s.l === o.level) &&
      (!o.cls || s.cl.includes(o.cls)) &&
      (!o.school || s.s === o.school) &&
      (o.edition === 'all' || s.e === o.edition),
  ).sort((a, b) => {
    const an = a.n.toLowerCase().startsWith(t) ? 0 : 1
    const bn = b.n.toLowerCase().startsWith(t) ? 0 : 1
    return an - bn || a.n.localeCompare(b.n) || a.e.localeCompare(b.e)
  })
}

export function findLib(name: string): LibSpell[] {
  const t = name.trim().toLowerCase()
  return t ? LIB.filter((s) => s.n.toLowerCase() === t) : []
}

export function fromLib(l: LibSpell): Spell {
  const sp = newSpell(l.l, l.n)
  return applyLib(sp, l)
}

export function applyLib(sp: Spell, l: LibSpell): Spell {
  return {
    ...sp, name: l.n, level: l.l, school: l.s, castingTime: l.ct, range: l.r, components: l.c, duration: l.d,
    concentration: l.co, ritual: l.ri, description: l.t,
  }
}
