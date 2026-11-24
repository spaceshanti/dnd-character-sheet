/*
 * Bookmarks the auto-fill makes: the class, subclass / branch, species, background or nationality you picked, found in
 * the sourcebooks you have (the Arknights 5e book's text, and any PDF book with contents, e.g. the 2024 SRD), and
 * bookmarked for this character only.
 */
import { loadBook } from './book/book'
import { listBooks } from './book/books'
import { useStore } from './store'
import type { Character } from './types'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** the best heading for a name: the same words, else a heading that starts with it ("Psion" → "Psion Class") */
function find(heads: { title: string; page: number }[], name: string) {
  const n = norm(name)
  if (!n) return undefined
  return heads.find((h) => norm(h.title) === n)
    ?? heads.filter((h) => norm(h.title).startsWith(`${n} `) || norm(h.title).endsWith(` ${n}`)).sort((a, b) => a.title.length - b.title.length)[0]
}

/** bookmark each of these rules entries for the character, in every book of its game that has it */
export async function bookmarkRules(c: Character, entries: { kind: string; name: string }[]) {
  if (!entries.length) return 0
  const books: { id: string; heads: { title: string; page: number }[] }[] = []
  // the Arknights book's text (its sections and headings carry the page numbers)
  if (c.system === 'ak5e') {
    const sec = await loadBook()
    if (sec.length) books.push({ id: 'ak5e', heads: sec.flatMap((s) => [{ title: s.title, page: s.page }, ...s.subs.map((x) => ({ title: x.title, page: x.page }))]) })
  }
  // PDF books for this game, by their contents
  for (const b of await listBooks()) {
    if (!b.games.includes(c.system) || !b.toc.length) continue
    if (b.id === 'ak5e' && books.some((x) => x.id === 'ak5e')) continue
    books.push({ id: b.id, heads: b.toc.map(([, title, page]) => ({ title, page })) })
  }
  const st = useStore.getState()
  let added = 0
  for (const book of books) {
    for (const e of entries) {
      const h = find(book.heads, e.name)
      if (!h) continue
      const title = `${e.kind}: ${e.name}`
      const exists = useStore.getState().bookmarks.some((m) => m.book === book.id && m.charId === c.id && (m.page === h.page || m.title === title))
      if (exists) continue
      st.addBookmark({ book: book.id, page: h.page, title, y: 0, charId: c.id })
      added++
    }
  }
  return added
}
