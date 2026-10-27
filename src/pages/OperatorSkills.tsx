import { Fragment, useMemo, useRef, useState } from 'react'
import { spLimits } from '../calc'
import { newOpSkill } from '../blank'
import { activateOp, endOp, gainSp } from '../ak'
import { CHARGING, fromOpLib, OP_CLASSES, OP_LIB, searchOp, TIERS, type LibOpSkill } from '../opSkillLib'
import { imageToDataUrl, useChar, useStore } from '../store'
import { Frame, Modal, Num, Toast, useToast } from '../components/ui'
import { RichArea, RichText } from '../components/RichText'
import type { OperatorSkill, SkillTier } from '../types'

const ACTIVATIONS = ['Action', 'Bonus Action', 'Reaction', 'No Action', 'Special']

/** SP counter with quick charge buttons and the running skill. Also shown on the Overview. */
export function SpTracker({ onMsg }: { onMsg: (m: string) => void }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const lim = spLimits(c)
  const active = c.ak.opSkills.find((s) => s.id === c.ak.activeSkill)
  const pct = lim.max ? Math.min(100, (c.ak.sp / lim.max) * 100) : 0
  const charges = Array.from(new Set(c.ak.opSkills.map((s) => s.charging).filter(Boolean)))
  return (
    <div className="sp-tracker">
      <div className="sp-num">
        <Num min={0} max={lim.max || 999} value={c.ak.sp} onChange={(n) => patch((d) => { d.ak.sp = n })} />
        <span>/ {lim.max || '—'}</span>
        <label>Skill Points</label>
      </div>
      <div className="grow col" style={{ gap: 5, minWidth: 0 }}>
        <div className={`sp-bar ${lim.max && c.ak.sp >= lim.max ? 'full' : ''}`}><i style={{ width: pct + '%' }} /></div>
        <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
          <button className="btn sm" title="Spend / lose 1 SP" onClick={() => onMsg(gainSp(c, -1))}>−1</button>
          <button className="btn sm" onClick={() => onMsg(gainSp(c, 1))}>+1</button>
          <button className="btn sm" onClick={() => onMsg(gainSp(c, 2))}>+2</button>
          <span className="muted small">start SP {lim.start} · charging: {charges.join(', ') || '—'}</span>
        </div>
      </div>
      {active && (
        <div className="sp-active">
          <span className="field-lbl">Active</span>
          <b>{active.name || 'Operator Skill'}</b>
          {active.duration && <span className="muted small">{active.duration}</span>}
          <button className="btn sm" onClick={endOp}>End</button>
        </div>
      )}
    </div>
  )
}

/** Square picture for a skill: click to choose your own image, ✕ to remove it. */
export function SkillIconPick({ s, size = 44 }: { s: OperatorSkill; size?: number }) {
  const patch = useStore((st) => st.patch)
  const input = useRef<HTMLInputElement>(null)
  const set = (icon: string) => patch((d) => { const x = d.ak.opSkills.find((y) => y.id === s.id); if (x) x.icon = icon })
  return (
    <span className="skill-icon-pick" style={{ width: size, height: size }}>
      <input ref={input} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (f) set(await imageToDataUrl(f, 256, true))
      }} />
      <button className="sip" title={s.icon ? 'Change icon' : 'Add your own icon'} onClick={() => input.current?.click()}
        style={s.icon ? { backgroundImage: `url("${s.icon}")` } : undefined}>{s.icon ? '' : '＋'}</button>
      {s.icon && <button className="sip-x" title="Remove icon" onClick={() => set('')}>✕</button>}
    </span>
  )
}

function OpCard({ s, onMsg }: { s: OperatorSkill; onMsg: (m: string) => void }) {
  const c = useChar()
  const patch = useStore((st) => st.patch)
  const [edit, setEdit] = useState(!s.name)
  const up = (fn: (x: OperatorSkill) => void) => patch((d) => { const x = d.ak.opSkills.find((y) => y.id === s.id); if (x) fn(x) })
  const isActive = c.ak.activeSkill === s.id
  const ready = c.ak.sp >= s.spCost
  return (
    <div className={`op-card ${isActive ? 'active' : ''} ${ready ? 'ready' : ''}`}>
      {edit ? (
        <div className="col" style={{ gap: 6 }}>
          <div className="row">
            <SkillIconPick s={s} />
            <input className="box-input grow" autoFocus placeholder="Skill name" value={s.name} onChange={(e) => up((x) => { x.name = e.target.value })} />
            <select value={s.tier} onChange={(e) => up((x) => { x.tier = e.target.value as SkillTier })}>
              {TIERS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="op-grid">
            <label><span className="field-lbl">SP cost</span><Num min={0} className="box-input" value={s.spCost} onChange={(n) => up((x) => { x.spCost = n })} /></label>
            <label><span className="field-lbl">Start SP</span><Num min={0} className="box-input" value={s.startSp} onChange={(n) => up((x) => { x.startSp = n })} /></label>
            <label><span className="field-lbl">Charging</span>
              <select value={s.charging} onChange={(e) => up((x) => { x.charging = e.target.value })}>
                {[...new Set([s.charging, 'Automatic', 'Offensive', 'Defensive'])].map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <label><span className="field-lbl">Activation</span>
              <input className="box-input" list="op-acts" value={s.activation} onChange={(e) => up((x) => { x.activation = e.target.value })} />
            </label>
            <label><span className="field-lbl">Duration</span><input className="box-input" placeholder="Instant, 3 Rounds…" value={s.duration} onChange={(e) => up((x) => { x.duration = e.target.value })} /></label>
          </div>
          <RichArea className="box-input" minRows={3} placeholder="Effect" value={s.effect} onChange={(v) => up((x) => { x.effect = v })} />
          <div className="row">
            <button className="btn sm primary" onClick={() => setEdit(false)}>✓ Done</button>
            <span className="grow" />
            <button className="btn sm danger" onClick={() => { if (window.confirm(`Remove ${s.name || 'this skill'}?`)) patch((d) => { d.ak.opSkills = d.ak.opSkills.filter((y) => y.id !== s.id); if (d.ak.activeSkill === s.id) d.ak.activeSkill = '' }) }}>Delete</button>
          </div>
        </div>
      ) : (
        <>
          <div className="op-head">
            {s.icon && <span className="op-icon" style={{ backgroundImage: `url("${s.icon}")` }} />}
            <b className="op-name">{s.name || 'Unnamed skill'}</b>
            <span className="grow" />
            {isActive
              ? <button className="btn sm" onClick={endOp}>End</button>
              : <button className="btn sm primary" disabled={!ready} title={ready ? 'Spend SP and activate' : `Needs ${s.spCost} SP`} onClick={() => onMsg(activateOp(c, s.id))}>Activate</button>}
            <button className="btn icon sm ghost" title="Edit" onClick={() => setEdit(true)}>✎</button>
          </div>
          <div className="op-stats">
            <span><i>SP</i>{s.spCost}</span>
            <span><i>Start</i>{s.startSp}</span>
            <span title={CHARGING[s.charging] ?? ''}><i>Charge</i>{s.charging}</span>
            <span><i>Use</i>{s.activation}</span>
            <span><i>Lasts</i>{s.duration || '—'}</span>
          </div>
          <RichText className="prose small-prose" value={s.effect} />
        </>
      )}
    </div>
  )
}

function Picker({ tier, onClose }: { tier: SkillTier; onClose: () => void }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const guess = OP_CLASSES.find((k) => c.className.toLowerCase().includes(k.toLowerCase())) ?? ''
  const [q, setQ] = useState('')
  const [cls, setCls] = useState(guess)
  const [t, setT] = useState<string>(tier === 'other' ? '' : tier)
  const list = useMemo(() => searchOp(q, cls, t), [q, cls, t])
  const have = (s: LibOpSkill) => c.ak.opSkills.some((x) => x.name.toLowerCase() === s.n.toLowerCase())
  return (
    <Modal title="Operator Skills from the book" wide onClose={onClose}>
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
        <input className="box-input" style={{ width: 220 }} autoFocus placeholder="search name or effect…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={cls} onChange={(e) => setCls(e.target.value)}><option value="">Any class / branch</option>{OP_CLASSES.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={t} onChange={(e) => setT(e.target.value)}><option value="">Any tier</option>{TIERS.slice(0, 3).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <span className="muted small">{list.length} skills</span>
      </div>
      <div className="op-pick-list">
        {list.map((s, i) => (
          <div key={s.cls + s.tier + s.n + i} className="op-card">
            <div className="op-head">
              <b className="op-name">{s.n}</b>
              <span className="tag alt">{s.cls} · {s.tier}</span>
              <span className="grow" />
              {have(s) ? <span className="muted small">added ✓</span> : (
                <button className="btn sm primary" onClick={() => patch((d) => { d.ak.opSkills.push(fromOpLib(s, tier === 'other' ? undefined : tier)) })}>Add</button>
              )}
            </div>
            <div className="op-stats">
              <span><i>SP</i>{s.sp}</span><span><i>Start</i>{s.start}</span><span><i>Charge</i>{s.charge}</span><span><i>Use</i>{s.act}</span><span><i>Lasts</i>{s.dur}</span>
            </div>
            <div className="prose small-prose">{s.t}</div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export function OperatorSkillsPage() {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const toast = useToast()
  const [pick, setPick] = useState<SkillTier | null>(null)
  const msg = (m: string) => m && toast.show(m)
  const tiers = TIERS.filter((t) => t.id !== 'other' || c.ak.opSkills.some((s) => s.tier === 'other'))
  return (
    <div className="col" style={{ gap: 14 }}>
      <Frame title="Skill Points">
        <SpTracker onMsg={msg} />
      </Frame>
      <datalist id="op-acts">{ACTIVATIONS.map((a) => <option key={a} value={a} />)}</datalist>
      <div className="op-tiers">
        {tiers.map((t) => {
          const list = c.ak.opSkills.filter((s) => s.tier === t.id)
          return (
            <Frame key={t.id} title={`${t.name} Skill`} className="op-tier"
              tools={
                <>
                  {OP_LIB.length > 0 && <button className="btn sm" onClick={() => setPick(t.id)}>From book…</button>}
                  <button className="btn sm" onClick={() => patch((d) => { d.ak.opSkills.push(newOpSkill(t.id)) })}>＋ New</button>
                </>
              }>
              <div className="muted small" style={{ marginBottom: 6 }}>{t.level}</div>
              {list.length === 0 && <div className="empty">No {t.name.toLowerCase()} skill yet.</div>}
              {list.map((s) => <OpCard key={s.id} s={s} onMsg={msg} />)}
            </Frame>
          )
        })}
      </div>
      <Frame title="How Operator Skills work" tight>
        <div className="prose small-prose">
          {`Max SP is the highest SP cost among your skills. After a long rest you're topped up to your highest Start SP. Only one skill can be active at a time, and you gain no SP while one is active (or from what an active skill does).`}
        </div>
        <div className="kv" style={{ marginTop: 6 }}>
          {Object.entries(CHARGING).map(([k, v]) => <Fragment key={k}><b>{k}</b><span>{v}</span></Fragment>)}
        </div>
        {OP_LIB.length === 0 && (
          <div className="muted small" style={{ marginTop: 8 }}>
            Run <code>python tools/import_ak5e.py</code> to load every Operator Skill table from the AK5e book, then pick them with "From book…".
          </div>
        )}
      </Frame>
      {pick && <Picker tier={pick} onClose={() => setPick(null)} />}
      <Toast msg={toast.msg} />
    </div>
  )
}
