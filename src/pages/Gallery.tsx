import { useRef, useState } from 'react'
import { uid } from '../blank'
import { imageToDataUrl, useChar, useStore, useUI } from '../store'
import { Frame } from '../components/ui'
import { isAK } from '../systems'

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
    <div className="col" style={{ gap: 14 }}
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}>
      <div className="row">
        <button className="btn primary" onClick={() => file.current?.click()}>＋ Add art</button>
        <button className="btn" onClick={() => set({ charListOpen: true })}>👥 All characters</button>
        {isAK(c) && <button className="btn" onClick={() => set({ operatorOpen: true })} title="The character shown like Arknights' operator screen">◈ Operator view</button>}
        <span className="muted small">You can also drop image files anywhere on this page.</span>
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
                <button className="btn sm danger" onClick={() => { if (window.confirm('Remove this image?')) patch((d) => { d.gallery = d.gallery.filter((y) => y.id !== g.id) }) }}>✕</button>
              </div>
            </div>
          </Frame>
        ))}
      </div>
      {big && <div className="lightbox" onClick={() => setBig('')}><img src={big} /></div>}
    </div>
  )
}
