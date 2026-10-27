import { useEffect, useMemo, useState } from 'react'
import type { BookSection } from '../book/book'

type Heading = BookSection['subs'][number]

/** Contents sidebar: chapters → sections → their ### / #### headings. Folds open around where you are. */
export function BookContents({ book, current, onSection, onHeading }: {
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

  const headingRow = (s: BookSection, h: Heading, i: number, cls: string) => (
    <div key={i} className={`bk-row ${cls}`}>
      <button className="t" onClick={() => onHeading(s, h)}>{h.title}</button>
      <span className="pg">{h.page}</span>
    </div>
  )

  return (
    <>
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
