import { useEffect, useState } from 'react'
import { reminders, setNotify } from '../lib/reminders'
import { iosNeedsHomeScreen, notifyPermission, showNotice } from '../lib/notify'
import { exportReminderCalendar } from '../lib/ics'
import { toast } from '../lib/fx'

/** One obvious place to switch reminders on. Used on Home (until set up) and in Settings. */
export default function NotifyCard({ compact = false }: { compact?: boolean }) {
  const rem = reminders.use()
  const [perm, setPerm] = useState(notifyPermission())
  useEffect(() => {
    const f = () => setPerm(notifyPermission())
    addEventListener('focus', f)
    document.addEventListener('visibilitychange', f)
    return () => {
      removeEventListener('focus', f)
      document.removeEventListener('visibilitychange', f)
    }
  }, [])
  const ios = iosNeedsHomeScreen()
  const on = rem.notify && perm === 'granted'

  const turnOn = async () => {
    if (perm === 'unsupported') return toast('This browser cannot show notifications. Use "Add to my calendar" below.')
    const p = perm === 'granted' ? 'granted' : await Notification.requestPermission()
    setPerm(p)
    if (p !== 'granted') return toast('Notifications are blocked. See the steps below to allow them.')
    setNotify(true)
    const ok = await showNotice('Healthy Lifestyle', 'Reminders are on. You will get them when you open the app.', { tag: 'hl-test' })
    toast(ok ? 'Reminders on' : 'Permission granted, but the test did not show. Try again after reopening the app.', { tone: ok ? 'win' : undefined })
  }
  const calendar = async () => {
    const n = await exportReminderCalendar()
    toast(`Calendar file ready (${n} reminders). Open it and tap Add All.`, { tone: 'win' })
  }

  return (
    <section className={`card notify-card ${on ? 'is-on' : ''}`} id="reminders">
      <h2>🔔 Reminders {on && <span className="pill ok">On</span>}</h2>

      <div className="nc-block">
        <h3>1. Phone calendar alerts <small>(best: work even when the app is closed)</small></h3>
        <p>Adds weigh-ins, paydays, bills, French practice and bookings to your phone's Calendar, which buzzes you at the right time.</p>
        <button className="big-btn" onClick={calendar}>📅 Add reminders to my calendar</button>
        {!compact && <p className="muted small">Re-add after you change bills or paydays. If your calendar asks, choose Add All.</p>}
      </div>

      <div className="nc-block">
        <h3>2. App notifications <small>(when you open the app)</small></h3>
        {ios ? (
          <ol className="steps">
            <li>Open this page in <b>Safari</b>.</li>
            <li>Tap <b>Share</b> (square with an arrow), then <b>Add to Home Screen</b>.</li>
            <li>Open <b>Healthy</b> from the new Home Screen icon and come back here to turn notifications on.</li>
          </ol>
        ) : on ? (
          <div className="row gap wrap">
            <button className="big-btn ghost" onClick={() => showNotice('Test reminder', 'This is how reminders will look.', { tag: 'hl-test' }).then((ok) => !ok && toast('Could not show a notification. Check phone settings.'))}>Send a test</button>
            <button className="big-btn ghost" onClick={() => setNotify(false)}>Turn off</button>
          </div>
        ) : perm === 'denied' ? (
          <ol className="steps">
            <li>Notifications are blocked for this site.</li>
            <li><b>Android:</b> tap the lock or ⋮ next to the address, then Permissions, Notifications, Allow. Installed app: long-press the icon, App info, Notifications.</li>
            <li><b>iPhone:</b> Settings, Notifications, Healthy, Allow Notifications.</li>
          </ol>
        ) : (
          <button className="big-btn" onClick={turnOn}>Turn on notifications</button>
        )}
      </div>
    </section>
  )
}
