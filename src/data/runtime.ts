/*
 * Book data that isn't part of the app: the Arknights 5e book (downloaded from Homebrewery by the app itself) and any
 * spell lists you imported from your own PDFs. It lives in the app's data folder on your computer and is read once
 * at start-up, before the rest of the app loads, so the libraries built from it can stay simple constants.
 * In the browser preview (development only) the copies under src/data/extra and src/data/book are used instead.
 */

import { AK5E_PARSE_VERSION, parseAk5e } from '../ak5e/parse'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExtraData = Record<string, any>

let extras: Record<string, ExtraData> = {}
let books: Record<string, string> = {}

/** every imported data file (ak5e.json, your UA spell lists…) */
export const extraFiles = (): ExtraData[] => Object.values(extras)
/** the same, with the file name each came from */
export const extraEntries = (): [string, ExtraData][] => Object.entries(extras)
/** a book's markdown text (the Arknights 5e book's text view), if downloaded */
export const bookText = (id: string): string | undefined => books[id]

export async function loadRuntimeData() {
  if (window.sheetApi) {
    try {
      const list = await window.sheetApi.extraList()
      for (const f of list) { try { extras[f.name] = JSON.parse(f.text) } catch { /* a broken file: skip it */ } }
      const md = await window.sheetApi.bookTextGet('ak5e')
      if (md) books.ak5e = md
      // a book read by an older version of the app: read it again from the copy on this computer
      const ak = extras['ak5e.json']
      if (md && ak && (ak.version ?? 1) < AK5E_PARSE_VERSION) {
        try {
          const fresh = parseAk5e(md)
          extras['ak5e.json'] = fresh
          await window.sheetApi.extraSave('ak5e.json', JSON.stringify(fresh))
        } catch { /* keep the old reading */ }
      }
    } catch { /* an older desktop build without these: nothing extra */ }
    return
  }
  if (import.meta.env.DEV) {
    const json = import.meta.glob('./extra/*.json', { import: 'default' }) as Record<string, () => Promise<ExtraData>>
    const md = import.meta.glob('./book/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>
    for (const [path, load] of Object.entries(json)) extras[path.split('/').pop()!] = await load()
    for (const [path, load] of Object.entries(md)) books[path.split('/').pop()!.replace(/\.md$/, '')] = await load()
  }
}

/** replace what's loaded (after downloading the book), for the next start */
export function setRuntime(name: string, data: ExtraData, bookId?: string, md?: string) {
  extras = { ...extras, [name]: data }
  if (bookId && md) books = { ...books, [bookId]: md }
}
