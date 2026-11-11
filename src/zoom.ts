import { create } from 'zustand'

/*
 * Zooming the whole sheet. Locked at normal size by default (Ctrl + scroll is easy to hit by accident);
 * Settings → Allow zooming turns on Ctrl + scroll / Ctrl + = − 0 and keeps the zoom you pick. Remembered on this computer.
 */

const KEY = 'ui-zoom'
const UNLOCK_KEY = 'ui-zoom-unlocked'
const MIN = 0.5
const MAX = 2

function applyZoom(z: number) {
  if (window.sheetApi?.setZoom) window.sheetApi.setZoom(z)
  else document.documentElement.style.zoom = String(z)
}

const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }

const unlocked = read(UNLOCK_KEY) === '1'
const saved = unlocked ? +(read(KEY) || 1) || 1 : 1

export const useZoom = create<{ zoom: number; unlocked: boolean; setZoom: (z: number) => void; setUnlocked: (b: boolean) => void }>((set, get) => ({
  zoom: saved,
  unlocked,
  setZoom: (z) => {
    if (!get().unlocked && z !== 1) return
    const zoom = Math.round(Math.min(MAX, Math.max(MIN, z)) * 100) / 100
    applyZoom(zoom)
    write(KEY, String(zoom))
    set({ zoom })
  },
  // locking goes back to normal size
  setUnlocked: (b) => {
    write(UNLOCK_KEY, b ? '1' : '0')
    set({ unlocked: b })
    if (!b) get().setZoom(1)
  },
}))

/** call once at start: puts the zoom where it belongs and listens for Ctrl + wheel / keys */
export function installZoom() {
  applyZoom(saved)
  const step = (dir: number) => { const { zoom, setZoom } = useZoom.getState(); setZoom(zoom + dir * 0.1) }
  window.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return
    // always stop the browser's own zoom; only zoom ourselves when it's allowed
    e.preventDefault()
    if (useZoom.getState().unlocked) step(e.deltaY < 0 ? 1 : -1)
  }, { passive: false })
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return
    if (e.key !== '=' && e.key !== '+' && e.key !== '-' && e.key !== '0') return
    e.preventDefault()
    if (!useZoom.getState().unlocked) return
    if (e.key === '0') useZoom.getState().setZoom(1)
    else step(e.key === '-' ? -1 : 1)
  })
}
