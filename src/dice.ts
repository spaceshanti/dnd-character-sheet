/*
 * Dice expressions for the roller: "2d6+3", "d20 + 5", "4d6kh3" (keep the highest 3), "2d20kl1" (keep the lowest),
 * "1d8 + 1d6 - 1". Advantage / disadvantage roll every d20 twice and keep the higher / lower.
 */

export interface DieRoll { sides: number; value: number; kept: boolean }
export interface TermResult { text: string; sign: 1 | -1; dice: DieRoll[]; total: number }
export interface RollResult { expr: string; total: number; terms: TermResult[]; mode: 'normal' | 'adv' | 'dis'; at: number; nat?: 'crit' | 'fumble' }

const roll = (sides: number) => 1 + Math.floor(Math.random() * sides)

/** check an expression without rolling it ('' = fine) */
export function diceError(expr: string): string {
  const t = expr.replace(/\s+/g, '').toLowerCase()
  if (!t) return 'Add some dice'
  if (!/^[+-]?(\d*d\d+(k[hl]\d+)?|\d+)([+-](\d*d\d+(k[hl]\d+)?|\d+))*$/.test(t)) return 'Try something like 2d6+3'
  for (const m of t.matchAll(/(\d*)d(\d+)/g)) {
    if (+(m[1] || 1) > 100) return 'At most 100 dice at once'
    if (+m[2] < 2 || +m[2] > 1000) return 'Dice have 2 to 1000 sides'
  }
  return ''
}

export function rollDice(expr: string, mode: RollResult['mode'] = 'normal'): RollResult | null {
  if (diceError(expr)) return null
  const t = expr.replace(/\s+/g, '').toLowerCase()
  const terms: TermResult[] = []
  for (const m of t.matchAll(/([+-]?)(?:(\d*)d(\d+)(?:k([hl])(\d+))?|(\d+))/g)) {
    const sign: 1 | -1 = m[1] === '-' ? -1 : 1
    if (m[6]) { terms.push({ text: m[6], sign, dice: [], total: +m[6] }); continue }
    const n = +(m[2] || 1)
    const sides = +m[3]
    let dice: DieRoll[] = []
    if (sides === 20 && n === 1 && mode !== 'normal' && !m[4]) {
      // advantage / disadvantage: two d20s, keep one
      const a = roll(20)
      const b = roll(20)
      const keepA = mode === 'adv' ? a >= b : a <= b
      dice = [{ sides, value: a, kept: keepA }, { sides, value: b, kept: !keepA }]
    } else {
      dice = Array.from({ length: n }, () => ({ sides, value: roll(sides), kept: true }))
      if (m[4]) {
        const keep = Math.min(n, +m[5])
        const order = [...dice].sort((x, y) => (m[4] === 'h' ? y.value - x.value : x.value - y.value))
        const kept = new Set(order.slice(0, keep))
        dice = dice.map((d) => ({ ...d, kept: kept.has(d) }))
      }
    }
    const total = dice.filter((d) => d.kept).reduce((s, d) => s + d.value, 0)
    terms.push({ text: `${n}d${sides}${m[4] ? `k${m[4]}${m[5]}` : ''}`, sign, dice, total })
  }
  const total = terms.reduce((s, x) => s + x.sign * x.total, 0)
  // a lone d20 (with or without advantage): natural 20 / 1
  const d20s = terms.filter((x) => x.dice.length && x.dice[0].sides === 20)
  let nat: RollResult['nat']
  if (d20s.length === 1 && d20s[0].dice.filter((d) => d.kept).length === 1) {
    const v = d20s[0].dice.find((d) => d.kept)!.value
    nat = v === 20 ? 'crit' : v === 1 ? 'fumble' : undefined
  }
  return { expr: expr.trim(), total, terms, mode, at: Date.now(), nat }
}

/** add one die to an expression: "2d6+3" + d6 → "3d6+3"; + d8 → "2d6+3+1d8" */
export function addDie(expr: string, sides: number): string {
  const t = expr.replace(/\s+/g, '')
  const re = new RegExp(`(^|[+-])(\\d*)d${sides}(?![\\dk])`)
  const m = re.exec(t)
  if (m) return t.replace(re, `${m[1]}${+(m[2] || 1) + 1}d${sides}`)
  return t ? `${t}+1d${sides}` : `1d${sides}`
}
