import { useEffect, useRef, useState } from 'react'
import { AK5E_SOURCE_URL, parseAk5e, sourceFromPage } from '../ak5e/parse'
import { importBookPdf } from '../book/importPdf'
import { listBooks, type BookInfo } from '../book/books'
import { extraEntries, extraFiles } from '../data/runtime'
import { askConfirm } from './Dialog'

/*
 * Getting the sourcebooks onto this computer from inside the app (nothing is shipped with it):
 *  - the Arknights 5e book's text and data, downloaded from Homebrewery (Arts, gear, Op. Skills, classes, the text view)
 *  - the free 2024 rules PDF (SRD 5.2.1), downloaded and turned into pages
 *  - any book PDF you have (e.g. Arknights 5e, printed to PDF from Homebrewery) for the real-pages view
 */

export const SRD_PDF_URL = 'https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf'

export const hasAkData = () => extraFiles().some((f) => f.system === 'ak5e')

/** download and read the Arknights 5e book; the app has to reload to use it */
export async function downloadAk5e() {
  const api = window.sheetApi
  if (!api) throw new Error('Downloading works in the desktop app.')
  const md = sourceFromPage(await api.fetchUrl(AK5E_SOURCE_URL))
  const data = parseAk5e(md)
  await api.extraSave('ak5e.json', JSON.stringify(data))
  await api.bookTextSave('ak5e', md)
}

/** reload once the save file is written (a moment after the last edit) */
export const reloadSoon = () => setTimeout(() => location.reload(), 700)

export function BookSetup({ game }: { game?: 'dnd5e' | 'ak5e' }) {
  const [books, setBooks] = useState<BookInfo[]>([])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const otherFile = useRef<HTMLInputElement>(null)
  // a PDF waiting for its title and which characters see it
  const [adding, setAdding] = useState<{ file: File; title: string; games: string[] } | null>(null)
  const refresh = () => listBooks().then(setBooks)
  useEffect(() => { refresh() }, [])
  const desktop = !!window.sheetApi
  const have = (id: string) => books.some((b) => b.id === id)

  const run = async (label: string, job: (progress: (t: string) => void) => Promise<string>) => {
    setBusy(label)
    setMsg('')
    try { setMsg(await job(setBusy)) } catch (e) { setMsg(`Couldn't finish: ${e instanceof Error ? e.message : String(e)}`) }
    setBusy('')
    refresh()
  }
  const akText = () => run('Downloading the Arknights 5e book…', async () => {
    await downloadAk5e()
    reloadSoon()
    return 'Downloaded. Reloading to use it…'
  })
  const srd = () => run('Downloading the 2024 rules PDF…', async (p) => {
    const bytes = await window.sheetApi!.fetchUrl(SRD_PDF_URL, true)
    await importBookPdf(bytes, { id: 'srd52', title: 'SRD 5.2.1 (2024 rules)', games: ['dnd5e', 'ak5e'], onProgress: (n, t) => p(`Preparing the pages: ${n} / ${t}`) })
    return 'The 2024 rules book is ready in the 📖 Sourcebooks reader.'
  })
  const akPdf = (f: File) => run('Reading the PDF…', async (p) => {
    const bytes = new Uint8Array(await f.arrayBuffer())
    await importBookPdf(bytes, { id: 'ak5e', title: 'Arknights 5e', games: ['ak5e'], onProgress: (n, t) => p(`Preparing the pages: ${n} / ${t}`) })
    return 'The Arknights 5e pages are ready in the 📖 Sourcebooks reader.'
  })

  const addOther = () => {
    if (!adding) return
    const { file: f, title, games } = adding
    setAdding(null)
    // a folder name from the title, not clashing with a book that's already there
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'book'
    let id = base
    for (let n = 2; ['ak5e', 'srd52'].includes(id) || have(id); n++) id = `${base}-${n}`
    run('Reading the PDF…', async (p) => {
      await importBookPdf(new Uint8Array(await f.arrayBuffer()), { id, title: title.trim() || f.name, games, onProgress: (n, t) => p(`Preparing the pages: ${n} / ${t}`) })
      return `${title} is ready in the 📖 Sourcebooks reader.`
    })
  }
  const removeBook = async (b: BookInfo) => {
    if (!(await askConfirm(`Remove ${b.title} from this computer? (Only the app's copy of the pages; your PDF isn't touched.)`))) return
    await window.sheetApi!.bookRemove(b.id)
    refresh()
  }
  const others = books.filter((b) => b.id !== 'ak5e' && b.id !== 'srd52')

  // spell lists from your own files (e.g. a UA class you imported, or one a friend sent you)
  const spellFile = useRef<HTMLInputElement>(null)
  const spellLists = extraEntries().filter(([, d]) => d.system !== 'ak5e' && (d.spells || d.classLists))
  const addSpellFile = (f: File) => run('Adding the spell list…', async () => {
    const text = await f.text()
    let data: { spells?: unknown[]; classLists?: Record<string, unknown>; source?: string }
    try { data = JSON.parse(text) } catch { throw new Error("that isn't a spell list file (.json)") }
    if (!Array.isArray(data.spells) && !data.classLists) throw new Error("that file has no spells or spell lists in it")
    const name = f.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/\.json$/, '') + '.json'
    await window.sheetApi!.extraSave(name, text)
    reloadSoon()
    return `Added ${data.source || f.name}. Reloading to use it…`
  })
  const removeSpellFile = async (name: string, label: string) => {
    if (!(await askConfirm(`Remove ${label}? Characters keep the spells they already have.`))) return
    await window.sheetApi!.extraRemove(name)
    reloadSoon()
  }
  const gameName = (g: string) => (g === 'ak5e' ? 'Arknights' : 'D&D')

  if (!desktop) return <div className="muted small">Books are added in the desktop app.</div>
  const row = (title: string, status: string, ok: boolean, action: React.ReactNode, note?: string) => (
    <div className="book-setup-row">
      <div className="grow">
        <b>{title}</b> <span className={`chip ${ok ? 'accent' : ''}`}>{status}</span>
        {note && <div className="muted small">{note}</div>}
      </div>
      {action}
    </div>
  )
  return (
    <div className="col" style={{ gap: 8 }}>
      {game !== 'dnd5e' && row('Arknights 5e: text & data', hasAkData() ? 'downloaded' : 'not yet', hasAkData(),
        <button className="btn sm" disabled={!!busy} onClick={akText}>{hasAkData() ? 'Update' : 'Download'}</button>,
        'Arts, gear, Operator Skills, classes for filling in features, and the book’s text view. From Homebrewery.')}
      {game !== 'dnd5e' && row('Arknights 5e: real pages', have('ak5e') ? 'added' : 'not yet', have('ak5e'),
        <>
          <button className="btn sm" disabled={!!busy} onClick={() => file.current?.click()}>{have('ak5e') ? 'Replace PDF…' : 'Add PDF…'}</button>
          <input ref={file} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) akPdf(f) }} />
        </>,
        'The book as its actual pages. Print the book to PDF from Homebrewery (or use a copy from your party), then add it here.')}
      {row('2024 rules (SRD 5.2.1)', have('srd52') ? 'added' : 'not yet', have('srd52'),
        <button className="btn sm" disabled={!!busy} onClick={srd}>{have('srd52') ? 'Download again' : 'Download'}</button>,
        'The free System Reference Document from Wizards of the Coast (CC-BY-4.0), about 5 MB.')}
      {others.map((b) => row(b.title, b.games.map(gameName).join(' + '), true,
        <button className="btn sm ghost" disabled={!!busy} onClick={() => removeBook(b)}>Remove</button>,
        `${b.pages} pages · your own PDF`))}
      {adding ? (
        <div className="book-setup-row col" style={{ alignItems: 'stretch', gap: 6 }}>
          <div className="row" style={{ gap: 6 }}>
            <span className="small">Title</span>
            <input className="box-input grow" autoFocus value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} />
          </div>
          <div className="row" style={{ gap: 12 }}>
            <span className="small">Shown on</span>
            {(['dnd5e', 'ak5e'] as const).map((g) => (
              <label key={g} className="row small" style={{ gap: 4 }}>
                <input type="checkbox" checked={adding.games.includes(g)}
                  onChange={(e) => setAdding({ ...adding, games: e.target.checked ? [...adding.games, g] : adding.games.filter((x) => x !== g) })} />
                {gameName(g)} characters
              </label>
            ))}
            <span className="grow" />
            <button className="btn sm" onClick={() => setAdding(null)}>Cancel</button>
            <button className="btn sm primary" disabled={!adding.games.length || !adding.title.trim()} onClick={addOther}>Add book</button>
          </div>
        </div>
      ) : (
        <div className="row">
          <button className="btn sm" disabled={!!busy} onClick={() => otherFile.current?.click()}>＋ Add another book (PDF)…</button>
          <span className="muted small">Any PDF you have: its pages, contents and search, in the reader.</span>
          <input ref={otherFile} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) setAdding({ file: f, title: f.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' '), games: game ? [game] : ['dnd5e', 'ak5e'] })
          }} />
        </div>
      )}
      <div className="field-lbl" style={{ marginTop: 6 }}>Extra spell lists</div>
      {spellLists.map(([name, d]) => row(d.source || name,
        Object.keys(d.classLists ?? {}).join(', ') || 'spells', true,
        <button className="btn sm ghost" disabled={!!busy} onClick={() => removeSpellFile(name, d.source || name)}>Remove</button>,
        `${(d.spells ?? []).length} spells written out${d.classLists ? ` · ${Object.values(d.classLists as Record<string, Record<string, unknown[]>>).reduce((n, lv) => n + Object.values(lv).reduce((m, x) => m + x.length, 0), 0)} on the class list` : ''}`))}
      <div className="row">
        <button className="btn sm" disabled={!!busy} onClick={() => spellFile.current?.click()}>＋ Add a spell list file…</button>
        <span className="muted small">A <code>.json</code> spell list, e.g. the Psion one from a party member. Adds its class to the library's filter.</span>
        <input ref={spellFile} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addSpellFile(f) }} />
      </div>
      {busy && <div className="small">⏳ {busy}</div>}
      {msg && <div className="small">{msg}</div>}
    </div>
  )
}
