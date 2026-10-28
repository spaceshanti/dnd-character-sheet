import { useRef, useState } from 'react'
import { create } from 'zustand'
import { imageToDataUrl } from '../store'
import { Popover } from './ui'

/*
 * Class / subclass symbols: an original set of simple marks, the official Arknights class / branch icons (downloaded on
 * request onto this computer, for Arknights sheets), or your own picture. With nothing picked, a class gets its
 * matching mark from its name.
 */

export const SYMBOLS: { id: string; name: string; d: string }[] = [
  // D&D classes
  { id: 'axe', name: 'Barbarian · axe', d: 'M13 2l9 9-3.5 3.5L16 12l-9.6 9.6a1.4 1.4 0 01-2-2L14 10l-2.5-2.5zM14.5 4.9l4.6 4.6 1-1-4.6-4.6z' },
  { id: 'lute', name: 'Bard · lute', d: 'M15.5 2.5l6 6-1.4 1.4-1.3-1.3-3.6 3.6a5.5 5.5 0 11-5.4-5.4l3.6-3.6-1.3-1.3zM9.5 12a2 2 0 100 4 2 2 0 000-4z' },
  { id: 'sun', name: 'Cleric · sun', d: 'M12 7a5 5 0 110 10 5 5 0 010-10zM11 1h2v4h-2zM11 19h2v4h-2zM1 11h4v2H1zM19 11h4v2h-4zM4.2 5.6l1.4-1.4 2.8 2.8L7 8.4zM15.6 17l1.4-1.4 2.8 2.8-1.4 1.4zM4.2 18.4L7 15.6 8.4 17l-2.8 2.8zM15.6 7l2.8-2.8 1.4 1.4L17 8.4z' },
  { id: 'leaf', name: 'Druid · leaf', d: 'M21 3C11 3 4 8 4 16c0 1.4.3 2.7.8 3.9L3 21.7 4.3 23l1.8-1.8A8.7 8.7 0 0010 22c8 0 11-8 11-19zM7 19l9-9' },
  { id: 'swordshield', name: 'Fighter · sword & shield', d: 'M3 3l11 11-2 2L1 5V3zM14 9l6-6h1v1l-6 6zM15 11h6v4c0 3-2.5 5.5-5 7-1.6-1-3-2.3-4-3.9z' },
  { id: 'fist', name: 'Monk · open hand', d: 'M8 11V4.5a1.5 1.5 0 013 0V10h1V3a1.5 1.5 0 013 0v7h1V4.5a1.5 1.5 0 013 0V15c0 4-3 7-7 7-3 0-5-1.6-6.5-4L3 14a1.6 1.6 0 012.6-1.9L8 15z' },
  { id: 'holyshield', name: 'Paladin · holy shield', d: 'M12 1l9 3.5V11c0 5.5-3.8 10.4-9 12-5.2-1.6-9-6.5-9-12V4.5zM11 6v4H7v2.4h4V18h2v-5.6h4V10h-4V6z' },
  { id: 'bow', name: 'Ranger · bow', d: 'M5 2c7 2 13 8 15 15l-2 .6C16.2 11.4 11.5 6.8 5.4 4.9zM3 3l18 18-1 1-3.5-1.5L15 22l-1.5-3.5L3.6 8.6 2 8l.6-1.6-.6-1.4 1-2z' },
  { id: 'dagger', name: 'Rogue · dagger', d: 'M20 2l2 2-10 12-2-2zM9.5 13.5l1 1L8 17l1.5 1.5-1.5 1.5-1.5-1.5-3 3L2 20l3-3-1.5-1.5L5 14l1.5 1.5z' },
  { id: 'flame', name: 'Sorcerer · flame', d: 'M12 1c1 4 6 6.5 6 12.5a6 6 0 01-12 0c0-2.5 1.2-4.5 3-6 0 2 .8 3.4 2 4 0-4 0-7.5 1-10.5zM12 14c-1.4 1.2-2 2.4-2 3.6a2 2 0 004 0c0-1.2-.6-2.4-2-3.6z' },
  { id: 'eye', name: 'Warlock · eye', d: 'M12 5c5 0 9 4 11 7-2 3-6 7-11 7S3 15 1 12c2-3 6-7 11-7zm0 3a4 4 0 100 8 4 4 0 000-8zm0 2.4l1.6 1.6L12 13.6 10.4 12z' },
  { id: 'hat', name: 'Wizard · hat & star', d: 'M13 1l7 15H6zM2 17h22v2.5C24 20.9 19 22 13 22S2 20.9 2 19.5zM11.5 6.5l.6 1.4 1.5.1-1.2 1 .4 1.5-1.3-.8-1.3.8.4-1.5-1.2-1 1.5-.1z' },
  { id: 'gear', name: 'Artificer · gear', d: 'M10.5 1h3l.5 2.6 1.8.8 2.2-1.5 2.1 2.1-1.5 2.2.8 1.8 2.6.5v3l-2.6.5-.8 1.8 1.5 2.2-2.1 2.1-2.2-1.5-1.8.8-.5 2.6h-3l-.5-2.6-1.8-.8-2.2 1.5-2.1-2.1 1.5-2.2-.8-1.8L1 13.5v-3l2.6-.5.8-1.8-1.5-2.2 2.1-2.1 2.2 1.5 1.8-.8zM12 8a4 4 0 100 8 4 4 0 000-8z' },
  { id: 'mind', name: 'Psion · third eye', d: 'M12 2l3 4h-6zM12 8c4.5 0 8 3 10 6-2 3-5.5 6-10 6S4 17 2 14c2-3 5.5-6 10-6zm0 2.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM2 6l3 2-1 1.6-3-2zM22 6l1 1.6-3 2-1-1.6z' },
  // Arknights classes
  { id: 'caster', name: 'Caster · star', d: 'M12 2l2.4 6.6L21 9l-5.2 4.3L17.6 21 12 17l-5.6 4 1.8-7.7L3 9l6.6-.4z' },
  { id: 'defender', name: 'Defender · tower shield', d: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5zm0 4l-4 1.5V11c0 3 1.7 5.4 4 6.7 2.3-1.3 4-3.7 4-6.7V7.5z' },
  { id: 'guard', name: 'Guard · blade', d: 'M19 2l3 3-11 11-3-3zM6 14l4 4-2 2-1.5-1.5L3 22l-1-1 3.5-3.5L4 16z' },
  { id: 'marksman', name: 'Marksman · crosshair', d: 'M11 2h2v4.1A6 6 0 0117.9 11H22v2h-4.1A6 6 0 0113 17.9V22h-2v-4.1A6 6 0 016.1 13H2v-2h4.1A6 6 0 0111 6.1zm1 6a4 4 0 100 8 4 4 0 000-8zm0 3a1 1 0 110 2 1 1 0 010-2z' },
  { id: 'medic', name: 'Medic · cross', d: 'M9 2h6v7h7v6h-7v7H9v-7H2V9h7z' },
  { id: 'specialist', name: 'Specialist · hook', d: 'M14 2l8 8-3 1-6-6zM12 7l5 5-9 9-4 1 1-4z' },
  { id: 'supporter', name: 'Supporter · pennant', d: 'M5 2h2v20H5zm3 1h11l-3 4 3 4H8z' },
  { id: 'vanguard', name: 'Vanguard · banner', d: 'M4 2h2v20H4zm3 1c4-1 6 2 12 0v9c-6 2-8-1-12 0z' },
  { id: 'construct', name: 'Doll / Drone · core', d: 'M12 2l9 5v10l-9 5-9-5V7zm0 5a5 5 0 100 10 5 5 0 000-10z' },
  // anything else
  { id: 'crown', name: 'Crown', d: 'M2 7l5 4 5-7 5 7 5-4-2 11H4zM4 19h16v2H4z' },
  { id: 'moon', name: 'Moon', d: 'M14 2a10 10 0 108 15.5A8.5 8.5 0 0114 2z' },
  { id: 'skull', name: 'Skull', d: 'M12 2c5 0 9 3.6 9 8.5 0 2.6-1.2 4.5-3 5.6V20h-3v-2h-2v2h-2v-2H9v2H6v-3.9c-1.8-1.1-3-3-3-5.6C3 5.6 7 2 12 2zM8.5 9a2 2 0 100 4 2 2 0 000-4zm7 0a2 2 0 100 4 2 2 0 000-4z' },
  { id: 'wing', name: 'Wing', d: 'M2 20C4 10 10 4 22 3c-1 3-3 5-6 6 2 0 3-.3 4-1-1 3-3.5 5-7 5.5 1.5.4 3 .3 4-.3C15 16 10 18 4 18z' },
  { id: 'bolt', name: 'Lightning', d: 'M14 1L4 14h7l-2 9 11-13h-7z' },
  { id: 'snow', name: 'Snowflake', d: 'M11 1h2v4.3l2.3-2.3 1.4 1.4L13 8.1V11h2.9l3.7-3.7 1.4 1.4-2.3 2.3H23v2h-4.3l2.3 2.3-1.4 1.4-3.7-3.7H13v2.9l3.7 3.7-1.4 1.4-2.3-2.3V23h-2v-4.3l-2.3 2.3-1.4-1.4 3.7-3.7V13H8.1l-3.7 3.7L3 15.3 5.3 13H1v-2h4.3L3 8.7l1.4-1.4L8.1 11H11V8.1L7.3 4.4 8.7 3 11 5.3z' },
  { id: 'tree', name: 'Tree', d: 'M12 1l7 9h-3l4 5h-4l3 4H13v4h-2v-4H5l3-4H4l4-5H5z' },
  { id: 'wave', name: 'Wave', d: 'M2 9c3-3 6-3 9 0s6 3 9 0l2 2c-4 4-8 4-12 0s-6-3-8 0zm0 6c3-3 6-3 9 0s6 3 9 0l2 2c-4 4-8 4-12 0s-6-3-8 0z' },
  { id: 'mountain', name: 'Mountain', d: 'M9 4l5 8 2-3 7 12H1zm0 4l-1.6 2.6L9 12l1.5-1.4z' },
  { id: 'feather', name: 'Feather', d: 'M21 2C12 2 6 8 6 16v2l-3 3 1.4 1.4L7.4 19.4H9c8 0 13-7 13-17zM9 16l7-7' },
  { id: 'heart', name: 'Heart', d: 'M12 21l-1.5-1.3C5 15 2 12.2 2 8.5 2 5.4 4.4 3 7.5 3c1.8 0 3.4.8 4.5 2.1C13.1 3.8 14.7 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.7-3 6.5-8.5 11.2z' },
  { id: 'hourglass', name: 'Hourglass', d: 'M5 2h14v2h-1v3c0 2-1.5 3.6-3.5 5 2 1.4 3.5 3 3.5 5v3h1v2H5v-2h1v-3c0-2 1.5-3.6 3.5-5C7.5 10.6 6 9 6 7V4H5zm3 2v3c0 1.4 1.6 2.8 4 4.1 2.4-1.3 4-2.7 4-4.1V4z' },
  { id: 'key', name: 'Key', d: 'M8 3a5 5 0 014.6 7H22v4h-2v3h-3v-3h-4.4A5 5 0 118 3zm0 3a2 2 0 100 4 2 2 0 000-4z' },
  { id: 'book', name: 'Book', d: 'M3 3h7a3 3 0 013 3v15a2.5 2.5 0 00-2.5-2.5H3zm18 0h-5a2.6 2.6 0 00-2 1v15c.6-.4 1.3-.5 2-.5h5z' },
  { id: 'compass', name: 'Compass', d: 'M12 1a11 11 0 110 22 11 11 0 010-22zm0 2a9 9 0 100 18 9 9 0 000-18zm4.5 4.5l-3 6-6 3 3-6zM12 11a1 1 0 100 2 1 1 0 000-2z' },
  { id: 'anchor', name: 'Anchor', d: 'M12 1a3 3 0 011 5.8V9h4v2h-4v9.9c3-.4 5.4-2.6 5.9-5.9H16l4-4 4 4h-3a9 9 0 01-18 0H0l4-4 4 4H5.1c.5 3.3 2.9 5.5 5.9 5.9V11H7V9h4V6.8A3 3 0 0112 1z' },
  { id: 'scale', name: 'Scales', d: 'M11 2h2v3h6l3 7a3.5 3.5 0 01-7 0l2.5-6H13v14h4v2H7v-2h4V6H7.5L10 12a3.5 3.5 0 01-7 0l3-7h5zM6.5 7.8L5 11.5h3z M17.5 7.8L16 11.5h3z' },
  { id: 'diamond', name: 'Diamond', d: 'M6 3h12l4 6-10 13L2 9zm1.2 2L4.6 9h4.6l1.4-4zm9.6 0h-3.4l1.4 4h4.6zM12 5.6L10.8 9h2.4zM5 11l5.5 7L9.2 11zm9.8 0l-1.3 7 5.5-7zm-3.6 0L12 16l.8-5z' },
  { id: 'rose', name: 'Rose', d: 'M12 2a5 5 0 015 5c0 3-2.2 5.5-5 5.5S7 10 7 7a5 5 0 015-5zm-1 11.5h2V22h-2zm2 3c2-2.5 4.5-3 7-2.5-.5 2.5-3 4-7 4zm-2 0c-4 0-6.5-1.5-7-4 2.5-.5 5 0 7 2.5z' },
  { id: 'chalice', name: 'Chalice', d: 'M5 2h14c0 5-2.6 8.6-6 9.6V18h4v2H7v-2h4v-6.4C7.6 10.6 5 7 5 2z' },
  { id: 'claw', name: 'Claw', d: 'M5 2c1 5 1 10-2 15 4-2 6-6 6.5-11C10 11 9 16 6 20c4-1 7-5 7.5-11 .5 5-.5 10-3.5 14 5-1 9-6 9-14C19 5 17 3 14 2c.8 3 .6 6-.5 8C13.5 6 11 3 8 2c.5 2.5.3 5-.5 7C7.5 6 6.5 3.5 5 2z' },
]

const BY_ID = Object.fromEntries(SYMBOLS.map((s) => [s.id, s]))

/* ---------- official Arknights icons: downloaded on request into the app's data folder (never bundled) ---------- */

export interface AkIcon { id: string; name: string; kind: 'class' | 'branch'; cls: string; url: string }

export const useAkIcons = create<{
  list: AkIcon[]; loaded: boolean; busy: boolean; error: string; tried: boolean
  load: () => Promise<void>; download: () => Promise<void>
  /** for Arknights sheets: load them, and fetch them the first time if they aren't on this computer yet */
  ensure: () => Promise<void>
}>((set, get) => ({
  list: [], loaded: false, busy: false, error: '', tried: false,
  async ensure() {
    await get().load()
    if (get().list.length || get().tried || get().busy || !window.sheetApi?.symbolDownload) return
    set({ tried: true })
    await get().download()
  },
  async load() {
    if (get().loaded) return
    let list: AkIcon[] = []
    if (window.sheetApi?.symbolList) list = await window.sheetApi.symbolList()
    else {
      // browser preview: a dev copy under public/sym-dev (never part of a build)
      try { list = await (await fetch('/sym-dev/index.json')).json() } catch { /* none */ }
    }
    set({ list, loaded: true })
  },
  async download() {
    if (!window.sheetApi?.symbolDownload) { set({ error: 'Downloading only works in the desktop app.' }); return }
    set({ busy: true, error: '' })
    try {
      await window.sheetApi.symbolDownload()
      set({ list: await window.sheetApi.symbolList(), loaded: true })
    } catch (e) { set({ error: `Couldn't download them: ${String(e)}` }) }
    set({ busy: false })
  },
}))

/** AK5e class names → the game's classes (AK5e's Marksman is the game's Sniper) */
const AK_CLASS: [RegExp, string][] = [
  [/caster/i, 'Caster'], [/defender|protector/i, 'Defender'], [/\bguard|slayer/i, 'Guard'], [/marksman|sniper|slinger/i, 'Sniper'],
  [/medic/i, 'Medic'], [/specialist/i, 'Specialist'], [/supporter/i, 'Supporter'], [/vanguard/i, 'Vanguard'],
]
export const akClassOf = (className: string) => AK_CLASS.find(([re]) => re.test(className))?.[1] ?? ''

/** AK5e branches the book names differently from the game → the game branch whose icon fits best */
const AK_BRANCH_ALIAS: Record<string, string> = {
  artshield: 'Arts Protector Defender', artsblade: 'Arts Fighter Guard', brawler: 'Fighter Guard', duellist: 'Duelist Defender',
  musha: 'Soloblade Guard', weaponmaster: 'Swordmaster Guard', 'anti-air': 'Marksman Sniper', heavyshot: 'Heavyshooter Sniper',
  spreadshot: 'Spreadshooter Sniper', physician: 'Medic Medic', triage: 'Multi-target Medic', ward: 'Watchman Medic',
  witchcraft: 'Incantation Medic', infuser: 'Alchemist Specialist', inventor: 'Geek Specialist',
}

/** The automatic mark for a class / branch: the official Arknights icon on Arknights sheets (once downloaded), else ours. */
export function autoSymbolFor(name: string, opts: { ak: boolean; branchOf?: string; icons: AkIcon[] }): string {
  if (opts.ak && opts.icons.length && name.trim()) {
    if (opts.branchOf === undefined) {
      const cls = akClassOf(name)
      const icon = opts.icons.find((i) => i.kind === 'class' && i.cls === cls)
      if (icon) return icon.id
    } else {
      // "Core Caster", "Pioneer", "Artsblade (Arts Fighter)": match the branch's name, preferring the character's class
      const cls = akClassOf(opts.branchOf)
      const n = name.toLowerCase()
      const words = n.split(/[^a-z-]+/).filter((w) => w.length > 2)
      const branches = opts.icons.filter((i) => i.kind === 'branch').sort((a, b) => Number(b.cls === cls) - Number(a.cls === cls))
      const alias = words.map((w) => AK_BRANCH_ALIAS[w]).find(Boolean)
      const hit = (alias && branches.find((i) => i.name === alias))
        ?? branches.find((i) => i.name.toLowerCase() === n)
        ?? branches.find((i) => n.includes(i.name.toLowerCase().replace(` ${i.cls.toLowerCase()}`, '')))
        ?? branches.find((i) => words.some((w) => i.name.toLowerCase().startsWith(w)))
      if (hit) return hit.id
    }
  }
  return autoSymbol(name)
}

/** class / branch name → mark, when nothing has been picked */
const AUTO: [RegExp, string][] = [
  [/barbarian/i, 'axe'], [/bard/i, 'lute'], [/cleric/i, 'sun'], [/druid/i, 'leaf'], [/fighter/i, 'swordshield'],
  [/monk/i, 'fist'], [/paladin/i, 'holyshield'], [/ranger/i, 'bow'], [/rogue/i, 'dagger'], [/sorcer/i, 'flame'],
  [/warlock/i, 'eye'], [/wizard/i, 'hat'], [/artificer/i, 'gear'], [/psion|psionic|psykinetic/i, 'mind'],
  [/caster/i, 'caster'], [/defender|protector/i, 'defender'], [/\bguard|slayer/i, 'guard'], [/marksman|sniper|slinger/i, 'marksman'],
  [/medic|healer/i, 'medic'], [/specialist/i, 'specialist'], [/supporter/i, 'supporter'], [/vanguard/i, 'vanguard'],
  [/doll|drone|arts master/i, 'construct'],
]
export const autoSymbol = (name: string) => AUTO.find(([re]) => re.test(name))?.[1] ?? ''

/** A symbol: one of the built-in marks (by id), or your own picture (data URL). */
export function SymbolMark({ value, size = 22, title }: { value: string; size?: number; title?: string }) {
  const icons = useAkIcons((s) => s.list)
  if (value.startsWith('data:')) return <img className="sym-img" src={value} alt="" title={title} style={{ width: size, height: size }} />
  if (value.startsWith('ak:')) {
    // drawn as a stencil in the current colour, so the game's white / black icons suit every UI style
    const icon = icons.find((i) => i.id === value)
    if (!icon) return null
    const mask = `url("${icon.url}") center / contain no-repeat`
    return <span className="sym-ak" title={title ?? icon.name} style={{ width: size, height: size, WebkitMask: mask, mask }} />
  }
  const s = BY_ID[value]
  if (!s) return null
  return <svg className="sym-svg" viewBox="0 0 24 24" width={size} height={size} aria-label={title ?? s.name}><title>{title ?? s.name}</title><path d={s.d} fillRule="evenodd" /></svg>
}

/** The little symbol button beside the Class / Subclass fields; click to pick another, or your own picture. */
export function SymbolPicker({ value, auto, label, onChange, ak = false, akClass = '' }: {
  value: string; auto: string; label: string; onChange: (v: string) => void
  /** Arknights sheet: offer the official class & branch icons first */
  ak?: boolean
  /** the character's game class (e.g. Sniper), to list its branches first */
  akClass?: string
}) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const { list: icons, busy, error, download } = useAkIcons()
  const shown = value || auto
  const autoName = auto.startsWith('ak:') ? icons.find((i) => i.id === auto)?.name : BY_ID[auto]?.name
  const classIcons = icons.filter((i) => i.kind === 'class')
  const branchGroups = [...new Set(icons.filter((i) => i.kind === 'branch').map((i) => i.cls))]
    .sort((a, b) => Number(b === akClass) - Number(a === akClass) || a.localeCompare(b))
  const cell = (id: string, title: string) => (
    <button key={id} className={`sym-cell ${value === id ? 'on' : ''}`} title={title} onClick={() => { onChange(id); setOpen(false) }}>
      <SymbolMark value={id} size={22} />
    </button>
  )
  return (
    <>
      <button ref={btn} className={`sym-btn ${shown ? '' : 'empty'}`} title={`${label} symbol: click to choose`} onClick={() => setOpen(!open)}>
        {shown ? <SymbolMark value={shown} size={20} /> : <span>＋</span>}
      </button>
      <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (f) { onChange(await imageToDataUrl(f, 128, true)); setOpen(false) }
      }} />
      {open && (
        <Popover anchor={btn.current} onClose={() => setOpen(false)} width={360}>
          <div className="row" style={{ marginBottom: 6 }}>
            <b className="grow">{label} symbol</b>
            <button className="btn sm" onClick={() => file.current?.click()}>Use my own picture…</button>
          </div>
          <div className="sym-scroll">
            <div className="sym-grid">
              <button className={`sym-cell ${!value ? 'on' : ''}`} title={auto ? `Automatic (${autoName ?? 'from the name'})` : 'None'} onClick={() => { onChange(''); setOpen(false) }}>
                {auto ? <><SymbolMark value={auto} size={22} /><i>auto</i></> : <span className="muted small">none</span>}
              </button>
              {value.startsWith('data:') && <button className="sym-cell on" title="Your picture"><SymbolMark value={value} size={22} /></button>}
            </div>
            {ak && (
              <>
                <div className="sym-h">Arknights · official icons</div>
                {icons.length === 0 ? (
                  <div className="sym-dl">
                    <span className="muted small">The game's class and branch icons, downloaded from the Arknights wiki onto this computer (not part of the app).</span>
                    <button className="btn sm primary" disabled={busy} onClick={download}>{busy ? 'Downloading…' : 'Download them'}</button>
                    {error && <span className="small" style={{ color: 'var(--dis)' }}>{error}</span>}
                  </div>
                ) : (
                  <>
                    <div className="sym-sub">Classes</div>
                    <div className="sym-grid">{classIcons.map((i) => cell(i.id, i.name))}</div>
                    {branchGroups.map((g) => (
                      <div key={g}>
                        <div className="sym-sub">{g} branches</div>
                        <div className="sym-grid">{icons.filter((i) => i.kind === 'branch' && i.cls === g).map((i) => cell(i.id, i.name))}</div>
                      </div>
                    ))}
                  </>
                )}
                <div className="sym-h">Other symbols</div>
              </>
            )}
            <div className="sym-grid">{SYMBOLS.map((s) => cell(s.id, s.name))}</div>
          </div>
        </Popover>
      )}
    </>
  )
}
