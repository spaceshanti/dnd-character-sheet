import { useRef } from 'react'
import { uid } from '../blank'
import { imageToDataUrl, useChar, useStore } from '../store'
import type { Faction } from '../types'
import { Field, Frame } from '../components/ui'
import { RichArea } from '../components/RichText'
import { ImageBox } from '../components/ImageBox'
import { isAK } from '../systems'
import { askConfirm, askText } from '../components/Dialog'

/**
 * Allies & Organizations: any number of factions, each with its own emblem and notes. Folds away.
 * The first faction's emblem is the sheet's emblem (the top bar's faction mark falls back to it; the printable sheet uses it).
 */
function FactionsBox() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const st = c.story
  const folded = !!c.factionsFolded
  const upF = (id: string, fn: (f: Faction) => void) => patch((d) => {
    const f = d.factions.find((x) => x.id === id)
    if (f) fn(f)
    d.emblem = d.factions[0]?.emblem ?? ''
  })
  const add = () => patch((d) => { d.factions.push({ id: uid(), name: '', emblem: '', notes: '' }); d.factionsFolded = false })
  const remove = async (f: Faction) => {
    if (!(await askConfirm(`Remove ${f.name || 'this faction'}?`))) return
    patch((d) => { d.factions = d.factions.filter((x) => x.id !== f.id); d.emblem = d.factions[0]?.emblem ?? '' })
  }
  const move = (i: number, by: number) => patch((d) => {
    const j = i + by
    if (j < 0 || j >= d.factions.length) return
    ;[d.factions[i], d.factions[j]] = [d.factions[j], d.factions[i]]
    d.emblem = d.factions[0]?.emblem ?? ''
  })
  const names = c.factions.map((f) => f.name.trim()).filter(Boolean)
  return (
    <Frame
      title={st.alliesTitle || 'Allies & Organizations'} tight
      tools={
        <>
          <button className="btn sm ghost" title="Rename this box" onClick={async () => { const t = (await askText('Box title', st.alliesTitle)); if (t != null) patch((d) => { d.story.alliesTitle = t }) }}>✎</button>
          <button className="btn sm ghost" title={folded ? 'Unfold' : 'Fold'} onClick={() => patch((d) => { d.factionsFolded = !folded })}>{folded ? '▸' : '▾'}</button>
        </>
      }
    >
      {folded ? (
        <div className="muted small faction-sum" onClick={() => patch((d) => { d.factionsFolded = false })}>
          {names.length ? names.join(' · ') : c.factions.length ? `${c.factions.length} faction${c.factions.length > 1 ? 's' : ''}` : 'No factions yet'}
        </div>
      ) : (
        <div className="col" style={{ gap: 12 }}>
          {c.factions.map((f, i) => (
            <div key={f.id} className="faction">
              <EmblemPick src={f.emblem} onChange={(src) => upF(f.id, (x) => { x.emblem = src })} />
              <div className="col grow" style={{ gap: 4, minWidth: 0 }}>
                <div className="row" style={{ gap: 4 }}>
                  <input className="line-input grow faction-name" placeholder="Faction / organisation" value={f.name} onChange={(e) => upF(f.id, (x) => { x.name = e.target.value })} />
                  {c.factions.length > 1 && (
                    <>
                      <button className="btn icon sm ghost" disabled={i === 0} title="Move up" onClick={() => move(i, -1)}>↑</button>
                      <button className="btn icon sm ghost" disabled={i === c.factions.length - 1} title="Move down" onClick={() => move(i, 1)}>↓</button>
                    </>
                  )}
                  <button className="btn icon sm ghost" title="Remove" onClick={() => remove(f)}>✕</button>
                </div>
                <RichArea className="sheet-ta free" minRows={3} value={f.notes} placeholder="Your standing, contacts, rank, what they want from you…" onChange={(v) => upF(f.id, (x) => { x.notes = v })} />
              </div>
            </div>
          ))}
          {c.factions.length === 0 && <div className="muted small">Factions, patrons, families, rivals: add one for each.</div>}
          <div><button className="btn sm" onClick={add}>＋ Add faction</button></div>
        </div>
      )}
    </Frame>
  )
}

/** A faction's emblem: click to pick a picture file, drop one on it, or remove it. Never added to the gallery. */
function EmblemPick({ src, onChange }: { src: string; onChange: (src: string) => void }) {
  const file = useRef<HTMLInputElement>(null)
  const take = async (f?: File) => { if (f && f.type.startsWith('image/')) onChange(await imageToDataUrl(f, 512, true)) }
  return (
    <div className="emblem-pick" title={src ? 'Click to change · drop a picture to replace' : 'Click to add an emblem · or drop a picture here'}
      onClick={() => file.current?.click()}
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); take(e.dataTransfer.files[0]) }}
      style={src ? { backgroundImage: `url("${src}")` } : undefined}>
      {!src && <span>Emblem</span>}
      {src && <button className="emblem-x" title="Remove emblem" onClick={(e) => { e.stopPropagation(); onChange('') }}>✕</button>}
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}

export function CharacterPage() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const st = c.story
  const text = (key: keyof typeof st, title: string, rows = 4, ph = '') => (
    <Frame title={title} tight>
      <RichArea className="sheet-ta" minRows={rows} placeholder={ph} value={st[key]} onChange={(v) => patch((d) => { d.story[key] = v })} />
    </Frame>
  )

  return (
    <div className="story-cols">
      {/* left: who they are */}
      <div className="col" style={{ gap: 12 }}>
        <Frame title="Appearance" tight>
          <div className="grid" style={{ gridTemplateColumns: isAK(c) ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 8 }}>
            <Field label="Nickname" value={c.nickname ?? ''} placeholder="none" onChange={(v) => patch((d) => { d.nickname = v })} />
            {isAK(c) && (
              <Field label="Operator codename" value={c.ak.codename} placeholder="not assigned yet"
                onChange={(v) => patch((d) => { d.ak.codename = v })} />
            )}
          </div>
          <ImageBox target="appearanceImage" contain maxHeight={c.appearanceImage ? 420 : 160} placeholder="Click to choose a full-body / appearance image" />
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
            {(['age', 'height', 'weight', 'eyes', 'skin', 'hair'] as const).map((k) => (
              <Field key={k} label={k} value={c.appearance[k]} onChange={(v) => patch((d) => { d.appearance[k] = v })} />
            ))}
          </div>
        </Frame>
        <Frame title="Character Backstory" tight>
          <RichArea className="sheet-ta free" minRows={14} placeholder="Where do they come from? What drives them?" value={st.backstory} onChange={(v) => patch((d) => { d.story.backstory = v })} />
        </Frame>
      </div>

      <div className="story-right">
      {/* middle: personality */}
      <div className="col" style={{ gap: 12 }}>
        {text('trait1', 'Personality Traits', 8, 'How do they carry themselves? Habits, likes, quirks…')}
        {text('ideals', 'Ideals', 4)}
        {text('bonds', 'Bonds', 4)}
        {text('flaws', 'Flaws', 4)}
      </div>

      {/* right: the world around them, roleplay notes */}
      <div className="col" style={{ gap: 12 }}>
        <FactionsBox />

        {text('roleplay', 'Roleplaying · Voice & Mannerisms', 5, 'How do they talk? Casually, under stress, when excited…')}
        {text('expression', 'Physical Expression', 5, 'Posture, gestures, tells…')}

        {c.extraNotes.map((n) => (
          <Frame key={n.id} title={n.title || 'Notes'} tight tools={
            <>
              <button className="btn sm ghost" onClick={async () => { const t = (await askText('Box title', n.title)); if (t != null) patch((d) => { const x = d.extraNotes.find((y) => y.id === n.id); if (x) x.title = t }) }}>✎</button>
              <button className="btn sm ghost" onClick={async () => { if ((await askConfirm('Delete this box?'))) patch((d) => { d.extraNotes = d.extraNotes.filter((y) => y.id !== n.id) }) }}>✕</button>
            </>
          }>
            <RichArea className="sheet-ta free" minRows={4} value={n.text} onChange={(v) => patch((d) => { const x = d.extraNotes.find((y) => y.id === n.id); if (x) x.text = v })} />
          </Frame>
        ))}
        <div>
          <button className="btn sm" onClick={async () => {
            const t = (await askText('Title for the new box (e.g. Family, Secrets, Session notes)', 'Notes'))
            if (t != null) patch((d) => { d.extraNotes.push({ id: uid(), title: t, text: '' }) })
          }}>＋ Add another box</button>
        </div>
      </div>
      </div>
    </div>
  )
}
