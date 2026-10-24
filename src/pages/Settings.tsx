import { useEffect, useState } from 'react'
import { profBonus } from '../calc'
import { downloadJson, useChar, useStore } from '../store'
import { Frame, Num, Switch } from '../components/ui'

export function SettingsPage() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const { theme, setTheme, chars, order } = useStore()
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
          <div className="row">
            <span className="grow">Size</span>
            <input className="box-input" style={{ width: 120 }} value={c.size} onChange={(e) => patch((d) => { d.size = e.target.value })} />
          </div>
        </div>
      </Frame>

      <Frame title="App">
        <div className="col" style={{ gap: 12 }}>
          <div className="row"><span className="grow">Theme</span>
            <div className="seg"><button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>Light</button><button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>Dark</button></div>
          </div>
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
