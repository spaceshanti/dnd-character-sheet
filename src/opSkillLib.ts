import { uid } from './blank'
import type { OperatorSkill, SkillTier } from './types'

/** One row of an Operator Skill table, as written by tools/import_ak5e.py */
export interface LibOpSkill {
  n: string
  /** class or branch the table belongs to (Caster, Guard, Liberator…) */
  cls: string
  tier: SkillTier | ''
  sp: number
  start: number
  charge: string
  act: string
  t: string
  dur: string
}

function build(): LibOpSkill[] {
  const extras = import.meta.glob('./data/extra/*.json', { eager: true, import: 'default' }) as Record<string, { opSkills?: LibOpSkill[] }>
  return Object.values(extras).flatMap((f) => f.opSkills ?? [])
}

export const OP_LIB = build()
export const OP_CLASSES = Array.from(new Set(OP_LIB.map((s) => s.cls))).sort()

export const TIERS: { id: SkillTier; name: string; level: string }[] = [
  { id: 'basic', name: 'Basic', level: '2nd level' },
  { id: 'advanced', name: 'Advanced', level: '7th level' },
  { id: 'elite', name: 'Elite', level: '14th level' },
  { id: 'other', name: 'Other', level: 'from a branch or feature' },
]

export const CHARGING: Record<string, string> = {
  Automatic: '+2 SP at the start of each of your turns in combat.',
  Offensive: '+1 SP when you damage a hostile creature (once per attack), heal another creature, or give another creature temp HP with an Art, on your turn.',
  Defensive: '+2 SP when a hostile creature attacks you, or damages you without an attack.',
}

export function searchOp(q: string, cls: string, tier: string): LibOpSkill[] {
  const t = q.trim().toLowerCase()
  return OP_LIB.filter((s) =>
    (!cls || s.cls === cls) && (!tier || s.tier === tier) &&
    (!t || s.n.toLowerCase().includes(t) || (t.length > 3 && s.t.toLowerCase().includes(t))),
  )
}

export function fromOpLib(s: LibOpSkill, tier?: SkillTier): OperatorSkill {
  return {
    id: uid(), tier: tier ?? (s.tier || 'other'), name: s.n, spCost: s.sp, startSp: s.start, charging: s.charge,
    activation: s.act, duration: s.dur, effect: s.t,
  }
}
