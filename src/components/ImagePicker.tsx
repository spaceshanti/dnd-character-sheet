import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { uid } from '../blank'
import { imageToDataUrl, useChar, useStore, useUI, type ImageTarget } from '../store'
import { Modal } from './ui'

const TARGET_NAMES: Record<ImageTarget, string> = {
  portrait: 'Portrait (top-left)',
  appearanceImage: 'Appearance image',
  emblem: 'Emblem / symbol',
}

/** Read image files, add them all to the gallery, return their data URLs. */
export async function addImagesToGallery(files: FileList | File[]): Promise<string[]> {
  const out: { id: string; src: string; caption: string }[] = []
  for (const f of Array.from(files)) {
    if (!f.type.startsWith('image/')) continue
    out.push({ id: uid(), src: await imageToDataUrl(f, 1400), caption: f.name.replace(/\.[^.]+$/, '') })
  }
  if (out.length) useStore.getState().patch((d) => { d.gallery.push(...out) })
  return out.map((g) => g.src)
}

/** Drop image files onto a target: they go into the gallery and the first one is used. */
export async function dropImagesOn(target: ImageTarget, files: FileList | File[]) {
  const [first] = await addImagesToGallery(files)
  if (first) useStore.getState().patch((d) => { d[target] = first })
}

/** Choose the portrait / appearance / emblem image from the gallery, or upload new ones into it. */
export function ImagePicker() {
  const target = useUI((s) => s.imagePick)
  const set = useUI((s) => s.set)
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const file = useRef<HTMLInputElement>(null)
  if (!target || !c) return null
  const close = () => set({ imagePick: null })
  const current = c[target]
  const inGallery = !current || c.gallery.some((g) => g.src === current)
  const choose = (src: string) => { patch((d) => { d[target] = src }); close() }

  return (
    <Modal title={`Choose image · ${TARGET_NAMES[target]}`} onClose={close}
      tools={
        <>
          <button className="btn primary sm" onClick={() => file.current?.click()}>＋ Upload new</button>
          {current && <button className="btn danger sm" onClick={() => choose('')}>Remove image</button>}
        </>
      }>
      <input ref={file} type="file" accept="image/*" multiple hidden onChange={async (e) => {
        if (!e.target.files?.length) return
        const [first] = await addImagesToGallery(e.target.files)
        e.target.value = ''
        if (first) choose(first)
      }} />
      <div onDragOver={(e) => e.preventDefault()} onDrop={async (e) => {
        e.preventDefault()
        const [first] = await addImagesToGallery(e.dataTransfer.files)
        if (first) choose(first)
      }}>
        <div className="muted small" style={{ marginBottom: 10 }}>
          Pick one of {c.name || 'this character'}'s gallery images, or upload / drop new ones (they're added to the gallery too).
        </div>
        <div className="pick-grid">
          {!inGallery && (
            <div className="pick-tile on">
              <div className="img" style={{ backgroundImage: `url("${current}")` }} onClick={close} />
              <div className="row small" style={{ gap: 4 }}>
                <span className="grow">Current</span>
                <button className="btn sm" onClick={() => patch((d) => { d.gallery.push({ id: uid(), src: current, caption: TARGET_NAMES[target] }) })}>Add to gallery</button>
              </div>
            </div>
          )}
          {c.gallery.map((g) => (
            <div key={g.id} className={`pick-tile ${g.src === current ? 'on' : ''}`} onClick={() => choose(g.src)} title="Use this image">
              <div className="img" style={{ backgroundImage: `url("${g.src}")` }} />
              <div className="small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.caption || 'Untitled'}</div>
            </div>
          ))}
        </div>
        {c.gallery.length === 0 && inGallery && <div className="empty">No images in the gallery yet. Upload one to start.</div>}
      </div>
    </Modal>
  )
}

/** Full-size image viewer. Click anywhere or press Esc to close. */
export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  // stopPropagation: the viewer is rendered from inside clickable boxes, and portals still bubble React clicks
  return createPortal(
    <div className="lightbox" onClick={(e) => { e.stopPropagation(); onClose() }}><img src={src} /></div>,
    document.body,
  )
}
