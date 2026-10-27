import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { activeEffects, attackInfo, damageReduction, itemAttacks, martialDc, profBonus, signed, spellStats, spLimits, statInfo } from '../calc'
import { activateOp } from '../ak'
import { useChar, useUI } from '../store'
import { Toast, useToast } from './ui'
import type { SkillTier } from '../types'

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
const rarity = (lvl: number) => Math.min(6, 2 + Math.ceil(Math.max(1, lvl) / 5))
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
  const range = atk?.a.range || (atk ? 'Melee' : '—')
  const ranged = /\d/.test(range) && !/^5\b/.test(range)
  const talents = c.features.filter((f) => f.category === 'class' || f.category === 'species').slice(0, 3)
  const tags = [c.className || 'Operator', ranged ? 'Ranged' : 'Melee', c.ak.infected ? 'Infected' : '', c.species].filter(Boolean)
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
      </div>

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
        <div className="ops-stars">{'★'.repeat(rarity(c.level))}</div>
        <div className="ops-name" style={{ fontSize: `${Math.min(13, 92 / Math.max(5, (c.name || 'Operator').length))}vh` }}>{c.name || 'Operator'}</div>
        <div className="ops-class">
          <div className="ops-classbox" title={c.className}>{(c.className || '?').slice(0, 1)}</div>
          <div className="ops-range"><b>{range}</b><span>Range</span></div>
          <div className="ops-tags">{tags.slice(0, 2).map((t) => <span key={t}>{t}</span>)}</div>
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
              <button key={t} className={`ops-skill ${s ? '' : 'none'} ${active ? 'active' : ''} ${locked ? 'locked' : ''}`}
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
            <div className="ico">{(c.subclass || c.className || '?').slice(0, 1)}</div>
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
