import { useEffect } from 'react'
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
import { systemOf } from './systems'

export default function App() {
  const loaded = useStore((s) => s.loaded)
  const load = useStore((s) => s.load)
  const theme = useStore((s) => s.theme)
  const skin = useStore((s) => s.skin)
  const activeId = useStore((s) => s.activeId)
  const page = useUI((s) => s.page)
  const listOpen = useUI((s) => s.charListOpen)
  const hasChar = useStore((s) => !!s.chars[s.activeId])
  const system = useStore((s) => systemOf(s.chars[s.activeId]))

  useEffect(() => { load() }, [load])
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => { document.documentElement.dataset.skin = skin }, [skin])
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
    </div>
  )
}
