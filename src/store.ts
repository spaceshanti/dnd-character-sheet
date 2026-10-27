import { create } from 'zustand'
import { produce } from 'immer'
import type { AppData, Character, CustomSpell } from './types'
import { blankCharacter, normalize, uid } from './blank'
import { SKINS, type SkinId } from './skins'
import { systemOf, type SystemId } from './systems'

declare global {
  interface Window {
    sheetApi?: {
      load: () => Promise<string | null>
      save: (json: string) => Promise<boolean>
      fetchSpell: (target: string) => Promise<SpellLookup>
      fetchItem: (target: string) => Promise<ItemLookup>
      openExternal: (url: string) => Promise<void>
      dataPath: () => Promise<string>
      listTemplates: () => Promise<string[]>
      readTemplate: (name: string) => Promise<Uint8Array | null>
      addTemplate: (name: string, bytes: Uint8Array) => Promise<string>
      removeTemplate: (name: string) => Promise<void>
      saveFile: (name: string, bytes: Uint8Array) => Promise<string>
    }
  }
}

export interface ItemLookup {
  error?: string
  url?: string
  name?: string
  type?: string
  rarity?: string
  attunement?: boolean
  description?: string
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

interface State extends Omit<AppData, 'skin' | 'customSpells' | 'skinBySystem'> {
  skin: SkinId
  skinBySystem: Partial<Record<SystemId, SkinId>>
  customSpells: CustomSpell[]
  saveCustomSpell: (s: CustomSpell) => void
  deleteCustomSpell: (id: string) => void
  loaded: boolean
  saveError: string
  load: () => Promise<void>
  /** edit the active character with an immer-style mutator */
  patch: (fn: (c: Character) => void) => void
  setActive: (id: string) => void
  addChar: (name?: string, system?: SystemId) => string
  dupChar: (id: string) => void
  deleteChar: (id: string) => void
  importChars: (chars: Character[]) => void
  setTheme: (t: 'light' | 'dark') => void
  setSkin: (s: SkinId) => void
}

export const useStore = create<State>((set, get) => ({
  version: 1, chars: {}, order: [], activeId: '', theme: 'light', skin: 'standard', skinBySystem: {}, customSpells: [], loaded: false, saveError: '',

  async load() {
    let data: Partial<AppData> | null = null
    try {
      const raw = await readStore()
      if (raw) data = JSON.parse(raw)
    } catch { /* unreadable: the desktop app already falls back to the .bak copy */ }
    const chars: Record<string, Character> = {}
    for (const [id, c] of Object.entries(data?.chars ?? {})) {
      try { if (c && typeof c === 'object') chars[id] = normalize({ ...c, id }) } catch { /* skip a broken character */ }
    }
    const order = (data?.order ?? []).filter((id) => chars[id])
    for (const id of Object.keys(chars)) if (!order.includes(id)) order.push(id)
    // no character, or the last one opened is gone → the character list is shown instead
    const activeId = data?.activeId && chars[data.activeId] ? data.activeId : ''
    const skin = (SKINS.find((k) => k.id === data?.skin)?.id ?? 'standard') as SkinId
    const skinBySystem: State['skinBySystem'] = {}
    for (const [sys, id] of Object.entries(data?.skinBySystem ?? {})) if (SKINS.some((k) => k.id === id)) skinBySystem[sys as SystemId] = id as SkinId
    // saves from before games existed: the style in use becomes the D&D one
    if (!skinBySystem.dnd5e) skinBySystem.dnd5e = skin
    set({ chars, order, activeId, theme: data?.theme === 'dark' ? 'dark' : 'light', skin, skinBySystem, customSpells: data?.customSpells ?? [], loaded: true })
  },

  patch(fn) {
    const { activeId, chars } = get()
    const cur = chars[activeId]
    if (!cur) return
    const next = produce(cur, (d) => { fn(d as Character); d.updatedAt = Date.now() })
    set({ chars: { ...chars, [activeId]: next } })
  },

  setActive: (id) => set({ activeId: id }),

  addChar(name = 'New Character', system: SystemId = 'dnd5e') {
    const c = blankCharacter(name, system)
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
      const order = s.order.filter((x) => x !== id)
      return { chars, order, activeId: s.activeId === id ? '' : s.activeId }
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
  // remembered per game: the style you pick applies to every character of the open character's game
  setSkin: (skin) => set((s) => ({ skin, skinBySystem: { ...s.skinBySystem, [systemOf(s.chars[s.activeId])]: skin } })),
  saveCustomSpell: (sp) => set((s) => ({ customSpells: s.customSpells.some((x) => x.id === sp.id) ? s.customSpells.map((x) => (x.id === sp.id ? sp : x)) : [...s.customSpells, sp] })),
  deleteCustomSpell: (id) => set((s) => ({ customSpells: s.customSpells.filter((x) => x.id !== id) })),
}))

/* debounce-save everything whenever it changes (after the first load) */
let timer: ReturnType<typeof setTimeout> | undefined
useStore.subscribe((s, prev) => {
  // nothing to save for the load itself, only for changes after it (keeps the .bak a real previous version)
  if (!s.loaded || !prev.loaded) return
  if (s.chars === prev.chars && s.order === prev.order && s.activeId === prev.activeId && s.theme === prev.theme && s.skin === prev.skin && s.skinBySystem === prev.skinBySystem && s.customSpells === prev.customSpells) return
  clearTimeout(timer)
  timer = setTimeout(async () => {
    const { chars, order, activeId, theme, skin, skinBySystem, customSpells } = useStore.getState()
    try {
      await writeStore(JSON.stringify({ version: 1, chars, order, activeId, theme, skin, skinBySystem, customSpells } satisfies AppData))
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
export type ImageTarget = 'portrait' | 'appearanceImage' | 'emblem'

export type PageId = 'overview' | 'character' | 'features' | 'operator' | 'spells' | 'actions' | 'gallery' | 'settings'

export type Drawer =
  | { kind: 'spell'; id: string }
  | { kind: 'feature'; id: string }
  | null

interface UIState {
  page: PageId
  dockOpen: boolean
  inventoryOpen: boolean
  inventorySelected: string
  /** the character list screen, opened from inside a character */
  charListOpen: boolean
  /** AK5e: the full-screen operator view */
  operatorOpen: boolean
  /** AK5e: the sourcebook reader */
  bookOpen: boolean
  themeOpen: boolean
  drawer: Drawer
  /** which image the gallery picker is choosing, if open */
  imagePick: ImageTarget | null
  go: (p: PageId) => void
  toggleDock: () => void
  set: (p: Partial<UIState>) => void
}

function readOpen() {
  try { return localStorage.getItem('dock-open') === '1' } catch { return false }
}

export const useUI = create<UIState>((set) => ({
  page: 'overview', dockOpen: readOpen(), inventoryOpen: false, inventorySelected: '', charListOpen: false, operatorOpen: false, bookOpen: false, themeOpen: false, drawer: null, imagePick: null,
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
function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const d = ctx.getImageData(0, 0, w, h).data
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true
  return false
}

export function imageToDataUrl(file: File, max = 1100, png = false): Promise<string> {
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
        ctx.drawImage(img, 0, 0, cv.width, cv.height)
        // pictures with see-through parts (cut-out character art, icons) stay PNG so the transparency survives;
        // everything else becomes JPEG on white to keep saves small
        if (png || hasTransparency(ctx, cv.width, cv.height)) { resolve(cv.toDataURL('image/png')); return }
        ctx.globalCompositeOperation = 'destination-over'
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, cv.width, cv.height)
        resolve(cv.toDataURL('image/jpeg', 0.86))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
