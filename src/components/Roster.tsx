import { useRef } from 'react'
import { downloadJson, useStore, useUI } from '../store'
import { Modal, Toast, useToast } from './ui'
import type { Character } from '../types'

export function Roster() {
  const open = useUI((s) => s.rosterOpen)
  const set = useUI((s) => s.set)
  const { chars, order, activeId, setActive, addChar, dupChar, deleteChar, importChars } = useStore()
  const file = useRef<HTMLInputElement>(null)
  const toast = useToast()
  if (!open) return null
  const close = () => set({ rosterOpen: false })

  const onImport = async (f: File) => {
    try {
      const data = JSON.parse(await f.text())
      const list: Character[] = Array.isArray(data) ? data : data.chars ? Object.values(data.chars) : [data]
      if (!list.every((c) => c && typeof c === 'object' && 'name' in c)) throw new Error('bad')
      importChars(list)
      toast.show(`Imported ${list.length} character${list.length > 1 ? 's' : ''}`)
    } catch {
      toast.show('That file is not a character export')
    }
  }

  return (
    <Modal
      title="👥 Characters & Party"
      onClose={close}
      tools={
        <>
          <button className="btn sm" onClick={() => file.current?.click()}>Import…</button>
          <button className="btn sm" onClick={() => downloadJson('all-characters.json', { version: 1, chars, order })}>Export all</button>
          <button className="btn primary sm" onClick={() => { addChar(); close(); useUI.getState().go('overview') }}>＋ New character</button>
        </>
      }
    >
      <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
      <div className="art-grid">
        {order.map((id) => {
          const c = chars[id]
          return (
            <div key={id} className="art-card">
              <div className="frame"><div className="frame-in" style={{ padding: 8 }}>
                <div className="img" style={{ backgroundImage: c.portrait ? `url("${c.portrait}")` : undefined, display: 'grid', placeItems: 'center', fontSize: 48 }}
                  onClick={() => { setActive(id); close() }}>
                  {!c.portrait && '👤'}
                </div>
                <div style={{ marginTop: 8, fontWeight: 700, fontFamily: 'var(--font-head)' }}>{c.name || 'Unnamed'}</div>
                <div className="muted small">{[c.species, c.className, c.level ? `Lv ${c.level}` : ''].filter(Boolean).join(' · ') || '—'}</div>
                <div className="row" style={{ marginTop: 8, gap: 4, flexWrap: 'wrap' }}>
                  <button className={`btn sm ${id === activeId ? 'primary' : ''}`} onClick={() => { setActive(id); close() }}>{id === activeId ? 'Current' : 'Open'}</button>
                  <button className="btn sm" onClick={() => downloadJson(`${(c.name || 'character').replace(/[^\w-]+/g, '_')}.json`, c)}>Export</button>
                  <button className="btn sm" onClick={() => dupChar(id)}>Copy</button>
                  <button className="btn sm danger" onClick={() => { if (window.confirm(`Delete ${c.name || 'this character'}? This can't be undone.`)) deleteChar(id) }}>✕</button>
                </div>
              </div></div>
            </div>
          )
        })}
      </div>
      <Toast msg={toast.msg} />
    </Modal>
  )
}
