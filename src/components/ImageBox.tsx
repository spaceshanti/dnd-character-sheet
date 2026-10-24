import { useUI, type ImageTarget } from '../store'
import { useChar } from '../store'
import { dropImagesOn } from './ImagePicker'

/** Image slot for the appearance / emblem pictures. Click to choose from the gallery; drop files to add them. */
export function ImageBox({
  target, ratio = '3 / 4', placeholder = 'Click to choose an image', contain = false, maxHeight,
}: { target: ImageTarget; ratio?: string; placeholder?: string; contain?: boolean; maxHeight?: number }) {
  const c = useChar()
  const set = useUI((s) => s.set)
  const src = c[target]
  return (
    <div
      className="image-box"
      onClick={() => set({ imagePick: target })}
      title="Click to choose from the gallery · drop an image to add it"
      style={{
        aspectRatio: ratio, maxHeight, cursor: 'pointer', border: '1px solid var(--line)',
        background: src ? `var(--img-bg) center/${contain ? 'contain' : 'cover'} no-repeat url("${src}")` : 'var(--panel2)',
        display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 6,
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); dropImagesOn(target, e.dataTransfer.files) }}
    >
      {!src && placeholder}
    </div>
  )
}
