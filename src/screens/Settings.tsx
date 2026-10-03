import { useRef, useState } from 'react'
import { Modal, Tilt } from '../components/ui'
import { applyBackup, dataKeys, downloadBackup, parseBackup, resetEverything, storageBytes } from '../lib/backup'
import { reminders, setNotify } from '../lib/reminders'
import { toast } from '../lib/fx'

type Parsed = ReturnType<typeof parseBackup>

export default function Settings() {
  const rem = reminders.use()
  const file = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [fileName, setFileName] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetText, setResetText] = useState('')
  const keys = dataKeys()
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'

  const pick = async (f?: File) => {
    if (!f) return
    setFileName(f.name)
    setParsed(parseBackup(await f.text()))
  }
  const toggleNotify = async (on: boolean) => {
    if (!on) return setNotify(false)
    if (typeof Notification === 'undefined') return toast('This browser does not support notifications.')
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (p === 'granted') {
      setNotify(true)
      new Notification('Healthy Lifestyle', { body: 'Reminders on — you’ll see these while the app is open.' })
    } else toast('Notifications were blocked in the browser settings.')
  }
  return (
    <div className="screen">
      <header className="page-head"><div><p className="eyebrow">Data &amp; app</p><h1>Settings</h1></div></header>
      <div className="bento b-settings">
        <Tilt className="se-backup">
          <div className="card-head"><h2>💾 Backup &amp; move devices</h2></div>
          <p className="honest"><b>Your data lives only in this browser on this device.</b> There is no account and no server, so nothing syncs automatically between your phone and laptop. To move data, <b>export a file here, then import it on the other device</b> (send yourself the file by email, AirDrop or cloud drive). Clearing browser data deletes it — export now and then as a backup.</p>
          <div className="row gap wrap">
            <button className="btn primary" onClick={() => toast(`Exported ${downloadBackup()} data sets`, { tone: 'win' })}>⬇ Export all data</button>
            <button className="btn" onClick={() => file.current?.click()}>⬆ Import a backup…</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
          </div>
          <p className="hint">{keys.length} data sets on this device · about {(storageBytes() / 1024).toFixed(0)} KB. Export is one JSON file with every <code>healthy-*</code> key.</p>
          <ul className="keys">{keys.map((k) => <li key={k}>{k}</li>)}</ul>
        </Tilt>
        <Tilt className="se-notify">
          <div className="card-head"><h2>🔔 Reminders</h2></div>
          <label className="todo big"><input type="checkbox" checked={rem.notify && perm === 'granted'} onChange={(e) => toggleNotify(e.target.checked)} /><span className="box" aria-hidden /><span className="todo-text">Browser notifications while the app is open<small>Permission: {perm}</small></span></label>
          <p className="honest">Honest limit: a web app can only show notifications <b>while it is open</b> in a tab. To get alerts when it is closed you’d need a push server, which this app doesn’t have. On a phone, “Add to Home Screen” (the app is installable) makes it open like an app, but it still can’t wake itself to remind you. The reminder cards on the Today screen always work.</p>
        </Tilt>
        <Tilt className="se-reset">
          <div className="card-head"><h2>⚠️ Reset</h2></div>
          <p className="honest">Deletes <b>all</b> data on this device (meals, workouts, weigh-ins, money, shopping, habits, study…). Export a backup first if you might want it back.</p>
          <button className="btn danger" onClick={() => { setResetText(''); setConfirmReset(true) }}>Reset everything…</button>
        </Tilt>
      </div>
      {parsed && (
        <Modal title="Import backup" wide onClose={() => setParsed(null)}>
          {!parsed.ok ? (
            <div className="stack gap"><p className="honest bad">{parsed.error}</p><button className="btn" onClick={() => setParsed(null)}>Close</button></div>
          ) : (
            <div className="stack gap">
              <p className="muted small">{fileName}{parsed.exportedAt ? ` · exported ${new Date(parsed.exportedAt).toLocaleString()}` : ''}</p>
              <p className="honest">Importing <b>replaces</b> the data sets below on this device. Data sets that aren’t in the file are left alone. The page reloads afterwards.</p>
              <table className="prev"><thead><tr><th>Data set</th><th>Action</th><th>On this device now</th><th>In the file</th></tr></thead>
                <tbody>{parsed.rows.map((r) => <tr key={r.key}><td>{r.key}</td><td className={r.status}>{r.status === 'replace' ? 'REPLACE' : 'add'}</td><td>{r.now}</td><td>{r.incoming}</td></tr>)}</tbody></table>
              <div className="row gap end"><button className="btn ghost" onClick={() => setParsed(null)}>Cancel</button><button className="btn primary" onClick={() => applyBackup(parsed.keys)}>Replace &amp; reload</button></div>
            </div>
          )}
        </Modal>
      )}
      {confirmReset && (
        <Modal title="Reset everything?" onClose={() => setConfirmReset(false)}>
          <div className="stack gap"><p className="honest bad">This permanently deletes all {keys.length} data sets on this device. Type <b>RESET</b> to confirm.</p>
            <input value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="RESET" aria-label="Type RESET" />
            <div className="row gap end"><button className="btn ghost" onClick={() => setConfirmReset(false)}>Cancel</button><button className="btn danger" disabled={resetText.trim() !== 'RESET'} onClick={resetEverything}>Delete everything</button></div></div>
        </Modal>
      )}
    </div>
  )
}
