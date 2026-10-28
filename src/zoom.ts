import { create } from 'zustand'

/* Zooming the whole sheet: Ctrl + scroll wheel (or Ctrl + = / − / 0), reset from Settings. Remembered on this computer. */

const KEY = 'ui-zoom'
const MIN = 0.5
const MAX = 2

function applyZoom(z: number) {
  if (window.sheetApi?.setZoom) window.sheetApi.setZoom(z)
  else document.documentElement.style.zoom = String(z)
}

const saved = (() => { try { return +(localStorage.getItem(KEY) || 1) || 1 } catch { return 1 } })()

export const useZoom = create<{ zoom: number; setZoom: (z: number) => void }>((set) => ({
  zoom: saved,
  setZoom: (z) => {
    const zoom = Math.round(Math.min(MAX, Math.max(MIN, z)) * 100) / 100
    applyZoom(zoom)
    try { localStorage.setItem(KEY, String(zoom)) } catch { /* private mode */ }
    set({ zoom })
  },
}))

/** call once at start: restores the saved zoom and listens for Ctrl + wheel / keys */
export function installZoom() {
  applyZoom(saved)
  const step = (dir: number) => { const { zoom, setZoom } = useZoom.getState(); setZoom(zoom + dir * 0.1) }
  window.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    step(e.deltaY < 0 ? 1 : -1)
  }, { passive: false })
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return
    if (e.key === '=' || e.key === '+') { e.preventDefault(); step(1) }
    else if (e.key === '-') { e.preventDefault(); step(-1) }
    else if (e.key === '0') { e.preventDefault(); useZoom.getState().setZoom(1) }
  })
}
