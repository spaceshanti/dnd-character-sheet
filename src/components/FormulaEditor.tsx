import { useState } from 'react'
import { currentValue, formulaVars } from '../calc'
import { FORMULA_EXAMPLES, FORMULA_FNS, FORMULA_VARS, tryFormula } from '../formula'
import { uid } from '../blank'
import { labelOf, nameOf, resolveTarget, sheetValues, type SheetValue } from '../values'
import { useChar, useStore } from '../store'
import type { Effect, Feature } from '../types'

/** a formula effect's value as text ("+3", "≥ 15"), worked out for this character */
export function formulaText(e: Effect, vars: Record<string, number>): string {
  const r = tryFormula(e.formula ?? '', vars)
  if (r.error) return `(${e.formula}: ${r.error})`
  return e.type === 'minScore' ? `≥ ${r.value}` : r.value >= 0 ? `+${r.value}` : `${r.value}`
}

/**
 * Advanced, folded away at the bottom of a feature's editor: modifiers whose value is a calculation
 * ("wis", "max(1, cha)", "half(prof)") instead of a fixed number. A reference of the variables opens separately.
 */
export function FormulaModifiers({ f }: { f: Feature }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const rows = f.effects.filter((e) => e.formula !== undefined)
  const [open, setOpen] = useState(rows.length > 0)
  const [help, setHelp] = useState(false)
  const vars = formulaVars(c)
  const values = sheetValues(c)
  const upF = (fn: (x: Feature) => void) => patch((d) => { const x = d.features.find((y) => y.id === f.id); if (x) fn(x) })
  const set = (id: string, p: Partial<Effect>) => upF((x) => { const e = x.effects.find((y) => y.id === id); if (e) Object.assign(e, p) })

  if (!open) {
    return (
      <button className="adv-link" onClick={() => setOpen(true)} title="Modifiers worked out from a formula (ability modifiers, level, proficiency…)">
        ⚙ Advanced: custom formulas
      </button>
    )
  }
  return (
    <div className="adv-formulas">
      <div className="row" style={{ gap: 6 }}>
        <b className="grow small">Custom formula modifiers</b>
        <button className="btn sm ghost" onClick={() => setHelp(!help)}>{help ? 'Hide' : '?'} Variables &amp; functions</button>
        {!rows.length && <button className="btn sm ghost" title="Fold away" onClick={() => setOpen(false)}>✕</button>}
      </div>
      {help && <FormulaHelp vars={vars} values={values} />}
      <datalist id="sheet-values">
        {values.map((v) => <option key={v.id} value={v.name}>{v.label}</option>)}
      </datalist>
      {rows.map((e) => <FormulaRow key={e.id} e={e} vars={vars} values={values} onSet={(p) => set(e.id, p)} onRemove={() => upF((x) => { x.effects = x.effects.filter((y) => y.id !== e.id) })} />)}
      {rows.some((e) => e.formula && tryFormula(e.formula, vars).error) && (
        <div className="small" style={{ color: 'var(--dis)' }}>
          {rows.filter((e) => e.formula).map((e) => tryFormula(e.formula!, vars).error).filter(Boolean)[0]} (counts as 0 until fixed)
        </div>
      )}
      <button className="btn sm" onClick={() => upF((x) => { x.effects.push({ id: uid(), target: 'ac', type: 'bonus', formula: '' }) })}>＋ Formula modifier</button>
    </div>
  )
}

const OPS: { id: Effect['type']; name: string }[] = [
  { id: 'bonus', name: 'adds' },
  { id: 'minScore', name: 'at least' },
  { id: 'maxScore', name: 'at most' },
  { id: 'set', name: 'sets to' },
]

/**
 * One formula modifier: what it changes (type a value's name: dr, initiative, carry, res_psionic_dice… or a new name
 * for a value of your own), how (adds / at least / at most / sets to), and the formula.
 */
function FormulaRow({ e, vars, values, onSet, onRemove }: {
  e: Effect; vars: Record<string, number>; values: SheetValue[]; onSet: (p: Partial<Effect>) => void; onRemove: () => void
}) {
  const c = useChar()
  const [text, setText] = useState(nameOf(c, e.target))
  const res = resolveTarget(c, text)
  const value = values.find((v) => v.id === (res.id || e.target))
  const ops = !value || value.ops === 'all' ? OPS : OPS.slice(0, 1)
  const r = tryFormula(e.formula ?? '', vars)
  // its final number with every modifier, this one included
  const now = res.id ? currentValue(c, res.id) : undefined
  const commit = (t: string) => {
    setText(t)
    const x = resolveTarget(c, t)
    if (!x.id) return
    const v = values.find((y) => y.id === x.id)
    onSet({ target: x.id, type: v && v.ops === 'add' ? 'bonus' : e.type === 'bonus' || e.type === 'minScore' || e.type === 'maxScore' || e.type === 'set' ? e.type : 'bonus' })
  }
  return (
    <div className="formula-item">
      <div className="fx-row formula-row">
        <input className="box-input formula-target" list="sheet-values" spellCheck={false} placeholder="dr, initiative, carry…" value={text}
          title="What this changes: type a value's name (the list suggests them), or a new name for a value of your own"
          onChange={(ev) => commit(ev.target.value)} />
        <select value={e.type} onChange={(ev) => onSet({ type: ev.target.value as Effect['type'] })}>
          {ops.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <input className="box-input grow formula-in" spellCheck={false} placeholder="e.g. max(1, wis)" value={e.formula ?? ''}
          onChange={(ev) => onSet({ formula: ev.target.value })} />
        <span className={`formula-out ${r.error && e.formula ? 'bad' : ''}`} title={r.error || `${labelOf(c, e.target)} ${formulaText(e, vars)} right now`}>
          {!e.formula ? '' : r.error ? '⚠' : `= ${r.value}`}
        </span>
        <button className="btn icon sm" title="Remove" onClick={onRemove}>✕</button>
      </div>
      <div className={`formula-what small ${res.kind === 'bad' ? 'bad' : 'muted'}`}>
        {res.kind === 'bad' ? res.error : res.kind === 'new'
          ? <>A value of your own: <code>{text.trim()}</code>. Other formulas can use it by name.</>
          : <>→ {res.label}{now !== undefined && <> (now {now})</>}</>}
      </div>
    </div>
  )
}

/** the reference: every variable with this character's current value, the functions, a few examples */
function FormulaHelp({ vars, values }: { vars: Record<string, number>; values: SheetValue[] }) {
  // the sheet's own values, grouped, then the plain formula variables that aren't targets
  const groups = [...new Set(values.map((v) => v.group))]
  const valueNames = new Set(values.map((v) => v.name))
  const extra = FORMULA_VARS.filter((v) => !valueNames.has(v.name) && vars[v.name] !== undefined)
  return (
    <div className="formula-help">
      <div className="small muted">
        Write a calculation instead of a fixed number. It updates by itself as the character changes (level, scores…).
        Results are rounded down to whole numbers. <b>What it changes</b> can be any value below: type its name. Every name
        can also be used inside a formula to read it (the value without other formulas, so nothing depends on itself).
        Type a new name (e.g. <code>rage_damage</code>) to make a value of your own that other features' formulas can use.
      </div>
      <div className="formula-cols">
        <div>
          <div className="field-lbl">Variables <span className="muted">(now)</span></div>
          <table className="formula-table"><tbody>
            {extra.map((v) => <tr key={v.name}><td><code>{v.name}</code></td><td>{v.desc}</td><td className="muted">{vars[v.name]}</td></tr>)}
          </tbody></table>
          {groups.map((g) => (
            <div key={g}>
              <div className="field-lbl" style={{ marginTop: 8 }}>{g} <span className="muted">(read or change)</span></div>
              <table className="formula-table"><tbody>
                {values.filter((v) => v.group === g).map((v) => (
                  <tr key={v.id}><td><code>{v.name}</code></td><td>{v.label}</td><td className="muted">{vars[v.name] ?? ''}</td></tr>
                ))}
                {g === 'Resources' && <tr><td colSpan={3} className="muted small">and <code>left_…</code> for the uses left, e.g. <code>{values.find((v) => v.group === 'Resources')?.name.replace(/^res_/, 'left_')}</code></td></tr>}
              </tbody></table>
            </div>
          ))}
        </div>
        <div>
          <div className="field-lbl">Functions</div>
          <table className="formula-table"><tbody>
            {FORMULA_FNS.map((f) => <tr key={f.name}><td><code>{f.name}</code></td><td>{f.desc}</td></tr>)}
          </tbody></table>
          <div className="field-lbl" style={{ marginTop: 8 }}>Operators</div>
          <div className="small"><code>+ - * / %</code>, brackets <code>( )</code>, and for tests <code>&lt; &gt; &lt;= &gt;= == !=</code> <code>&amp;&amp; ||</code></div>
          <div className="field-lbl" style={{ marginTop: 8 }}>How it changes the value</div>
          <div className="small"><b>adds</b> the result; <b>at least</b> raises it to the result; <b>at most</b> caps it; <b>sets to</b> replaces it (applied last).</div>
          <div className="field-lbl" style={{ marginTop: 8 }}>Examples</div>
          <table className="formula-table"><tbody>
            {FORMULA_EXAMPLES.map(([f, d]) => <tr key={f}><td><code>{f}</code></td><td>{d}</td></tr>)}
          </tbody></table>
        </div>
      </div>
    </div>
  )
}
