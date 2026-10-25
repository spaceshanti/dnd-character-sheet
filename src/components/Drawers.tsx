import { useEffect, useState } from 'react'
import { ACTION_TYPES } from '../constants'
import { isConsumed, newFeature, uid } from '../blank'
import { ammoOptions, ammoText, useItem } from '../consume'
import { toCustom } from '../spellLib'
import { findLib, applyLib } from '../spellLib'
import { useChar, useStore, useUI } from '../store'
import { Drawer, EffectsEditor, Num, Select, Switch, useToast, Toast } from './ui'
import { RichArea, RichText } from './RichText'
import { FeatureChangesEditor, FeatureUsage, FeatureUsageEditor } from './FeatureParts'
import { targetName } from '../constants'
import type { Effect, Feature, FeatureCategory, Spell } from '../types'

export function DrawerHost() {
  const drawer = useUI((s) => s.drawer)
  if (!drawer) return null
  return drawer.kind === 'spell' ? <SpellDrawer id={drawer.id} /> : <FeatureDrawer id={drawer.id} />
}

function EffectSummary({ effects }: { effects: Effect[] }) {
  if (!effects.length) return null
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 5 }}>
      {effects.map((e) => (
        <span key={e.id} className={`chip ${e.type === 'advantage' ? 'adv' : e.type === 'disadvantage' ? 'dis' : 'accent'}`}>
          {targetName(e.target)}: {e.type === 'bonus' ? (e.value ?? 0) >= 0 ? `+${e.value ?? 0}` : e.value : e.type === 'minScore' ? `≥ ${e.value}` : e.type}
          {e.note ? ` (${e.note})` : ''}
        </span>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ spells */

export function SpellDrawer({ id }: { id: string }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const customSpells = useStore((s) => s.customSpells)
  const saveCustomSpell = useStore((s) => s.saveCustomSpell)
  const set = useUI((s) => s.set)
  const sp = c.spells.find((s) => s.id === id)
  const [editing, setEditing] = useState(() => !sp?.name)
  const [busy, setBusy] = useState(false)
  const [fetchMsg, setFetchMsg] = useState('')
  const toast = useToast()
  const [castLevel, setCastLevel] = useState(sp?.level || 1)
  useEffect(() => { if (sp) setCastLevel(Math.max(1, sp.level)) }, [sp?.level])
  if (!sp) return null

  const up = (fn: (s: Spell) => void) => patch((d) => { const x = d.spells.find((y) => y.id === id); if (x) fn(x) })
  const close = () => set({ drawer: null })
  const matches = findLib(sp.name).filter((m) => !m.stub)

  const fetchRemote = async () => {
    setFetchMsg('')
    if (!window.sheetApi) { setFetchMsg('Fetching from wikidot only works in the desktop app. Paste the description manually instead.'); return }
    setBusy(true)
    const r = await window.sheetApi.fetchSpell(sp.url || sp.name)
    setBusy(false)
    if (r.error) { setFetchMsg(`${r.error} You can always paste the description yourself.`); return }
    if (sp.description.trim() && !window.confirm('Replace the stored description with the fetched one?')) return
    up((x) => {
      if (r.name && !x.name) x.name = r.name
      if (r.url) x.url = r.url
      if (r.level != null) x.level = r.level
      if (r.school) x.school = r.school[0].toUpperCase() + r.school.slice(1)
      if (r.castingTime) x.castingTime = r.castingTime
      if (r.range) x.range = r.range
      if (r.components) { x.components = r.components; x.materialConsumed = isConsumed(r.components) }
      if (r.duration) x.duration = r.duration
      x.concentration = !!r.concentration
      x.ritual = !!r.ritual
      if (r.description) x.description = r.description
    })
    setFetchMsg('Fetched ✓')
  }

  const cast = () => {
    const ammo = sp.ammoId ? c.items.find((i) => i.id === sp.ammoId) : undefined
    if (sp.ammoId && (!ammo || ammo.qty < sp.ammoCost)) { toast.show(ammo ? `Out of ${ammo.name}!` : 'Its linked item is gone. Pick another in Edit.'); return }
    if (sp.level > 0) {
      const slot = c.slots[castLevel]
      if (!slot || slot.total - slot.used <= 0) { toast.show(`No level ${castLevel} slots left`); return }
      patch((d) => { d.slots[castLevel].used += 1 })
    }
    const used = sp.ammoId ? useItem(c, sp.ammoId, sp.ammoCost, sp.name) : ''
    toast.show(used || (sp.level > 0 ? `Cast ${sp.name} using a level ${castLevel} slot` : `${sp.name} cast`))
  }
  const libEntry = customSpells.find((x) => x.n.toLowerCase() === sp.name.toLowerCase())

  const levelOptions = Array.from({ length: 10 }, (_, i) => ({ id: String(i), name: i === 0 ? 'Cantrip' : `Level ${i}` }))

  return (
    <Drawer
      title={sp.name || 'New spell'}
      onClose={close}
      tools={
        <>
          <button className="btn sm" onClick={() => setEditing(!editing)}>{editing ? '✓ Done' : '✎ Edit'}</button>
        </>
      }
    >
      {!editing ? (
        <div className="col" style={{ gap: 12 }}>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span className="tag">{sp.level === 0 ? 'Cantrip' : `Level ${sp.level}`}</span>
            {sp.school && <span className="tag alt">{sp.school}</span>}
            {sp.concentration && <span className="tag alt">Concentration</span>}
            {sp.ritual && <span className="tag alt">Ritual</span>}
            {sp.materialConsumed && <span className="tag alt">Material consumed</span>}
            {sp.alwaysPrepared ? <span className="chip accent">Always prepared</span> : sp.prepared && <span className="chip accent">Prepared</span>}
            {sp.grantedBy && <span className="chip">From {c.features.find((f) => f.id === sp.grantedBy)?.name || 'a feature'}</span>}
          </div>
          <div className="kv">
            {sp.castingTime && <><b>Casting time</b><span>{sp.castingTime}</span></>}
            {sp.range && <><b>Range</b><span>{sp.range}</span></>}
            {sp.components && <><b>Components</b><span>{sp.components}</span></>}
            {sp.duration && <><b>Duration</b><span>{sp.duration}</span></>}
            {sp.ammoId && <><b>Uses up</b><span>{ammoText(c, sp.ammoId, sp.ammoCost) || 'a missing item'} per cast</span></>}
          </div>
          {sp.description ? <RichText className="prose" value={sp.description} /> : (
            <div className="empty">
              No description stored yet.<br />
              <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setEditing(true)}>Paste one in</button>
            </div>
          )}
          {sp.notes && <div><div className="field-lbl">My notes</div><RichText className="prose" value={sp.notes} /></div>}
          {sp.effects.length > 0 && (
            <div className="col">
              <div className="row">
                <Switch on={sp.active} onChange={(b) => up((x) => { x.active = b })} />
                <b>Spell is currently active on me</b>
              </div>
              <EffectSummary effects={sp.effects} />
              <div className="muted small">While on, these bonuses are applied to your sheet.</div>
            </div>
          )}
          <div className="row" style={{ flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            {(sp.level > 0 || sp.ammoId) && (
              <>
                <button className="btn primary" onClick={cast}>Cast</button>
                <span className="small">at level</span>
                <select value={castLevel} onChange={(e) => setCastLevel(+e.target.value)}>
                  {Array.from({ length: 9 - sp.level + 1 }, (_, i) => sp.level + i).map((l) => (
                    <option key={l} value={l}>{l} ({Math.max(0, (c.slots[l]?.total ?? 0) - (c.slots[l]?.used ?? 0))} left)</option>
                  ))}
                </select>
              </>
            )}
            {sp.level > 0 && !sp.alwaysPrepared && (
              <button className="btn" onClick={() => up((x) => { x.prepared = !x.prepared })}>{sp.prepared ? 'Unprepare' : 'Prepare'}</button>
            )}
            {sp.url && <button className="btn" onClick={() => window.sheetApi ? window.sheetApi.openExternal(sp.url) : window.open(sp.url, '_blank')}>Open page ↗</button>}
            {sp.name && (
              <button className="btn" title="Keep this spell in the shared spell library for all your characters"
                onClick={() => { saveCustomSpell(toCustom(sp, libEntry?.id ?? uid())); toast.show(libEntry ? 'Updated in your spell library' : 'Saved to your spell library') }}>
                {libEntry ? 'Update in library' : 'Save to library'}
              </button>
            )}
            <span className="grow" />
            <button className="btn danger" onClick={() => { if (window.confirm(`Remove ${sp.name || 'this spell'}?`)) { close(); patch((d) => { d.spells = d.spells.filter((y) => y.id !== id) }) } }}>Delete</button>
          </div>
        </div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          <div className="row">
            <input className="box-input grow" placeholder="Spell name" value={sp.name} autoFocus onChange={(e) => up((x) => { x.name = e.target.value })} />
            <Select value={String(sp.level)} onChange={(v) => up((x) => { x.level = +v })} options={levelOptions} />
          </div>

          <div className="fx" style={{ borderStyle: 'solid' }}>
            <div className="field-lbl" style={{ marginBottom: 4 }}>Get the description</div>
            <div className="row" style={{ marginBottom: 6 }}>
              <input className="box-input grow" placeholder="wikidot link (optional) — or leave empty to look up by name" value={sp.url} onChange={(e) => up((x) => { x.url = e.target.value })} />
              <button className="btn" disabled={busy} onClick={fetchRemote}>{busy ? 'Fetching…' : 'Fetch'}</button>
            </div>
            {matches.length > 0 && (
              <div className="row small" style={{ marginBottom: 6, flexWrap: 'wrap' }}>
                <span>Built-in library:</span>
                {matches.map((m) => (
                  <button key={m.e + (m.src ?? '')} className="btn sm" onClick={() => {
                    if (sp.description.trim() && !window.confirm('Replace the stored description?')) return
                    up((x) => Object.assign(x, applyLib(x, m)))
                  }}>Use {m.e === 'UA' ? 'UA' : `${m.e} SRD`} text</button>
                ))}
              </div>
            )}
            {fetchMsg && <div className="small" style={{ color: fetchMsg.endsWith('✓') ? 'var(--good)' : 'var(--dis)' }}>{fetchMsg}</div>}
            <div className="muted small">Or just type / paste it below — manually stored text is always kept.</div>
          </div>

          <RichArea className="box-input" minRows={9} placeholder="Spell description (paste it here)" value={sp.description} onChange={(v) => up((x) => { x.description = v })} />

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input className="box-input" placeholder="School" value={sp.school} onChange={(e) => up((x) => { x.school = e.target.value })} />
            <input className="box-input" placeholder="Casting time (1 action, 1 bonus action…)" value={sp.castingTime} onChange={(e) => up((x) => { x.castingTime = e.target.value })} />
            <input className="box-input" placeholder="Range" value={sp.range} onChange={(e) => up((x) => { x.range = e.target.value })} />
            <input className="box-input" placeholder="Duration" value={sp.duration} onChange={(e) => up((x) => { x.duration = e.target.value })} />
          </div>
          <input className="box-input" placeholder="Components (V, S, M (a pinch of salt))" value={sp.components}
            onChange={(e) => up((x) => { x.components = e.target.value; if (isConsumed(e.target.value)) x.materialConsumed = true })} />
          <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
            <label className="row small"><Switch on={sp.concentration} onChange={(b) => up((x) => { x.concentration = b })} /> Concentration</label>
            <label className="row small"><Switch on={sp.ritual} onChange={(b) => up((x) => { x.ritual = b })} /> Ritual</label>
            <label className="row small"><Switch on={sp.materialConsumed} onChange={(b) => up((x) => { x.materialConsumed = b })} /> Material consumed</label>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span className="field-lbl">Uses up an item</span>
            <Select value={sp.ammoId} onChange={(v) => up((x) => { x.ammoId = v })} options={ammoOptions(c)} />
            {sp.ammoId && <><span className="small">×</span><Num min={1} max={20} className="box-input" width={36} value={sp.ammoCost} onChange={(n) => up((x) => { x.ammoCost = n })} /><span className="small">per cast</span></>}
            <label className="row small"><Switch on={sp.prepared} onChange={(b) => up((x) => { x.prepared = b })} /> Prepared</label>
            <label className="row small"><Switch on={sp.alwaysPrepared} onChange={(b) => up((x) => { x.alwaysPrepared = b })} /> Always prepared</label>
          </div>
          <RichArea className="box-input" minRows={2} placeholder="My notes" value={sp.notes} onChange={(v) => up((x) => { x.notes = v })} />
          <div>
            <div className="field-lbl" style={{ marginBottom: 4 }}>What this spell changes on my sheet (e.g. Mage Armor → AC +3)</div>
            <EffectsEditor effects={sp.effects} onChange={(e) => up((x) => { x.effects = e })} />
          </div>
        </div>
      )}
      <Toast msg={toast.msg} />
    </Drawer>
  )
}

/* ---------------------------------------------------------------- features */

const CATS: { id: FeatureCategory; name: string }[] = [
  { id: 'class', name: 'Class feature' },
  { id: 'species', name: 'Species trait' },
  { id: 'feat', name: 'Feat' },
  { id: 'background', name: 'Background' },
  { id: 'buff', name: 'Buff / temporary effect' },
  { id: 'other', name: 'Other' },
]

export function FeatureDrawer({ id }: { id: string }) {
  const c = useChar()
  const patch = useStore((s) => s.patch)
  const set = useUI((s) => s.set)
  const f = c.features.find((x) => x.id === id)
  const [editing, setEditing] = useState(() => !f?.name)
  const toast = useToast()
  if (!f) return null
  const up = (fn: (x: Feature) => void) => patch((d) => { const x = d.features.find((y) => y.id === id); if (x) fn(x) })
  const close = () => set({ drawer: null })
  return (
    <Drawer title={f.name || 'New feature'} onClose={close}
      tools={<button className="btn sm" onClick={() => setEditing(!editing)}>{editing ? '✓ Done' : '✎ Edit'}</button>}>
      {!editing ? (
        <div className="col" style={{ gap: 12 }}>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span className="tag">{CATS.find((x) => x.id === f.category)?.name}</span>
            {f.source && <span className="tag alt">{f.source}</span>}
            {f.actionType !== 'none' && <span className="chip accent">{ACTION_TYPES.find((a) => a.id === f.actionType)?.name}</span>}
          </div>
          <FeatureUsage f={f} onUsed={toast.show} />
          {f.description ? <RichText className="prose" value={f.description} /> : <div className="empty">No description yet.</div>}
          {f.effects.length > 0 && (
            <div className="col">
              <div className="row">
                <Switch on={f.active} onChange={(b) => up((x) => { x.active = b })} />
                <b>{f.active ? 'Applied to my sheet' : 'Switched off'}</b>
              </div>
              <EffectSummary effects={f.effects} />
            </div>
          )}
          <div className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <span className="grow" />
            <button className="btn danger" onClick={() => {
              if (!window.confirm(`Remove ${f.name || 'this feature'}? Spells it grants are removed too; its resources stay under Class Resources.`)) return
              close()
              patch((d) => {
                d.features = d.features.filter((y) => y.id !== id)
                d.spells = d.spells.filter((s) => s.grantedBy !== id)
                for (const r of d.resources) if (r.featureId === id) r.featureId = ''
              })
            }}>Delete</button>
          </div>
        </div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          <input className="box-input" placeholder="Name" autoFocus value={f.name} onChange={(e) => up((x) => { x.name = e.target.value })} />
          <div className="row">
            <Select value={f.category} onChange={(v) => up((x) => { x.category = v })} options={CATS} />
            <input className="box-input grow" placeholder="Source (class, book, item…)" value={f.source} onChange={(e) => up((x) => { x.source = e.target.value })} />
          </div>
          <RichArea className="box-input" minRows={9} placeholder="Description" value={f.description} onChange={(v) => up((x) => { x.description = v })} />
          <div className="row">
            <span className="field-lbl">The feature itself is</span>
            <Select value={f.actionType} onChange={(v) => up((x) => { x.actionType = v })} options={ACTION_TYPES} />
            <span className="muted small">(none if it only gives actions)</span>
          </div>
          <FeatureChangesEditor f={f} />
          <FeatureUsageEditor f={f} />
        </div>
      )}
      <Toast msg={toast.msg} />
    </Drawer>
  )
}

export function addFeature(category: FeatureCategory = 'class') {
  const f = newFeature(category)
  useStore.getState().patch((d) => { d.features.push(f) })
  useUI.getState().set({ drawer: { kind: 'feature', id: f.id } })
}

