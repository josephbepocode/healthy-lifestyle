import { useEffect, useState } from 'react'
import Today from './screens/Today'
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


const TABS: (Nav & { more?: boolean })[] = [
  { id: 'today', label: 'Today', icon: '◉', key: '1' },
  { id: 'meals', label: 'Meals', icon: '🍽', key: '2' },
  { id: 'workouts', label: 'Workouts', icon: '🏋', key: '3' },
  { id: 'progress', label: 'Progress', icon: '📈', key: '4' },
  { id: 'habits', label: 'Habits', icon: '💧', key: '5', more: true },
  { id: 'study', label: 'Study', icon: '📚', key: '6', more: true },
  { id: 'money', label: 'Money', icon: '$', key: '7', more: true },
  { id: 'shopping', label: 'Shopping', icon: '🛒', key: '8' },
  { id: 'tasks', label: 'Tasks', icon: '✓', key: '9', more: true },
  { id: 'time', label: 'Time', icon: '⏱', key: '0', more: true },
  { id: 'review', label: 'Review', icon: '🗓', key: 'r', more: true },
  { id: 'settings', label: 'Settings', icon: '⚙', key: ',', more: true },
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
  // optional browser notifications while the app is open (cannot fire when the app is closed)
  useEffect(() => {
    if (!rem.notify || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const run = () => {
      const day = todayStr()
      const seen = reminders.get().notified
      const fresh = activeReminders(day).filter((r) => seen[r.id] !== day)
      if (!fresh.length) return
      fresh.slice(0, 3).forEach((r) => new Notification(r.title, { body: r.body }))
      reminders.set((x) => ({ ...x, notified: { ...x.notified, ...Object.fromEntries(fresh.map((r) => [r.id, day])) } }))
    }
    run()
    const t = setInterval(run, 60000)
    return () => clearInterval(t)
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
          <button className="tb-search" onClick={() => setPal(true)} aria-label="Quick add (Ctrl or Cmd K)"><span>Quick add…</span><kbd>⌘K</kbd></button>
          <button className="tb-bell" onClick={() => go('today')} aria-label={`${nOpen} reminders`}>🔔{nOpen > 0 && <i>{nOpen}</i>}</button>
          <button className="plus" onClick={() => setPal(true)} aria-label="Quick add">＋</button>
        </div>
      </header>

      <main key={tab} className="main">
        {tab === 'today' && <Today go={go} />}
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

      <nav className="dock" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} className={`${tab === t.id ? 'on' : ''} ${t.more ? 'dk-more' : ''}`} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined} title={`${t.label}${t.key ? ` (${t.key})` : ''}`}>
            <span className="ni" aria-hidden>{t.icon}</span>
            <span className="nl">{t.label}</span>
          </button>
        ))}
        <button className={`dk-morebtn ${onMore ? 'on' : ''}`} onClick={() => setMore((m) => !m)} aria-expanded={more} aria-haspopup="dialog">
          <span className="ni" aria-hidden>⋯</span>
          <span className="nl">More</span>
        </button>
      </nav>
      {/* compact mobile dock: only main tabs + More (CSS hides .dk-more on phones) */}
      {more && (
        <div className="more-ov" onMouseDown={(e) => e.target === e.currentTarget && setMore(false)}>
          <div className="more-sheet" role="dialog" aria-label="More tabs">
            <div className="more-grab" aria-hidden />
            <div className="more-grid">
              {moreTabs.map((t) => (
                <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
                  <span className="ni" aria-hidden>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            <p className="hint center">Keys: {main.concat(moreTabs).map((t) => `${t.key} ${t.label}`).join(' · ')} · ⌘/Ctrl K quick add</p>
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
