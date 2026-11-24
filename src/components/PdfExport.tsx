import { useEffect, useRef, useState } from 'react'
import { useChar } from '../store'
import { isAK } from '../systems'
import { Toast, useToast } from './ui'
import type { TemplateKind } from '../pdf/export'
import { askConfirm } from './Dialog'

/*
 * Export the open character as a printable PDF: the app's own sheet (full or compact, nothing needed first), the
 * official 2014 sheet (downloaded from Wizards of the Coast when first used), or a fillable sheet / the AK book's
 * pages you add yourself. Other people's sheets are never part of the app: they're fetched or added onto this computer.
 * Stored names: "<kind>__<original name>.pdf" for fillable sheets, "ak-main|ak-second|ak-arts.<ext>" for the AK pages.
 */

const AK_PAGES = [
  { id: 'ak-main', name: 'Page 1 (stats)' },
  { id: 'ak-second', name: 'Page 2 (operator skills, backstory)' },
  { id: 'ak-arts', name: 'Arts page' },
] as const
const AK_SOURCE = 'https://imgchest.com/p/qb4zpmejdyj'

/** Without the desktop app (browser preview) files only live for this session. */
const memory = new Map<string, Uint8Array>()
const api = {
  list: async () => (window.sheetApi ? window.sheetApi.listTemplates() : [...memory.keys()]),
  read: async (n: string) => (window.sheetApi ? window.sheetApi.readTemplate(n) : memory.get(n) ?? null),
  add: async (n: string, b: Uint8Array) => { if (window.sheetApi) return window.sheetApi.addTemplate(n, b); memory.set(n, b); return n },
  remove: async (n: string) => { if (window.sheetApi) await window.sheetApi.removeTemplate(n); else memory.delete(n) },
  save: async (n: string, b: Uint8Array) => {
    if (window.sheetApi) return window.sheetApi.saveFile(n, b)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([b as BlobPart], { type: 'application/pdf' }))
    a.download = n
    a.click()
    return n
  },
}

const fileName = (s: string) => `${(s || 'character').replace(/[^\w-]+/g, '_')}.pdf`
const bytesOf = async (f: File) => new Uint8Array(await f.arrayBuffer())
const toUrl = (b: Uint8Array, name: string) => URL.createObjectURL(new Blob([b as BlobPart], { type: /\.png$/i.test(name) ? 'image/png' : 'image/jpeg' }))

export function PdfExport() {
  const c = useChar()
  const toast = useToast()
  const [files, setFiles] = useState<string[]>([])
  const [busy, setBusy] = useState('')
  const pdfInput = useRef<HTMLInputElement>(null)
  const imgInput = useRef<HTMLInputElement>(null)
  const [imgFor, setImgFor] = useState('')
  const refresh = () => api.list().then(setFiles)
  useEffect(() => { refresh() }, [])
  const ak = isAK(c)

  const lib = () => import('../pdf/export')

  const addPdf = async (f: File) => {
    try {
      const b = await bytesOf(f)
      const { inspectTemplate } = await lib()
      const kind = await inspectTemplate(b)
      if (!kind) { toast.show("That PDF isn't a sheet I know how to fill (2014 / 2024 official, or Current Standard CS v1.4)"); return }
      await api.add(`${kind}__${f.name.replace(/\.pdf$/i, '')}.pdf`, b)
      refresh()
      toast.show('Sheet added')
    } catch (e) { toast.show(`Couldn't read that PDF: ${String(e)}`) }
  }

  const exportPdf = async (name: string) => {
    setBusy(name)
    try {
      const b = await api.read(name)
      if (!b) throw new Error('The stored copy is missing; add the sheet again.')
      const { fillTemplate } = await lib()
      const out = await fillTemplate(new Uint8Array(b), c)
      const where = await api.save(fileName(`${c.name} - ${name.split('__')[1] ?? 'sheet'}`), out)
      if (where) toast.show('Exported ✓')
    } catch (e) { toast.show(`Export failed: ${e instanceof Error ? e.message : String(e)}`) }
    setBusy('')
  }

  const akFile = (id: string) => files.find((f) => f.replace(/\.\w+$/, '') === id)
  const addImage = async (f: File) => {
    const ext = /\.png$/i.test(f.name) ? 'png' : 'jpg'
    for (const old of files.filter((x) => x.replace(/\.\w+$/, '') === imgFor)) await api.remove(old)
    await api.add(`${imgFor}.${ext}`, await bytesOf(f))
    refresh()
  }
  const exportAk = async () => {
    setBusy('ak')
    const urls: string[] = []
    try {
      const read = async (id: string) => {
        const n = akFile(id)
        const b = n && (await api.read(n))
        if (!b) throw new Error('Add all three sheet pages first.')
        const u = toUrl(new Uint8Array(b), n); urls.push(u); return u
      }
      const { akSheet } = await lib()
      const out = await akSheet(c, { main: await read('ak-main'), second: await read('ak-second'), arts: await read('ak-arts') })
      const where = await api.save(fileName(`${c.name} - Arknights 5e`), out)
      if (where) toast.show('Exported ✓')
    } catch (e) { toast.show(`Export failed: ${e instanceof Error ? e.message : String(e)}`) }
    urls.forEach((u) => URL.revokeObjectURL(u))
    setBusy('')
  }

  const pdfs = files.filter((f) => f.includes('__') && f.endsWith('.pdf'))
  const official = pdfs.find((f) => f === OFFICIAL_2014)
  const own = pdfs.filter((f) => f !== OFFICIAL_2014)

  // the app's own sheet: nothing to add first
  const exportApp = async (compact: boolean) => {
    const key = compact ? 'app-compact' : 'app-full'
    setBusy(key)
    try {
      const { appSheet } = await import('../pdf/appSheet')
      const out = await appSheet(c, { compact })
      const where = await api.save(fileName(`${c.name}${compact ? ' - compact' : ''}`), out)
      if (where) toast.show('Exported ✓')
    } catch (e) { toast.show(`Export failed: ${e instanceof Error ? e.message : String(e)}`) }
    setBusy('')
  }
  // the official 2014 sheet: downloaded from Wizards of the Coast the first time, then kept
  const exportOfficial = async () => {
    if (official) return exportPdf(official)
    if (!window.sheetApi?.fetchUrl) { toast.show('Downloading the official sheet works in the desktop app.'); return }
    setBusy(OFFICIAL_2014)
    try {
      const b = await window.sheetApi.fetchUrl(OFFICIAL_2014_URL, true)
      const { inspectTemplate } = await lib()
      if ((await inspectTemplate(b)) !== 'wotc2014') throw new Error("the downloaded file isn't the sheet I expected")
      await api.add(OFFICIAL_2014, b)
      await refresh()
    } catch (e) { setBusy(''); toast.show(`Couldn't download the official sheet: ${e instanceof Error ? e.message : String(e)}`); return }
    await exportPdf(OFFICIAL_2014)
  }

  const row = (key: string, title: string, sub: string, onClick: () => void, extra?: React.ReactNode) => (
    <div className="pdf-row" key={key}>
      <span className="grow" style={{ minWidth: 0 }}><b>{title}</b><br /><span className="muted small">{sub}</span></span>
      {extra}
      <button className="btn sm primary" disabled={!!busy} onClick={onClick}>{busy === key ? 'Exporting…' : 'Export PDF'}</button>
    </div>
  )

  return (
    <div className="col" style={{ gap: 8 }}>
      <input ref={pdfInput} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addPdf(f); e.target.value = '' }} />
      <input ref={imgInput} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addImage(f); e.target.value = '' }} />
      {row('app-full', 'Character Sheet · full', `Made by the app${ak ? ' for Arknights 5e' : ''}: stats, skills, attacks, resources, then every feature, ${ak ? 'Art, Operator Skill' : 'spell'}, item and your story, with their text.`, () => exportApp(false))}
      {row('app-compact', 'Character Sheet · compact', 'The same sheet with short descriptions: fewer pages to print.', () => exportApp(true))}
      {!ak && row(OFFICIAL_2014, 'Official D&D 5e sheet (2014)', official ? 'The fillable sheet from Wizards of the Coast (downloaded).' : 'The fillable sheet from Wizards of the Coast: downloaded the first time you export.', exportOfficial)}
      {!ak && own.map((f) => {
        const [kind, name] = f.replace(/\.pdf$/, '').split('__')
        return row(f, name, `Your sheet · ${KIND_NAMES[kind as TemplateKind] ?? kind}`, () => exportPdf(f),
          <button className="btn icon sm ghost" title="Remove this sheet" onClick={async () => { if ((await askConfirm(`Remove ${name}? (Only the app's copy.)`))) { await api.remove(f); refresh() } }}>✕</button>)
      })}
      <details className="pdf-more">
        <summary className="small muted">{ak ? "Use the book's own sheet pages instead" : 'Use another fillable sheet (2024 official, Current Standard CS v1.4)'}</summary>
        {ak ? (
          <div className="col" style={{ gap: 6, marginTop: 6 }}>
            <div className="muted small">
              Save the sheet's pages once from <a href={AK_SOURCE} onClick={(e) => { e.preventDefault(); window.sheetApi ? window.sheetApi.openExternal(AK_SOURCE) : window.open(AK_SOURCE) }}>imgchest</a> (the stats page, the operator skills / backstory page, and one Arts page) and add them here; the export writes onto them.
            </div>
            {AK_PAGES.map((pg) => (
              <div key={pg.id} className="row">
                <span className="grow">{pg.name}</span>
                {akFile(pg.id) ? <span className="small" style={{ color: 'var(--good)' }}>added ✓</span> : <span className="muted small">not added</span>}
                <button className="btn sm" onClick={() => { setImgFor(pg.id); imgInput.current?.click() }}>{akFile(pg.id) ? 'Replace…' : 'Choose image…'}</button>
              </div>
            ))}
            <div className="row">
              <button className="btn sm primary" disabled={!!busy || AK_PAGES.some((pg) => !akFile(pg.id))} onClick={exportAk}>{busy === 'ak' ? 'Exporting…' : "Export onto the book's pages"}</button>
            </div>
          </div>
        ) : (
          <div className="col" style={{ gap: 6, marginTop: 6 }}>
            <div className="muted small">Add a copy of a form-fillable sheet you have (the official 2024 sheet, or the Current Standard CS v1.4) and it appears in the list above. A filled-in sheet works too: its old contents are cleared first.</div>
            <div><button className="btn sm" onClick={() => pdfInput.current?.click()}>＋ Add a sheet PDF…</button></div>
          </div>
        )}
      </details>
      <Toast msg={toast.msg} />
    </div>
  )
}

/** the official 2014 sheet, as Wizards of the Coast publishes it (stored under this name once downloaded) */
const OFFICIAL_2014 = 'wotc2014__Official 5e sheet (2014).pdf'
const OFFICIAL_2014_URL = 'https://media.wizards.com/2016/dnd/downloads/5E_CharacterSheet_Fillable.pdf'

const KIND_NAMES: Record<TemplateKind, string> = {
  wotc2014: 'Official 5e sheet (2014)',
  wotc2024: 'Official 2024 sheet',
  cs14: 'Current Standard CS v1.4',
}
