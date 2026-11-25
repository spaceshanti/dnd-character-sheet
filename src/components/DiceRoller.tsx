import { useEffect, useRef, useState } from 'react'
import { useUI } from '../store'
import { addDie, diceError, rollDice, type RollResult } from '../dice'
import { Modal } from './ui'

const DICE = [4, 6, 8, 10, 12, 20, 100]
const HISTORY = 'dice-history'

/**
 * The dice roller (R, or the 🎲 button). Click dice to build a roll (d6 twice → 2d6) or type one ("2d6+3", "4d6kh3"),
 * then Roll / Enter. Advantage and disadvantage apply to a d20. The last rolls are kept on this computer.
 */
export function DiceRoller() {
  const open = useUI((s) => s.diceOpen)
  const set = useUI((s) => s.set)
  if (!open) return null
  return <RollerInner onClose={() => set({ diceOpen: false })} />
}

function RollerInner({ onClose }: { onClose: () => void }) {
  const [expr, setExpr] = useState('')
  const [mode, setMode] = useState<RollResult['mode']>('normal')
  const [history, setHistoryRaw] = useState<RollResult[]>(() => { try { return JSON.parse(localStorage.getItem(HISTORY) || '[]') } catch { return [] } })
  const [mod, setMod] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  const setHistory = (h: RollResult[]) => { setHistoryRaw(h); try { localStorage.setItem(HISTORY, JSON.stringify(h.slice(0, 30))) } catch { /* private mode */ } }

  const full = () => {
    const base = expr.trim() || '1d20'
    return mod ? `${base}${mod > 0 ? '+' : '-'}${Math.abs(mod)}` : base
  }
  const doRoll = (e = full()) => {
    const r = rollDice(e, mode)
    if (!r) return
    setHistory([r, ...history].slice(0, 30))
  }
  const err = expr.trim() ? diceError(expr) : ''
  const last = history[0]

  return (
    <Modal title="Dice roller" onClose={onClose}>
      <div className="col dice" style={{ gap: 10 }}>
        <div className="dice-row">
          {DICE.map((s) => (
            <button key={s} className="btn die-btn" title={`Add a d${s} (right-click: roll one now)`}
              onClick={() => setExpr(addDie(expr, s))}
              onContextMenu={(e) => { e.preventDefault(); doRoll(`1d${s}`) }}>d{s}</button>
          ))}
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <input ref={input} className="box-input grow dice-expr" spellCheck={false} placeholder="e.g. 2d6+3, d20+5, 4d6kh3 (empty = d20)" value={expr}
            onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doRoll() }} />
          <span className="row dice-mod" title="Modifier added to the roll">
            <button className="btn icon sm" onClick={() => setMod((m) => m - 1)}>−</button>
            <b>{mod >= 0 ? `+${mod}` : mod}</b>
            <button className="btn icon sm" onClick={() => setMod((m) => m + 1)}>＋</button>
          </span>
          <button className="btn sm ghost" disabled={!expr && !mod} onClick={() => { setExpr(''); setMod(0) }}>Clear</button>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <div className="seg">
            {(['normal', 'adv', 'dis'] as const).map((m) => (
              <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m === 'normal' ? 'Normal' : m === 'adv' ? 'Advantage' : 'Disadvantage'}</button>
            ))}
          </div>
          <span className="grow small bad">{err}</span>
          <button className="btn primary" disabled={!!err} onClick={() => doRoll()}>🎲 Roll {full()}</button>
        </div>

        {last && (
          <div className={`dice-result ${last.nat ?? ''}`}>
            <div className="dice-total">{last.total}</div>
            <div className="col" style={{ gap: 2, minWidth: 0 }}>
              <span className="small muted">{last.expr}{last.mode !== 'normal' ? ` · ${last.mode === 'adv' ? 'advantage' : 'disadvantage'}` : ''}{last.nat === 'crit' ? ' · natural 20!' : last.nat === 'fumble' ? ' · natural 1' : ''}</span>
              <span className="dice-parts">{breakdown(last)}</span>
            </div>
          </div>
        )}
        {history.length > 1 && (
          <div className="dice-history">
            <div className="row"><span className="field-lbl grow">Earlier</span><button className="btn sm ghost" onClick={() => setHistory(history.slice(0, 1))}>Clear</button></div>
            {history.slice(1, 12).map((r, i) => (
              <div key={i} className="dice-hist-row" onClick={() => doRoll(r.expr)} title="Roll this again">
                <b>{r.total}</b><span className="muted small grow">{r.expr}{r.mode !== 'normal' ? ` (${r.mode})` : ''}</span><span className="small dice-parts">{breakdown(r)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="muted small">R opens this from anywhere (when you're not typing). Click a die to add it, right-click to roll one on its own.</div>
      </div>
    </Modal>
  )
}

/** "[4, 2] + 3" with dropped dice struck through */
function breakdown(r: RollResult) {
  return r.terms.map((t, i) => (
    <span key={i}>
      {i > 0 || t.sign < 0 ? (t.sign < 0 ? ' − ' : ' + ') : ''}
      {t.dice.length ? <>[{t.dice.map((d, j) => <span key={j} className={d.kept ? '' : 'dropped'}>{j ? ', ' : ''}{d.value}</span>)}]</> : t.text}
    </span>
  ))
}
