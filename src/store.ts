import { create } from 'zustand'
import { produce } from 'immer'
import type { AppData, Character } from './types'
import { blankCharacter, normalize, uid } from './blank'
import { SKINS, type SkinId } from './skins'

declare global {
  interface Window {
    sheetApi?: {
      load: () => Promise<string | null>
      save: (json: string) => Promise<boolean>
      fetchSpell: (target: string) => Promise<SpellLookup>
      openExternal: (url: string) => Promise<void>
      dataPath: () => Promise<string>
    }
  }
}

export interface SpellLookup {
  error?: string
  url?: string
  name?: string
  level?: number
  school?: string
  ritual?: boolean
  castingTime?: string
  range?: string
  components?: string
  duration?: string
  concentration?: boolean
  source?: string
  description?: string
}

const LS_KEY = 'dnd-sheet-data'

async function readStore(): Promise<string | null> {
  if (window.sheetApi) return window.sheetApi.load()
  try { return localStorage.getItem(LS_KEY) } catch { return null }
}
async function writeStore(json: string) {
  if (window.sheetApi) await window.sheetApi.save(json)
  else try { localStorage.setItem(LS_KEY, json) } catch { /* quota */ }
}

interface State extends Omit<AppData, 'skin'> {
  skin: SkinId
  loaded: boolean
  saveError: string
  load: () => Promise<void>
  /** edit the active character with an immer-style mutator */
  patch: (fn: (c: Character) => void) => void
  setActive: (id: string) => void
  addChar: (name?: string) => string
  dupChar: (id: string) => void
  deleteChar: (id: string) => void
  importChars: (chars: Character[]) => void
  setTheme: (t: 'light' | 'dark') => void
  setSkin: (s: SkinId) => void
}

export const useStore = create<State>((set, get) => ({
  version: 1, chars: {}, order: [], activeId: '', theme: 'light', skin: 'standard', loaded: false, saveError: '',

  async load() {
    let data: Partial<AppData> | null = null
    try {
      const raw = await readStore()
      if (raw) data = JSON.parse(raw)
    } catch { /* corrupt → start fresh (a .bak exists beside the file) */ }
    const chars: Record<string, Character> = {}
    for (const [id, c] of Object.entries(data?.chars ?? {})) chars[id] = normalize(c)
    let order = (data?.order ?? []).filter((id) => chars[id])
    for (const id of Object.keys(chars)) if (!order.includes(id)) order.push(id)
    if (!order.length) {
      const c = blankCharacter('New Character')
      chars[c.id] = c
      order = [c.id]
    }
    const activeId = data?.activeId && chars[data.activeId] ? data.activeId : order[0]
    const skin = (SKINS.find((k) => k.id === data?.skin)?.id ?? 'standard') as SkinId
    set({ chars, order, activeId, theme: data?.theme === 'dark' ? 'dark' : 'light', skin, loaded: true })
  },

  patch(fn) {
    const { activeId, chars } = get()
    const cur = chars[activeId]
    if (!cur) return
    const next = produce(cur, (d) => { fn(d as Character); d.updatedAt = Date.now() })
    set({ chars: { ...chars, [activeId]: next } })
  },

  setActive: (id) => set({ activeId: id }),

  addChar(name = 'New Character') {
    const c = blankCharacter(name)
    set((s) => ({ chars: { ...s.chars, [c.id]: c }, order: [...s.order, c.id], activeId: c.id }))
    return c.id
  },

  dupChar(id) {
    const src = get().chars[id]
    if (!src) return
    const copy: Character = JSON.parse(JSON.stringify(src))
    copy.id = uid()
    copy.name = `${src.name} (copy)`
    set((s) => ({ chars: { ...s.chars, [copy.id]: copy }, order: [...s.order, copy.id], activeId: copy.id }))
  },

  deleteChar(id) {
    set((s) => {
      const chars = { ...s.chars }
      delete chars[id]
      let order = s.order.filter((x) => x !== id)
      if (!order.length) {
        const c = blankCharacter()
        chars[c.id] = c
        order = [c.id]
      }
      return { chars, order, activeId: s.activeId === id ? order[0] : s.activeId }
    })
  },

  importChars(list) {
    set((s) => {
      const chars = { ...s.chars }
      const order = [...s.order]
      let last = s.activeId
      for (const raw of list) {
        const c = normalize(raw)
        if (chars[c.id]) c.id = uid()
        chars[c.id] = c
        order.push(c.id)
        last = c.id
      }
      return { chars, order, activeId: last }
    })
  },

  setTheme: (theme) => set({ theme }),
  setSkin: (skin) => set({ skin }),
}))

/* debounce-save everything whenever it changes (after the first load) */
let timer: ReturnType<typeof setTimeout> | undefined
useStore.subscribe((s, prev) => {
  if (!s.loaded) return
  if (s.chars === prev.chars && s.order === prev.order && s.activeId === prev.activeId && s.theme === prev.theme && s.skin === prev.skin) return
  clearTimeout(timer)
  timer = setTimeout(async () => {
    const { chars, order, activeId, theme, skin } = useStore.getState()
    try {
      await writeStore(JSON.stringify({ version: 1, chars, order, activeId, theme, skin } satisfies AppData))
      useStore.setState({ saveError: '' })
    } catch (e) {
      useStore.setState({ saveError: String(e) })
    }
  }, 350)
})

export const useChar = (): Character => {
  const id = useStore((s) => s.activeId)
  return useStore((s) => s.chars[id])
}

/* ---------------- transient UI state ---------------- */
export type PageId = 'overview' | 'character' | 'features' | 'spells' | 'actions' | 'gallery' | 'settings'

export type Drawer =
  | { kind: 'spell'; id: string }
  | { kind: 'feature'; id: string }
  | null

interface UIState {
  page: PageId
  dockOpen: boolean
  inventoryOpen: boolean
  inventorySelected: string
  rosterOpen: boolean
  themeOpen: boolean
  drawer: Drawer
  go: (p: PageId) => void
  toggleDock: () => void
  set: (p: Partial<UIState>) => void
}

function readOpen() {
  try { return localStorage.getItem('dock-open') === '1' } catch { return false }
}

export const useUI = create<UIState>((set) => ({
  page: 'overview', dockOpen: readOpen(), inventoryOpen: false, inventorySelected: '', rosterOpen: false, themeOpen: false, drawer: null,
  go: (page) => set({ page }),
  toggleDock: () => set((s) => {
    try { localStorage.setItem('dock-open', s.dockOpen ? '0' : '1') } catch { /* private mode */ }
    return { dockOpen: !s.dockOpen }
  }),
  set: (p) => set(p),
}))

/* ---------------- helpers ---------------- */
export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

/** Read an image file, downscale it so saves stay small, return a data URL. */
export function imageToDataUrl(file: File, max = 1100): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Not an image'))
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const cv = document.createElement('canvas')
        cv.width = Math.round(img.width * scale)
        cv.height = Math.round(img.height * scale)
        const ctx = cv.getContext('2d')!
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, cv.width, cv.height)
        ctx.drawImage(img, 0, 0, cv.width, cv.height)
        resolve(cv.toDataURL('image/jpeg', 0.86))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
