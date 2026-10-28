import { useEffect, useMemo, useState } from 'react'
import type { BookSection } from '../book/book'
import type { Bookmark } from '../types'

type Heading = BookSection['subs'][number]

export interface BookmarkProps {
  marks: Bookmark[]
  onOpenMark: (b: Bookmark) => void
  onRenameMark: (b: Bookmark) => void
  onRemoveMark: (b: Bookmark) => void
  /** bookmark a chapter / section / heading straight from the contents */
  onMarkHere: (title: string, page: number) => void
}

/** Contents sidebar: your bookmarks first, then chapters → sections → their headings. Folds open around where you are. */
export function BookContents({ book, current, onSection, onHeading, marks, onOpenMark, onRenameMark, onRemoveMark, onMarkHere }: BookmarkProps & {
  book: BookSection[]
  current: number
  onSection: (s: BookSection) => void
  onHeading: (s: BookSection, h: Heading) => void
}) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [subOpen, setSubOpen] = useState<Set<number>>(new Set())
  const chapters = useMemo(() => book.filter((s) => s.level === 1), [book])
  const flip = (set: typeof setOpen, id: number) => set((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const sec = book[current]

  // keep the current chapter, and the current section's headings, unfolded
  useEffect(() => {
    if (!sec) return
    setOpen((o) => (o.has(sec.chapter) ? o : new Set(o).add(sec.chapter)))
    if (sec.level === 2) setSubOpen((o) => (o.has(sec.id) ? o : new Set(o).add(sec.id)))
  }, [sec])

  const star = (title: string, page: number) => (
    <button className="bk-star" title="Bookmark this" onClick={(e) => { e.stopPropagation(); onMarkHere(title, page) }}>☆</button>
  )
  const headingRow = (s: BookSection, h: Heading, i: number, cls: string) => (
    <div key={i} className={`bk-row ${cls}`}>
      <button className="t" onClick={() => onHeading(s, h)}>{h.title}</button>
      {star(h.title, h.page)}
      <span className="pg">{h.page}</span>
    </div>
  )

  return (
    <>
      {marks.length > 0 && (
        <div className="bk-marks">
          <div className="bk-marks-h">★ Bookmarks</div>
          {marks.map((m) => (
            <div key={m.id} className="bk-row l1 bk-mark">
              <button className="t" onClick={() => onOpenMark(m)} onDoubleClick={() => onRenameMark(m)} title="Click to open · double-click to rename">{m.title}</button>
              <button className="bk-star on" title="Remove bookmark" onClick={() => onRemoveMark(m)}>✕</button>
              <span className="pg">{m.page}</span>
            </div>
          ))}
        </div>
      )}
      {chapters.length === 0 && <div className="muted small" style={{ padding: 12 }}>This book has no contents list. Use search or go to a page.</div>}
      {chapters.map((ch) => {
        const kids = book.filter((s) => s.chapter === ch.id && s.level === 2)
        const isOpen = open.has(ch.id)
        return (
          <div key={ch.id} className="bk-ch">
            <div className={`bk-row l1 ${current === ch.id ? 'on' : ''}`}>
              {kids.length > 0 || ch.subs.length > 0
                ? <button className="tw" onClick={() => flip(setOpen, ch.id)}>{isOpen ? '▾' : '▸'}</button>
                : <span className="tw" />}
              <button className="t" onClick={() => onSection(ch)}>{ch.title}</button>
              {star(ch.title, ch.page)}
              <span className="pg">{ch.page}</span>
            </div>
            {isOpen && ch.subs.map((h, i) => headingRow(ch, h, i, h.level === 3 ? 'l2 sub' : 'l3'))}
            {isOpen && kids.map((s) => (
              <div key={s.id}>
                <div className={`bk-row l2 ${current === s.id ? 'on' : ''}`}>
                  {s.subs.length > 0
                    ? <button className="tw" title="Headings" onClick={() => flip(setSubOpen, s.id)}>{subOpen.has(s.id) ? '▾' : '▸'}</button>
                    : <span className="tw" />}
                  <button className="t" onClick={() => onSection(s)}>{s.title}</button>
                  {star(s.title, s.page)}
                  <span className="pg">{s.page}</span>
                </div>
                {subOpen.has(s.id) && s.subs.map((h, i) => headingRow(s, h, i, h.level === 3 ? 'l3' : 'l4'))}
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}
