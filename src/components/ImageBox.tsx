import { useRef } from 'react'
import { imageToDataUrl } from '../store'

/** Click-to-upload image slot. Stores a downscaled data URL. */
export function ImageBox({
  src, onChange, ratio = '3 / 4', placeholder = 'Click to add art', contain = false, maxHeight,
}: { src: string; onChange: (s: string) => void; ratio?: string; placeholder?: string; contain?: boolean; maxHeight?: number }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => ref.current?.click()}
        title="Click to replace"
        style={{
          aspectRatio: ratio, maxHeight, cursor: 'pointer', border: '1px solid var(--line)', background: src ? `#fff center/${contain ? 'contain' : 'cover'} no-repeat url("${src}")` : 'var(--panel2)',
          display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 6,
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={async (e) => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f && f.type.startsWith('image/')) onChange(await imageToDataUrl(f))
        }}
      >
        {!src && placeholder}
      </div>
      {src && <button className="btn icon sm" style={{ position: 'absolute', top: 4, right: 4 }} title="Remove image" onClick={() => onChange('')}>✕</button>}
      <input ref={ref} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0]
        if (f) onChange(await imageToDataUrl(f))
        e.target.value = ''
      }} />
    </div>
  )
}
