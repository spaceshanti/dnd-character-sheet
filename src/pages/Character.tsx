import { uid } from '../blank'
import { useChar, useStore } from '../store'
import { Area, Frame } from '../components/ui'
import { ImageBox } from '../components/ImageBox'

export function CharacterPage() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const st = c.story
  const text = (key: keyof typeof st, title: string, rows = 4, ph = '') => (
    <Frame title={title} tight>
      <Area className="sheet-ta" minRows={rows} placeholder={ph} value={st[key]} onChange={(v) => patch((d) => { d.story[key] = v })} />
    </Frame>
  )
  return (
    <div style={{ columns: '3 340px', columnGap: 14 }} className="masonry">
      <style>{`.masonry > * { break-inside: avoid; margin-bottom: 14px; }`}</style>
      <Frame title="Appearance">
        <ImageBox src={c.portrait} onChange={(s) => patch((d) => { d.portrait = s })} contain placeholder="Click or drop an image" />
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
          {(['age', 'height', 'weight', 'eyes', 'skin', 'hair'] as const).map((k) => (
            <div className="field" key={k}>
              <input value={c.appearance[k]} onChange={(e) => patch((d) => { d.appearance[k] = e.target.value })} />
              <label>{k}</label>
            </div>
          ))}
        </div>
      </Frame>

      <Frame title="Character Backstory">
        <Area className="sheet-ta free" minRows={14} placeholder="Where do they come from? What drives them?" value={st.backstory} onChange={(v) => patch((d) => { d.story.backstory = v })} />
      </Frame>

      {text('trait1', 'Personality Traits', 4)}
      {text('trait2', 'Personality Traits', 4)}
      {text('trait3', 'Personality Traits', 4)}
      {text('ideals', 'Ideals', 4)}
      {text('bonds', 'Bonds', 4)}
      {text('flaws', 'Flaws', 4)}

      <Frame
        title={st.alliesTitle || 'Allies & Organizations'}
        tools={<button className="btn sm ghost" title="Rename this box" onClick={() => { const t = window.prompt('Box title', st.alliesTitle); if (t != null) patch((d) => { d.story.alliesTitle = t }) }}>✎</button>}
      >
        <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 120, flex: 'none' }}>
            <ImageBox src={c.emblem} onChange={(s) => patch((d) => { d.emblem = s })} ratio="1 / 1" contain placeholder="Emblem / symbol" />
          </div>
          <Area className="sheet-ta free" minRows={6} value={st.allies} placeholder="Factions, patrons, family, rivals…" onChange={(v) => patch((d) => { d.story.allies = v })} />
        </div>
      </Frame>

      {text('roleplay', 'Roleplaying · Voice & Mannerisms', 6, 'How do they talk? Casually, under stress, when excited…')}
      {text('expression', 'Physical Expression', 6, 'Posture, gestures, tells…')}

      {c.extraNotes.map((n) => (
        <Frame key={n.id} title={n.title || 'Notes'} tools={
          <>
            <button className="btn sm ghost" onClick={() => { const t = window.prompt('Box title', n.title); if (t != null) patch((d) => { const x = d.extraNotes.find((y) => y.id === n.id); if (x) x.title = t }) }}>✎</button>
            <button className="btn sm ghost" onClick={() => { if (window.confirm('Delete this box?')) patch((d) => { d.extraNotes = d.extraNotes.filter((y) => y.id !== n.id) }) }}>✕</button>
          </>
        }>
          <Area className="sheet-ta free" minRows={4} value={n.text} onChange={(v) => patch((d) => { const x = d.extraNotes.find((y) => y.id === n.id); if (x) x.text = v })} />
        </Frame>
      ))}
      <div>
        <button className="btn" onClick={() => {
          const t = window.prompt('Title for the new box (e.g. Family, Secrets, Session notes)', 'Notes')
          if (t != null) patch((d) => { d.extraNotes.push({ id: uid(), title: t, text: '' }) })
        }}>＋ Add another box</button>
      </div>
    </div>
  )
}
