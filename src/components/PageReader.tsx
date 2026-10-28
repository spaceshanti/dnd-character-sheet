import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { BookSection } from '../book/book'
import { BookContents } from './BookContents'
import { keyInScope, useBookmarks, type ReaderProps } from './BookViewer'
import type { BookInfo } from '../book/books'

/*
 * A sourcebook as its real pages (rendered from your PDF by tools/import_book_pdf.py), with the same
 * contents sidebar as the text view. Search runs over each page's words and highlights them on the page.
 * Only the pages around where you are get loaded, so hundreds of pages scroll smoothly.
 */

type Word = [number, number, number, number, string]

interface PageHit { page: number; w0: number; w1: number; before: string; match: string; after: string }
const GAP = 14

export function PageReader({ book, pb, layout, onClose, extra, searchTick }: ReaderProps & { book: BookSection[]; pb: BookInfo }) {
  // where you were, per book (the AK5e book used to be the only one)
  const LAST = `book-page-${pb.id}`
  const scroller = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const [width, setWidth] = useState(900)
  const [zoom, setZoom] = useState(() => { try { return +(localStorage.getItem('book-zoom') || 1) || 1 } catch { return 1 } })
  const [page, setPage] = useState(() => { try { return Math.max(1, +(localStorage.getItem(LAST) || (pb.id === 'ak5e' && localStorage.getItem('book-page')) || 1)) } catch { return 1 } })
  const bm = useBookmarks(pb.id)
  const [words, setWords] = useState<Word[][] | null>(null)
  const [q, setQ] = useState('')
  const [hitIdx, setHitIdx] = useState(-1)
  const [pageInput, setPageInput] = useState('')
  // contents shown or not, remembered separately for the side pane (folded away by default: it's narrow) and full screen
  const navKey = `book-nav-${layout}`
  const [navOpen, setNavOpen] = useState(() => { try { const v = localStorage.getItem(navKey); return v ? v === '1' : layout === 'full' } catch { return layout === 'full' } })
  useEffect(() => { try { const v = localStorage.getItem(navKey); setNavOpen(v ? v === '1' : layout === 'full') } catch { /* private mode */ } }, [navKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggleNav = () => setNavOpen((o) => { try { localStorage.setItem(navKey, o ? '0' : '1') } catch { /* private mode */ } return !o })
  // Ctrl+F from anywhere in the app lands in this search box
  useEffect(() => { if (searchTick) { search.current?.focus(); search.current?.select() } }, [searchTick])

  useEffect(() => { fetch(pb.base + 'words.json').then((r) => r.json()).then(setWords).catch(() => setWords([])) }, [pb.base])
  useEffect(() => { try { localStorage.setItem(LAST, String(page)); localStorage.setItem('book-zoom', String(zoom)) } catch { /* private mode */ } }, [page, zoom])

  // page size follows the window (and zoom); every page is the same size
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  const pageW = Math.max(300, Math.min(width - 48, 1000) * zoom)
  const pageH = pageW * pb.aspect
  const stride = pageH + GAP

  const scrollToPage = (p: number, frac = 0) => {
    const el = scroller.current
    if (!el) return
    const n = Math.min(pb.pages, Math.max(1, p))
    el.scrollTop = (n - 1) * stride + Math.max(0, frac * pageH - 40)
    setPage(n)
  }
  // open where you left off; keep the same page when the size changes
  const first = useRef(true)
  useLayoutEffect(() => {
    if (first.current) { first.current = false; scrollToPage(page); return }
    scrollToPage(page)
  }, [stride]) // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = scroller.current
    if (el) setPage(Math.min(pb.pages, Math.floor((el.scrollTop + el.clientHeight * 0.3) / stride) + 1))
  }

  // page text for search: the page's words in order, with where each word starts
  const texts = useMemo(() => (words ?? []).map((pw) => {
    const starts: number[] = []
    let text = ''
    for (const w of pw) { starts.push(text.length); text += w[4] + ' ' }
    return { text, lower: text.toLowerCase(), starts }
  }), [words])
  const wordAt = (starts: number[], pos: number) => {
    let lo = 0, hi = starts.length - 1
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1 }
    return lo
  }
  const hits: PageHit[] = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/\s+/g, ' ')
    if (t.length < 2) return []
    const out: PageHit[] = []
    texts.forEach((pt, i) => {
      for (let at = pt.lower.indexOf(t); at >= 0 && out.length < 1500; at = pt.lower.indexOf(t, at + t.length)) {
        out.push({
          page: i + 1, w0: wordAt(pt.starts, at), w1: wordAt(pt.starts, at + t.length - 1),
          before: pt.text.slice(Math.max(0, at - 50), at), match: pt.text.slice(at, at + t.length), after: pt.text.slice(at + t.length, at + t.length + 70),
        })
      }
    })
    return out
  }, [texts, q])
  const hitsByPage = useMemo(() => {
    const m = new Map<number, PageHit[]>()
    for (const h of hits) { if (!m.has(h.page)) m.set(h.page, []); m.get(h.page)!.push(h) }
    return m
  }, [hits])

  const showHit = (i: number) => {
    const h = hits[i]
    if (!h) return
    setHitIdx(i)
    scrollToPage(h.page, (words![h.page - 1][h.w0]?.[1] ?? 0) / 1000 - 0.15)
  }
  const stepHit = (dir: 1 | -1) => { if (hits.length) showHit((hitIdx + dir + hits.length) % hits.length) }

  /** where a heading sits on its page (so the jump lands on it, not the top of the page) */
  const titleY = (p: number, title: string) => {
    const pt = texts[p - 1]
    if (!pt) return 0
    const at = pt.lower.indexOf(title.toLowerCase().replace(/\s+/g, ' ').slice(0, 40))
    return at < 0 ? 0 : (words![p - 1][wordAt(pt.starts, at)][1]) / 1000
  }
  const goSection = (s: BookSection) => scrollToPage(s.page, titleY(s.page, s.title))
  const goHeading = (_s: BookSection, h: BookSection['subs'][number]) => scrollToPage(h.page, titleY(h.page, h.title))
  /** the nearest heading at or above a spot, to name a bookmark */
  const headingAt = (p: number, y: number) => {
    let best = ''
    for (const s of book) {
      if (s.page < p || (s.page === p && titleY(p, s.title) <= y + 0.05)) best = s.title
      for (const h of s.subs) if (h.page < p || (h.page === p && titleY(p, h.title) <= y + 0.05)) best = h.title
    }
    return best
  }

  // which section you're in, for the contents highlight
  const current = useMemo(() => {
    let id = 0
    for (const s of book) if (s.page <= page) id = s.id
    return id
  }, [book, page])

  // the book's own contents pages: each line ending in a page number becomes a link
  const contents = book.find((s) => s.title === 'Contents')
  const tocLinks = (p: number) => {
    if (!contents || p < contents.page || p > contents.lastPage || !words) return []
    const lines = new Map<number, Word[]>()
    for (const w of words[p - 1] ?? []) {
      const key = [...lines.keys()].find((y) => Math.abs(y - w[1]) <= 4) ?? w[1]
      if (!lines.has(key)) lines.set(key, [])
      lines.get(key)!.push(w)
    }
    const out: { x0: number; y0: number; x1: number; y1: number; to: number }[] = []
    for (const ws of lines.values()) {
      ws.sort((a, b) => a[0] - b[0])
      // two columns on the contents pages: split a line where a page number sits in the middle
      let run: Word[] = []
      for (const w of ws) {
        run.push(w)
        if (/^\d{1,3}$/.test(w[4]) && +w[4] <= pb.pages && run.length > 1) {
          out.push({ x0: run[0][0], y0: Math.min(...run.map((r) => r[1])), x1: w[2], y1: Math.max(...run.map((r) => r[3])), to: +w[4] })
          run = []
        }
      }
    }
    return out
  }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!keyInScope(layout, e)) return
      const typing = /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)
      if (e.key === 'Escape') { e.stopImmediatePropagation(); if (q && document.activeElement === search.current) setQ(''); else onClose() }
      else if (!typing && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); scrollToPage(page + (e.key === 'ArrowRight' ? 1 : -1)) }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  })

  const from = Math.max(1, page - 2)
  const to = Math.min(pb.pages, page + 3)
  const groups = [...hitsByPage.entries()]

  return (
    <div className="book">
      <div className="bk-head">
        <button className={`btn sm ${navOpen ? 'primary' : ''}`} title={navOpen ? 'Hide the contents' : 'Show the contents'} onClick={toggleNav}>☰</button>
        <b className="bk-title">{pb.title}</b>
        <div className="bk-search">
          <input ref={search} placeholder={words ? 'Search the book (Ctrl + F)' : 'Loading the words…'} value={q} autoFocus
            onChange={(e) => { setQ(e.target.value); setHitIdx(-1) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); stepHit(e.shiftKey ? -1 : 1) } }} />
          {q.trim().length >= 2 && <span className="bk-count">{hits.length ? `${hitIdx >= 0 ? hitIdx + 1 : '–'} / ${hits.length}` : 'no matches'}</span>}
          {hits.length > 0 && <><button className="btn sm" title="Previous (Shift + Enter)" onClick={() => stepHit(-1)}>↑</button><button className="btn sm" title="Next (Enter)" onClick={() => stepHit(1)}>↓</button></>}
          {q && <button className="btn sm ghost" title="Clear" onClick={() => setQ('')}>✕</button>}
        </div>
        <span className="grow" />
        <div className="bk-zoom">
          <button className="btn sm" title="Smaller" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))}>−</button>
          <button className="btn sm ghost" title="Fit width" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button className="btn sm" title="Bigger" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}>＋</button>
        </div>
        <form className="bk-goto" onSubmit={(e) => { e.preventDefault(); const n = parseInt(pageInput, 10); if (n) scrollToPage(n); setPageInput('') }}>
          <button type="button" className="btn sm" title="Previous page (←)" onClick={() => scrollToPage(page - 1)}>‹</button>
          <input placeholder={String(page)} value={pageInput} onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))} />
          <span className="muted small">/ {pb.pages}</span>
          <button type="button" className="btn sm" title="Next page (→)" onClick={() => scrollToPage(page + 1)}>›</button>
        </form>
        <button className="btn sm bk-markbtn" title="Bookmark this page" onClick={() => {
          const el = scroller.current
          const y = el ? Math.max(0, (el.scrollTop - (page - 1) * stride) / pageH) : 0
          bm.add(page, headingAt(page, y) || `Page ${page}`, y)
        }}>☆</button>
        {extra}
        <button className="btn sm" onClick={onClose} title="Close (Esc)">✕</button>
      </div>
      <div className="bk-body">
        <nav className="bk-nav" hidden={!navOpen && q.trim().length < 2}>
          {q.trim().length >= 2 ? (
            <div className="bk-results">
              {!words && <div className="muted small" style={{ padding: 12 }}>Loading the words…</div>}
              {words && hits.length === 0 && <div className="muted small" style={{ padding: 12 }}>Nothing found.</div>}
              {groups.map(([p, list]) => {
                const sec = [...book].reverse().find((s) => s.page <= p)
                return (
                  <div key={p} className="bk-group">
                    <div className="bk-gt">p. {p}{sec ? ` · ${sec.title}` : ''} <span className="muted">· {list.length}</span></div>
                    {list.slice(0, 6).map((h) => {
                      const i = hits.indexOf(h)
                      return (
                        <button key={i} className={`bk-hitrow ${i === hitIdx ? 'on' : ''}`} onClick={() => showHit(i)}>
                          …{h.before}<mark>{h.match}</mark>{h.after}…
                        </button>
                      )
                    })}
                    {list.length > 6 && <button className="bk-more" onClick={() => showHit(hits.indexOf(list[6]))}>+ {list.length - 6} more on this page</button>}
                  </div>
                )
              })}
            </div>
          ) : <BookContents book={book} current={current} onSection={goSection} onHeading={goHeading}
            marks={bm.marks} onOpenMark={(m) => scrollToPage(m.page, m.y)} onRenameMark={(m) => bm.rename(m.id, m.title)} onRemoveMark={(m) => bm.remove(m.id)}
            onMarkHere={(title, p) => bm.add(p, title, titleY(p, title))} />}
        </nav>
        <div ref={scroller} className="bk-pages" onScroll={onScroll}>
          {/* wide enough for zoomed-in pages to scroll sideways instead of being cut off */}
          <div style={{ height: pb.pages * stride + 20, position: 'relative', width: Math.max(pageW + 100, width - 2) }}>
            {Array.from({ length: to - from + 1 }, (_, k) => from + k).map((p) => (
              <div key={p} className="bk-sheet" style={{ top: (p - 1) * stride, width: pageW, height: pageH }}>
                <img src={`${pb.base}pages/${String(p).padStart(3, '0')}.${pb.ext}`} alt={`Page ${p}`} draggable={false} />
                {(hitsByPage.get(p) ?? []).map((h) => {
                  const i = hits.indexOf(h)
                  return words![p - 1].slice(h.w0, h.w1 + 1).map((w, j) => (
                    <i key={`${i}-${j}`} className={`bk-hl ${i === hitIdx ? 'now' : ''}`}
                      style={{ left: `${w[0] / 10}%`, top: `${w[1] / 10}%`, width: `${(w[2] - w[0]) / 10}%`, height: `${(w[3] - w[1]) / 10}%` }} />
                  ))
                })}
                {tocLinks(p).map((l, j) => (
                  <button key={j} className="bk-toclink" title={`Go to page ${l.to}`} onClick={() => scrollToPage(l.to, 0)}
                    style={{ left: `${l.x0 / 10}%`, top: `${l.y0 / 10}%`, width: `${(l.x1 - l.x0) / 10}%`, height: `${(l.y1 - l.y0) / 10}%` }} />
                ))}
                <span className="bk-pnum">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
