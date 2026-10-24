/** Rich text helpers. Text boxes store simple HTML; older saves (and fetched spell text) are plain text. */

const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI', 'H3', 'H4', 'BLOCKQUOTE', 'SPAN', 'SUB', 'SUP'])
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'IMG', 'SVG', 'VIDEO', 'AUDIO', 'CANVAS', 'LINK', 'META', 'TEMPLATE', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'FORM'])

export const isHtml = (s: string) => /<(\/?)(p|div|br|b|i|u|s|strong|em|ul|ol|li|h3|h4|span|strike|del|blockquote|sub|sup)\b[^>]*>/i.test(s)

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Keep only simple formatting tags and no attributes. */
export function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement
  const clean = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName
      if (DROP.has(tag)) { child.remove(); continue }
      clean(child)
      if (tag === 'H1' || tag === 'H2') {
        const h = doc.createElement('h3'); h.append(...Array.from(child.childNodes)); child.replaceWith(h); continue
      }
      if (!ALLOWED.has(tag)) { child.replaceWith(...Array.from(child.childNodes)); continue }
      for (const a of Array.from(child.attributes)) child.removeAttribute(a.name)
    }
  }
  clean(root)
  return root.innerHTML
}

/** What to load into the editor: HTML as-is, plain text escaped with line breaks kept. */
export function toHtml(value: string): string {
  if (!value) return ''
  return isHtml(value) ? sanitize(value) : escapeHtml(value).replace(/\n/g, '<br>')
}

/** Plain text version, for searching. */
export function plainText(value: string): string {
  if (!value || !isHtml(value)) return value || ''
  const doc = new DOMParser().parseFromString(value.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h3|h4)>/gi, '\n'), 'text/html')
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}
