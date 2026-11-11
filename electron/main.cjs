const { app, BrowserWindow, ipcMain, shell, Menu, dialog, protocol, net } = require('electron')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const { autoUpdater } = require('electron-updater')

// sheetbook://ak5e/pages/001.jpg → <userData>/sourcebook/ak5e/pages/001.jpg (the book pages you imported)
protocol.registerSchemesAsPrivileged([
  { scheme: 'sheetbook', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
])

const dataFile = () => path.join(app.getPath('userData'), 'characters.json')

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#d9d6cf',
    title: 'Character Sheet',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  Menu.setApplicationMenu(null)
  // Electron on Windows can leave the page unable to take typing after a native dialog (file pickers, Save PDF):
  // whenever the window comes back to the front, give the keyboard back to the page
  win.on('focus', () => { if (!win.webContents.isFocused()) win.webContents.focus() })
  // open maximized; F11 toggles true full screen
  win.once('ready-to-show', () => { win.maximize(); win.show() })
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault() }
  })
  // right-click: spelling suggestions, add to dictionary, cut / copy / paste
  win.webContents.on('context-menu', (_e, params) => {
    const items = []
    for (const s of params.dictionarySuggestions.slice(0, 6)) items.push({ label: s, click: () => win.webContents.replaceMisspelling(s) })
    if (params.misspelledWord) {
      if (!params.dictionarySuggestions.length) items.push({ label: 'No suggestions', enabled: false })
      items.push({ label: 'Add to dictionary', click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord) })
      items.push({ type: 'separator' })
    }
    if (params.isEditable) items.push({ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' }, { role: 'selectAll' })
    else if (params.selectionText) items.push({ role: 'copy' })
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win })
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.SHEET_DEV_URL) win.loadURL(process.env.SHEET_DEV_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

/* ---------- storage: a single JSON file in the user data folder ---------- */
ipcMain.handle('store:load', () => {
  const f = dataFile()
  if (!fs.existsSync(f)) return null
  for (const p of [f, f + '.bak']) {
    try {
      const txt = fs.readFileSync(p, 'utf8')
      JSON.parse(txt)
      return txt
    } catch { /* try the next one */ }
  }
  return null
})
ipcMain.handle('store:save', (_e, json) => {
  const f = dataFile()
  fs.mkdirSync(path.dirname(f), { recursive: true })
  const tmp = f + '.tmp'
  fs.writeFileSync(tmp, json, 'utf8')
  if (fs.existsSync(f)) {
    // only rotate a readable file into .bak; keep an unreadable one aside instead of losing the good backup
    let readable = true
    try { JSON.parse(fs.readFileSync(f, 'utf8')) } catch { readable = false }
    if (readable) fs.copyFileSync(f, f + '.bak')
    else fs.copyFileSync(f, f.replace(/\.json$/, `.unreadable-${Date.now()}.json`))
  }
  fs.renameSync(tmp, f)
  return true
})
ipcMain.handle('store:path', () => dataFile())
ipcMain.handle('open:external', (_e, url) => {
  if (/^https?:\/\//.test(url)) shell.openExternal(url)
})

/* ---------- PDF sheet templates (copies of the user's own PDFs / images, kept beside the save file) ---------- */
const templateDir = () => path.join(app.getPath('userData'), 'templates')
const safeName = (n) => String(n).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120)
ipcMain.handle('templates:list', () => {
  try { return fs.readdirSync(templateDir()) } catch { return [] }
})
ipcMain.handle('templates:read', (_e, name) => {
  try { return fs.readFileSync(path.join(templateDir(), safeName(name))) } catch { return null }
})
ipcMain.handle('templates:add', (_e, name, bytes) => {
  fs.mkdirSync(templateDir(), { recursive: true })
  fs.writeFileSync(path.join(templateDir(), safeName(name)), Buffer.from(bytes))
  return safeName(name)
})
ipcMain.handle('templates:remove', (_e, name) => {
  try { fs.unlinkSync(path.join(templateDir(), safeName(name))) } catch { /* already gone */ }
})
ipcMain.handle('file:save', async (e, defaultName, bytes) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const r = await dialog.showSaveDialog(win, { defaultPath: defaultName, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
  if (r.canceled || !r.filePath) return ''
  fs.writeFileSync(r.filePath, Buffer.from(bytes))
  shell.showItemInFolder(r.filePath)
  return r.filePath
})

/* ---------- book data kept on this computer (never part of the app): the Arknights 5e book, your imported spell lists ---------- */
const extraDir = () => path.join(app.getPath('userData'), 'extra')
const bookTextDir = () => path.join(app.getPath('userData'), 'books')
const plainFile = (n) => String(n).replace(/[^\w.-]+/g, '_')
ipcMain.handle('extra:list', () => {
  try {
    return fs.readdirSync(extraDir()).filter((f) => f.endsWith('.json')).map((f) => ({ name: f, text: fs.readFileSync(path.join(extraDir(), f), 'utf-8') }))
  } catch { return [] }
})
ipcMain.handle('extra:save', (_e, name, text) => {
  fs.mkdirSync(extraDir(), { recursive: true })
  fs.writeFileSync(path.join(extraDir(), plainFile(name)), text, 'utf-8')
})
ipcMain.handle('booktext:get', (_e, id) => {
  try { return fs.readFileSync(path.join(bookTextDir(), plainFile(id) + '.md'), 'utf-8') } catch { return '' }
})
ipcMain.handle('booktext:save', (_e, id, text) => {
  fs.mkdirSync(bookTextDir(), { recursive: true })
  fs.writeFileSync(path.join(bookTextDir(), plainFile(id) + '.md'), text, 'utf-8')
})
// downloads the app makes for you: the Arknights 5e book's source on Homebrewery, the free SRD PDF
const FETCH_HOSTS = ['homebrewery.naturalcrit.com', 'media.dndbeyond.com']
ipcMain.handle('net:fetch', async (_e, url, binary) => {
  const u = new URL(url)
  if (u.protocol !== 'https:' || !FETCH_HOSTS.includes(u.hostname)) throw new Error('not an allowed address')
  const r = await net.fetch(url, { headers: UA })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return binary ? new Uint8Array(await r.arrayBuffer()) : r.text()
})

/* ---------- version & updates ---------- */
ipcMain.handle('app:version', () => app.getVersion())
// where the update stands, shown on the Characters screen and in Settings
let updateState = { status: 'idle', latest: '', percent: 0, error: '' }
const sendUpdate = (patch) => {
  updateState = { ...updateState, ...patch }
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('update:status', updateState)
}
autoUpdater.on('checking-for-update', () => sendUpdate({ status: 'checking', error: '' }))
autoUpdater.on('update-available', (i) => sendUpdate({ status: 'downloading', latest: i.version, percent: 0 }))
autoUpdater.on('update-not-available', (i) => sendUpdate({ status: 'current', latest: i.version }))
autoUpdater.on('download-progress', (p) => sendUpdate({ status: 'downloading', percent: Math.round(p.percent) }))
autoUpdater.on('update-downloaded', (i) => sendUpdate({ status: 'ready', latest: i.version, percent: 100 }))
autoUpdater.on('error', (e) => sendUpdate({ status: 'error', error: String(e?.message || e).split('\n')[0].slice(0, 160) }))
ipcMain.handle('update:state', () => (app.isPackaged ? updateState : { ...updateState, status: 'dev' }))
ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) return { ...updateState, status: 'dev' }
  // a download that's already running or finished just reports where it is
  if (updateState.status === 'downloading' || updateState.status === 'ready') return updateState
  try { await autoUpdater.checkForUpdates() } catch (e) { sendUpdate({ status: 'error', error: String(e?.message || e).split('\n')[0].slice(0, 160) }) }
  return updateState
})
// close, install the downloaded version, and open it again
ipcMain.handle('update:install', () => { if (updateState.status === 'ready') setImmediate(() => autoUpdater.quitAndInstall(false, true)) })

/* ---------- spell lookup from wikidot ---------- */
const { fetchSpell, fetchItem } = require('./spells.cjs')
ipcMain.handle('spell:fetch', (_e, target) => fetchSpell(target))
ipcMain.handle('item:fetch', (_e, target) => fetchItem(target))

/* ---------- official Arknights class & branch icons, downloaded on request from the Arknights wiki ---------- */
// They're Hypergryph's artwork: kept on this computer only (<userData>/symbols/ak), never bundled with the app.
const symDir = () => path.join(app.getPath('userData'), 'symbols', 'ak')
const WIKI = 'https://arknights.wiki.gg/api.php'
const UA = { 'user-agent': 'CharacterSheetApp (personal desktop character sheet)' }
const AK_CLASSES = ['Vanguard', 'Guard', 'Defender', 'Sniper', 'Caster', 'Medic', 'Supporter', 'Specialist']
const wiki = async (params) => (await net.fetch(`${WIKI}?${new URLSearchParams({ format: 'json', ...params })}`, { headers: UA })).json()

ipcMain.handle('symbols:list', () => {
  try {
    const index = JSON.parse(fs.readFileSync(path.join(symDir(), 'index.json'), 'utf-8'))
    return index.map((s) => {
      try { return { ...s, url: `data:image/png;base64,${fs.readFileSync(path.join(symDir(), s.file)).toString('base64')}` } } catch { return null }
    }).filter(Boolean)
  } catch { return [] }
})
ipcMain.handle('symbols:download', async () => {
  fs.mkdirSync(symDir(), { recursive: true })
  // class marks: "Vanguard B.png" etc.; branch marks: everything in Category:Branch icons ("Pioneer Vanguard.png")
  const branch = await wiki({ action: 'query', list: 'categorymembers', cmtitle: 'Category:Branch icons', cmlimit: '500', cmtype: 'file' })
  // nations and factions (Lungmen, Kazimierz, Rhodes Island, Penguin Logistics…)
  const faction = await wiki({ action: 'query', list: 'categorymembers', cmtitle: 'Category:Faction icons', cmlimit: '500', cmtype: 'file' })
  const factionTitles = new Set(faction.query.categorymembers.map((m) => m.title))
  const titles = [...AK_CLASSES.map((c) => `File:${c} B.png`), ...branch.query.categorymembers.map((m) => m.title), ...factionTitles]
  const urls = {}
  for (let i = 0; i < titles.length; i += 40) {
    const info = await wiki({ action: 'query', prop: 'imageinfo', iiprop: 'url', titles: titles.slice(i, i + 40).join('|') })
    for (const p of Object.values(info.query.pages)) if (p.imageinfo?.[0]?.url) urls[p.title] = p.imageinfo[0].url
  }
  const index = []
  for (const [title, url] of Object.entries(urls)) {
    const name = title.replace(/^File:/, '').replace(/\.png$/i, '')
    const isClass = / B$/.test(name)
    const file = name.replace(/[^\w-]+/g, '_') + '.png'
    const r = await net.fetch(url, { headers: UA })
    if (!r.ok) continue
    fs.writeFileSync(path.join(symDir(), file), Buffer.from(await r.arrayBuffer()))
    const isFaction = factionTitles.has(title)
    const cls = isClass ? name.replace(/ B$/, '') : isFaction ? '' : AK_CLASSES.find((c) => name.endsWith(` ${c}`)) || ''
    index.push({ id: `ak:${file.replace(/\.png$/, '')}`, name: isClass ? cls : name, kind: isClass ? 'class' : isFaction ? 'faction' : 'branch', cls, file })
  }
  fs.writeFileSync(path.join(symDir(), 'index.json'), JSON.stringify(index))
  return index.length
})

/* ---------- sourcebook pages (imported with tools/import_ak5e_pdf.py) ---------- */
const bookRoot = () => path.join(app.getPath('userData'), 'sourcebook')
ipcMain.handle('book:list', () => {
  const out = []
  let ids = []
  try { ids = fs.readdirSync(bookRoot()) } catch { return out }
  for (const id of ids) {
    try { out.push({ id, ...JSON.parse(fs.readFileSync(path.join(bookRoot(), id, 'book.json'), 'utf-8')) }) } catch { /* not a book */ }
  }
  return out
})
// a book imported inside the app (pages, words.json, book.json), written into <userData>/sourcebook/<id>/
ipcMain.handle('book:write', (_e, id, rel, data) => {
  const root = path.join(bookRoot(), String(id).replace(/[^\w-]/g, ''))
  const file = path.normalize(path.join(root, String(rel)))
  if (!file.startsWith(root + path.sep)) throw new Error('bad path')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, typeof data === 'string' ? data : Buffer.from(data))
})
ipcMain.handle('book:remove', (_e, id) => {
  const dir = path.join(bookRoot(), String(id).replace(/[^\w-]/g, ''))
  if (dir !== bookRoot()) fs.rmSync(dir, { recursive: true, force: true })
})
ipcMain.handle('book:info', (_e, id) => {
  try { return JSON.parse(fs.readFileSync(path.join(bookRoot(), String(id).replace(/[^\w-]/g, ''), 'book.json'), 'utf-8')) } catch { return null }
})

app.whenReady().then(() => {
  protocol.handle('sheetbook', async (req) => {
    const u = new URL(req.url)
    const root = bookRoot()
    const file = path.normalize(path.join(root, decodeURIComponent(u.hostname), decodeURIComponent(u.pathname)))
    if (!file.startsWith(root + path.sep)) return new Response('', { status: 403 })
    try {
      const r = await net.fetch(pathToFileURL(file).toString())
      return new Response(r.body, { status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/octet-stream', 'access-control-allow-origin': '*', 'cache-control': 'max-age=31536000' } })
    } catch {
      return new Response('', { status: 404 })
    }
  })
  createWindow()
  // new versions come from the GitHub Releases page: downloaded in the background, installed when you close the app
  if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => { /* offline: try next time */ })
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})
app.on('window-all-closed', () => app.quit())
