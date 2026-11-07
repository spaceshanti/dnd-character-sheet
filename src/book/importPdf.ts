import { getDocument, GlobalWorkerOptions, Util, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

/*
 * Adding a sourcebook PDF from inside the app (what tools/import_book_pdf.py does): every page rendered to an image,
 * each page's words with their positions (search highlights, clickable spell names and contents lines) and the PDF's
 * own bookmarks (the contents sidebar). Written to the app's data folder: <userData>/sourcebook/<id>/.
 */

GlobalWorkerOptions.workerSrc = workerUrl

const WIDTH = 1240 // rendered page width in pixels

export interface ImportOptions {
  id: string
  title: string
  games: string[]
  onProgress?: (done: number, total: number) => void
}

type Word = [number, number, number, number, string]

/** a page's text runs split into words, as [x0, y0, x1, y1, text] in thousandths of the page */
async function pageWords(pdf: PDFDocumentProxy, n: number): Promise<Word[]> {
  const page = await pdf.getPage(n)
  const vp = page.getViewport({ scale: 1 })
  const tc = await page.getTextContent()
  const out: Word[] = []
  const seen = new Set<string>()
  for (const item of tc.items) {
    if (!('str' in item) || !item.str.trim()) continue
    const tx = Util.transform(vp.transform, item.transform)
    // sideways text isn't worth placing
    if (Math.abs(tx[1]) > 0.01 || Math.abs(tx[2]) > 0.01) continue
    const fh = Math.hypot(tx[2], tx[3]) || item.height
    const x = tx[4]
    const base = tx[5]
    const w = item.width * (vp.scale || 1)
    const chars = item.str.length
    // place each word along the run in proportion to its characters
    for (const m of item.str.matchAll(/\S+/g)) {
      const x0 = x + (w * m.index!) / chars
      const x1 = x + (w * (m.index! + m[0].length)) / chars
      const word: Word = [Math.round((x0 / vp.width) * 1000), Math.round(((base - fh * 0.88) / vp.height) * 1000),
        Math.round((x1 / vp.width) * 1000), Math.round(((base + fh * 0.24) / vp.height) * 1000), m[0]]
      // some books draw text twice (outlines / shadows): drop repeats at the same spot
      const k = `${Math.round(x0)}|${Math.round(base)}|${m[0]}`
      if (seen.has(k)) continue
      seen.add(k)
      out.push(word)
    }
  }
  page.cleanup()
  return out
}

async function renderPage(pdf: PDFDocumentProxy, n: number): Promise<Uint8Array> {
  const page = await pdf.getPage(n)
  const base = page.getViewport({ scale: 1 })
  const vp = page.getViewport({ scale: WIDTH / base.width })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(vp.width)
  canvas.height = Math.round(vp.height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport: vp }).promise
  page.cleanup()
  const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('could not draw the page'))), 'image/jpeg', 0.82))
  return new Uint8Array(await blob.arrayBuffer())
}

/** the PDF's bookmarks as [level, title, page] */
async function outline(pdf: PDFDocumentProxy): Promise<[number, string, number][]> {
  const out: [number, string, number][] = []
  const walk = async (items: Awaited<ReturnType<PDFDocumentProxy['getOutline']>>, level: number) => {
    for (const it of items ?? []) {
      let page = 0
      try {
        const dest = typeof it.dest === 'string' ? await pdf.getDestination(it.dest) : it.dest
        const ref = dest?.[0]
        page = ref == null ? 0 : typeof ref === 'number' ? ref + 1 : (await pdf.getPageIndex(ref)) + 1
      } catch { /* a bookmark to nowhere */ }
      const title = (it.title || '').trim()
      if (title && page > 0) out.push([level, title, page])
      await walk(it.items, level + 1)
    }
  }
  await walk(await pdf.getOutline(), 1)
  return out
}

/** import a PDF (its bytes) as sourcebook <id>; replaces one with the same id */
export async function importBookPdf(bytes: Uint8Array, o: ImportOptions) {
  const api = window.sheetApi
  if (!api) throw new Error('Adding books works in the desktop app.')
  const pdf = await getDocument({ data: bytes }).promise
  const total = pdf.numPages
  await api.bookRemove(o.id)
  const words: Word[][] = []
  for (let n = 1; n <= total; n++) {
    await api.bookWrite(o.id, `pages/${String(n).padStart(3, '0')}.jpg`, await renderPage(pdf, n))
    words.push(await pageWords(pdf, n))
    o.onProgress?.(n, total)
  }
  await api.bookWrite(o.id, 'words.json', JSON.stringify(words))
  const first = (await pdf.getPage(1)).getViewport({ scale: 1 })
  const info = { id: o.id, title: o.title, games: o.games, pages: total, aspect: first.height / first.width, ext: 'jpg', toc: await outline(pdf) }
  // book.json last: the reader only lists a book once this is there
  await api.bookWrite(o.id, 'book.json', JSON.stringify(info))
  await pdf.destroy()
  return info
}
