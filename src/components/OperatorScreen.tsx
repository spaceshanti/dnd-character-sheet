import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { activeEffects, attackInfo, damageReduction, itemAttacks, martialDc, profBonus, signed, spellStats, spLimits, statInfo } from '../calc'
import { activateOp } from '../ak'
import { useChar, useStore, useUI } from '../store'
import { Toast, useToast } from './ui'
import { SkillIconPick } from '../pages/OperatorSkills'
import type { OperatorDisplay, SkillTier } from '../types'

/*
 * Arknights 5e: the character shown like the game's operator screen — art in the middle on angular
 * black / white shards, attributes on the left, level, promotion and skills on the right.
 * Purely a view of the sheet (skills can be activated from here).
 */

const ICON: Record<string, ReactNode> = {
  hp: <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" />,
  atk: <path d="M4 4l6 6-1.5 1.5L3 6V4zM20 4v2l-5.5 5.5L13 10l6-6zM10.5 13.5L4 20l-1-1 6.5-6.5zM13.5 13.5L20 20l1-1-6.5-6.5zM12 12l-1.5-1.5 1.5-1.5 1.5 1.5z" />,
  def: <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" />,
  res: <path d="M12 2l10 10-10 10L2 12zm0 5l-5 5 5 5 5-5z" />,
  init: <path d="M6 2h12v2h-1v3l-4 5 4 5v3h1v2H6v-2h1v-3l4-5-4-5V4H6zm3 2v2.3l3 3.7 3-3.7V4z" />,
  dc: <path d="M12 2a10 10 0 110 20 10 10 0 010-20zm0 4a6 6 0 100 12 6 6 0 000-12zm0 3a3 3 0 110 6 3 3 0 010-6z" />,
  arts: <path d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z" />,
  spd: <path d="M4 18l7-12 2 1-5 9h6l2 2zM14 5h6v2h-6zm1 4h5v2h-5zm1 4h4v2h-4z" />,
}

const Ico = ({ k }: { k: string }) => <svg viewBox="0 0 24 24" className="op-ico">{ICON[k]}</svg>

/** Elite promotion follows the Operator Skill levels: E1 at 7th level, E2 at 14th. */
const elite = (lvl: number) => (lvl >= 14 ? 2 : lvl >= 7 ? 1 : 0)
/** 1★ at level 1 up to 6★ at 17+: 3★ when you reach E1 (7th), 5★ at E2 (14th) */
const levelStars = (lvl: number) => Math.min(6, Math.max(1, Math.ceil((Math.max(1, lvl) * 6) / 20)))

type Range = OperatorDisplay['range']
const PRESETS: { name: string; range: Range }[] = [
  { name: 'Melee', range: [[0, 0], [1, 0]] },
  { name: 'Lord', range: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { name: 'Centurion', range: [[0, 0], [1, 0], [0, -1], [0, 1], [1, -1], [1, 1]] },
  { name: 'Ranged', range: [[0, 0], [1, 0], [2, 0], [3, 0], [0, -1], [1, -1], [2, -1], [3, -1], [0, 1], [1, 1], [2, 1], [3, 1]] },
  { name: 'Caster', range: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, -1], [1, -1], [2, -1], [3, -1], [0, 1], [1, 1], [2, 1], [3, 1]] },
  { name: 'Healer', range: [[0, 0], [1, 0], [2, 0], [3, 0], [-1, 0], [0, -1], [1, -1], [2, -1], [3, -1], [0, 1], [1, 1], [2, 1], [3, 1]] },
  { name: 'Artillery', range: [[0, 0], ...[1, 2, 3, 4].flatMap((x) => [-2, -1, 0, 1, 2].map((y) => [x, y] as [number, number])), [5, 0], [5, -1], [5, 1]] },
]
const TAG_IDEAS = ['DPS', 'Healing', 'Support', 'Defense', 'Crowd-Control', 'AoE', 'Nuker', 'Debuff', 'Slow', 'Shift', 'Summon', 'Survival', 'Fast-Redeploy', 'DP-Recovery', 'Elemental']
const COLS = [-1, 0, 1, 2, 3, 4, 5]
const ROWS = [-2, -1, 0, 1, 2]
const has = (r: Range, x: number, y: number) => r.some(([a, b]) => a === x && b === y)

/** the attack range tiles, the operator's own tile filled */
function RangeGrid({ range, onToggle }: { range: Range; onToggle?: (x: number, y: number) => void }) {
  const xs = onToggle ? COLS : COLS.filter((x) => range.some(([a]) => a === x))
  const ys = onToggle ? ROWS : ROWS.filter((y) => range.some(([, b]) => b === y))
  if (!xs.length) return <span className="ops-norange">—</span>
  return (
    <div className={`ops-grid ${onToggle ? 'edit' : ''}`} style={{ gridTemplateColumns: `repeat(${xs.length}, 1fr)` }}>
      {ys.flatMap((y) => xs.map((x) => {
        const self = x === 0 && y === 0
        const on = self || has(range, x, y)
        return onToggle
          ? <button key={`${x},${y}`} className={`cell ${self ? 'self' : on ? 'on' : ''}`} disabled={self} onClick={() => onToggle(x, y)} />
          : <i key={`${x},${y}`} className={`cell ${self ? 'self' : on ? 'on' : 'off'}`} />
      }))}
    </div>
  )
}

/** simple class marks for the AK5e classes */
const CLASS_PATHS: [RegExp, string][] = [
  [/caster/i, 'M12 2l2.4 6.6L21 9l-5.2 4.3L17.6 21 12 17l-5.6 4 1.8-7.7L3 9l6.6-.4z'],
  [/defender|protector/i, 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5zm0 4l-4 1.5V11c0 3 1.7 5.4 4 6.7 2.3-1.3 4-3.7 4-6.7V7.5z'],
  [/guard|slayer/i, 'M19 2l3 3-11 11-3-3zM6 14l4 4-2 2-1.5-1.5L3 22l-1-1 3.5-3.5L4 16z'],
  [/marksman|sniper|slinger/i, 'M11 2h2v4.1A6 6 0 0117.9 11H22v2h-4.1A6 6 0 0113 17.9V22h-2v-4.1A6 6 0 016.1 13H2v-2h4.1A6 6 0 0111 6.1zm1 6a4 4 0 100 8 4 4 0 000-8zm0 3a1 1 0 110 2 1 1 0 010-2z'],
  [/medic/i, 'M9 2h6v7h7v6h-7v7H9v-7H2V9h7z'],
  [/specialist/i, 'M14 2l8 8-3 1-6-6zM12 7l5 5-9 9-4 1 1-4z'],
  [/supporter/i, 'M5 2h2v20H5zm3 1h11l-3 4 3 4H8z'],
  [/vanguard/i, 'M4 2h2v20H4zm3 1c4-1 6 2 12 0v9c-6 2-8-1-12 0z'],
  [/doll|drone|arts master/i, 'M12 2l9 5v10l-9 5-9-5V7zm0 5a5 5 0 100 10 5 5 0 000-10z'],
]
function ClassMark({ name }: { name: string }) {
  const p = CLASS_PATHS.find(([re]) => re.test(name))
  return p ? <svg viewBox="0 0 24 24" className="ops-classico"><path d={p[1]} /></svg> : <span>{(name || '?').slice(0, 1)}</span>
}
const TIERS: SkillTier[] = ['basic', 'advanced', 'elite']

export function OperatorScreen() {
  const open = useUI((s) => s.operatorOpen)
  const set = useUI((s) => s.set)
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && set({ operatorOpen: false })
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, set])
  if (!open) return null
  return createPortal(<Screen onClose={() => set({ operatorOpen: false })} />, document.body)
}

function Screen({ onClose }: { onClose: () => void }) {
  const c = useChar()
  const go = useUI((s) => s.go)
  const set = useUI((s) => s.set)
  const toast = useToast()
  const fx = activeEffects(c)
  const hp = statInfo(c, 'hpMax', fx).total
  const atk = [...itemAttacks(c), ...c.attacks].map((a) => ({ a, i: attackInfo(c, a, fx) })).sort((x, y) => y.i.bonus - x.i.bonus)[0]
  const sp = spellStats(c, fx)
  const lim = spLimits(c)
  const e = elite(c.level)
  const art = c.appearanceImage || c.portrait
  const disp = c.ak.display
  const weaponRange = atk?.a.range || ''
  const autoRanged = /\d/.test(weaponRange) && !/^5\b/.test(weaponRange)
  // auto: a range reaching 2+ tiles ahead counts as ranged, otherwise go by the best weapon
  const reach = disp.range.reduce((m, [x]) => Math.max(m, x), 0)
  const position = disp.position || ((disp.range.length ? reach >= 2 : autoRanged) ? 'Ranged' : 'Melee')
  const range: Range = disp.range.length ? disp.range : position === 'Ranged' ? PRESETS[3].range : PRESETS[0].range
  const talents = c.features.filter((f) => f.category === 'class' || f.category === 'species').slice(0, 3)
  const tags = [position, ...(disp.tags.filter(Boolean).length ? disp.tags.filter(Boolean) : [c.className || 'Operator'])]
  const stars = disp.stars || levelStars(c.level)
  const [editing, setEditing] = useState(false)
  const leave = (page?: Parameters<typeof go>[0]) => { onClose(); if (page) go(page) }

  const attrs: [string, string, ReactNode][] = [
    ['hp', 'HP', <>{c.hp.current}<small>/{hp}</small></>],
    ['init', 'Initiative', signed(statInfo(c, 'initiative', fx).total)],
    ['atk', 'Attack', atk ? signed(atk.i.bonus) : '—'],
    ['dc', 'Martial DC', martialDc(c, fx)],
    ['def', 'Armour', statInfo(c, 'ac', fx).total],
    ['arts', 'Arts DC', sp.dc ?? '—'],
    ['res', 'Dmg. Red.', damageReduction(c, fx).total],
    ['spd', 'Speed', `${statInfo(c, 'speed', fx).total}ft`],
  ]

  return (
    <div className="opscreen">
      <div className="ops-bg"><i className="s1" /><i className="s2" /><i className="s3" /><i className="s4" /></div>
      {art ? <div className="ops-art" style={{ backgroundImage: `url("${art}")` }} /> : <div className="ops-art empty">No art yet. Add a picture in the Appearance box.</div>}

      <div className="ops-top">
        <button className="ops-btn wide" title="Back (Esc)" onClick={onClose}>‹</button>
        <button className="ops-btn" title="Character page" onClick={() => leave('character')}>⌂</button>
        <button className="ops-btn" title="Operator Skills" onClick={() => leave('operator')}>⚡</button>
        <button className="ops-btn" title="Inventory" onClick={() => { onClose(); set({ inventoryOpen: true }) }}>⌒</button>
        <button className="ops-btn" title="Arts" onClick={() => leave('spells')}>ⓘ</button>
        <button className={`ops-btn wide2 ${editing ? 'on' : ''}`} title="Range, position, tags and stars" onClick={() => setEditing(!editing)}>✎ Customize</button>
      </div>
      {editing && <Customize range={range} onClose={() => setEditing(false)} />}

      <div className="ops-left">
        <div className="ops-attr-h">Attributes <span>»</span></div>
        <div className="ops-attrs">
          {attrs.map(([k, label, v]) => (
            <div key={k} className="ops-attr" title={label}><Ico k={k} /><b>{v}</b></div>
          ))}
        </div>
        <div className="ops-trust" title="Skill Points">
          <span>SP</span><span className="grow" /><b>{c.ak.sp}{lim.max ? ` / ${lim.max}` : ''}</b>
          <i style={{ width: `${lim.max ? Math.min(100, (c.ak.sp / lim.max) * 100) : 0}%` }} />
        </div>
        <div className="ops-stars" title={disp.stars ? 'Set by hand (Customize)' : 'Goes up with your level'}>{'★'.repeat(stars)}</div>
        <div className="ops-name" style={{ fontSize: `${Math.min(13, 92 / Math.max(5, (c.name || 'Operator').length))}vh` }}>{c.name || 'Operator'}</div>
        <div className="ops-class">
          <div className="ops-classbox" title={c.className}><ClassMark name={c.className} /></div>
          <button className="ops-range" title={`Attack range${weaponRange ? ` · ${atk!.a.name}: ${weaponRange}` : ''}\nClick to change`} onClick={() => setEditing(true)}>
            <div className="g"><RangeGrid range={range} /></div><span>Attack Range</span>
          </button>
          <div className="ops-tags">{tags.slice(0, 3).map((t, i) => <span key={t + i}>{t}</span>)}</div>
        </div>
      </div>

      <div className="ops-right">
        <div className="ops-lv">
          <div className="ring"><small>LV</small><b>{c.level}</b></div>
          <span className="cap">/20</span>
          <div className="exp"><small>EXP</small><b>{c.xp || '-/-'}</b></div>
        </div>
        <div className="ops-row2">
          <div className="ops-card"><span>Promotion</span><b className="elite">E{e}</b></div>
          <div className="ops-card"><span>Proficiency</span><b>{signed(profBonus(c))}</b></div>
        </div>
        <div className="ops-skills">
          {TIERS.map((t, i) => {
            const s = c.ak.opSkills.find((x) => x.tier === t)
            const active = s && c.ak.activeSkill === s.id
            const locked = c.level < [2, 7, 14][i]
            return (
              <button key={t} className={`ops-skill ${s ? '' : 'none'} ${s?.icon ? 'has-icon' : ''} ${active ? 'active' : ''} ${locked ? 'locked' : ''}`}
                style={s?.icon ? { backgroundImage: `url("${s.icon}")` } : undefined}
                title={s ? `${s.name} · ${s.spCost} SP · ${s.activation} · ${s.duration}\nClick to activate` : `${t} skill (level ${[2, 7, 14][i]})`}
                onClick={() => s && toast.show(activateOp(c, s.id))}>
                <span className="nm">{s?.name || (locked ? `Lv ${[2, 7, 14][i]}` : '—')}</span>
                {s && <span className="cost">⚡{s.spCost}</span>}
                {active && <span className="chk">✓</span>}
              </button>
            )
          })}
          <div className="ops-rank"><small>Arts</small><b>{c.ak.maxArtLevel || '—'}</b><span>{c.ak.ap.max ? `${c.ak.ap.max - c.ak.ap.used}/${c.ak.ap.max} AP` : 'max level'}</span></div>
        </div>
        <div className="ops-branch">
          <div className="top">
            <div className="ico"><ClassMark name={c.className} /></div>
            <b>{c.subclass || c.className || 'Branch'}</b>
            <span className="sep" />
            <span className="mod">{c.nationality || 'Module'}</span>
          </div>
          <div className="talent">
            <span>Talent</span>
            <div>{talents.length ? talents.map((f) => <span key={f.id} className="chip-t">{f.name}</span>) : <span className="muted">—</span>}</div>
          </div>
        </div>
      </div>
      <Toast msg={toast.msg} />
    </div>
  )
}

/** Edit panel: attack range tiles, position, tags and stars. */
function Customize({ range, onClose }: { range: Range; onClose: () => void }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const d = c.ak.display
  const up = (fn: (x: OperatorDisplay) => void) => patch((ch) => { fn(ch.ak.display) })
  const toggle = (x: number, y: number) => up((dd) => {
    const cur: Range = dd.range.length ? dd.range : range.map(([a, b]) => [a, b])
    dd.range = has(cur, x, y) ? cur.filter(([a, b]) => !(a === x && b === y)) : [...cur, [x, y]]
  })
  return (
    <div className="ops-edit">
      <div className="hd"><b>Customize</b><button onClick={onClose}>✕</button></div>
      <label>Attack range <small>click tiles · facing right · the filled tile is you</small></label>
      <RangeGrid range={range} onToggle={toggle} />
      <div className="presets">
        {PRESETS.map((p) => <button key={p.name} onClick={() => up((dd) => { dd.range = p.range })}>{p.name}</button>)}
        <button onClick={() => up((dd) => { dd.range = [] })} title="Melee or ranged, from your best weapon">Auto</button>
      </div>
      <label>Position</label>
      <div className="presets">
        {(['', 'Melee', 'Ranged'] as const).map((p) => <button key={p} className={d.position === p ? 'on' : ''} onClick={() => up((dd) => { dd.position = p })}>{p || 'Auto'}</button>)}
      </div>
      <label>Tags</label>
      <div className="tags">
        {[0, 1].map((i) => (
          <input key={i} list="ops-tag-ideas" placeholder={i === 0 ? 'e.g. DPS' : 'e.g. Crowd-Control'} value={d.tags[i] ?? ''}
            onChange={(e) => up((dd) => { const t = [...dd.tags]; t[i] = e.target.value; dd.tags = t })} />
        ))}
        <datalist id="ops-tag-ideas">{TAG_IDEAS.map((t) => <option key={t} value={t} />)}</datalist>
      </div>
      {c.ak.opSkills.length > 0 && (
        <>
          <label>Skill icons <small>click to use your own picture</small></label>
          <div className="icons">
            {c.ak.opSkills.map((sk) => <span key={sk.id} title={sk.name}><SkillIconPick s={sk} size={48} /><small>{sk.name || sk.tier}</small></span>)}
          </div>
        </>
      )}
      <label>Rarity</label>
      <div className="presets">
        <button className={!d.stars ? 'on' : ''} onClick={() => up((dd) => { dd.stars = 0 })}>By level ({levelStars(c.level)}★)</button>
        {[1, 2, 3, 4, 5, 6].map((n) => <button key={n} className={d.stars === n ? 'on' : ''} onClick={() => up((dd) => { dd.stars = n })}>{n}★</button>)}
      </div>
    </div>
  )
}
