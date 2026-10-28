import type { BookSection } from './book'

/*
 * The sourcebooks you've imported (tools/import_book_pdf.py), each a folder of page images in the app's data folder.
 * Which characters see a book is up to its `games` list (e.g. the 2024 SRD for both D&D and Arknights sheets).
 */

export interface BookInfo {
  id: string
  title: string
  games: string[]
  pages: number
  aspect: number
  ext: string
  /** the PDF's bookmarks: [level, title, page] */
  toc: [number, string, number][]
  /** where its files are served from */
  base: string
}

let cache: Promise<BookInfo[]> | null = null

export function listBooks(): Promise<BookInfo[]> {
  cache ??= (async () => {
    if (window.sheetApi?.bookList) {
      const list = await window.sheetApi.bookList()
      return list.map((b) => ({ games: ['ak5e'], toc: [], ...b, base: `sheetbook://${b.id}/` }))
    }
    // browser preview: a dev copy under public/book-dev (never part of a build)
    try {
      const ids: string[] = await (await fetch('/book-dev/index.json')).json()
      return await Promise.all(ids.map(async (id) => ({ games: ['ak5e'], toc: [], ...(await (await fetch(`/book-dev/${id}/book.json`)).json()), id, base: `/book-dev/${id}/` })))
    } catch { return [] }
  })()
  return cache
}

/** A PDF's bookmarks as contents: its chapters, their sections, and the headings inside those. */
export function sectionsFromToc(b: BookInfo): BookSection[] {
  const toc = b.toc.filter(([, t]) => t)
  if (!toc.length) return []
  // a single top entry wrapping everything (e.g. "System Reference Document 5.2.1") isn't a chapter
  const top = Math.min(...toc.map(([l]) => l))
  const chapterLevel = toc.filter(([l]) => l === top).length <= 1 && toc.some(([l]) => l > top) ? top + 1 : top
  const out: BookSection[] = []
  let chapter = 0
  for (const [lvl, title, page] of toc) {
    if (lvl < chapterLevel) continue
    if (lvl <= chapterLevel + 1) {
      const level = lvl === chapterLevel ? 1 : 2
      const s: BookSection = { id: out.length, title, level, chapter: level === 1 ? out.length : chapter, page, lastPage: page, md: '', subs: [], plain: '', text: '' }
      if (level === 1) chapter = s.id
      out.push(s)
    } else if (out.length) {
      out[out.length - 1].subs.push({ title, slug: '', level: lvl === chapterLevel + 2 ? 3 : 4, page })
    }
  }
  out.forEach((s, i) => { s.lastPage = Math.max(s.page, (out[i + 1]?.page ?? b.pages + 1) - 1) })
  return out
}
