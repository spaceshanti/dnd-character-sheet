import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'

/*
 * The app's own "are you sure?" and "type a name" boxes, instead of the browser's confirm() / prompt().
 * In the desktop app those native boxes can leave the window unable to take typing afterwards (an Electron bug on
 * Windows: text boxes stop responding until the window is closed and reopened), and prompt() doesn't work there at all.
 */

interface Ask {
  kind: 'confirm' | 'text'
  message: string
  ok: string
  danger: boolean
  value: string
  resolve: (v: string | null) => void
}

const useAsk = create<{ ask: Ask | null }>(() => ({ ask: null }))

function open(a: Omit<Ask, 'resolve'>): Promise<string | null> {
  return new Promise((resolve) => {
    // one at a time: a newer question cancels an older one
    useAsk.getState().ask?.resolve(null)
    useAsk.setState({ ask: { ...a, resolve } })
  })
}

/** "Are you sure?" — resolves true for OK */
export async function askConfirm(message: string, opts: { ok?: string; danger?: boolean } = {}): Promise<boolean> {
  // "Delete …?" / "Remove …?" get a red button saying so
  const verb = /^(Delete|Remove)\b/.exec(message)?.[1]
  return (await open({ kind: 'confirm', message, ok: opts.ok ?? verb ?? 'OK', danger: opts.danger ?? !!verb, value: '' })) !== null
}

/** a line of text (null when cancelled) */
export function askText(message: string, value = '', opts: { ok?: string } = {}): Promise<string | null> {
  return open({ kind: 'text', message, ok: opts.ok ?? 'OK', danger: false, value })
}

/** mounted once in each top-level screen */
export function DialogHost() {
  const ask = useAsk((s) => s.ask)
  const [value, setValue] = useState('')
  const okBtn = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const prevFocus = useRef<Element | null>(null)

  useEffect(() => {
    if (!ask) return
    prevFocus.current = document.activeElement
    setValue(ask.value)
    setTimeout(() => { if (ask.kind === 'text') { input.current?.focus(); input.current?.select() } else okBtn.current?.focus() }, 0)
  }, [ask])

  if (!ask) return null
  const finish = (v: string | null) => {
    useAsk.setState({ ask: null })
    ask.resolve(v)
    // back to where you were typing
    const el = prevFocus.current as HTMLElement | null
    if (el && document.contains(el)) el.focus?.()
  }
  const ok = () => finish(ask.kind === 'text' ? value : '')

  return createPortal(
    <div className="backdrop ask-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) finish(null) }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.stopPropagation(); finish(null) }
        // Enter is OK (unless you've tabbed to Cancel)
        if (e.key === 'Enter' && !(e.target as HTMLElement).classList.contains('ask-cancel')) { e.preventDefault(); ok() }
      }}>
      <div className="ask-box" role="dialog" aria-modal="true">
        <div className="ask-msg">{ask.message}</div>
        {ask.kind === 'text' && <input ref={input} className="box-input" value={value} onChange={(e) => setValue(e.target.value)} />}
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn ask-cancel" onClick={() => finish(null)}>Cancel</button>
          <button ref={okBtn} className={`btn ${ask.danger ? 'danger' : 'primary'}`} onClick={ok}>{ask.ok}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
