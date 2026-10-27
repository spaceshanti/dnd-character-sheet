import { marked } from 'marked'

/*
 * The Arknights 5e sourcebook, read from the Homebrewery markdown that tools/import_ak5e.py saves
 * (src/data/book/ak5e.md, not part of the repository). Split into sections at its # / ## headings,
 * rendered on demand, searchable as plain text.
 */

export interface BookSection {
  id: number
  title: string
  /** 1 = chapter, 2 = section */
  level: 1 | 2
  /** index of the chapter section this one belongs to */
  chapter: number
  /** book page the section starts on (as printed: #p357 → 357) */
  page: number
  lastPage: number
  md: string
  /** ### and #### headings inside, for the contents sidebar; slug is the id of the anchor placed before each */
  subs: { title: string; slug: string; level: 3 | 4 }[]
  /** plain text, and the same lower-cased for search (same length, so indexes line up) */
  plain: string
  text: string
}

const files = import.meta.glob('../data/book/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>

export const hasBook = () => Object.keys(files).length > 0

let cache: Promise<BookSection[]> | null = null
export function loadBook(): Promise<BookSection[]> {
  const load = Object.values(files)[0]
  if (!load) return Promise.resolve([])
  cache ??= load().then(split)
  return cache
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Strip Homebrewery / markdown markup down to what you'd read. */
export function plainOf(md: string): string {
  return md
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\{[^\n]*$/gm, '').replace(/^\}\}\s*$/gm, '').replace(/\{\{\s?|\}\}/g, '')
    .replace(/^\\(page|column)\s*$/gm, '').replace(/^:+\s*$/gm, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>|]+/g, ' ').replace(/\s*::\s*/g, ' ').replace(/-{3,}/g, ' ')
    .replace(/[ \t]+/g, ' ')
}

function split(src: string): BookSection[] {
  const pages = src.replace(/\r\n/g, '\n').split(/^\\page\s*$/m)
  const out: BookSection[] = []
  let cur: BookSection | null = null
  let chapter = 0
  const start = (title: string, level: 1 | 2, page: number) => {
    cur = { id: out.length, title: title.trim(), level, chapter: level === 1 ? out.length : chapter, page, lastPage: page, md: '', subs: [], plain: '', text: '' }
    if (level === 1) chapter = out.length
    out.push(cur)
  }
  pages.forEach((pg, i) => {
    const page = i + 1
    if (!cur) start('Cover', 1, page)
    // page marker so links to a page (#p357) can scroll to it
    cur!.md += `\n\n<a class="bk-page" data-page="${page}"></a>\n\n`
    for (const line of pg.split('\n')) {
      const h = /^(#{1,2}) (.+)$/.exec(line)
      if (h && !/^Version /.test(h[2])) {
        // a {{monster / {{wide frame opened just before the heading belongs with it, not the previous section
        const prev: BookSection = cur!
        const tail = /((?:\{\{[^\n}]*\n|[ \t]*\n)*\{\{[^\n}]*\n[\s]*)$/.exec(prev.md)
        if (tail) prev.md = prev.md.slice(0, prev.md.length - tail[1].length)
        start(h[2], h[1].length as 1 | 2, page)
        cur!.md += `\n\n<a class="bk-page" data-page="${page}"></a>\n\n` + (tail ? tail[1] : '')
      }
      // every ### / #### heading gets its own anchor, so the contents can jump straight to it
      const sub = /^(#{3,4}) (.+)$/.exec(line)
      if (sub) {
        const title = plainOf(sub[2]).trim()
        if (title) {
          const id = `bk-h-${out.length - 1}-${cur!.subs.length}`
          cur!.subs.push({ title, slug: id, level: sub[1].length as 3 | 4 })
          cur!.md += `\n\n<a class="bk-anchor" id="${id}"></a>\n\n`
        }
      }
      cur!.md += line + '\n'
      cur!.lastPage = page
    }
  })
  for (const s of out) { s.plain = plainOf(s.md); s.text = s.plain.toLowerCase() }
  // nothing before the first heading but page furniture: drop that "Cover" section
  if (out[0]?.title === 'Cover' && out[0].plain.trim().length < 40) {
    out.shift()
    out.forEach((s, i) => { s.id = i; s.chapter = Math.max(0, s.chapter - 1) })
  }
  return out
}

/** Homebrewery markdown → HTML: its {{blocks}} become divs, decorative images and page furniture go. */
function prepare(md: string): string {
  return md
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<img[\s\S]*?>/gi, '')
    .replace(/\{\{pageNumber[^}\n]*\}\}/g, '')
    // the book's own contents: [{{ Arts Points}}{{ 357}}](#p357)
    .replace(/\{\{\s([^{}\n]*)\}\}\{\{\s*(\d+)\}\}/g, '$1 · p. $2')
    .replace(/\{\{\s([^{}\n]*)\}\}/g, '$1')
    .replace(/^\{\{([^\n]*)$/gm, (_m, spec: string) => {
      const name = /^[a-zA-Z][\w-]*/.exec(spec)?.[0] ?? 'block'
      return `\n\n<div class="hb hb-${spec.includes(':') && !spec.includes(',') ? 'style' : name}">\n\n`
    })
    .replace(/^\}\}\s*$/gm, '\n\n</div>\n\n')
    .replace(/^\\column\s*$/gm, '')
    .replace(/^:+\s*$/gm, '')
    // "**Range:** :: 15 feet" lines: one per line
    .replace(/^(\*\*[^*\n]+\*\*)\s*::\s*(.*)$/gm, '$1 $2  ')
}

const DROP = 'script, style, iframe, object, embed, img, link, meta, form, input, button, video, audio'

export function renderSection(s: BookSection): string {
  const html = marked.parse(prepare(s.md), { gfm: true, async: false }) as string
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild!
  root.querySelectorAll(DROP).forEach((e) => e.remove())
  root.querySelectorAll('*').forEach((e) => {
    for (const a of Array.from(e.attributes)) {
      const n = a.name.toLowerCase()
      if (n.startsWith('on') || n === 'style' || n === 'srcset') e.removeAttribute(a.name)
      if (n === 'href' && !/^(#p\d+|https?:)/.test(a.value)) e.removeAttribute(a.name)
    }
  })
  root.querySelectorAll('h1, h2, h3, h4').forEach((h) => { h.id = slug(h.textContent || '') })
  // drop empty decorative blocks
  root.querySelectorAll('div.hb').forEach((d) => { if (!d.textContent?.trim()) d.remove() })
  return root.innerHTML
}

export interface Hit { section: number; index: number; nth: number; before: string; match: string; after: string }

/** Every place the words appear, with a bit of context. */
export function searchBook(book: BookSection[], q: string, limit = 400): Hit[] {
  const t = q.trim().toLowerCase()
  if (t.length < 2) return []
  const hits: Hit[] = []
  for (const s of book) {
    let from = 0
    let nth = 0
    for (;;) {
      const i = s.text.indexOf(t, from)
      if (i < 0) break
      const raw = s.plain
      hits.push({
        section: s.id, index: i, nth,
        before: raw.slice(Math.max(0, i - 60), i).replace(/\s+/g, ' '),
        match: raw.slice(i, i + t.length),
        after: raw.slice(i + t.length, i + t.length + 80).replace(/\s+/g, ' '),
      })
      nth++
      from = i + t.length
      if (hits.length >= limit) return hits
    }
  }
  return hits
}
