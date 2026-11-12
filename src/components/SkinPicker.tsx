import { SKINS, variantOf } from '../skins'
import { useStore, useUI } from '../store'
import { Modal } from './ui'

/** UI style cards plus the light / dark switch for the standard sheet. */
export function SkinPicker() {
  const { skin, setSkin, theme, setTheme, skinVariant, setSkinVariant } = useStore()
  const cur = SKINS.find((k) => k.id === skin)
  const look = variantOf(skin, skinVariant)
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="skin-grid">
        {SKINS.map((k) => (
          <button key={k.id} className={`skin-card ${skin === k.id ? 'on' : ''}`} onClick={() => setSkin(k.id)}>
            <span className="sw">{k.swatch.map((c) => <i key={c} style={{ background: c }} />)}</span>
            <b>{k.name}{k.modes && <span className="muted small"> · light / dark</span>}</b>
            <span className="small muted">{k.desc}</span>
          </button>
        ))}
      </div>
      {cur?.variants && (
        <div className="col" style={{ gap: 4 }}>
          <div className="row"><span className="grow">Look</span>
            <div className="seg">
              {cur.variants.map((v) => <button key={v.id} className={look === v.id ? 'on' : ''} onClick={() => setSkinVariant(skin, v.id)}>{v.name}</button>)}
            </div>
          </div>
          <span className="small muted">{cur.variants.find((v) => v.id === look)?.desc}</span>
        </div>
      )}
      {cur?.modes && (
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
