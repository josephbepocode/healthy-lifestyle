import { useEffect, useState } from 'react'
import Today from './screens/Today'
import Meals from './screens/Meals'
import Workouts from './screens/Workouts'
import Progress from './screens/Progress'
import Tasks from './screens/Tasks'
import Time from './screens/Time'
import Money from './screens/Money'
import Shopping from './screens/Shopping'
import { Confetti, Toaster } from './components/ui'
import { ModalHost } from './components/Recipe'
import { openIdeas } from './lib/fx'
import { useApp } from './lib/store'

const TABS = [
  { id: 'today', label: 'Today', icon: '◉', key: '1' },
  { id: 'meals', label: 'Meals', icon: '🍽', key: '2' },
  { id: 'workouts', label: 'Workouts', icon: '🏋', key: '3' },
  { id: 'progress', label: 'Progress', icon: '📈', key: '4' },
  { id: 'tasks', label: 'Tasks', icon: '✓', key: '5' },
  { id: 'time', label: 'Time', icon: '⏱', key: '6' },
  { id: 'money', label: 'Money', icon: '$', key: '7' },
  { id: 'shopping', label: 'Shopping', icon: '🛒', key: '8' },
] as const
type Tab = (typeof TABS)[number]['id']

const fromHash = (): Tab => {
  const h = location.hash.replace('#', '') as Tab
  return TABS.some((t) => t.id === h) ? h : 'today'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(fromHash)
  const s = useApp()
  const go = (t: string) => {
    location.hash = t
    setTab(t as Tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  useEffect(() => {
    const h = () => setTab(fromHash())
    addEventListener('hashchange', h)
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.matches('input,textarea,select') || e.metaKey || e.ctrlKey || e.altKey || document.body.classList.contains('modal-open')) return
      const t = TABS.find((x) => x.key === e.key)
      if (t) go(t.id)
      if (e.key === '?' || e.key === 'e') openIdeas()
    }
    addEventListener('keydown', k)
    return () => {
      removeEventListener('hashchange', h)
      removeEventListener('keydown', k)
    }
  }, [])

  return (
    <div className="app">
      <div className="bg" aria-hidden>
        <i className="blob b1" />
        <i className="blob b2" />
        <i className="blob b3" />
        <i className="grain" />
      </div>
      <aside className="nav" aria-label="Main">
        <div className="brand">
          <span className="logo" aria-hidden />
          <b>Healthy</b>
        </div>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined} title={`${t.label} (${t.key})`}>
              <span className="ni" aria-hidden>{t.icon}</span>
              <span className="nl">{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="nav-foot">
          {s.activeTimer && <button className="live" onClick={() => go('time')}><i className="pulse-dot" /> Timer running</button>}
          <small>Keys 1–8 · E for ideas</small>
        </div>
      </aside>
      <main key={tab} className="main">
        {tab === 'today' && <Today go={go} />}
        {tab === 'meals' && <Meals />}
        {tab === 'workouts' && <Workouts />}
        {tab === 'progress' && <Progress />}
        {tab === 'tasks' && <Tasks />}
        {tab === 'time' && <Time />}
        {tab === 'money' && <Money />}
        {tab === 'shopping' && <Shopping />}
      </main>
      <ModalHost />
      <Toaster />
      <Confetti />
    </div>
  )
}
