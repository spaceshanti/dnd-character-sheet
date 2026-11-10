/*
 * Custom calculations for a feature's modifiers, e.g. "max(1, wis)" or "floor(level / 2) + prof".
 * A small arithmetic language: numbers, the variables below, + - * / %, comparisons, ( ), and a few functions.
 * Nothing is run as code; anything it can't read counts as 0 and the editor says what's wrong.
 */

export interface FormulaVar { name: string; desc: string }
export interface FormulaFn { name: string; desc: string }

const ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const ABIL_NAME: Record<string, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }

/** the variables a formula can use, for the help panel */
export const FORMULA_VARS: FormulaVar[] = [
  { name: 'level', desc: 'Character level' },
  { name: 'prof', desc: 'Proficiency bonus' },
  ...ABIL.map((a) => ({ name: a, desc: `${ABIL_NAME[a]} modifier` })),
  ...ABIL.map((a) => ({ name: `${a}Score`, desc: `${ABIL_NAME[a]} score` })),
  { name: 'spellMod', desc: 'Spellcasting ability modifier (0 if none is set)' },
  { name: 'hitDice', desc: 'Total hit dice' },
  { name: 'ap', desc: 'Arknights: maximum Arts Points' },
  { name: 'artLevel', desc: 'Arknights: maximum Art level' },
]

export const FORMULA_FNS: FormulaFn[] = [
  { name: 'floor(x)', desc: 'Round down' },
  { name: 'ceil(x)', desc: 'Round up' },
  { name: 'round(x)', desc: 'Round to the nearest whole number' },
  { name: 'min(a, b, …)', desc: 'The smallest' },
  { name: 'max(a, b, …)', desc: 'The largest' },
  { name: 'abs(x)', desc: 'Without its sign' },
  { name: 'half(x)', desc: 'Half, rounded down (like half proficiency)' },
  { name: 'if(test, a, b)', desc: 'a when the test is true, otherwise b' },
]

export const FORMULA_EXAMPLES: [string, string][] = [
  ['wis', 'Add your Wisdom modifier (Monk Unarmored Defense on AC)'],
  ['max(1, cha)', 'Your Charisma modifier, at least 1'],
  ['half(prof)', 'Half your proficiency bonus'],
  ['floor(level / 2)', 'Half your level, rounded down'],
  ['if(level >= 11, 2, 1)', '2 from 11th level, 1 before'],
  ['prof + con', 'Proficiency bonus plus Constitution modifier'],
]

const FNS: Record<string, (...a: number[]) => number> = {
  floor: Math.floor, ceil: Math.ceil, round: Math.round, abs: Math.abs,
  min: (...a) => Math.min(...a), max: (...a) => Math.max(...a),
  half: (x) => Math.floor(x / 2),
  if: (t, a, b) => (t ? a : b),
}

type Tok = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string }

function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  const re = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(>=|<=|==|!=|&&|\|\||[-+*/%(),<>!]))/y
  let i = 0
  while (i < src.length) {
    if (/^\s*$/.test(src.slice(i))) break
    re.lastIndex = i
    const m = re.exec(src)
    if (!m) throw new Error(`I don't understand "${src.slice(i).trim().slice(0, 12)}"`)
    if (m[1]) out.push({ k: 'num', v: parseFloat(m[1]) })
    else if (m[2]) out.push({ k: 'id', v: m[2] })
    else out.push({ k: 'op', v: m[3] })
    i = re.lastIndex
  }
  return out
}

/** evaluate a formula with these variables; throws a readable error when it can't */
export function evaluate(src: string, vars: Record<string, number>): number {
  const t = tokenize(src)
  let p = 0
  const peek = () => t[p]
  const isOp = (v: string) => peek()?.k === 'op' && peek()!.v === v
  const expect = (v: string) => { if (!isOp(v)) throw new Error(`Expected "${v}"`); p++ }

  const or = (): number => { let a = and(); while (isOp('||')) { p++; const b = and(); a = a || b ? 1 : 0 } return a }
  const and = (): number => { let a = cmp(); while (isOp('&&')) { p++; const b = cmp(); a = a && b ? 1 : 0 } return a }
  const cmp = (): number => {
    let a = add()
    while (peek()?.k === 'op' && ['<', '>', '<=', '>=', '==', '!='].includes(peek()!.v as string)) {
      const op = t[p++].v
      const b = add()
      a = (op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : op === '>=' ? a >= b : op === '==' ? a === b : a !== b) ? 1 : 0
    }
    return a
  }
  const add = (): number => {
    let a = mul()
    while (isOp('+') || isOp('-')) { const op = t[p++].v; const b = mul(); a = op === '+' ? a + b : a - b }
    return a
  }
  const mul = (): number => {
    let a = unary()
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = t[p++].v
      const b = unary()
      if ((op === '/' || op === '%') && b === 0) throw new Error('Division by zero')
      a = op === '*' ? a * b : op === '/' ? a / b : a % b
    }
    return a
  }
  const unary = (): number => {
    if (isOp('-')) { p++; return -unary() }
    if (isOp('+')) { p++; return unary() }
    if (isOp('!')) { p++; return unary() ? 0 : 1 }
    return primary()
  }
  const primary = (): number => {
    const tok = t[p++]
    if (!tok) throw new Error('The formula ends too soon')
    if (tok.k === 'num') return tok.v
    if (tok.k === 'op' && tok.v === '(') { const v = or(); expect(')'); return v }
    if (tok.k === 'id') {
      if (isOp('(')) {
        const fn = FNS[tok.v]
        if (!fn) throw new Error(`No function called "${tok.v}"`)
        p++
        const args: number[] = []
        if (!isOp(')')) { args.push(or()); while (isOp(',')) { p++; args.push(or()) } }
        expect(')')
        if (tok.v === 'if' && args.length !== 3) throw new Error('if needs three parts: if(test, a, b)')
        return fn(...args)
      }
      if (!(tok.v in vars)) throw new Error(`No variable called "${tok.v}"`)
      return vars[tok.v]
    }
    throw new Error(`Unexpected "${tok.v}"`)
  }
  if (!t.length) throw new Error('Empty formula')
  const v = or()
  if (p < t.length) throw new Error(`Unexpected "${(t[p] as Tok).v}"`)
  if (!Number.isFinite(v)) throw new Error('Not a number')
  // modifiers are whole numbers
  return Math.floor(v)
}

/** evaluate, or explain what's wrong */
export function tryFormula(src: string, vars: Record<string, number>): { value: number; error: string } {
  try { return { value: evaluate(src, vars), error: '' } } catch (e) { return { value: 0, error: e instanceof Error ? e.message : String(e) } }
}
