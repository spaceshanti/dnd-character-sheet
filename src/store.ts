import { create } from 'zustand'
import { produce } from 'immer'
import type { AppData, Bookmark, Character, CustomSpell, TrashedChar } from './types'
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
      /** the imported sourcebook's page info, or null if it hasn't been imported */
      bookInfo: (id: string) => Promise<{ title: string; pages: number; aspect: number; ext: string } | null>
      /** downloaded official Arknights class / branch icons (as data URLs) */
      symbolList: () => Promise<{ id: string; name: string; kind: 'class' | 'branch' | 'faction'; cls: string; url: string }[]>
      /** fetch them from the Arknights wiki into the app's data folder; returns how many */
      symbolDownload: () => Promise<number>
      setZoom?: (factor: number) => void
      extraList: () => Promise<{ name: string; text: string }[]>
      extraSave: (name: string, text: string) => Promise<void>
      extraRemove: (name: string) => Promise<void>
      bookTextGet: (id: string) => Promise<string>
      bookTextSave: (id: string, text: string) => Promise<void>
      fetchUrl: <B extends boolean = false>(url: string, binary?: B) => Promise<B extends true ? Uint8Array : string>
      bookWrite: (id: string, rel: string, data: string | Uint8Array) => Promise<void>
      bookRemove: (id: string) => Promise<void>
      appVersion: () => Promise<string>
      checkUpdate: () => Promise<UpdateState>
      updateState: () => Promise<UpdateState>
      installUpdate: () => Promise<void>
      setIcon?: (dataUrl: string) => void
      onUpdateStatus: (cb: (s: UpdateState) => void) => () => void
      /** every imported sourcebook (folders under <userData>/sourcebook) */
      bookList: () => Promise<{ id: string; title: string; games?: string[]; pages: number; aspect: number; ext: string; toc?: [number, string, number][] }[]>
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

/** the desktop app's self-update, as the main process reports it */
export interface UpdateState { status: 'idle' | 'dev' | 'checking' | 'current' | 'downloading' | 'ready' | 'error'; latest: string; percent: number; error: string }

const LS_KEY = 'dnd-sheet-data'

async function readStore(): Promise<string | null> {
  if (window.sheetApi) return window.sheetApi.load()
  try { return localStorage.getItem(LS_KEY) } catch { return null }
}
async function writeStore(json: string) {
  if (window.sheetApi) await window.sheetApi.save(json)
  else try { localStorage.setItem(LS_KEY, json) } catch { /* quota */ }
}

/** how long a deleted character can still be restored */
export const TRASH_DAYS = 30

interface State extends Omit<AppData, 'skin' | 'customSpells' | 'skinBySystem' | 'skinVariant' | 'themeBySkin' | 'bookmarks' | 'trash'> {
  trash: TrashedChar[]
  restoreChar: (id: string) => void
  purgeChar: (id: string) => void
  bookmarks: Bookmark[]
  addBookmark: (b: Omit<Bookmark, 'id'>) => void
  updateBookmark: (id: string, p: Partial<Bookmark>) => void
  removeBookmark: (id: string) => void
  skin: SkinId
  skinBySystem: Partial<Record<SystemId, SkinId>>
  skinVariant: Partial<Record<SkinId, string>>
  /** light / dark is remembered per UI style */
  themeBySkin: Partial<Record<SkinId, 'light' | 'dark'>>
  setSkinVariant: (skin: SkinId, v: string) => void
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
  version: 1, chars: {}, order: [], activeId: '', trash: [], theme: 'light', skin: 'standard', skinBySystem: {}, skinVariant: {}, themeBySkin: {}, customSpells: [], bookmarks: [], loaded: false, saveError: '',

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
    // deleted characters stay restorable for TRASH_DAYS
    const trash = (data?.trash ?? []).filter((t) => t?.char && Date.now() - t.deletedAt < TRASH_DAYS * 86400000)
    set({ chars, order, activeId, trash, theme: data?.theme === 'dark' ? 'dark' : 'light', skin, skinBySystem, skinVariant: { ...(data?.skinVariant ?? {}) }, themeBySkin: { [skin]: data?.theme === 'dark' ? 'dark' : 'light', ...(data?.themeBySkin ?? {}) }, customSpells: data?.customSpells ?? [], bookmarks: data?.bookmarks ?? [], loaded: true })
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
      const c = s.chars[id]
      // a locked character has to be unlocked first
      if (!c || c.locked) return {}
      const chars = { ...s.chars }
      delete chars[id]
      const order = s.order.filter((x) => x !== id)
      return { chars, order, activeId: s.activeId === id ? '' : s.activeId, trash: [{ char: c, deletedAt: Date.now() }, ...s.trash] }
    })
  },

  restoreChar(id) {
    set((s) => {
      const t = s.trash.find((x) => x.char.id === id)
      if (!t) return {}
      const c = normalize({ ...t.char, locked: true })
      if (s.chars[c.id]) c.id = uid()
      return { chars: { ...s.chars, [c.id]: c }, order: [...s.order, c.id], trash: s.trash.filter((x) => x !== t) }
    })
  },

  purgeChar: (id) => set((s) => ({ trash: s.trash.filter((x) => x.char.id !== id) })),

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

  // light / dark belongs to the style in use: switching style brings back that style's own choice
  setTheme: (theme) => set((s) => ({ theme, themeBySkin: { ...s.themeBySkin, [s.skin]: theme } })),
  // remembered per game: the style you pick applies to every character of the open character's game
  setSkin: (skin) => set((s) => ({ skin, theme: s.themeBySkin[skin] ?? s.theme, skinBySystem: { ...s.skinBySystem, [systemOf(s.chars[s.activeId])]: skin } })),
  setSkinVariant: (skin, v) => set((s) => ({ skinVariant: { ...s.skinVariant, [skin]: v } })),
  saveCustomSpell: (sp) => set((s) => ({ customSpells: s.customSpells.some((x) => x.id === sp.id) ? s.customSpells.map((x) => (x.id === sp.id ? sp : x)) : [...s.customSpells, sp] })),
  deleteCustomSpell: (id) => set((s) => ({ customSpells: s.customSpells.filter((x) => x.id !== id) })),
  addBookmark: (b) => set((s) => ({ bookmarks: [...s.bookmarks, { ...b, id: uid() }] })),
  updateBookmark: (id, p) => set((s) => ({ bookmarks: s.bookmarks.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
  removeBookmark: (id) => set((s) => ({ bookmarks: s.bookmarks.filter((x) => x.id !== id) })),
}))

/* debounce-save everything whenever it changes (after the first load) */
let timer: ReturnType<typeof setTimeout> | undefined
useStore.subscribe((s, prev) => {
  // nothing to save for the load itself, only for changes after it (keeps the .bak a real previous version)
  if (!s.loaded || !prev.loaded) return
  if (s.chars === prev.chars && s.order === prev.order && s.activeId === prev.activeId && s.theme === prev.theme && s.skin === prev.skin && s.skinBySystem === prev.skinBySystem && s.skinVariant === prev.skinVariant && s.themeBySkin === prev.themeBySkin && s.customSpells === prev.customSpells && s.bookmarks === prev.bookmarks && s.trash === prev.trash) return
  clearTimeout(timer)
  timer = setTimeout(async () => {
    const { chars, order, activeId, theme, skin, skinBySystem, skinVariant, themeBySkin, customSpells, bookmarks, trash } = useStore.getState()
    try {
      await writeStore(JSON.stringify({ version: 1, chars, order, activeId, theme, skin, skinBySystem, skinVariant, themeBySkin, customSpells, bookmarks, trash } satisfies AppData))
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
  /** AK5e: the sourcebook reader */
  book: '' | 'side' | 'full'
  /** bumped to put the cursor in the sourcebook's search box */
  bookSearch: number
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
  page: 'overview', dockOpen: readOpen(), inventoryOpen: false, inventorySelected: '', charListOpen: false, book: '', bookSearch: 0, themeOpen: false, drawer: null, imagePick: null,
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
