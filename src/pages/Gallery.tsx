import { useEffect, useRef, useState } from 'react'
import { pastedImages, typingIn } from '../clipboard'
import { uid } from '../blank'
import { imageToDataUrl, useChar, useStore, useUI } from '../store'
import { Frame } from '../components/ui'
import { askConfirm } from '../components/Dialog'
import type { PartyMember } from '../types'

/** The character's own pictures, and a picture of each member of the party. */
export function GalleryPage() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const set = useUI((s) => s.set)
  const file = useRef<HTMLInputElement>(null)
  const [big, setBig] = useState('')

  const addFiles = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      const src = await imageToDataUrl(f, 1400)
      patch((d) => { d.gallery.push({ id: uid(), src, caption: f.name.replace(/\.[^.]+$/, '') }) })
    }
  }
  // Ctrl + V anywhere on the page (except while typing in a box, or into a party picture) adds a copied picture
  const [adding, setAdding] = useState(false)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (e.defaultPrevented || typingIn(e.target) || document.querySelector('.backdrop')) return
      const imgs = pastedImages(e)
      if (!imgs.length) return
      e.preventDefault()
      addFiles(imgs)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  return (
    <div className="col" style={{ gap: 14 }}>
      <PartySection onView={setBig} />

      <Frame title={`${c.name || 'Character'} · Art`} tight
        tools={<button className="btn sm primary" onClick={() => setAdding(true)}>＋ Add art</button>}>
        <div className="col" style={{ gap: 10 }}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}>
          <div className="row">
            <span className="muted small grow">Pictures of {c.name || 'this character'}. Drop image files here, or paste a copied picture (Ctrl + V).</span>
            <button className="btn sm" onClick={() => set({ charListOpen: true })}>👥 All characters</button>
            <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
          </div>
          {adding && (
            <PasteOrPick multiple onFiles={(f) => { setAdding(false); addFiles(f) }} onPick={() => { setAdding(false); file.current?.click() }} onCancel={() => setAdding(false)} />
          )}
          {c.gallery.length === 0 && !adding && <div className="empty">No art yet for {c.name || 'this character'}.</div>}
          <div className="art-grid">
            {c.gallery.map((g) => (
              <Frame key={g.id} tight>
                <div className="art-card">
                  <div className="img" style={{ backgroundImage: `url("${g.src}")` }} onClick={() => setBig(g.src)} />
                  <input className="line-input" style={{ marginTop: 8, fontWeight: 600 }} placeholder="caption" value={g.caption}
                    onChange={(e) => patch((d) => { const x = d.gallery.find((y) => y.id === g.id); if (x) x.caption = e.target.value })} />
                  <div className="row" style={{ marginTop: 8, gap: 4 }}>
                    <button className="btn sm" onClick={() => patch((d) => { d.portrait = g.src })} title="Top-left corner image">Use as portrait</button>
                    <button className="btn sm" onClick={() => patch((d) => { d.appearanceImage = g.src })} title="Appearance box on the Character page">Use in Appearance</button>
                    <span className="grow" />
                    <button className="btn sm danger" onClick={async () => { if ((await askConfirm('Remove this image?'))) patch((d) => { d.gallery = d.gallery.filter((y) => y.id !== g.id) }) }}>✕</button>
                  </div>
                </div>
              </Frame>
            ))}
          </div>
        </div>
      </Frame>
      {big && <div className="lightbox" onClick={() => setBig('')}><img src={big} /></div>}
    </div>
  )
}

/** The party: a picture and a name for each member (add your own, or bring one in from your other characters). */
function PartySection({ onView }: { onView: (src: string) => void }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const chars = useStore((s) => s.chars)
  const order = useStore((s) => s.order)
  const up = (id: string, fn: (m: PartyMember) => void) => patch((d) => { const m = d.party.find((x) => x.id === id); if (m) fn(m) })
  // your other characters, offered as quick additions (their name and portrait)
  const others = order.map((id) => chars[id]).filter((o) => o && o.id !== c.id && !c.party.some((m) => m.name.trim() && m.name.trim() === o.name.trim()))
  // folded by default (remembered on this computer); adding someone opens it
  const [open, setOpenRaw] = useState(() => { try { return localStorage.getItem('party-open') === '1' } catch { return false } })
  const setOpen = (v: boolean) => { setOpenRaw(v); try { localStorage.setItem('party-open', v ? '1' : '0') } catch { /* private mode */ } }
  const add = (m?: Partial<PartyMember>) => { patch((d) => { d.party.push({ id: uid(), name: '', note: '', image: '', ...m }) }); setOpen(true) }
  const names = c.party.map((m) => m.name.trim()).filter(Boolean)
  return (
    <Frame title="Party" tight
      tools={
        <>
          <button className="btn sm ghost" title={open ? 'Fold' : 'Unfold'} onClick={() => setOpen(!open)}>{open ? '▾' : `▸ Show${c.party.length ? ` (${c.party.length})` : ''}`}</button>
          {others.length > 0 && (
            <select className="party-from" value="" title="Add one of your other characters"
              onChange={(e) => { const o = chars[e.target.value]; if (o) add({ name: o.name, note: [o.className, o.level ? `level ${o.level}` : ''].filter(Boolean).join(', '), image: o.portrait || o.appearanceImage || '' }) }}>
              <option value="">＋ From my characters…</option>
              {others.map((o) => <option key={o.id} value={o.id}>{o.name || 'Unnamed'}</option>)}
            </select>
          )}
          <button className="btn sm primary" onClick={() => add()}>＋ Add member</button>
        </>
      }>
      {!open ? (
        <div className="muted small party-sum" onClick={() => setOpen(true)} style={{ cursor: 'pointer' }}>
          {names.length ? names.join(' · ') : c.party.length ? `${c.party.length} member${c.party.length > 1 ? 's' : ''}` : 'Who you travel with: add each party member with a picture.'}
        </div>
      ) : c.party.length === 0 ? (
        <div className="muted small">Who you travel with: add each party member with a picture.</div>
      ) : (
        <div className="party-grid">
          {c.party.map((m) => (
            <div key={m.id} className="party-card">
              <PartyPicture src={m.image} onView={onView} onChange={(src) => up(m.id, (x) => { x.image = src })} />
              <input className="line-input party-name" placeholder="Name" value={m.name} onChange={(e) => up(m.id, (x) => { x.name = e.target.value })} />
              <input className="line-input party-note" placeholder="player · class · notes" value={m.note} onChange={(e) => up(m.id, (x) => { x.note = e.target.value })} />
              <button className="btn icon sm ghost party-x" title="Remove from the party"
                onClick={async () => { if (await askConfirm(`Remove ${m.name || 'this member'} from the party?`)) patch((d) => { d.party = d.party.filter((x) => x.id !== m.id) }) }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </Frame>
  )
}

function PartyPicture({ src, onChange, onView }: { src: string; onChange: (src: string) => void; onView: (src: string) => void }) {
  const file = useRef<HTMLInputElement>(null)
  const [asking, setAsking] = useState(false)
  const take = async (f?: File) => { if (f && f.type.startsWith('image/')) onChange(await imageToDataUrl(f, 900)) }
  return (
    <div className="party-img" style={src && !asking ? { backgroundImage: `url("${src}")` } : undefined}
      title={src ? 'Click to view · drop a picture to replace' : 'Click to add a picture (paste or choose a file) · or drop one here'}
      onClick={() => (asking ? undefined : src ? onView(src) : setAsking(true))}
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setAsking(false); take(e.dataTransfer.files[0]) }}>
      {asking ? (
        <PasteOrPick compact onFiles={(f) => { setAsking(false); take(f[0]) }} onPick={() => { setAsking(false); file.current?.click() }} onCancel={() => setAsking(false)} />
      ) : (
        <>
          {!src && <span>＋ Picture</span>}
          {src && <button className="party-change" onClick={(e) => { e.stopPropagation(); setAsking(true) }}>Change</button>}
        </>
      )}
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}

/**
 * Adding a picture: paste a copied one (Ctrl + V while this is showing; no need to save it first) or choose a file.
 * It takes the keyboard focus so the paste lands here.
 */
function PasteOrPick({ onFiles, onPick, onCancel, compact = false, multiple = false }: {
  onFiles: (f: File[]) => void; onPick: () => void; onCancel: () => void; compact?: boolean; multiple?: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { box.current?.focus() }, [])
  useEffect(() => {
    // the paste can arrive with the focus anywhere on the page: take it while this is open
    const onPaste = (e: ClipboardEvent) => {
      if (typingIn(e.target)) return
      const imgs = pastedImages(e)
      if (!imgs.length) return
      e.preventDefault()
      onFiles(multiple ? imgs : imgs.slice(0, 1))
    }
    window.addEventListener('paste', onPaste, true)
    return () => window.removeEventListener('paste', onPaste, true)
  })
  return (
    <div ref={box} tabIndex={-1} className={`paste-pick ${compact ? 'compact' : ''}`} onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}>
      <b>Paste a picture</b>
      <span className="small muted"><kbd className="kbd">Ctrl + V</kbd> with an image copied{compact ? '' : ' (from a browser, Discord, a screenshot…)'}</span>
      <div className="row" style={{ gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={onPick}>Choose a file…</button>
        <button className="btn sm ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
