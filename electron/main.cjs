const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron')
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
  win.once('ready-to-show', () => win.show())
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

/* ---------- spell lookup from wikidot ---------- */
const { fetchSpell } = require('./spells.cjs')
ipcMain.handle('spell:fetch', (_e, target) => fetchSpell(target))

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})
app.on('window-all-closed', () => app.quit())
