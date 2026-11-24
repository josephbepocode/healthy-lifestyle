import { useEffect, useState } from 'react'
import Home from './screens/Home'
import Meals from './screens/Meals'
import Workouts from './screens/Workouts'
import Progress from './screens/Progress'
import Tasks from './screens/Tasks'
import Time from './screens/Time'
import MoneyTab from './screens/BillsCard'
import Shopping from './screens/Shopping'
import Habits from './screens/Habits'
import Study from './screens/Study'
import Review from './screens/Review'
import Settings from './screens/Settings'
import Palette, { type Nav } from './components/Palette'
import RestTimer from './components/RestTimer'
import { Confetti, Toaster } from './components/ui'
import { ModalHost } from './components/Recipe'
import { openIdeas } from './lib/fx'
import { useApp } from './lib/store'
import { trackTasks } from './lib/review'
import { activeReminders, reminders } from './lib/reminders'
import { todayStr } from './lib/util'
import { showNotice } from './lib/notify'


const TABS: (Nav & { more?: boolean; hint?: string })[] = [
  { id: 'today', label: 'Home', icon: '🏠', key: '1' },
  { id: 'meals', label: 'Food', icon: '🍽', key: '2' },
  { id: 'workouts', label: 'Workout', icon: '🏋', key: '3' },
  { id: 'progress', label: 'Weight & progress', icon: '📈', key: '4', more: true, hint: 'Weigh-ins and charts' },
  { id: 'habits', label: 'Water & sleep', icon: '💧', key: '5', more: true, hint: 'Daily habits' },
  { id: 'shopping', label: 'Shopping list', icon: '🛒', key: '8', more: true, hint: 'Groceries and prices' },
  { id: 'study', label: 'French & study', icon: '📚', key: '6', more: true, hint: 'Study time, CELPIP' },
  { id: 'money', label: 'Money & bills', icon: '💵', key: '7', more: true, hint: 'Paycheck plan, bills' },
  { id: 'tasks', label: 'Tasks', icon: '✓', key: '9', more: true, hint: 'To-do list' },
  { id: 'time', label: 'Time tracker', icon: '⏱', key: '0', more: true, hint: 'Timers' },
  { id: 'review', label: 'Weekly review', icon: '🗓', key: 'r', more: true, hint: 'How the week went' },
  { id: 'settings', label: 'Reminders & settings', icon: '🔔', key: ',', more: true, hint: 'Notifications, backup' },
]
type Tab = string
const ALL = new Set(TABS.map((t) => t.id))
const fromHash = (): Tab => {
  const h = location.hash.replace('#', '')
  return ALL.has(h) ? h : 'today'
}
function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(fromHash)
  const [pal, setPal] = useState(false)
  const [more, setMore] = useState(false)
  const s = useApp()
  const rem = reminders.use()
  const go = (t: string) => {
    location.hash = t
    setTab(t)
    setMore(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  useEffect(() => {
    const off = trackTasks()
    return () => void off()
  }, [])
  useEffect(() => {
    const h = () => setTab(fromHash())
    addEventListener('hashchange', h)
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPal((p) => !p)
        return
      }
      const el = e.target as HTMLElement
      if (el?.matches?.('input,textarea,select') || e.metaKey || e.ctrlKey || e.altKey || document.body.classList.contains('modal-open')) return
      const t = TABS.find((x) => x.key === e.key)
      if (t) go(t.id)
      if (e.key === '?' || e.key === 'e') openIdeas()
      if (e.key === '+' || e.key === '=') setPal(true)
    }
    addEventListener('keydown', k)
    return () => {
      removeEventListener('hashchange', h)
      removeEventListener('keydown', k)
    }
  }, [])
  // Reminder notifications. A web app with no push server can only check when it is opened or brought
  // back to the front, so we check on open, on every return to the app, and once a minute while open.
  // Uses the service worker (registration.showNotification): phones reject `new Notification()`.
  useEffect(() => {
    if (!rem.notify) return
    let busy = false
    const run = async () => {
      if (busy || document.visibilityState !== 'visible' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      busy = true
      try {
        const day = todayStr()
        const seen = reminders.get().notified
        const fresh = activeReminders(day).filter((r) => seen[r.id] !== day).slice(0, 3)
        const shown: string[] = []
        for (const r of fresh) if (await showNotice(`${r.icon} ${r.title}`, r.body, { tag: r.id, go: r.go })) shown.push(r.id)
        if (shown.length) reminders.set((x) => ({ ...x, notified: { ...x.notified, ...Object.fromEntries(shown.map((id) => [id, day])) } }))
      } finally {
        busy = false
      }
    }
    run()
    const t = setInterval(run, 60000)
    document.addEventListener('visibilitychange', run)
    addEventListener('focus', run)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', run)
      removeEventListener('focus', run)
    }
  }, [rem.notify])

  const main = TABS.filter((t) => !t.more)
  const moreTabs = TABS.filter((t) => t.more)
  const onMore = moreTabs.some((t) => t.id === tab)
  const nOpen = activeReminders().length
  const date = new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="app v2">
      <div className="bg" aria-hidden>
        <i className="blob b1" />
        <i className="blob b2" />
        <i className="blob b3" />
        <i className="grain" />
      </div>
      <header className="topbar">
        <button className="tb-brand" onClick={() => go('today')} aria-label="Home">
          <span className="logo" aria-hidden />
          <span className="tb-text"><small>{date}</small><b>{greeting()}, <span className="acc">Deji</span></b></span>
        </button>
        <div className="tb-actions">
          {s.activeTimer && <button className="live" onClick={() => go('time')}><i className="pulse-dot" /> Timer</button>}
          <button className="tb-bell" onClick={() => go('settings')} aria-label={`Reminders (${nOpen} today)`}>🔔{nOpen > 0 && <i>{nOpen}</i>}</button>
        </div>
      </header>

      <main key={tab} className="main">
        {tab === 'today' && <Home go={go} />}
        {tab === 'meals' && <Meals />}
        {tab === 'workouts' && <Workouts />}
        {tab === 'progress' && <Progress />}
        {tab === 'habits' && <Habits />}
        {tab === 'study' && <Study />}
        {tab === 'money' && <MoneyTab />}
        {tab === 'shopping' && <Shopping />}
        {tab === 'tasks' && <Tasks />}
        {tab === 'time' && <Time />}
        {tab === 'review' && <Review />}
        {tab === 'settings' && <Settings />}
      </main>

      <nav className="dock simple-dock" aria-label="Main">
        {main.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <span className="ni" aria-hidden>{t.icon}</span>
            <span className="nl">{t.label}</span>
          </button>
        ))}
        <button className={onMore ? 'on' : ''} onClick={() => setMore((m) => !m)} aria-expanded={more} aria-haspopup="dialog">
          <span className="ni" aria-hidden>☰</span>
          <span className="nl">{onMore ? TABS.find((t) => t.id === tab)?.label.split(' ')[0] : 'More'}</span>
        </button>
      </nav>
      {more && (
        <div className="more-ov" onMouseDown={(e) => e.target === e.currentTarget && setMore(false)}>
          <div className="more-sheet simple-more" role="dialog" aria-label="More">
            <div className="more-grab" aria-hidden />
            <div className="more-list">
              {moreTabs.map((t) => (
                <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
                  <span className="ni" aria-hidden>{t.icon}</span>
                  <span><b>{t.label}</b><small>{t.hint}</small></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {pal && <Palette tabs={TABS} go={go} onClose={() => setPal(false)} />}
      <RestTimer />
      <ModalHost />
      <Toaster />
      <Confetti />
    </div>
  )
}
