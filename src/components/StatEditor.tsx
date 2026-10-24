import { activeEffects, inactiveEffects, signed, statInfo, type StatKey } from '../calc'
import { newMod } from '../blank'
import { useChar, useStore } from '../store'
import { Num, Popover, Switch } from './ui'

const TITLES: Record<StatKey, string> = { ac: 'Armor Class', speed: 'Speed', initiative: 'Initiative', hpMax: 'Max Hit Points' }
const HINTS: Record<StatKey, string> = {
  ac: 'e.g. "Mage Armor" +3, "Shield" +5. Toggle them on and off instead of rewriting your base.',
  speed: 'e.g. "Longstrider" +10, "Boots of Speed" +20.',
  initiative: 'Your DEX modifier is added automatically. Use these for Alert, etc.',
  hpMax: 'e.g. "Aid" +5, "Tough" feat.',
}

export function StatEditor({ statKey, anchor, onClose }: { statKey: StatKey; anchor: HTMLElement | null; onClose: () => void }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const fx = activeEffects(c)
  const info = statInfo(c, statKey, fx)
  const off = inactiveEffects(c).filter((a) => a.effect.target === statKey && a.effect.type === 'bonus')
  const stat = c[statKey]
  const unit = statKey === 'speed' ? ' ft' : ''

  return (
    <Popover anchor={anchor} onClose={onClose} width={340}>
      <div className="row" style={{ marginBottom: 6 }}>
        <h3 style={{ fontSize: 14, flex: 1 }}>{TITLES[statKey]}</h3>
        <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-head)' }}>
          {statKey === 'initiative' ? signed(info.total) : info.total}{unit}
        </span>
      </div>

      {statKey === 'ac' && info.baseLabel !== '10 + DEX' && info.baseLabel !== 'Base' && (
        <div className="stat-line"><span className="field-lbl" style={{ width: 70 }}>Base AC</span><b>{info.baseValue}</b><span className="muted small">from {info.baseLabel}</span></div>
      )}
      {statKey === 'ac' && (info.baseLabel === '10 + DEX' || info.baseLabel === 'Base') && (
        <div className="stat-line">
          <span className="field-lbl" style={{ width: 70 }}>Base is</span>
          <select value={c.ac.mode} onChange={(e) => patch((d) => { d.ac.mode = e.target.value as 'manual' | 'unarmored' })}>
            <option value="unarmored">10 + DEX (no armor)</option>
            <option value="manual">A number I set (armor)</option>
          </select>
        </div>
      )}
      {!(statKey === 'ac' && info.baseLabel !== '10 + DEX' && info.baseLabel !== 'Base') && <div className="stat-line">
        <span className="field-lbl" style={{ width: 70 }}>{statKey === 'ac' ? 'Base AC' : statKey === 'initiative' ? 'Misc bonus' : 'Base'}</span>
        {statKey === 'ac' && c.ac.mode === 'unarmored' ? (
          <b>{info.baseValue} <span className="muted small">(10 + DEX)</span></b>
        ) : (
          <Num className="box-input" width={70} value={stat.base} onChange={(n) => patch((d) => { d[statKey].base = n })} />
        )}
        {statKey === 'initiative' && <span className="muted small">+ DEX {signed(info.baseValue)}</span>}
      </div>}

      <div className="field-lbl" style={{ margin: '10px 0 4px' }}>Added on top of base</div>
      {stat.mods.length === 0 && <div className="muted small" style={{ marginBottom: 4 }}>{HINTS[statKey]}</div>}
      {stat.mods.map((m) => (
        <div className="stat-line" key={m.id}>
          <Switch on={m.on} onChange={(b) => patch((d) => { const x = d[statKey].mods.find((y) => y.id === m.id); if (x) x.on = b })} />
          <input className="box-input" placeholder="name" value={m.name} style={{ flex: 1 }}
            onChange={(e) => patch((d) => { const x = d[statKey].mods.find((y) => y.id === m.id); if (x) x.name = e.target.value })} />
          <Num className="box-input" width={54} value={m.value} onChange={(n) => patch((d) => { const x = d[statKey].mods.find((y) => y.id === m.id); if (x) x.value = n })} />
          <button className="btn icon sm" onClick={() => patch((d) => { d[statKey].mods = d[statKey].mods.filter((y) => y.id !== m.id) })}>✕</button>
        </div>
      ))}
      <button className="btn sm" onClick={() => patch((d) => { d[statKey].mods.push(newMod()) })}>＋ Add modifier</button>

      {(info.adds.some((a) => a.fromEffect) || off.length > 0) && (
        <>
          <div className="field-lbl" style={{ margin: '10px 0 4px' }}>From features & items</div>
          {info.adds.filter((a) => a.fromEffect).map((a, i) => (
            <div className="row small" key={i}><span className="grow">{a.label}</span><b>{signed(a.value)}</b></div>
          ))}
          {off.map((a, i) => (
            <div className="row small dim" key={'o' + i}><span className="grow">{a.source} (off)</span><b>{signed(a.effect.value ?? 0)}</b></div>
          ))}
        </>
      )}
    </Popover>
  )
}
