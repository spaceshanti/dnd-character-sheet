import { useEffect, useState } from 'react'
import { profBonus } from '../calc'
import { downloadJson, useChar, useStore } from '../store'
import { Frame, Num, Switch } from '../components/ui'
import { SkinPicker } from '../components/SkinPicker'
import { PdfExport } from '../components/PdfExport'
import { convertSkills, isAK, SYSTEMS, systemName, systemOf, type SystemId } from '../systems'

export function SettingsPage() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const { chars, order } = useStore()
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

      <Frame title="Game">
        <div className="col" style={{ gap: 12 }}>
          <div className="row">
            <span className="grow">This character is for</span>
            <select value={systemOf(c)} onChange={(e) => {
              const to = e.target.value as SystemId
              if (!window.confirm(`Move ${c.name || 'this character'} to ${systemName(to)}? Skills are merged or split to match (e.g. History + Religion ↔ Lore); nothing else is deleted, and you can switch back.`)) return
              patch((d) => { d.system = to; d.skillProf = convertSkills(d.skillProf, to) })
            }}>
              {SYSTEMS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {isAK(c) && (
            <>
              <div className="row">
                <Switch on={c.ak.infected} onChange={(b) => patch((d) => { d.ak.infected = b })} />
                <span className="grow">Infected (Oripathy): can cast Arts without a Casting Unit</span>
              </div>
              {c.ak.infected && (
                <div className="row">
                  <span className="grow">Originium Assimilation (Oripathy Hardcore rule; you die above your CON score)</span>
                  <Num min={0} className="box-input" width={54} value={c.ak.assimilation} onChange={(n) => patch((d) => { d.ak.assimilation = n })} />
                  <b style={{ color: c.ak.assimilation > c.abilities.con ? 'var(--dis)' : undefined }}>/ {c.abilities.con}</b>
                </div>
              )}
              <div className="row">
                <span className="grow">Damage Reduction note (e.g. "Physical only")</span>
                <input className="box-input" style={{ width: 160 }} value={c.ak.drNote} onChange={(e) => patch((d) => { d.ak.drNote = e.target.value })} />
              </div>
            </>
          )}
          <div className="muted small">Each game remembers its own UI style: pick one while a character of that game is open.</div>
        </div>
      </Frame>

      <Frame title="Export to a printable sheet">
        <PdfExport />
      </Frame>

      <Frame title="App">
        <div className="col" style={{ gap: 12 }}>
          <div>
            <div className="field-lbl" style={{ marginBottom: 6 }}>UI style <span className="kbd">Ctrl + T</span></div>
            <SkinPicker />
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

const SHORTCUTS: [string, string][] = [
  ['Tab', 'Open / close abilities, saves & skills'],
  ['Ctrl + I', 'Open / close the inventory'],
  ['Ctrl + T', 'UI style menu'],
  ['Ctrl + B', 'Sourcebooks in a side pane: open / close'],
  ['Ctrl + F', 'Search the sourcebook (opens the side pane if it\'s closed)'],
  ['← / →', 'Sourcebook: previous / next page'],
  ['Esc', 'Close the open window, side panel or popup'],
  ['F11', 'Full screen on / off'],
  ['Enter', 'HP box: take damage'],
  ['Shift + Enter', 'HP box: heal'],
  ['Enter', 'Add the spell / gear / condition you just typed'],
]

function ShortcutList() {
  return (
    <div className="col" style={{ gap: 6 }}>
      <table className="t">
        <tbody>
          {SHORTCUTS.map(([k, v], i) => (
            <tr key={i}>
              <td style={{ width: '36%' }}><kbd className="kbd">{k}</kbd></td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="muted small">Tab, Ctrl + I, Ctrl + T and Ctrl + B work whenever you're not typing in a box.</div>
    </div>
  )
}
