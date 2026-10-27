import type { Character, ProfLevel, SkillKey } from './types'

/** Game systems a character can be built for. Each one changes which parts of the sheet show. */
export type SystemId = 'dnd5e' | 'ak5e'

export const SYSTEMS: { id: SystemId; name: string; short: string; desc: string }[] = [
  { id: 'dnd5e', name: 'D&D 5th Edition', short: 'D&D 5e', desc: 'Spell slots, prepared spells, coins, death saves.' },
  { id: 'ak5e', name: 'Arknights 5e', short: 'AK5e', desc: 'The Arknights overhaul: Arts Points, Operator Skills, Mettle, Nationality and LMD.' },
]

export const systemOf = (c: Pick<Character, 'system'> | undefined): SystemId => (c?.system === 'ak5e' ? 'ak5e' : 'dnd5e')
export const isAK = (c: Pick<Character, 'system'> | undefined) => systemOf(c) === 'ak5e'
export const systemName = (id: SystemId) => SYSTEMS.find((s) => s.id === id)?.short ?? id

/**
 * Moving a character to another game: AK5e folds some skills together (History + Religion → Lore,
 * Nature + Survival → Wilderness, Arcana → Arts). Proficiency carries over to the merged skill.
 */
const MERGE: [SkillKey, SkillKey[]][] = [
  ['arts', ['arcana']],
  ['lore', ['history', 'religion']],
  ['wilderness', ['survival', 'nature']],
]

export function convertSkills(prof: Record<SkillKey, ProfLevel>, to: SystemId): Record<SkillKey, ProfLevel> {
  const out = { ...prof }
  for (const [ak, dnd] of MERGE) {
    if (to === 'ak5e') out[ak] = Math.max(out[ak], ...dnd.map((k) => out[k])) as ProfLevel
    else for (const k of dnd) out[k] = Math.max(out[k], out[ak]) as ProfLevel
  }
  return out
}
