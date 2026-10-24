import { useRef } from 'react'
import { downloadJson, useStore, useUI } from '../store'
import { Toast, useToast } from '../components/ui'
import type { Character } from '../types'

function ago(t: number): string {
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} days ago`
  return new Date(t).toLocaleDateString()
}

/** Start screen: shown when there's no character to open, or from the 👥 Characters button. */
export function CharacterList() {
  const { chars, order, activeId, setActive, addChar, dupChar, deleteChar, importChars } = useStore()
  const set = useUI((s) => s.set)
  const file = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const current = chars[activeId]

  const open = (id: string) => { setActive(id); set({ charListOpen: false, page: 'overview' }) }
  const create = () => { addChar(); set({ charListOpen: false, page: 'overview' }) }

  const onImport = async (f: File) => {
    try {
      const data = JSON.parse(await f.text())
      const list: Character[] = Array.isArray(data) ? data : data.chars ? Object.values(data.chars) : [data]
      if (!list.length || !list.every((c) => c && typeof c === 'object' && 'name' in c)) throw new Error('bad')
      importChars(list)
      set({ charListOpen: false, page: 'overview' })
    } catch {
      toast.show('That file is not a character export')
    }
  }

  return (
    <div className="charlist">
      <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
      <header className="charlist-head">
        {current && <button className="btn" onClick={() => set({ charListOpen: false })}>← Back to {current.name || 'character'}</button>}
        <h1>Characters</h1>
        <span className="grow" />
        <button className="btn" onClick={() => file.current?.click()}>Import…</button>
        {order.length > 0 && <button className="btn" onClick={() => downloadJson('all-characters.json', { version: 1, chars, order })}>Export all</button>}
        <button className="btn ghost" onClick={() => set({ themeOpen: true })} title="UI style (Ctrl + T)">◐</button>
      </header>

      {order.length === 0 && (
        <div className="charlist-empty">
          <h2>No characters yet</h2>
          <p className="muted">Start a new sheet, or import a character you exported before.</p>
        </div>
      )}

      <div className="charlist-grid">
        {order.map((id) => {
          const c = chars[id]
          return (
            <div key={id} className={`char-card frame ${id === activeId ? 'current' : ''}`}>
              <div className="frame-in">
                <button className="char-portrait" style={c.portrait ? { backgroundImage: `url("${c.portrait}")` } : undefined} onClick={() => open(id)} title={`Open ${c.name || 'character'}`}>
                  {!c.portrait && <span>{(c.name || '?').trim().charAt(0).toUpperCase()}</span>}
                </button>
                <div className="char-name">{c.name || 'Unnamed'}</div>
                <div className="muted small">{[c.level ? `Level ${c.level}` : '', c.className, c.species].filter(Boolean).join(' · ') || '—'}</div>
                <div className="muted small">{id === activeId ? 'Last opened · ' : ''}edited {ago(c.updatedAt)}</div>
                <div className="row" style={{ marginTop: 8, gap: 4, flexWrap: 'wrap' }}>
                  <button className="btn sm primary" onClick={() => open(id)}>Open</button>
                  <button className="btn sm" onClick={() => dupChar(id)}>Copy</button>
                  <button className="btn sm" onClick={() => downloadJson(`${(c.name || 'character').replace(/[^\w-]+/g, '_')}.json`, c)}>Export</button>
                  <span className="grow" />
                  <button className="btn sm danger" title="Delete"
                    onClick={() => { if (window.confirm(`Delete ${c.name || 'this character'}? This can't be undone.`)) deleteChar(id) }}>✕</button>
                </div>
              </div>
            </div>
          )
        })}
        <button className="char-new" onClick={create}>
          <span className="plus">＋</span>
          <b>New character</b>
        </button>
      </div>
      <Toast msg={toast.msg} />
    </div>
  )
}
