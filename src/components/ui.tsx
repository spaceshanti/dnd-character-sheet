import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ACTION_TYPES, EFFECT_TARGETS, EFFECT_TYPES } from '../constants'
import { newEffect } from '../blank'
import type { Effect, EffectType } from '../types'

export function Frame({
  title, children, className = '', tools, style, tight,
}: { title?: string; children: ReactNode; className?: string; tools?: ReactNode; style?: CSSProperties; tight?: boolean }) {
  return (
    <div className={`frame ${tight ? 'tight' : ''} ${className}`} style={style}>
      <div className="frame-in">
        {title && (
          <div className="frame-title">
            <span>{title}</span>
            {tools && <span className="tools">{tools}</span>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/** Number input that keeps a draft while typing so "-" or empty don't snap back. */
export function Num({
  value, onChange, min, max, className = '', style, placeholder, width,
}: { value: number; onChange: (n: number) => void; min?: number; max?: number; className?: string; style?: CSSProperties; placeholder?: string; width?: number }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (s: string) => {
    setDraft(null)
    let n = parseFloat(s)
    if (isNaN(n)) n = min ?? 0
    if (min != null) n = Math.max(min, n)
    if (max != null) n = Math.min(max, n)
    if (n !== value) onChange(n)
  }
  return (
    <input
      className={className}
      style={{ ...(width ? { width } : {}), ...style }}
      inputMode="decimal"
      placeholder={placeholder}
      value={draft ?? String(value)}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setDraft(e.target.value)
        const n = parseFloat(e.target.value)
        if (!isNaN(n) && /^-?\d*\.?\d+$/.test(e.target.value)) {
          let v = n
          if (min != null) v = Math.max(min, v)
          if (max != null) v = Math.min(max, v)
          onChange(v)
        }
      }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

export function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string }) {
  return (
    <div className="field">
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <label>{label}</label>
    </div>
  )
}

export function Area({
  value, onChange, placeholder, className = '', minRows = 3,
}: { value: string; onChange: (s: string) => void; placeholder?: string; className?: string; minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fit = () => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = el.scrollHeight + 2 + 'px'
  }
  useLayoutEffect(fit, [value])
  useEffect(() => {
    const ro = new ResizeObserver(fit)
    if (ref.current?.parentElement) ro.observe(ref.current.parentElement)
    return () => ro.disconnect()
  }, [])
  return (
    <textarea
      ref={ref} rows={minRows} className={className} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function Switch({ on, onChange, title }: { on: boolean; onChange: (b: boolean) => void; title?: string }) {
  return <button type="button" className={`switch ${on ? 'on' : ''}`} title={title} onClick={(e) => { e.stopPropagation(); onChange(!on) }} />
}

/** Filled pip = still available. Click a filled pip to spend one, an empty pip to regain one. */
export function Pips({
  total, used, onChange, kind = '',
}: { total: number; used: number; onChange: (used: number) => void; kind?: string }) {
  if (total > 24) {
    return (
      <span className="row small">
        <button className="btn sm icon" onClick={() => onChange(Math.min(total, used + 1))}>−</button>
        <b>{Math.max(0, total - used)}</b> / {total}
        <button className="btn sm icon" onClick={() => onChange(Math.max(0, used - 1))}>+</button>
      </span>
    )
  }
  return (
    <span className="pips">
      {Array.from({ length: total }, (_, i) => {
        const avail = i < total - used
        return (
          <button
            key={i} type="button" className={`pip ${kind} ${avail ? 'on' : ''}`}
            onClick={(e) => { e.stopPropagation(); onChange(avail ? Math.min(total, used + 1) : Math.max(0, used - 1)) }}
          />
        )
      })}
    </span>
  )
}

export function Popover({ anchor, onClose, children, width }: { anchor: HTMLElement | null; onClose: () => void; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -999, top: -999 })
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return
    const r = anchor.getBoundingClientRect()
    const w = ref.current.offsetWidth
    const h = ref.current.offsetHeight
    let left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8)
    let top = r.bottom + 6
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6)
    setPos({ left, top })
  }, [anchor, children])
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor?.contains(e.target as Node)) return
      onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [anchor, onClose])
  return createPortal(<div ref={ref} className="popover" style={{ ...pos, ...(width ? { width } : {}) }}>{children}</div>, document.body)
}

export function Modal({ title, onClose, children, wide, tools }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; tools?: ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  return createPortal(
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { width: 'min(1280px, 100%)', height: '100%' } : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          {tools}
          <button className="btn icon" onClick={onClose} title="Close (Esc)">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Drawer({ title, onClose, children, tools }: { title: ReactNode; onClose: () => void; children: ReactNode; tools?: ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(0,0,0,.25)' }} onMouseDown={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <h2>{title}</h2>
          {tools}
          <button className="btn icon" onClick={onClose} title="Close (Esc)">✕</button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>,
    document.body,
  )
}

export function Select<T extends string>({
  value, onChange, options, className,
}: { value: T; onChange: (v: T) => void; options: { id: T; name: string }[]; className?: string }) {
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  )
}

export const ActionSelect = ({ value, onChange }: { value: Parameters<typeof Select>[0]['value']; onChange: (v: any) => void }) => (
  <Select value={value as string} onChange={onChange} options={ACTION_TYPES as any} />
)

function allowedTypes(target: string): EffectType[] {
  if (target.startsWith('ability:')) return ['bonus', 'minScore', 'note']
  if (target.startsWith('save:') || target.startsWith('skill:')) return ['advantage', 'disadvantage', 'bonus', 'proficiency', 'expertise', 'note']
  if (target === 'initiative' || target === 'attack') return ['bonus', 'advantage', 'disadvantage', 'note']
  return ['bonus', 'note']
}

/** Lets any feature / item / spell be linked to the things it changes. */
export function EffectsEditor({ effects, onChange }: { effects: Effect[]; onChange: (e: Effect[]) => void }) {
  const set = (id: string, patch: Partial<Effect>) => onChange(effects.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  return (
    <div className="fx">
      {effects.length === 0 && <div className="muted small" style={{ marginBottom: 6 }}>No links yet. Link this to a skill, save, AC, speed… and it will show up there and count in the math.</div>}
      {effects.map((e) => {
        const types = allowedTypes(e.target)
        return (
          <div className="fx-row" key={e.id}>
            <select
              value={e.target}
              onChange={(ev) => {
                const t = ev.target.value
                const ok = allowedTypes(t)
                set(e.id, { target: t, type: ok.includes(e.type) ? e.type : ok[0] })
              }}
            >
              {EFFECT_TARGETS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </optgroup>
              ))}
            </select>
            <select value={e.type} onChange={(ev) => set(e.id, { type: ev.target.value as EffectType })}>
              {EFFECT_TYPES.filter((t) => types.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {(e.type === 'bonus' || e.type === 'minScore') && (
              <Num className="box-input n" width={56} value={e.value ?? 0} onChange={(n) => set(e.id, { value: n })} />
            )}
            <input className="box-input grow" style={{ minWidth: 90 }} placeholder="note (optional)" value={e.note ?? ''} onChange={(ev) => set(e.id, { note: ev.target.value })} />
            <button className="btn icon sm" onClick={() => onChange(effects.filter((x) => x.id !== e.id))}>✕</button>
          </div>
        )
      })}
      <button className="btn sm" onClick={() => onChange([...effects, newEffect()])}>＋ Link to something</button>
    </div>
  )
}

export function Toast({ msg }: { msg: string }) {
  return msg ? createPortal(<div className="toast">{msg}</div>, document.body) : null
}

export function useToast() {
  const [msg, setMsg] = useState('')
  const t = useRef<ReturnType<typeof setTimeout>>()
  const show = (m: string) => {
    setMsg(m)
    clearTimeout(t.current)
    t.current = setTimeout(() => setMsg(''), 2400)
  }
  return { msg, show }
}
