import { useEffect, useState } from 'react'
import { profBonus } from '../calc'
import { downloadJson, useChar, useStore } from '../store'
import { Frame, Num, Switch } from '../components/ui'
import { SKINS } from '../skins'

export function SettingsPage() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const { theme, setTheme, skin, setSkin, chars, order } = useStore()
  const saveError = useStore((s) => s.saveError)
  const [path, setPath] = useState('')
  useEffect(() => { window.sheetApi?.dataPath().then(setPath) }, [])
  const auto = 2 + Math.floor((Math.max(1, c.level) - 1) / 4)

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', alignItems: 'start' }}>
      <Frame title="Rules for this character">
        <div className="col" style={{ gap: 12 }}>
          <div className="row">
            <Switch on={c.profOverride != null} onChange={(b) => patch((d) => { d.profOverride = b ? auto : null })} />
            <span className="grow">Set proficiency bonus manually</span>
            {c.profOverride != null ? <Num className="box-input" width={54} value={c.profOverride} onChange={(n) => patch((d) => { d.profOverride = n })} /> : <b>+{profBonus(c)} (from level {c.level})</b>}
          </div>
          <div className="row">
            <Switch on={c.halfProfAll} onChange={(b) => patch((d) => { d.halfProfAll = b })} />
            <span className="grow">Half proficiency on unproficient skills (Jack of All Trades)</span>
          </div>
          <div className="row">
            <span className="grow">Carrying capacity = STR score ×</span>
            <Num min={1} className="box-input" width={54} value={c.carryMultiplier} onChange={(n) => patch((d) => { d.carryMultiplier = n })} />
          </div>
        </div>
      </Frame>

      <Frame title="App">
        <div className="col" style={{ gap: 12 }}>
          <div>
            <div className="field-lbl" style={{ marginBottom: 6 }}>UI style</div>
            <div className="skin-grid">
              {SKINS.map((k) => (
                <button key={k.id} className={`skin-card ${skin === k.id ? 'on' : ''}`} onClick={() => setSkin(k.id)}>
                  <span className="sw">{k.swatch.map((c) => <i key={c} style={{ background: c }} />)}</span>
                  <b>{k.name}</b>
                  <span className="small muted">{k.desc}</span>
                </button>
              ))}
            </div>
          </div>
          {skin === 'standard' && (
            <div className="row"><span className="grow">Light / dark</span>
              <div className="seg"><button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>Light</button><button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>Dark</button></div>
            </div>
          )}
          <div className="small muted">
            Saves automatically{path ? <> to <code style={{ wordBreak: 'break-all' }}>{path}</code> (a <code>.bak</code> copy is kept beside it)</> : ' in this browser'}.
          </div>
          {saveError && <div style={{ color: 'var(--dis)' }}>Couldn't save: {saveError}</div>}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => downloadJson(`${(c.name || 'character').replace(/[^\w-]+/g, '_')}.json`, c)}>Export this character</button>
            <button className="btn" onClick={() => downloadJson('all-characters.json', { version: 1, chars, order })}>Export everything (backup)</button>
          </div>
          <div className="muted small">Import files from the 👥 Characters window.</div>
        </div>
      </Frame>

      <Frame title="Shortcuts">
        <ShortcutList />
      </Frame>

      <Frame title="How linking works">
        <div className="prose" style={{ fontSize: 13.5 }}>
          {`Features, items and spells can each be linked to the things they change — a skill, a saving throw, AC, speed, initiative, an ability score and more.

• Bonuses are added into the totals automatically.
• Advantage / disadvantage shows as ADV / DIS beside the roll.
• Click any skill or save on the left to see exactly what's contributing.
• Items only count while equipped (and attuned, if they need it). Features and spells have an on/off switch, so "Mage Armor" can add +3 AC only when it's up.
• AC, Speed, Initiative and Max HP also have their own add-on list: click them in the top bar.`}
        </div>
      </Frame>
    </div>
  )
}

const SHORTCUTS: { group: string; items: [string, string][] }[] = [
  {
    group: 'Keyboard',
    items: [
      ['Ctrl + I', 'Open / close the inventory (when not typing in a box)'],
      ['Esc', 'Close the open window, side panel or popup'],
      ['Enter', 'In the HP box: apply damage'],
      ['Shift + Enter', 'In the HP box: heal instead'],
      ['Enter', 'On an empty spell line: add the spell and start the next one'],
      ['Enter', 'In a number box: confirm the value'],
      ['Enter', 'In the conditions popup: add a custom condition'],
    ],
  },
  {
    group: 'Mouse',
    items: [
      ['Click the left edge strip', 'Open / close abilities, saves & skills (stays open and pushes the page over)'],
      ['Click AC / Speed / Initiative', 'Edit the base value and add-on bonuses'],
      ['Click max HP ( / 25 )', 'Edit max HP and its bonuses'],
      ['Click a skill or save', 'Show what is affecting it'],
      ['Click a proficiency circle', 'Cycle none → proficient → expertise'],
      ['Click an ability modifier', 'Show how the score is built'],
      ['Click a pip', 'Filled = available. Click to spend, click an empty one to regain'],
      ['Click top-left image', 'View it full size (✎ to replace)'],
      ['Click a spell circle', 'Prepare / unprepare'],
    ],
  },
  {
    group: 'Drag & drop',
    items: [
      ['Item → equipment slot', 'Equip it (swaps out whatever was there)'],
      ['Equipped item → backpack', 'Unequip it'],
      ['Image file → top-left image', 'Replace the portrait'],
      ['Image files → Gallery page', 'Add them to the gallery'],
      ['Image file → any image box', 'Set that image (appearance, emblem)'],
    ],
  },
]

function ShortcutList() {
  return (
    <div className="col" style={{ gap: 10 }}>
      {SHORTCUTS.map((g) => (
        <div key={g.group}>
          <div className="field-lbl" style={{ marginBottom: 3 }}>{g.group}</div>
          <table className="t">
            <tbody>
              {g.items.map(([k, v], i) => (
                <tr key={i}>
                  <td style={{ width: '42%' }}><kbd className="kbd">{k}</kbd></td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
