import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { hasBook, loadBook, renderSection, searchBook, type BookSection, type Hit } from '../book/book'
import { linkSpells } from '../book/spellLinks'
import { SpellPeek } from './SpellPeek'
import { BookSetup } from './BookSetup'
import { useStore, useUI } from '../store'
import { systemOf } from '../systems'
import { listBooks, sectionsFromToc, type BookInfo } from '../book/books'
import { BookContents } from './BookContents'
import { PageReader } from './PageReader'
import { askText } from './Dialog'

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

  // the side pane's width (it slides out over the sheet)
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

const store = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }

/**
 * Picks the book: every imported sourcebook for this character's game (D&D: the 2024 SRD and any you've added;
 * Arknights: the AK5e book and the SRD), switchable from the header. The AK5e book also has a text view.
 */
function Reader({ layout, onClose }: { layout: BookLayout; onClose: () => void }) {
  const set = useUI((s) => s.set)
  const searchTick = useUI((s) => s.bookSearch)
  const sys = useStore((s) => systemOf(s.chars[s.activeId]))
  const [books, setBooks] = useState<BookInfo[] | null>(null)
  const [akText, setAkText] = useState<BookSection[] | null>(null)
  const [mode, setModeState] = useState<'pages' | 'text'>(() => (read('book-mode') === 'text' ? 'text' : 'pages'))
  const setMode = (m: 'pages' | 'text') => { setModeState(m); store('book-mode', m) }
  const [chosen, setChosen] = useState(() => read(`book-current-${sys}`) || '')
  useEffect(() => { listBooks().then(setBooks); loadBook().then(setAkText) }, [])

  const mine = (books ?? []).filter((b) => b.games.includes(sys))
  // the AK5e book's text works even before its pages are imported
  const choices: { id: string; title: string; info?: BookInfo }[] = mine.map((b) => ({ id: b.id, title: b.title, info: b }))
  if (sys === 'ak5e' && hasBook() && !choices.some((b) => b.id === 'ak5e')) choices.unshift({ id: 'ak5e', title: 'Arknights 5e' })
  choices.sort((a, b) => (a.id === 'ak5e' ? -1 : b.id === 'ak5e' ? 1 : 0))
  const cur = choices.find((b) => b.id === chosen) ?? choices[0]
  const sections = useMemo(() => (!cur ? [] : cur.id === 'ak5e' ? (akText ?? []) : cur.info ? sectionsFromToc(cur.info) : []), [cur?.id, akText]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!books || (hasBook() && !akText)) return <div className="book"><div className="bk-empty muted">Opening the sourcebook…</div></div>
  if (!cur) {
    return (
      <div className="book">
        <div className="bk-head"><b>Sourcebooks</b><span className="grow" /><button className="btn sm" onClick={onClose}>✕ Close</button></div>
        <div className="bk-empty bk-setup">
          <p>No sourcebooks for this game yet. Get them onto this computer here (once; every character of that game can open them):</p>
          <BookSetup game={sys} />
        </div>
      </div>
    )
  }
  const pick = (id: string) => { setChosen(id); store(`book-current-${sys}`, id) }
  const canText = cur.id === 'ak5e' && hasBook()
  const showPages = cur.info && (mode === 'pages' || !canText)
  const extra = (
    <>
      {choices.length > 1 && (
        <select className="bk-pick" value={cur.id} onChange={(e) => pick(e.target.value)} title="Switch book">
          {choices.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
      )}
      {canText && cur.info && (
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
  if (showPages) return <PageReader key={cur.id} book={sections} pb={cur.info!} {...props} />
  return <TextReader {...props} />
}

/** Bookmarks for one book, plus the "bookmark this" action, for the contents sidebar. */
export function useBookmarks(bookId: string) {
  const all = useStore((s) => s.bookmarks)
  const add = useStore((s) => s.addBookmark)
  const update = useStore((s) => s.updateBookmark)
  const remove = useStore((s) => s.removeBookmark)
  return {
    marks: all.filter((b) => b.book === bookId).sort((a, b) => a.page - b.page || a.y - b.y),
    add: (page: number, title: string, y = 0) => add({ book: bookId, page, title, y }),
    rename: async (id: string, old: string) => { const t = (await askText('Bookmark name', old)); if (t != null && t.trim()) update(id, { title: t.trim() }) },
    remove,
  }
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
  const bm = useBookmarks('ak5e')

  useEffect(() => { loadBook().then(setBook) }, [])
  useEffect(() => { try { localStorage.setItem(LAST, String(cur)) } catch { /* private mode */ } }, [cur])

  const sec = book?.[cur]
  const customSpells = useStore((s) => s.customSpells)
  const [peek, setPeek] = useState<{ name: string; x: number; y: number } | null>(null)
  // spell / Art names link to the spell
  const html = useMemo(() => {
    if (!sec) return ''
    const doc = new DOMParser().parseFromString(`<div>${renderSection(sec)}</div>`, 'text/html')
    const root = doc.body.firstElementChild!
    linkSpells(root)
    return root.innerHTML
  }, [sec, customSpells])
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
      if (e.key === 'Escape' && document.querySelector('.spell-peek, .ask-box')) return
      if (e.key === 'Escape' && keyInScope(layout, e)) { e.stopImmediatePropagation(); if (q && document.activeElement === search.current) setQ(''); else onClose() }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [q, onClose, layout])

  // links inside the book: its own contents page uses #p<page>; web links open in the browser
  const onClick = (e: React.MouseEvent) => {
    const spell = (e.target as HTMLElement).closest('.bk-spell')
    if (spell) { setPeek({ name: spell.getAttribute('data-spell') || '', x: e.clientX, y: e.clientY }); return }
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
        <div className="bk-empty bk-setup">
          <p>The book isn't on this computer yet:</p>
          <BookSetup game="ak5e" />
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
        <button className="btn sm bk-markbtn" title="Bookmark this section" disabled={!sec} onClick={() => sec && bm.add(sec.page, sec.title)}>☆</button>
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
          ) : book && <BookContents book={book} current={cur} onSection={(s) => go(s.id)} onHeading={(s, h) => go(s.id, { slug: h.slug })}
            marks={bm.marks} onOpenMark={(m) => goPage(m.page)} onRenameMark={(m) => bm.rename(m.id, m.title)} onRemoveMark={(m) => bm.remove(m.id)}
            onMarkHere={(title, p) => bm.add(p, title)} />}
        </nav>
        <article ref={body} className="bk-text" onClick={onClick}>
          {sec && <div className="bk-crumb">{book![sec.chapter].title}{sec.level === 2 ? ` › ${sec.title}` : ''}</div>}
          {/* only this part is touched by search highlighting: React doesn't manage what's inside it */}
          <div ref={textEl} dangerouslySetInnerHTML={{ __html: html }} />
          {peek && <SpellPeek name={peek.name} at={peek} onClose={() => setPeek(null)} />}
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
