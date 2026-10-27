import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { hasBook, loadBook, renderSection, searchBook, type BookSection, type Hit } from '../book/book'
import { useUI } from '../store'
import { BookContents } from './BookContents'
import { findPageBook, PageReader, type PageBook } from './PageReader'

/*
 * In-app reader for the Arknights 5e sourcebook: contents on the left (chapters → sections → sub-headings),
 * one section at a time on the right, full-text search with every hit listed, jump to page.
 * Ctrl + F focuses search, Enter / Shift + Enter step through hits, Esc closes.
 */

export type BookLayout = 'side' | 'full'

/** Things every reader view gets: how it's shown, how to close it, and the "focus your search box" signal. */
export interface ReaderProps { layout: BookLayout; onClose: () => void; extra: ReactNode; searchTick: number }

/** In side mode, keys only count when you're in the pane (so Esc etc. still work on the sheet). */
export const keyInScope = (layout: BookLayout, e: KeyboardEvent) =>
  layout === 'full' || !!(e.target as HTMLElement | null)?.closest?.('.book-frame')

const WIDTH_KEY = 'book-side-w'

export function BookViewer() {
  const layout = useUI((s) => s.book)
  const set = useUI((s) => s.set)
  const [w, setW] = useState(() => { try { return +(localStorage.getItem(WIDTH_KEY) || 0) || 620 } catch { return 620 } })

  // the side pane pushes the sheet over instead of covering it
  useEffect(() => {
    const root = document.documentElement
    root.dataset.book = layout
    root.style.setProperty('--book-w', `${w}px`)
    return () => { root.dataset.book = '' }
  }, [layout, w])

  if (!layout) return null
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    const move = (ev: MouseEvent) => setW(Math.round(Math.min(window.innerWidth * 0.75, Math.max(360, window.innerWidth - ev.clientX))))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.classList.remove('bk-dragging')
      setW((v) => { try { localStorage.setItem(WIDTH_KEY, String(v)) } catch { /* private mode */ } return v })
    }
    document.body.classList.add('bk-dragging')
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }
  return createPortal(
    <div className={`book-frame ${layout}`}>
      {layout === 'side' && <div className="bk-resize" title="Drag to resize" onMouseDown={startDrag} />}
      <Reader layout={layout} onClose={() => set({ book: '' })} />
    </div>,
    document.body,
  )
}

/** The real pages when the PDF has been imported (tools/import_ak5e_pdf.py), the text otherwise; switchable. */
function Reader({ layout, onClose }: { layout: BookLayout; onClose: () => void }) {
  const set = useUI((s) => s.set)
  const searchTick = useUI((s) => s.bookSearch)
  const [book, setBook] = useState<BookSection[] | null>(null)
  const [pb, setPb] = useState<PageBook | null | undefined>(undefined)
  const [mode, setModeState] = useState<'pages' | 'text'>(() => { try { return localStorage.getItem('book-mode') === 'text' ? 'text' : 'pages' } catch { return 'pages' } })
  const setMode = (m: 'pages' | 'text') => { setModeState(m); try { localStorage.setItem('book-mode', m) } catch { /* private mode */ } }
  useEffect(() => { loadBook().then(setBook); findPageBook().then(setPb) }, [])
  if (pb === undefined || (hasBook() && !book)) return <div className={`book ${layout}`}><div className="bk-empty muted">Opening the sourcebook…</div></div>
  const extra = (
    <>
      {pb && hasBook() && (
        <div className="seg bk-mode">
          <button className={mode === 'pages' ? 'on' : ''} onClick={() => setMode('pages')} title="The book's real pages">Pages</button>
          <button className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')} title="Plain text, follows your UI style">Text</button>
        </div>
      )}
      {layout === 'side'
        ? <button className="btn sm" title="Full screen" onClick={() => set({ book: 'full' })}>⤢</button>
        : <button className="btn sm" title="Side pane (Ctrl + B)" onClick={() => set({ book: 'side' })}>◧</button>}
    </>
  )
  const props: ReaderProps = { layout, onClose, extra, searchTick }
  if (pb && (mode === 'pages' || !hasBook())) return <PageReader book={book ?? []} pb={pb} {...props} />
  return <TextReader {...props} />
}

const LAST = 'book-last'

function TextReader({ layout, onClose, extra, searchTick }: ReaderProps) {
  const [book, setBook] = useState<BookSection[] | null>(null)
  const [cur, setCur] = useState(() => { try { return +(localStorage.getItem(LAST) || 0) } catch { return 0 } })
  const [q, setQ] = useState('')
  const [hitIdx, setHitIdx] = useState(-1)
  const [scrollTo, setScrollTo] = useState<{ page?: number; slug?: string; nth?: number } | null>(null)
  const [pageInput, setPageInput] = useState('')
  const body = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const marked = useRef('')
  const textEl = useRef<HTMLDivElement>(null)

  useEffect(() => { loadBook().then(setBook) }, [])
  useEffect(() => { try { localStorage.setItem(LAST, String(cur)) } catch { /* private mode */ } }, [cur])

  const sec = book?.[cur]
  const html = useMemo(() => (sec ? renderSection(sec) : ''), [sec])
  const hits: Hit[] = useMemo(() => (book ? searchBook(book, q) : []), [book, q])

  const go = (id: number, to?: { page?: number; slug?: string; nth?: number }) => {
    setCur(id)
    setScrollTo(to ?? {})
  }
  const goPage = (page: number) => {
    if (!book) return
    const s = book.find((x) => x.md.includes(`data-page="${page}"`)) ?? [...book].reverse().find((x) => x.page <= page)
    if (s) go(s.id, { page })
  }

  // after a section renders: mark search words, then scroll where we were asked to
  useLayoutEffect(() => {
    const el = textEl.current
    const scroller = body.current
    if (!el || !scroller) return
    // re-mark only when the text or the words change, so the current hit keeps its highlight
    const key = `${cur}\u0000${q}`
    if (marked.current !== key || !el.querySelector('mark.bk-hit')) { markHits(el, q); marked.current = key }
    const t = scrollTo
    if (!t) return
    let target: Element | null = null
    if (t.page) target = el.querySelector(`[data-page="${t.page}"]`)
    if (t.slug) target = el.querySelector(`[id="${CSS.escape(t.slug)}"]`)
    if (t.nth != null) {
      const marks = el.querySelectorAll('mark.bk-hit')
      target = marks[Math.min(t.nth, marks.length - 1)] ?? null
      marks.forEach((m) => m.classList.remove('now'))
      target?.classList.add('now')
    }
    if (target) target.scrollIntoView({ block: t.nth != null ? 'center' : 'start' })
    else scroller.scrollTop = 0
    setScrollTo(null)
  }, [html, scrollTo, q])

  const stepHit = (dir: 1 | -1) => {
    if (!hits.length) return
    const n = (hitIdx + dir + hits.length) % hits.length
    setHitIdx(n)
    go(hits[n].section, { nth: hits[n].nth })
  }

  // Ctrl+F from anywhere in the app lands in this search box
  useEffect(() => { if (searchTick) { search.current?.focus(); search.current?.select() } }, [searchTick])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && keyInScope(layout, e)) { e.stopImmediatePropagation(); if (q && document.activeElement === search.current) setQ(''); else onClose() }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [q, onClose, layout])

  // links inside the book: its own contents page uses #p<page>; web links open in the browser
  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a')
    if (!a) return
    const href = a.getAttribute('href') || ''
    e.preventDefault()
    const m = /^#p(\d+)$/.exec(href)
    if (m) goPage(+m[1])
    else if (/^https?:/.test(href)) window.sheetApi ? window.sheetApi.openExternal(href) : window.open(href, '_blank')
  }

  const hitGroups = useMemo(() => {
    const g = new Map<number, { hit: Hit; i: number }[]>()
    hits.forEach((h, i) => { if (!g.has(h.section)) g.set(h.section, []); g.get(h.section)!.push({ hit: h, i }) })
    return g
  }, [hits])

  if (!hasBook()) {
    return (
      <div className="book">
        <div className="bk-head"><b>Arknights 5e sourcebook</b><span className="grow" /><button className="btn sm" onClick={onClose}>✕ Close</button></div>
        <div className="bk-empty">
          <p>The book isn't in this copy of the app yet. Add your PDF of it once with</p>
          <code>python tools/import_ak5e_pdf.py "path/to/the book.pdf"</code>
          <p className="muted small">That shows the real pages. For the text view and contents, also run <code>python tools/import_ak5e.py</code> and rebuild.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="book">
      <div className="bk-head">
        <b className="bk-title">Arknights 5e</b>
        <div className="bk-search">
          <input ref={search} placeholder="Search the book (Ctrl + F)" value={q} autoFocus
            onChange={(e) => { setQ(e.target.value); setHitIdx(-1) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); stepHit(e.shiftKey ? -1 : 1) } }} />
          {q.trim().length >= 2 && <span className="bk-count">{hits.length ? `${hitIdx + 1 > 0 ? hitIdx + 1 : '–'} / ${hits.length}${hits.length >= 400 ? '+' : ''}` : 'no matches'}</span>}
          {hits.length > 0 && <><button className="btn sm" title="Previous (Shift + Enter)" onClick={() => stepHit(-1)}>↑</button><button className="btn sm" title="Next (Enter)" onClick={() => stepHit(1)}>↓</button></>}
          {q && <button className="btn sm ghost" title="Clear" onClick={() => setQ('')}>✕</button>}
        </div>
        <span className="grow" />
        <form className="bk-goto" onSubmit={(e) => { e.preventDefault(); const n = parseInt(pageInput, 10); if (n) goPage(n); setPageInput('') }}>
          <span className="muted small">{sec ? `p. ${sec.page}${sec.lastPage > sec.page ? `–${sec.lastPage}` : ''}` : ''}</span>
          <input placeholder="page" value={pageInput} onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))} />
          <button className="btn sm">Go</button>
        </form>
        <button className="btn sm" disabled={!sec || cur === 0} onClick={() => go(cur - 1)}>‹ Prev</button>
        <button className="btn sm" disabled={!book || cur >= book.length - 1} onClick={() => go(cur + 1)}>Next ›</button>
        {extra}
        <button className="btn sm" onClick={onClose} title="Close (Esc)">✕</button>
      </div>
      <div className="bk-body">
        <nav className="bk-nav">
          {!book && <div className="muted small" style={{ padding: 12 }}>Loading the book…</div>}
          {q.trim().length >= 2 ? (
            <div className="bk-results">
              {hits.length === 0 && <div className="muted small" style={{ padding: 12 }}>Nothing found.</div>}
              {[...hitGroups.entries()].map(([sid, list]) => (
                <div key={sid} className="bk-group">
                  <div className="bk-gt">{book![sid].title} <span className="muted">· {list.length}</span></div>
                  {list.slice(0, 12).map(({ hit, i }) => (
                    <button key={i} className={`bk-hitrow ${i === hitIdx ? 'on' : ''}`} onClick={() => { setHitIdx(i); go(sid, { nth: hit.nth }) }}>
                      …{hit.before}<mark>{hit.match}</mark>{hit.after}…
                    </button>
                  ))}
                  {list.length > 12 && <button className="bk-more" onClick={() => go(sid, { nth: 12 })}>+ {list.length - 12} more in this section</button>}
                </div>
              ))}
            </div>
          ) : book && <BookContents book={book} current={cur} onSection={(s) => go(s.id)} onHeading={(s, h) => go(s.id, { slug: h.slug })} />}
        </nav>
        <article ref={body} className="bk-text" onClick={onClick}>
          {sec && <div className="bk-crumb">{book![sec.chapter].title}{sec.level === 2 ? ` › ${sec.title}` : ''}</div>}
          {/* only this part is touched by search highlighting: React doesn't manage what's inside it */}
          <div ref={textEl} dangerouslySetInnerHTML={{ __html: html }} />
          {book && sec && (
            <div className="bk-foot">
              {cur > 0 && <button className="btn" onClick={() => go(cur - 1)}>‹ {book[cur - 1].title}</button>}
              <span className="grow" />
              {cur < book.length - 1 && <button className="btn primary" onClick={() => go(cur + 1)}>{book[cur + 1].title} ›</button>}
            </div>
          )}
        </article>
      </div>
    </div>
  )
}

/** Wrap every occurrence of the search words in <mark class="bk-hit">. */
function markHits(root: HTMLElement, q: string) {
  root.querySelectorAll('mark.bk-hit').forEach((m) => m.replaceWith(document.createTextNode(m.textContent || '')))
  root.normalize()
  const t = q.trim().toLowerCase()
  if (t.length < 2) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if ((n.textContent || '').toLowerCase().includes(t)) nodes.push(n as Text)
  for (const node of nodes) {
    const text = node.textContent || ''
    const lower = text.toLowerCase()
    const frag = document.createDocumentFragment()
    let from = 0
    for (let i = lower.indexOf(t); i >= 0; i = lower.indexOf(t, i + t.length)) {
      frag.append(text.slice(from, i))
      const m = document.createElement('mark')
      m.className = 'bk-hit'
      m.textContent = text.slice(i, i + t.length)
      frag.append(m)
      from = i + t.length
    }
    frag.append(text.slice(from))
    node.replaceWith(frag)
  }
}
