import { useState } from 'react'
import { effectTargets, targetName } from '../constants'
import { formulaVars } from '../calc'
import { FORMULA_EXAMPLES, FORMULA_FNS, FORMULA_VARS, tryFormula } from '../formula'
import { uid } from '../blank'
import { systemOf } from '../systems'
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
  const targets = effectTargets(systemOf(c))
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
      {help && <FormulaHelp vars={vars} />}
      {rows.map((e) => {
        const r = tryFormula(e.formula ?? '', vars)
        return (
          <div className="fx-row formula-row" key={e.id}>
            <select value={e.target} onChange={(ev) => set(e.id, { target: ev.target.value, type: ev.target.value.startsWith('ability:') ? e.type : 'bonus' })}>
              {targets.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </optgroup>
              ))}
            </select>
            {e.target.startsWith('ability:') && (
              <select value={e.type} onChange={(ev) => set(e.id, { type: ev.target.value as Effect['type'] })}>
                <option value="bonus">adds</option>
                <option value="minScore">at least</option>
              </select>
            )}
            <input className="box-input grow formula-in" spellCheck={false} placeholder="e.g. max(1, wis)" value={e.formula ?? ''}
              onChange={(ev) => set(e.id, { formula: ev.target.value })} />
            <span className={`formula-out ${r.error && e.formula ? 'bad' : ''}`} title={r.error || `${targetName(e.target)} ${formulaText(e, vars)} right now`}>
              {!e.formula ? '' : r.error ? '⚠' : `= ${r.value}`}
            </span>
            <button className="btn icon sm" title="Remove" onClick={() => upF((x) => { x.effects = x.effects.filter((y) => y.id !== e.id) })}>✕</button>
          </div>
        )
      })}
      {rows.some((e) => e.formula && tryFormula(e.formula, vars).error) && (
        <div className="small" style={{ color: 'var(--dis)' }}>
          {rows.filter((e) => e.formula).map((e) => tryFormula(e.formula!, vars).error).filter(Boolean)[0]} (counts as 0 until fixed)
        </div>
      )}
      <button className="btn sm" onClick={() => upF((x) => { x.effects.push({ id: uid(), target: 'ac', type: 'bonus', formula: '' }) })}>＋ Formula modifier</button>
    </div>
  )
}

/** the reference: every variable with this character's current value, the functions, a few examples */
function FormulaHelp({ vars }: { vars: Record<string, number> }) {
  return (
    <div className="formula-help">
      <div className="small muted">
        Write a calculation instead of a fixed number. It updates by itself as the character changes (level, scores…).
        Results are rounded down to whole numbers.
      </div>
      <div className="formula-cols">
        <div>
          <div className="field-lbl">Variables <span className="muted">(now)</span></div>
          <table className="formula-table"><tbody>
            {FORMULA_VARS.map((v) => <tr key={v.name}><td><code>{v.name}</code></td><td>{v.desc}</td><td className="muted">{vars[v.name]}</td></tr>)}
          </tbody></table>
        </div>
        <div>
          <div className="field-lbl">Functions</div>
          <table className="formula-table"><tbody>
            {FORMULA_FNS.map((f) => <tr key={f.name}><td><code>{f.name}</code></td><td>{f.desc}</td></tr>)}
          </tbody></table>
          <div className="field-lbl" style={{ marginTop: 8 }}>Operators</div>
          <div className="small"><code>+ - * / %</code>, brackets <code>( )</code>, and for tests <code>&lt; &gt; &lt;= &gt;= == !=</code> <code>&amp;&amp; ||</code></div>
          <div className="field-lbl" style={{ marginTop: 8 }}>Examples</div>
          <table className="formula-table"><tbody>
            {FORMULA_EXAMPLES.map(([f, d]) => <tr key={f}><td><code>{f}</code></td><td>{d}</td></tr>)}
          </tbody></table>
        </div>
      </div>
    </div>
  )
}
