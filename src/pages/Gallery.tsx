import { useRef, useState } from 'react'
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

  return (
    <div className="col" style={{ gap: 14 }}>
      <PartySection onView={setBig} />

      <Frame title={`${c.name || 'Character'} · Art`} tight
        tools={<button className="btn sm primary" onClick={() => file.current?.click()}>＋ Add art</button>}>
        <div className="col" style={{ gap: 10 }}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}>
          <div className="row">
            <span className="muted small grow">Pictures of {c.name || 'this character'}. Drop image files here to add them.</span>
            <button className="btn sm" onClick={() => set({ charListOpen: true })}>👥 All characters</button>
            <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
          </div>
          {c.gallery.length === 0 && <div className="empty">No art yet for {c.name || 'this character'}.</div>}
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
  const add = (m?: Partial<PartyMember>) => patch((d) => { d.party.push({ id: uid(), name: '', note: '', image: '', ...m }) })
  return (
    <Frame title="Party" tight
      tools={
        <>
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
      {c.party.length === 0 ? (
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
  const take = async (f?: File) => { if (f && f.type.startsWith('image/')) onChange(await imageToDataUrl(f, 900)) }
  return (
    <div className="party-img" style={src ? { backgroundImage: `url("${src}")` } : undefined}
      title={src ? 'Click to view · drop a picture to replace' : 'Click to add a picture · or drop one here'}
      onClick={() => (src ? onView(src) : file.current?.click())}
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); take(e.dataTransfer.files[0]) }}>
      {!src && <span>＋ Picture</span>}
      {src && <button className="party-change" onClick={(e) => { e.stopPropagation(); file.current?.click() }}>Change</button>}
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}
