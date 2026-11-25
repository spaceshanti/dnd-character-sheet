/* Images from the clipboard: Ctrl + V (a paste event) or a Paste button (reading the clipboard). */

/** the images in a paste event (copied pictures, or image files copied in Explorer) */
export function pastedImages(e: ClipboardEvent): File[] {
  const out: File[] = []
  for (const it of Array.from(e.clipboardData?.items ?? [])) {
    if (it.kind !== 'file' || !it.type.startsWith('image/')) continue
    const f = it.getAsFile()
    if (f) out.push(new File([f], f.name && f.name !== 'image.png' ? f.name : `Pasted ${new Date().toLocaleString()}.png`, { type: f.type }))
  }
  return out
}

/** the images on the clipboard right now (for a Paste button); [] when there are none or it can't be read */
export async function clipboardImages(): Promise<File[]> {
  try {
    const items = await navigator.clipboard.read()
    const out: File[] = []
    for (const it of items) {
      const type = it.types.find((t) => t.startsWith('image/'))
      if (!type) continue
      const blob = await it.getType(type)
      out.push(new File([blob], `Pasted ${new Date().toLocaleString()}.${type.split('/')[1] || 'png'}`, { type }))
    }
    return out
  } catch { return [] }
}

/** typing in a box: leave pasting to it */
export const typingIn = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable)
}
