import { useEffect, useState } from 'react'
import { variantOf } from './skins'
import { useStore, useUI } from './store'
import { TopBar } from './components/TopBar'
import { LeftDock } from './components/LeftDock'
import { Inventory } from './components/Inventory'
import { CharacterList } from './pages/CharacterList'
import { DrawerHost } from './components/Drawers'
import { ThemeMenu } from './components/SkinPicker'
import { ImagePicker } from './components/ImagePicker'
import { Overview } from './pages/Overview'
import { CharacterPage } from './pages/Character'
import { FeaturesPage } from './pages/Features'
import { SpellsPage } from './pages/Spells'
import { ActionsPage } from './pages/Actions'
import { GalleryPage } from './pages/Gallery'
import { SettingsPage } from './pages/Settings'
import { OperatorSkillsPage } from './pages/OperatorSkills'
import { BookViewer } from './components/BookViewer'
import { DialogHost } from './components/Dialog'
import { installDerivedSync } from './derived'

// resource maximums, Arts Points etc. follow level and ability score changes
installDerivedSync()
import { systemOf } from './systems'
import { downloadAk5e, hasAkData, reloadSoon } from './components/BookSetup'

export default function App() {
  const loaded = useStore((s) => s.loaded)
  const load = useStore((s) => s.load)
  const theme = useStore((s) => s.theme)
  const skin = useStore((s) => s.skin)
  const variant = useStore((s) => variantOf(s.skin, s.skinVariant))
  const activeId = useStore((s) => s.activeId)
  const page = useUI((s) => s.page)
  const listOpen = useUI((s) => s.charListOpen)
  const hasChar = useStore((s) => !!s.chars[s.activeId])
  const system = useStore((s) => systemOf(s.chars[s.activeId]))

  useEffect(() => { load() }, [load])
  // the first time an Arknights sheet is opened, the book's data is downloaded onto this computer (once)
  const [akDownload, setAkDownload] = useState('')
  useEffect(() => {
    if (!loaded || !hasChar || system !== 'ak5e' || hasAkData() || !window.sheetApi) return
    let tries = 0
    try { tries = +(sessionStorage.getItem('ak5e-download-tried') || 0) } catch { /* private mode */ }
    if (tries) return
    try { sessionStorage.setItem('ak5e-download-tried', '1') } catch { /* private mode */ }
    setAkDownload('Downloading the Arknights 5e book (Arts, gear, classes)…')
    downloadAk5e()
      .then(() => { setAkDownload('Arknights 5e book downloaded: loading it…'); reloadSoon() })
      .catch((e) => setAkDownload(`Couldn't download the Arknights 5e book (${e instanceof Error ? e.message : e}). Try again from Settings → Sourcebooks.`))
  }, [loaded, hasChar, system])
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => { document.documentElement.dataset.skin = skin }, [skin])
  useEffect(() => {
    if (variant) document.documentElement.dataset.variant = variant
    else delete document.documentElement.dataset.variant
  }, [variant])
  // each game keeps its own UI style: opening an Arknights character switches to its look, and back
  useEffect(() => {
    const st = useStore.getState()
    if (!st.loaded || !st.chars[st.activeId]) return
    const want = st.skinBySystem[system] ?? (system === 'ak5e' ? 'arknights' : undefined)
    if (want && want !== st.skin) useStore.setState({ skin: want, skinBySystem: { ...st.skinBySystem, [system]: want } })
    document.documentElement.dataset.system = system
  }, [system, loaded, activeId])

  // Ctrl+I opens the inventory, Tab opens / closes the abilities panel (both only while not typing in a box)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable
      const overlay = document.querySelector('.backdrop, .drawer, .popover')
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !typing && !overlay) {
        e.preventDefault()
        useUI.getState().toggleDock()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't' && !typing) {
        e.preventDefault()
        const u = useUI.getState()
        u.set({ themeOpen: !u.themeOpen })
        return
      }
      // Sourcebooks. Ctrl+B: side pane on / off (not in a text box, where it's bold, except the book's own search).
      // Ctrl+F: open the side pane if it's closed and jump to its search box.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && (!typing || t.closest('.book'))) {
        e.preventDefault()
        const u = useUI.getState()
        u.set({ book: u.book === 'side' ? '' : 'side' })
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        const u = useUI.getState()
        u.set({ book: u.book || 'side', bookSearch: u.bookSearch + 1 })
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i' && !typing) {
        e.preventDefault()
        const u = useUI.getState()
        u.set({ inventoryOpen: !u.inventoryOpen })
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  if (!loaded) return null
  if (!hasChar || listOpen) return (
    <>
      <CharacterList />
      <ThemeMenu />
      <DialogHost />
    </>
  )
  return (
    <div className="app" key={activeId}>
      <TopBar />
      <div className="body">
        <LeftDock />
        <main className="page">
          {page === 'overview' && <Overview />}
          {page === 'character' && <CharacterPage />}
          {page === 'features' && <FeaturesPage />}
          {page === 'operator' && (system === 'ak5e' ? <OperatorSkillsPage /> : <Overview />)}
          {page === 'spells' && <SpellsPage />}
          {page === 'actions' && <ActionsPage />}
          {page === 'gallery' && <GalleryPage />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
      <Inventory />
      <ThemeMenu />
      <ImagePicker />
      <DrawerHost />
      <BookViewer />
      <DialogHost />
      {akDownload && <div className="toast show" onClick={() => setAkDownload('')}>{akDownload}</div>}
    </div>
  )
}
