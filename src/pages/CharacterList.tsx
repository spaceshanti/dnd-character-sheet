import { useRef, useState } from 'react'
import { SYSTEMS, systemName, systemOf, type SystemId } from '../systems'
import { downloadJson, TRASH_DAYS, useStore, useUI } from '../store'
import { Toast, useToast } from '../components/ui'
import type { Character } from '../types'
import { askConfirm } from '../components/Dialog'

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
  const { chars, order, activeId, setActive, addChar, dupChar, deleteChar, importChars, trash, restoreChar, purgeChar } = useStore()
  const [trashOpen, setTrashOpen] = useState(false)
  const setLocked = (id: string, locked: boolean) => useStore.setState((s) => ({ chars: { ...s.chars, [id]: { ...s.chars[id], locked } } }))
  const set = useUI((s) => s.set)
  const file = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const current = chars[activeId]

  const open = (id: string) => { setActive(id); set({ charListOpen: false, page: 'overview' }) }
  const create = (sys: SystemId) => { addChar('New Character', sys); set({ charListOpen: false, page: 'overview' }) }
  const [game, setGameState] = useState<SystemId | 'all'>(() => {
    try { return (localStorage.getItem('list-game') as SystemId | 'all') || 'all' } catch { return 'all' }
  })
  const setGame = (g: SystemId | 'all') => { setGameState(g); try { localStorage.setItem('list-game', g) } catch { /* private mode */ } }
  const count = (g: SystemId) => order.filter((id) => systemOf(chars[id]) === g).length
  const shown = order.filter((id) => game === 'all' || systemOf(chars[id]) === game)

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
        {order.length > 0 && (
          <div className="seg game-seg">
            <button className={game === 'all' ? 'on' : ''} onClick={() => setGame('all')}>All games ({order.length})</button>
            {SYSTEMS.map((s) => <button key={s.id} className={game === s.id ? 'on' : ''} onClick={() => setGame(s.id)}>{s.short} ({count(s.id)})</button>)}
          </div>
        )}
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
        {shown.map((id) => {
          const c = chars[id]
          return (
            <div key={id} className={`char-card frame sys-${systemOf(c)} ${id === activeId ? 'current' : ''}`}>
              <div className="frame-in">
                <button className="char-portrait" style={c.portrait ? { backgroundImage: `url("${c.portrait}")` } : undefined} onClick={() => open(id)} title={`Open ${c.name || 'character'}`}>
                  {!c.portrait && <span>{(c.name || '?').trim().charAt(0).toUpperCase()}</span>}
                </button>
                <div className="char-name">{c.name || 'Unnamed'}</div>
                <span className={`game-tag sys-${systemOf(c)}`}>{systemName(systemOf(c))}</span>
                <div className="muted small">{[c.level ? `Level ${c.level}` : '', c.className, c.species].filter(Boolean).join(' · ') || '—'}</div>
                <div className="muted small">{id === activeId ? 'Last opened · ' : ''}edited {ago(c.updatedAt)}</div>
                <div className="row" style={{ marginTop: 8, gap: 4, flexWrap: 'wrap' }}>
                  <button className="btn sm primary" onClick={() => open(id)}>Open</button>
                  <button className="btn sm" onClick={() => dupChar(id)}>Copy</button>
                  <button className="btn sm" onClick={() => downloadJson(`${(c.name || 'character').replace(/[^\w-]+/g, '_')}.json`, c)}>Export</button>
                  <span className="grow" />
                  {/* deletion protection: unlock first, then delete (and it can still be restored for a while) */}
                  <button className={`btn sm ghost lock-btn ${c.locked ? 'on' : ''}`} onClick={() => setLocked(id, !c.locked)}
                    title={c.locked ? 'Protected from deletion. Click to unlock' : 'Unlocked: can be deleted. Click to protect it again'}>{c.locked ? '🔒' : '🔓'}</button>
                  <button className="btn sm danger" disabled={c.locked} title={c.locked ? 'Unlock it (🔒) to delete' : 'Delete'}
                    onClick={async () => { if ((await askConfirm(`Delete ${c.name || 'this character'}? You can restore it from Recently deleted for ${TRASH_DAYS} days.`))) deleteChar(id) }}>✕</button>
                </div>
              </div>
            </div>
          )
        })}
        {SYSTEMS.filter((s) => game === 'all' || game === s.id).map((s) => (
          <button key={s.id} className={`char-new sys-${s.id}`} onClick={() => create(s.id)} title={s.desc}>
            <span className="plus">＋</span>
            <b>New {s.short} character</b>
            <span className="muted small">{s.name}</span>
          </button>
        ))}
      </div>

      {trash.length > 0 && (
        <div className="charlist-trash">
          <button className="btn sm ghost" onClick={() => setTrashOpen(!trashOpen)}>{trashOpen ? '▾' : '▸'} Recently deleted ({trash.length})</button>
          {trashOpen && (
            <div className="col" style={{ gap: 4, marginTop: 6 }}>
              <div className="muted small">Deleted characters can be restored for {TRASH_DAYS} days.</div>
              {trash.map((t) => (
                <div key={t.char.id + t.deletedAt} className="row trash-row">
                  <b>{t.char.name || 'Unnamed'}</b>
                  <span className="muted small grow">{[t.char.level ? `Level ${t.char.level}` : '', t.char.className].filter(Boolean).join(' · ')} · deleted {ago(t.deletedAt)}</span>
                  <button className="btn sm" onClick={() => restoreChar(t.char.id)}>Restore</button>
                  <button className="btn sm ghost" title="Delete for good"
                    onClick={async () => { if ((await askConfirm(`Delete ${t.char.name || 'this character'} for good? This can't be undone.`))) purgeChar(t.char.id) }}>Delete forever</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <Toast msg={toast.msg} />
    </div>
  )
}
