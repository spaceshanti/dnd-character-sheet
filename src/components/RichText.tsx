import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { isHtml, sanitize, toHtml } from '../rich'

/** Shows stored text: rich HTML (sanitised) or plain text with its line breaks. */
export function RichText({ value, className = '', style }: { value: string; className?: string; style?: CSSProperties }) {
  if (!value) return null
  if (!isHtml(value)) return <div className={className} style={{ whiteSpace: 'pre-wrap', ...style }}>{value}</div>
  return <div className={`${className} rich`} style={style} dangerouslySetInnerHTML={{ __html: sanitize(value) }} />
}

const TOOLS: { label: string; title: string; run: () => void; style?: CSSProperties }[] = [
  { label: 'B', title: 'Bold (Ctrl+B)', run: () => document.execCommand('bold'), style: { fontWeight: 800 } },
  { label: 'I', title: 'Italic (Ctrl+I)', run: () => document.execCommand('italic'), style: { fontStyle: 'italic' } },
  { label: 'U', title: 'Underline (Ctrl+U)', run: () => document.execCommand('underline'), style: { textDecoration: 'underline' } },
  { label: 'S', title: 'Strikethrough', run: () => document.execCommand('strikeThrough'), style: { textDecoration: 'line-through' } },
  {
    label: 'H', title: 'Heading', style: { fontWeight: 800 },
    run: () => document.execCommand('formatBlock', false, document.queryCommandValue('formatBlock').toLowerCase() === 'h3' ? 'div' : 'h3'),
  },
  { label: '•', title: 'Bullet list', run: () => document.execCommand('insertUnorderedList') },
  { label: '1.', title: 'Numbered list', run: () => document.execCommand('insertOrderedList') },
  { label: '⌫', title: 'Clear formatting', run: () => { document.execCommand('removeFormat'); document.execCommand('formatBlock', false, 'div') } },
]

/**
 * Multi-line text box with formatting and spellcheck. Drop-in for the old textarea `Area`:
 * same props, stores simple HTML. A small toolbar floats above it while it has focus.
 */
export function RichArea({
  value, onChange, placeholder, className = '', minRows = 3,
}: { value: string; onChange: (s: string) => void; placeholder?: string; className?: string; minRows?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef<string>('')
  const [focused, setFocused] = useState(false)

  // load / update from outside without disturbing typing
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || value === last.current) return
    el.innerHTML = toHtml(value)
    last.current = value
  }, [value])

  const emit = () => {
    const el = ref.current
    if (!el) return
    if (el.innerHTML === '<br>' || el.innerHTML === '<div><br></div>') el.innerHTML = ''
    last.current = el.innerHTML
    onChange(el.innerHTML)
  }

  return (
    <>
      <div
        ref={ref}
        className={`${className} rich-edit rich`}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        style={{ minHeight: `calc(${minRows} * 1.5em)` }}
        onInput={emit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPaste={(e) => {
          // keep formatting from pasted text but nothing else (scripts, styles, images, links...)
          e.preventDefault()
          const html = e.clipboardData.getData('text/html')
          if (html) document.execCommand('insertHTML', false, sanitize(html))
          else document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
        }}
      />
      {focused && <Toolbar anchor={ref.current} onChange={emit} />}
    </>
  )
}

function Toolbar({ anchor, onChange }: { anchor: HTMLElement | null; onChange: () => void }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useEffect(() => {
    const place = () => {
      if (!anchor) return
      const r = anchor.getBoundingClientRect()
      const top = r.top - 34 < 4 ? r.bottom + 6 : r.top - 34
      setPos({ left: Math.max(6, Math.min(r.right - 268, window.innerWidth - 274)), top })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place) }
  }, [anchor])
  if (!pos) return null
  return createPortal(
    <div className="rich-toolbar" style={pos} onMouseDown={(e) => e.preventDefault() /* keep the text selected */}>
      {TOOLS.map((t) => (
        <button key={t.label} type="button" title={t.title} style={t.style} onClick={() => { t.run(); onChange() }}>{t.label}</button>
      ))}
    </div>,
    document.body,
  )
}
