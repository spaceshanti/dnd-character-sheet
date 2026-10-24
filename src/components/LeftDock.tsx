import { useState } from 'react'
import { ABILITIES, SKILLS } from '../constants'
import {
  ability, activeEffects, inactiveEffects, netAdvantage, passivePerception, profBonus, save, signed, skill, type RollInfo,
} from '../calc'
import { useChar, useStore, useUI } from '../store'
import { Num } from './ui'
import type { AbilityKey, Character, ProfLevel, SkillKey } from '../types'

function Breakdown({ info, extra }: { info: RollInfo; extra?: { source: string; text: string }[] }) {
  return (
    <div className="breakdown">
      {info.parts.map((p, i) => (
        <div className="bl" key={i}><span>{p.label}</span><b>{signed(p.value)}</b></div>
      ))}
      <div className="bl total"><span>Total</span><b>{signed(info.total)}</b></div>
      {info.adv.map((s, i) => <div key={'a' + i} style={{ color: 'var(--adv)' }}>▲ Advantage — {s}</div>)}
      {info.dis.map((s, i) => <div key={'d' + i} style={{ color: 'var(--dis)' }}>▼ Disadvantage — {s}</div>)}
      {info.adv.length > 0 && info.dis.length > 0 && <div className="muted">Advantage and disadvantage cancel out.</div>}
      {info.notes.map((s, i) => <div key={'n' + i} className="muted">✎ {s}</div>)}
      {extra?.map((x, i) => <div key={'x' + i} className="dim">○ {x.source}: {x.text} (switched off)</div>)}
    </div>
  )
}

function Pip({ level, kind, granted, onClick }: { level: number; kind: 'save' | 'skill'; granted: boolean; onClick: () => void }) {
  const shape = kind === 'save' ? 'diamond' : ''
  return (
    <button
      className={`pip ${shape} ${level >= 1 ? 'on' : ''}`}
      style={{
        ...(level === 2 ? { boxShadow: 'inset 0 0 0 2px var(--panel)' } : {}),
        ...(level === 0.5 ? { background: 'linear-gradient(90deg, var(--ink) 50%, transparent 50%)' } : {}),
        ...(granted ? { borderStyle: 'dashed', borderColor: 'var(--accent)' } : {}),
      }}
      title={granted ? 'Granted by a feature or item' : level === 2 ? 'Expertise' : level === 1 ? 'Proficient' : level === 0.5 ? 'Half proficiency' : 'Not proficient'}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    />
  )
}

export function LeftDock() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const open = useUI((s) => s.dockOpen)
  const set = useUI((s) => s.set)
  const [expanded, setExpanded] = useState<string>('')
  const fx = activeEffects(c)
  const off = inactiveEffects(c)
  const pb = profBonus(c)

  const offFor = (targets: string[]) =>
    off.filter((a) => targets.includes(a.effect.target)).map((a) => ({
      source: a.source,
      text: a.effect.type === 'bonus' ? signed(a.effect.value ?? 0) : a.effect.type,
    }))

  const adv = (r: RollInfo) => {
    const n = netAdvantage(r)
    return n === 'adv' ? <span className="adv a" title="Advantage">ADV</span> : n === 'dis' ? <span className="adv d" title="Disadvantage">DIS</span> : null
  }
  const touched = (r: RollInfo) => r.parts.length > (r.profLevel ? 2 : 1) || r.adv.length || r.dis.length || r.notes.length

  const cycleSkill = (k: SkillKey) =>
    patch((d) => { d.skillProf[k] = ((d.skillProf[k] + 1) % 3) as ProfLevel })

  return (
    <>
      <aside className={`dock ${open ? '' : 'closed'}`}>
        <div className="prof-row">
          <div className="pill" title="Proficiency bonus is worked out from your level. Override it in Settings.">
            <div className="num">{signed(pb)}</div><div className="t">Proficiency<br />Bonus</div>
          </div>
          <div className={`pill insp ${c.inspiration ? 'on' : ''}`} onClick={() => patch((d) => { d.inspiration = !d.inspiration })}>
            <div className="num">{c.inspiration ? '★' : '☆'}</div><div className="t">Inspiration</div>
          </div>
        </div>

        {ABILITIES.map((a) => {
          const ai = ability(c, a.key as AbilityKey, fx)
          const sv = save(c, a.key, fx)
          const svKey = 'save:' + a.key
          const skills = SKILLS.filter((s) => s.ability === a.key)
          return (
            <div className="ab-card" key={a.key}>
              <div className="ab-box">
                <div className="name">{a.name}</div>
                <div
                  className={`mod ${ai.changed ? 'changed' : ''}`}
                  title={ai.changed ? ai.parts.map((p) => `${p.label}: ${p.value}`).join('\n') : 'Modifier'}
                  onClick={() => setExpanded(expanded === 'ab:' + a.key ? '' : 'ab:' + a.key)}
                >
                  {signed(ai.mod)}
                </div>
                <Num min={1} max={30} className="score" value={ai.changed ? ai.score : c.abilities[a.key]}
                  style={ai.changed ? { color: 'var(--accent)' } : undefined}
                  onChange={(n) => { if (!ai.changed) patch((d) => { d.abilities[a.key] = n }) }} />
              </div>
              <div className="ab-rows">
                {expanded === 'ab:' + a.key && (
                  <div className="breakdown" style={{ margin: '0 0 6px' }}>
                    {ai.parts.map((p, i) => <div className="bl" key={i}><span>{p.label}</span><b>{i === 0 ? p.value : signed(p.value)}</b></div>)}
                    <div className="bl total"><span>Score / modifier</span><b>{ai.score} / {signed(ai.mod)}</b></div>
                    {ai.changed && <div className="muted">Edit the base score by switching off the item that changes it.</div>}
                  </div>
                )}
                <div className={`rr save ${expanded === svKey ? 'open' : ''}`} onClick={() => setExpanded(expanded === svKey ? '' : svKey)}>
                  <Pip kind="save" level={sv.profLevel} granted={sv.profLevel > sv.baseProf} onClick={() => patch((d) => { d.saveProf[a.key] = d.saveProf[a.key] ? 0 : 1 })} />
                  <span className="val">{signed(sv.total)}</span>
                  <span className="nm">Saving Throw</span>
                  {adv(sv)}
                  {touched(sv) ? <span className="src">●</span> : null}
                  <span className="chev">▼</span>
                </div>
                {expanded === svKey && <Breakdown info={sv} extra={offFor([svKey, 'save:all'])} />}

                {skills.map((s) => {
                  const r = skill(c, s.key, fx)
                  const key = 'skill:' + s.key
                  return (
                    <div key={s.key}>
                      <div className={`rr ${expanded === key ? 'open' : ''}`} onClick={() => setExpanded(expanded === key ? '' : key)}>
                        <Pip kind="skill" level={r.profLevel} granted={r.profLevel > r.baseProf && r.profLevel !== 0.5} onClick={() => cycleSkill(s.key)} />
                        <span className="val">{signed(r.total)}</span>
                        <span className="nm">{s.name}</span>
                        {adv(r)}
                        {touched(r) ? <span className="src" title="Affected by a feature or item">●</span> : null}
                        <span className="chev">▼</span>
                      </div>
                      {expanded === key && <Breakdown info={r} extra={offFor([key, 'skill:all'])} />}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="passive">
          <div className="pill" style={{ border: '2px solid var(--ink)', flex: 'none', minHeight: 0, padding: 0, width: 38, height: 38, justifyContent: 'center' }}>
            <b style={{ fontFamily: 'var(--font-head)' }}>{passivePerception(c, fx)}</b>
          </div>
          <span className="caps">Passive Wisdom (Perception)</span>
        </div>
        <div className="muted small" style={{ marginTop: 8 }}>
          Click a row to see what's affecting it. Click a circle to cycle proficiency / expertise. A <span style={{ color: 'var(--accent)' }}>●</span> means a feature or item is changing that roll.
        </div>
      </aside>
      <button className="dock-toggle" style={{ left: open ? 334 : 0, transition: 'left .2s' }} title={open ? 'Hide abilities' : 'Show abilities'}
        onClick={() => set({ dockOpen: !open })}>
        {open ? '‹' : '›'}
      </button>
    </>
  )
}

export type { Character }
