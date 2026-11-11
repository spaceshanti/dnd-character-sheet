import { useEffect, useRef, useState } from 'react'
import { useChar } from '../store'
import { isAK } from '../systems'
import { Toast, useToast } from './ui'
import type { TemplateKind } from '../pdf/export'
import { askConfirm } from './Dialog'

/*
 * Export the open character onto a printable sheet. The sheets themselves are other people's PDFs / images,
 * so the app doesn't ship them: you add your own copy once and it's kept beside your save file.
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
  return (
    <div className="col" style={{ gap: 10 }}>
      <input ref={pdfInput} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addPdf(f); e.target.value = '' }} />
      <input ref={imgInput} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addImage(f); e.target.value = '' }} />
      {ak ? (
        <>
          <div className="muted small">
            The AK5e sheet is a set of images. Save its pages once from <a href={AK_SOURCE} onClick={(e) => { e.preventDefault(); window.sheetApi ? window.sheetApi.openExternal(AK_SOURCE) : window.open(AK_SOURCE) }}>imgchest</a> (the stats page, the operator skills / backstory page, and one Arts page) and add them here.
          </div>
          {AK_PAGES.map((p) => (
            <div key={p.id} className="row">
              <span className="grow">{p.name}</span>
              {akFile(p.id) ? <span className="small" style={{ color: 'var(--good)' }}>added ✓</span> : <span className="muted small">not added</span>}
              <button className="btn sm" onClick={() => { setImgFor(p.id); imgInput.current?.click() }}>{akFile(p.id) ? 'Replace…' : 'Choose image…'}</button>
            </div>
          ))}
          <div className="row">
            <button className="btn primary" disabled={!!busy || AK_PAGES.some((p) => !akFile(p.id))} onClick={exportAk}>{busy === 'ak' ? 'Exporting…' : 'Export Arknights PDF'}</button>
            <span className="muted small">Arts continue onto extra Arts pages as needed.</span>
          </div>
        </>
      ) : (
        <>
          <div className="muted small">
            Add a form-fillable sheet once (the official 2014 or 2024 sheet, or the Current Standard CS v1.4), then export any character onto it.
            A filled-in sheet works too: its old contents are cleared first.
          </div>
          {pdfs.length === 0 && <div className="empty">No sheets added yet.</div>}
          {pdfs.map((f) => {
            const [kind, name] = f.replace(/\.pdf$/, '').split('__')
            return (
              <div key={f} className="row">
                <span className="grow" style={{ minWidth: 0 }}>
                  <b>{name}</b><br /><span className="muted small">{KIND_NAMES[kind as TemplateKind] ?? kind}</span>
                </span>
                <button className="btn sm primary" disabled={!!busy} onClick={() => exportPdf(f)}>{busy === f ? 'Exporting…' : 'Export'}</button>
                <button className="btn icon sm ghost" title="Remove this sheet" onClick={async () => { if ((await askConfirm(`Remove ${name}? (Only the app's copy.)`))) { await api.remove(f); refresh() } }}>✕</button>
              </div>
            )
          })}
          <div><button className="btn sm" onClick={() => pdfInput.current?.click()}>＋ Add a sheet PDF…</button></div>
        </>
      )}
      <Toast msg={toast.msg} />
    </div>
  )
}

const KIND_NAMES: Record<TemplateKind, string> = {
  wotc2014: 'Official 5e sheet (2014)',
  wotc2024: 'Official 2024 sheet',
  cs14: 'Current Standard CS v1.4',
}
