// Live-reload dev mode: starts Vite, then opens the real Electron window pointed at it.
// Edit anything in src/ and the window updates on save. Closing the window stops everything.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import net from 'node:net'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const PORT = 5173
const vite = spawn(`npx vite --port ${PORT} --strictPort`, { stdio: 'inherit', shell: true })

const waitForPort = () =>
  new Promise((resolve, reject) => {
    const started = Date.now()
    const tryOnce = () => {
      const s = net.connect(PORT, '127.0.0.1')
      s.once('connect', () => { s.destroy(); resolve() })
      s.once('error', () => {
        s.destroy()
        if (Date.now() - started > 30000) reject(new Error('Vite did not start'))
        else setTimeout(tryOnce, 250)
      })
    }
    tryOnce()
  })

const stop = () => { try { vite.kill() } catch { /* already gone */ } }
process.on('SIGINT', () => { stop(); process.exit(0) })

try {
  await waitForPort()
  const app = spawn(electronPath, ['.'], { stdio: 'inherit', env: { ...process.env, SHEET_DEV_URL: `http://localhost:${PORT}` } })
  app.on('exit', () => { stop(); process.exit(0) })
} catch (e) {
  console.error(e.message)
  stop()
  process.exit(1)
}
