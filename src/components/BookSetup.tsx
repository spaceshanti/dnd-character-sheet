import { useEffect, useRef, useState } from 'react'
import { AK5E_SOURCE_URL, parseAk5e, sourceFromPage } from '../ak5e/parse'
import { importBookPdf } from '../book/importPdf'
import { listBooks, type BookInfo } from '../book/books'
import { extraFiles } from '../data/runtime'

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
      {busy && <div className="small">⏳ {busy}</div>}
      {msg && <div className="small">{msg}</div>}
    </div>
  )
}
