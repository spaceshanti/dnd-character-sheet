import { useStore } from './store'
import { formulaVars } from './calc'
import { tryFormula } from './formula'
import { akTableValue } from './ak5e/fill'

/*
 * Numbers that follow the character: a resource whose maximum is a formula ("prof", "max(1, con)") or a column of the
 * Arknights class / branch table (Resilience, Life Support, Fuel…), Arts Points and max Art level from that table, and
 * the hit dice total. They're worked out again whenever the level, ability scores or proficiency bonus change.
 */
export function installDerivedSync() {
  useStore.subscribe((s, prev) => {
    const c = s.chars[s.activeId]
    const p = prev.chars[prev.activeId]
    if (!c || !p || c === p || c.id !== p.id) return
    const levelChanged = c.level !== p.level
    if (!levelChanged && c.abilities === p.abilities && c.profOverride === p.profOverride && c.resources === p.resources) return

    const vars = formulaVars(c)
    const maxes = new Map<string, number>()
    for (const r of c.resources) {
      const m = r.fromTable ? akTableValue(r.fromTable, c.level, r.fromTable.col) : r.maxFormula ? Math.max(0, tryFormula(r.maxFormula, vars).value) : null
      if (m != null && m !== r.max && !(r.fromTable && m === 0)) maxes.set(r.id, m)
    }
    const ap = levelChanged && c.artsTable ? akTableValue(c.artsTable, c.level, 'Arts Points') : 0
    const mal = levelChanged && c.artsTable ? akTableValue(c.artsTable, c.level, 'Maximum Art Level') : 0
    // one pool of hit dice that matched the old level keeps matching it
    const hd = levelChanged && c.hitDice.length === 1 && c.hitDice[0].total === p.level
    if (!maxes.size && !(ap && ap !== c.ak.ap.max) && !(mal && mal !== c.ak.maxArtLevel) && !hd) return

    s.patch((d) => {
      for (const r of d.resources) {
        const m = maxes.get(r.id)
        if (m != null) { r.max = m; r.used = Math.min(r.used, m) }
      }
      if (ap) d.ak.ap.max = ap
      if (mal) d.ak.maxArtLevel = mal
      if (hd) d.hitDice[0].total = Math.max(1, d.level)
    })
  })
}
