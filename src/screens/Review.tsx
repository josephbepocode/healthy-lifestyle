import { useState } from 'react'
import { Tilt } from '../components/ui'
import { weeklyReview } from '../lib/review'
import { useApp } from '../lib/store'
import { habits } from '../lib/habits'
import { study } from '../lib/study'
import { useMoney, fmtMoney } from '../lib/money'
import { fmtDate, todayStr } from '../lib/util'

function Meter({ v, max }: { v: number; max: number }) {
  return <div className="track"><div className="fill" style={{ width: `${Math.min(100, (v / Math.max(max, 1)) * 100)}%` }} /></div>
}

export default function Review() {
  useApp(); habits.use(); study.use(); useMoney() // recompute when any source changes
  const [off, setOff] = useState(0)
  const r = weeklyReview(todayStr(), off)
  const lbl = `${fmtDate(r.ws, { month: 'short', day: 'numeric' })} – ${fmtDate(r.we, { month: 'short', day: 'numeric' })}`
  return (
    <div className="screen">
      <header className="page-head">
        <div><p className="eyebrow">{lbl} · {r.days} day{r.days === 1 ? '' : 's'} so far</p><h1>Weekly review</h1></div>
        <div className="seg small"><button className={off === 0 ? 'on' : ''} onClick={() => setOff(0)}>This week</button><button className={off === 1 ? 'on' : ''} onClick={() => setOff(1)}>Last week</button></div>
      </header>
      <Tilt className="adjust">
        <div className="card-head"><h2>What to adjust</h2><span className="muted">computed from your logs</span></div>
        <ul className="sug">{r.sug.map((x, i) => <li key={i} className={x.tone}>{x.tone === 'warn' ? '⚠️' : x.tone === 'ok' ? '✅' : '💡'} {x.text}</li>)}</ul>
      </Tilt>
      <div className="bento b-review">
        <Tilt><div className="card-head"><h2>🍽 Nutrition</h2><span className="muted">{r.logged} logged day{r.logged === 1 ? '' : 's'}</span></div>
          <div className="big-num"><b>{r.avgK.toLocaleString()}</b><span>avg kcal / {r.kcalTarget}</span></div><Meter v={r.avgK} max={r.kcalTarget} />
          <div className="big-num sm"><b>{r.avgP}</b><span>avg g protein / {r.proteinTarget}</span></div><Meter v={r.avgP} max={r.proteinTarget} />
          <p className="hint"><b>{r.hit}</b> of {r.logged} logged days hit both targets (≥ 90%).</p></Tilt>
        <Tilt><div className="card-head"><h2>🏋 Workouts</h2></div>
          <div className="big-num"><b>{r.workouts}</b><span>/ {r.planned} planned</span></div><Meter v={r.workouts} max={r.planned} />
          <p className="hint">{r.plannedSoFar} planned so far this week.</p></Tilt>
        <Tilt><div className="card-head"><h2>⚖️ Weight</h2></div>
          <div className="big-num"><b>{r.delta === null ? '—' : `${r.delta > 0 ? '+' : ''}${r.delta}`}</b><span>kg vs last week</span></div>
          <p className="hint">{r.endW ? `Latest ${r.endW.kg} kg (${fmtDate(r.endW.date)})` : 'No weigh-in this week'}{r.startW ? ` · before: ${r.startW.kg} kg` : ''}. Target +0.25–0.5 kg/week.</p></Tilt>
        <Tilt><div className="card-head"><h2>💵 Money</h2></div>
          <div className="big-num"><b>{fmtMoney(r.weekSpent)}</b><span>spent this week</span></div>
          <div className="big-num sm"><b>{fmtMoney(r.periodSpent)}</b><span>of {fmtMoney(r.budget)} this pay period</span></div><Meter v={r.periodSpent} max={r.budget} /></Tilt>
        <Tilt><div className="card-head"><h2>✓ Tasks</h2></div>
          <div className="big-num"><b>{r.tasksDone}</b><span>completed this week</span></div>
          <p className="hint">Counted from the day each task was ticked (tracking started with this version).</p></Tilt>
        <Tilt><div className="card-head"><h2>📚 Study</h2></div>
          <div className="big-num"><b>{r.studyMins}</b><span>min / {r.studyGoal} goal</span></div><Meter v={r.studyMins} max={r.studyGoal} />
          <p className="hint">Study streak {r.streaks.study} days.</p></Tilt>
        <Tilt><div className="card-head"><h2>💧 Habits</h2></div>
          <div className="big-num"><b>{r.waterDays}</b><span>/ {r.days} days water target</span></div>
          <p className="hint">Supplement {r.creatineDays}/{r.days} days · sleep avg {r.avgSleep ?? '—'} h · streaks: water {r.streaks.water}, supplement {r.streaks.creatine}, sleep {r.streaks.sleep}.</p></Tilt>
      </div>
    </div>
  )
}
