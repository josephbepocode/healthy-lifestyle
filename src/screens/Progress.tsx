import { useState } from 'react'
import { useApp } from '../lib/store'
import { addWeighIn, deleteWeighIn, updateProfile } from '../lib/actions'
import { Empty, Tilt } from '../components/ui'
import { LineChart } from '../components/charts'
import { addDays, clamp, diffDays, fmtDate, num, round, todayStr } from '../lib/util'

export default function Progress() {
  const s = useApp()
  const { goalKg, heightCm } = s.profile
  const w = [...s.weighIns].sort((a, b) => a.date.localeCompare(b.date))
  const latest = w[w.length - 1]
  const first = w[0]
  const [date, setDate] = useState(todayStr())
  const [kg, setKg] = useState('')
  const [goalEdit, setGoalEdit] = useState(false)
  const [goalVal, setGoalVal] = useState(String(goalKg))

  const cur = latest?.kg ?? s.profile.weightKg
  const toGo = Math.max(0, goalKg - cur)
  const startKg = first?.kg ?? cur
  const pct = clamp(((cur - startKg) / Math.max(goalKg - startKg, 0.1)) * 100, 0, 100)
  const bmi = cur / Math.pow(heightCm / 100, 2)
  const weeksFast = Math.ceil(toGo / 0.5)
  const weeksSlow = Math.ceil(toGo / 0.25)

  // plateau check: compare latest to the closest weigh-in at least 14 days older
  let advice: { tone: 'warn' | 'ok' | 'info'; title: string; body: string } | null = null
  if (latest) {
    const old = [...w].reverse().find((x) => diffDays(latest.date, x.date) >= 14)
    if (!old) {
      const nextCheck = addDays(first.date, 14)
      advice = { tone: 'info', title: 'Give it two weeks', body: `Weigh in once a week, same time of day. Your first trend check is ${fmtDate(nextCheck)} — if the scale hasn’t moved by then, raise calories by 150–200 kcal.` }
    } else {
      const delta = latest.kg - old.kg
      const days = diffDays(latest.date, old.date)
      if (delta < 0.25 && days >= 14) {
        advice = { tone: 'warn', title: 'Scale hasn’t moved — bump calories', body: `Only ${delta >= 0 ? '+' : ''}${round(delta, 1)} kg over ${days} days. Raise daily calories by 150–200 kcal (to about ${s.profile.kcalTarget + 150}–${s.profile.kcalTarget + 200}) and reassess in 2 weeks.` }
      } else {
        const perWeek = delta / (days / 7)
        advice = { tone: 'ok', title: 'On track', body: `+${round(delta, 1)} kg over ${days} days (${round(perWeek, 2)} kg/week). Goal pace is 0.25–0.5 kg/week — keep going.` }
      }
    }
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = num(kg)
    if (v < 20 || v > 300) return
    addWeighIn(date, round(v, 1))
    setKg('')
  }

  return (
    <div className="screen">
      <header className="page-head">
        <div><p className="eyebrow">Trend</p><h1>Progress</h1></div>
      </header>

      <div className="stat-row four">
        <Tilt className="stat-card"><small>Current</small><b>{cur} kg</b><i>BMI {round(bmi, 1)}</i></Tilt>
        <Tilt className="stat-card">
          <small>Goal</small>
          {goalEdit ? (
            <form className="row gap" onSubmit={(e) => { e.preventDefault(); const v = num(goalVal); if (v > 30) updateProfile({ goalKg: v }); setGoalEdit(false) }}>
              <input type="number" step="0.5" value={goalVal} onChange={(e) => setGoalVal(e.target.value)} autoFocus />
              <button className="btn primary sm">OK</button>
            </form>
          ) : (
            <b>{goalKg} kg <button className="linkish" onClick={() => { setGoalVal(String(goalKg)); setGoalEdit(true) }}>edit</button></b>
          )}
          <i>{heightCm} cm tall</i>
        </Tilt>
        <Tilt className="stat-card"><small>To gain</small><b>{round(toGo, 1)} kg</b><i>{toGo > 0 ? `≈ ${weeksFast}–${weeksSlow} weeks` : 'Goal reached 🎉'}</i></Tilt>
        <Tilt className="stat-card">
          <small>Journey</small><b>{Math.round(pct)}%</b>
          <div className="track"><div className="fill" style={{ width: `${pct}%` }} /></div>
        </Tilt>
      </div>

      {advice && (
        <div className={`advice ${advice.tone}`}>
          <strong>{advice.title}</strong>
          <p>{advice.body}</p>
        </div>
      )}

      <div className="two-col">
        <Tilt className="chart-card" max={2}>
          <div className="card-head"><h2>Weight vs goal</h2><span className="muted">target +0.25–0.5 kg / week</span></div>
          {w.length === 0 ? (
            <Empty icon="⚖️" title="No weigh-ins yet" hint="Log your first weight to start the line." />
          ) : (
            <LineChart points={w.map((x) => ({ x: x.date, y: x.kg }))} goal={goalKg} />
          )}
        </Tilt>

        <Tilt className="log-card" max={2}>
          <div className="card-head"><h2>Weekly weigh-in</h2></div>
          <form className="stack gap-s" onSubmit={submit}>
            <div className="grid2">
              <label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
              <label className="field"><span>Weight (kg)</span><input type="number" step="0.1" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder={String(cur)} /></label>
            </div>
            <button className="btn primary" disabled={!kg}>Log weigh-in</button>
          </form>
          <ul className="weigh-list">
            {[...w].reverse().map((x, i, arr) => {
              const prev = arr[i + 1]
              const d = prev ? x.kg - prev.kg : null
              return (
                <li key={x.date}>
                  <span>{fmtDate(x.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <b>{x.kg} kg</b>
                  <em className={d == null ? '' : d > 0 ? 'up' : d < 0 ? 'down' : ''}>{d == null ? 'start' : `${d > 0 ? '+' : ''}${round(d, 1)}`}</em>
                  <button className="icon-btn danger sm" onClick={() => deleteWeighIn(x.date)} aria-label="Delete weigh-in">✕</button>
                </li>
              )
            })}
          </ul>
        </Tilt>
      </div>
    </div>
  )
}
