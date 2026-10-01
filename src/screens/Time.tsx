import { useMemo, useState } from 'react'
import { useApp } from '../lib/store'
import { CATEGORIES, addTimeEntry, deleteTimeEntry } from '../lib/actions'
import { Empty, Tilt } from '../components/ui'
import TimerWidget from '../components/TimerWidget'
import { BarChart } from '../components/charts'
import { useNow } from '../lib/hooks'
import { addDays, fmtDate, fmtDur, num, todayStr, weekStart } from '../lib/util'

export default function Time() {
  const s = useApp()
  const now = useNow(1000)
  const today = todayStr()
  const ws = weekStart(today)
  const live = s.activeTimer ? Math.floor((now - s.activeTimer.startedAt) / 1000) : 0
  const [range, setRange] = useState<'today' | 'week'>('today')
  const [form, setForm] = useState({ label: '', category: CATEGORIES[0], minutes: '', date: today })

  const inRange = (d: string) => (range === 'today' ? d === today : d >= ws && d <= addDays(ws, 6))
  const cats = useMemo(() => {
    const m = new Map<string, number>()
    s.timeEntries.filter((e) => inRange(e.date)).forEach((e) => m.set(e.category, (m.get(e.category) || 0) + e.seconds))
    if (s.activeTimer && range === 'today') m.set(s.activeTimer.category, (m.get(s.activeTimer.category) || 0) + live)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.timeEntries, s.activeTimer, live, range])
  const total = cats.reduce((a, [, v]) => a + v, 0)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i)
    let v = s.timeEntries.filter((e) => e.date === d).reduce((a, e) => a + e.seconds, 0)
    if (d === today) v += live
    return { label: fmtDate(d, { weekday: 'short' }), value: v, highlight: d === today }
  })
  const entries = [...s.timeEntries].filter((e) => inRange(e.date)).sort((a, b) => (b.startedAt || b.date).localeCompare(a.startedAt || a.date))
  const sumToday = s.timeEntries.filter((e) => e.date === today).reduce((a, e) => a + e.seconds, 0) + (s.activeTimer ? live : 0)
  const sumWeek = days.reduce((a, d) => a + d.value, 0)

  return (
    <div className="screen">
      <header className="page-head"><div><p className="eyebrow">Focus</p><h1>Time</h1></div></header>
      <div className="stat-row">
        <div className="stat"><small>Today</small><b>{fmtDur(sumToday)}</b></div>
        <div className="stat"><small>This week</small><b>{fmtDur(sumWeek)}</b></div>
        <div className="stat"><small>Top category</small><b>{cats[0]?.[0] ?? '—'}</b></div>
      </div>
      <div className="two-col">
        <Tilt className="timer-card" max={3}><div className="card-head"><h2>Tracker</h2></div><TimerWidget /></Tilt>
        <Tilt className="chart-card" max={2}>
          <div className="card-head"><h2>This week</h2><span className="muted">hours per day</span></div>
          {sumWeek === 0 ? <Empty icon="📊" title="No time tracked this week" hint="Start the timer or add an entry." /> : <BarChart items={days} fmt={(v) => fmtDur(v)} />}
        </Tilt>
      </div>

      <div className="two-col">
        <Tilt className="card" max={2}>
          <div className="card-head">
            <h2>By category</h2>
            <div className="seg small"><button className={range === 'today' ? 'on' : ''} onClick={() => setRange('today')}>Today</button><button className={range === 'week' ? 'on' : ''} onClick={() => setRange('week')}>Week</button></div>
          </div>
          {cats.length === 0 ? <Empty icon="⏳" title="Nothing here yet" /> : (
            <ul className="cat-list">
              {cats.map(([c, v]) => (
                <li key={c}>
                  <div className="row between"><span>{c}</span><b>{fmtDur(v)}</b></div>
                  <div className="track"><div className="fill" style={{ width: `${(v / total) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Tilt>
        <Tilt className="card" max={2}>
          <div className="card-head"><h2>Add entry manually</h2></div>
          <form className="stack gap-s" onSubmit={(e) => {
            e.preventDefault()
            const m = num(form.minutes)
            if (m <= 0) return
            addTimeEntry({ date: form.date, label: form.label.trim() || form.category, category: form.category, seconds: Math.round(m * 60) })
            setForm({ ...form, label: '', minutes: '' })
          }}>
            <label className="field"><span>Label</span><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. French lesson" /></label>
            <div className="grid3">
              <label className="field"><span>Category</span><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="field"><span>Minutes</span><input type="number" min={1} inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} /></label>
              <label className="field"><span>Date</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            </div>
            <button className="btn primary" disabled={!form.minutes}>Add entry</button>
          </form>
        </Tilt>
      </div>

      <section className="card list-card">
        <div className="card-head"><h2>Entries · {range === 'today' ? 'today' : 'this week'}</h2></div>
        {entries.length === 0 ? <Empty icon="🕒" title="No entries" hint="Tracked sessions will be listed here." /> : (
          <ul className="entry-list">
            {entries.map((e) => (
              <li key={e.id}>
                <div><strong>{e.label}</strong><small>{e.category} · {fmtDate(e.date)}</small></div>
                <b>{fmtDur(e.seconds)}</b>
                <button className="icon-btn danger" onClick={() => deleteTimeEntry(e.id)} aria-label="Delete entry">🗑</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
