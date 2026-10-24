import { useEffect } from 'react'
import { useStore, useUI } from './store'
import { TopBar } from './components/TopBar'
import { LeftDock } from './components/LeftDock'
import { Inventory } from './components/Inventory'
import { Roster } from './components/Roster'
import { DrawerHost } from './components/Drawers'
import { Overview } from './pages/Overview'
import { CharacterPage } from './pages/Character'
import { FeaturesPage } from './pages/Features'
import { SpellsPage } from './pages/Spells'
import { ActionsPage } from './pages/Actions'
import { GalleryPage } from './pages/Gallery'
import { SettingsPage } from './pages/Settings'

export default function App() {
  const loaded = useStore((s) => s.loaded)
  const load = useStore((s) => s.load)
  const theme = useStore((s) => s.theme)
  const skin = useStore((s) => s.skin)
  const activeId = useStore((s) => s.activeId)
  const page = useUI((s) => s.page)

  useEffect(() => { load() }, [load])
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => { document.documentElement.dataset.skin = skin }, [skin])

  // Ctrl+I opens the inventory from anywhere
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName)) {
        e.preventDefault()
        const u = useUI.getState()
        u.set({ inventoryOpen: !u.inventoryOpen })
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  if (!loaded) return null
  return (
    <div className="app" key={activeId}>
      <TopBar />
      <div className="body">
        <LeftDock />
        <main className="page">
          {page === 'overview' && <Overview />}
          {page === 'character' && <CharacterPage />}
          {page === 'features' && <FeaturesPage />}
          {page === 'spells' && <SpellsPage />}
          {page === 'actions' && <ActionsPage />}
          {page === 'gallery' && <GalleryPage />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
      <Inventory />
      <Roster />
      <DrawerHost />
    </div>
  )
}
