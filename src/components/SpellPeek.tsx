import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { applyLib, fetchStub, fromLib, libLabel, nameKey, type LibSpell } from '../spellLib'
import { spellNamed } from '../book/spellLinks'
import { useChar, useStore } from '../store'
import { isAK } from '../systems'
import { RichText } from './RichText'
import { cantripScale, markCantrip } from '../cantrip'
import { toHtml } from '../rich'

const LEVEL = (l: number, ak: boolean) => (l === 0 ? 'Cantrip' : `${['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'][l]}-level ${ak ? 'Art' : 'spell'}`)

/** A spell / Art opened from a link in the sourcebook: read it, add it to the character, fetch its text if it's name-only. */
export function SpellPeek({ name, at, onClose }: { name: string; at: { x: number; y: number }; onClose: () => void }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  useStore((s) => s.customSpells) // re-read once a fetched description lands in your library
  const sp: LibSpell | undefined = spellNamed(name)
  const ak = isAK(c)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: at.x, top: at.y })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const mine = sp ? c.spells.find((x) => nameKey(x.name) === nameKey(sp.n)) : undefined
  const cantrip = sp && sp.l === 0 ? cantripScale(sp.t, c.level) : null

  // beside the click, kept on screen
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    setPos({ left: Math.max(8, Math.min(at.x + 12, window.innerWidth - w - 8)), top: Math.max(8, Math.min(at.y + 12, window.innerHeight - h - 8)) })
  }, [at.x, at.y, sp?.n, sp?.t])
  useEffect(() => {
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest?.('.bk-spell, .bk-spelllink')) onClose() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() } }
    document.addEventListener('mousedown', down)
    window.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('mousedown', down); window.removeEventListener('keydown', key, true) }
  }, [onClose])

  if (!sp) return null
  const add = () => {
    const s = fromLib(sp)
    s.prepared = sp.l === 0 || ak
    patch((d) => { d.spells.push(s) })
    setMsg(`Added to your ${ak ? 'Arts' : 'spells'}`)
  }
  const fetchText = async () => {
    setBusy(true)
    const r = await fetchStub(sp)
    setBusy(false)
    if (typeof r === 'string') { setMsg(r); return }
    // copies already on the sheet without text get it too
    patch((d) => { for (const x of d.spells) if (!x.description.trim() && nameKey(x.name) === nameKey(r.n)) Object.assign(x, applyLib(x, { ...r, e: 'Custom' }), { level: x.level }) })
    setMsg('Description filled in')
  }

  return createPortal(
    <div ref={ref} className="spell-peek" style={pos}>
      <div className="row" style={{ gap: 6, alignItems: 'baseline' }}>
        <b className="grow" style={{ fontSize: 16 }}>{sp.n}</b>
        <button className="btn icon sm ghost" title="Close (Esc)" onClick={onClose}>✕</button>
      </div>
      <div className="muted small" style={{ marginBottom: 6 }}>
        {LEVEL(sp.l, ak)}{sp.s ? ` · ${sp.s}` : ''}{sp.co ? ' · Concentration' : ''}{sp.ri ? ' · Ritual' : ''} · {libLabel(sp.e)}
      </div>
      {(sp.ct || sp.r || sp.c || sp.d) && (
        <div className="kv" style={{ marginBottom: 8 }}>
          {sp.ct && <><b>Casting time</b><span>{sp.ct}</span></>}
          {sp.r && <><b>Range</b><span>{sp.r}</span></>}
          {sp.c && <><b>Components</b><span>{sp.c}</span></>}
          {sp.d && <><b>Duration</b><span>{sp.d}</span></>}
        </div>
      )}
      <div className="spell-peek-text">
        {cantrip?.now && <div className="cantrip-now">Your damage at level {c.level}: <b>{cantrip.now}</b></div>}
        {sp.t ? <RichText className="prose small-prose" value={cantrip ? markCantrip(toHtml(sp.t), cantrip) : sp.t} /> : (
          <div className="muted small">
            Only the name is in the book{sp.stub ? ' (it reuses the regular D&D spell)' : ''}.
            {sp.stub && (window.sheetApi
              ? <> <button className="btn sm" disabled={busy} onClick={fetchText}>{busy ? 'Fetching…' : 'Fetch its D&D description'}</button></>
              : ' Fetching its description works in the desktop app.')}
          </div>
        )}
      </div>
      <div className="row" style={{ gap: 6, marginTop: 8 }}>
        <span className="grow small muted">{msg}</span>
        {mine ? <span className="chip">On your sheet</span> : <button className="btn sm primary" onClick={add}>＋ Add to my {ak ? 'Arts' : 'spells'}</button>}
      </div>
    </div>,
    document.body,
  )
}
