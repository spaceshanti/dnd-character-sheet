const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron')
const fs = require('fs')
const path = require('path')

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

/* ---------- spell lookup from wikidot ---------- */
const { fetchSpell, fetchItem } = require('./spells.cjs')
ipcMain.handle('spell:fetch', (_e, target) => fetchSpell(target))
ipcMain.handle('item:fetch', (_e, target) => fetchItem(target))

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})
app.on('window-all-closed', () => app.quit())
