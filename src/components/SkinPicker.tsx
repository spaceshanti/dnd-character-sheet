import { SKINS } from '../skins'
import { useStore, useUI } from '../store'
import { Modal } from './ui'

/** UI style cards plus the light / dark switch for the standard sheet. */
export function SkinPicker() {
  const { skin, setSkin, theme, setTheme } = useStore()
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="skin-grid">
        {SKINS.map((k) => (
          <button key={k.id} className={`skin-card ${skin === k.id ? 'on' : ''}`} onClick={() => setSkin(k.id)}>
            <span className="sw">{k.swatch.map((c) => <i key={c} style={{ background: c }} />)}</span>
            <b>{k.name}</b>
            <span className="small muted">{k.desc}</span>
          </button>
        ))}
      </div>
      {skin === 'standard' && (
        <div className="row"><span className="grow">Light / dark</span>
          <div className="seg">
            <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>Light</button>
            <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>Dark</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Quick style menu: Ctrl+T or the ◐ button in the top bar. */
export function ThemeMenu() {
  const open = useUI((s) => s.themeOpen)
  const set = useUI((s) => s.set)
  if (!open) return null
  return (
    <Modal title="UI style" onClose={() => set({ themeOpen: false })}>
      <div style={{ maxWidth: 620 }}><SkinPicker /></div>
      <div className="muted small" style={{ marginTop: 10 }}>Ctrl + T opens this menu from anywhere.</div>
    </Modal>
  )
}
