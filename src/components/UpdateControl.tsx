import { useEffect, useState } from 'react'
import type { UpdateState } from '../store'

/*
 * Checking for, downloading and installing a new version from the GitHub Releases page, from inside the app
 * (it also checks by itself at start-up). On the Characters screen (compact) and in Settings.
 */
export function UpdateControl({ compact = false }: { compact?: boolean }) {
  const api = window.sheetApi
  const [s, setS] = useState<UpdateState | null>(null)
  const [version, setVersion] = useState('')
  useEffect(() => {
    if (!api?.updateState) return
    api.appVersion().then(setVersion)
    api.updateState().then(setS)
    return api.onUpdateStatus(setS)
  }, [api])
  if (!api?.updateState || !s) return null

  const check = () => { setS({ ...s, status: 'checking', error: '' }); api.checkUpdate().then(setS) }
  const install = () => api.installUpdate()
  const label =
    s.status === 'checking' ? 'Checking…'
      : s.status === 'downloading' ? `Downloading ${s.latest}… ${s.percent ? s.percent + '%' : ''}`
        : s.status === 'current' ? 'Up to date'
          : s.status === 'error' ? "Couldn't check"
            : s.status === 'dev' ? 'Updates work in the installed app' : ''

  const button = s.status === 'ready'
    ? <button className="btn primary" onClick={install} title={`Close, install version ${s.latest} and reopen`}>⟳ Restart to update to {s.latest}</button>
    : <button className="btn" disabled={s.status === 'checking' || s.status === 'downloading' || s.status === 'dev'} onClick={check}
        title={`You have version ${version}. Check GitHub for a newer one${s.error ? `\n\nLast time: ${s.error}` : ''}`}>
        {s.status === 'checking' || s.status === 'downloading' ? label : '⟳ Check for updates'}
      </button>

  if (compact) {
    return (
      <span className="update-ctl" title={s.status === 'error' ? s.error : undefined}>
        {button}
        {(s.status === 'current' || s.status === 'error') && <span className={`small ${s.status === 'error' ? 'bad' : 'muted'}`}>{label}</span>}
      </span>
    )
  }
  return (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      <span className="small">Version {version}</span>
      {button}
      {s.status !== 'checking' && s.status !== 'downloading' && label && <span className={`small ${s.status === 'error' ? 'bad' : 'muted'}`}>{label}{s.status === 'error' && s.error ? `: ${s.error}` : ''}</span>}
      {s.status === 'ready' && <span className="small muted">Your characters are kept.</span>}
    </div>
  )
}
