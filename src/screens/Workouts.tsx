import { useMemo, useState } from 'react'
import { useApp } from '../lib/store'
import { addSet, deleteSet } from '../lib/actions'
import { SCHEDULE, SCHEDULE_NOTE, WEEKDAY_NAMES, WORKOUT_SPLIT } from '../lib/seed'
import { Empty, Tilt, DateNav } from '../components/ui'
import { Sparkline } from '../components/charts'
import { fmtDate, num, todayStr, weekdayIdx } from '../lib/util'
import type { DayKey, Exercise, SetEntry } from '../types'

function ExerciseCard({ ex, scheme, date, day }: { ex: Exercise; scheme: string; date: string; day: DayKey }) {
  const s = useApp()
  const sessions = useMemo(
    () =>
      s.workoutLog
        .filter((w) => w.sets.some((x) => x.exerciseId === ex.id))
        .map((w) => ({ date: w.date, sets: w.sets.filter((x) => x.exerciseId === ex.id) }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [s.workoutLog, ex.id],
  )
  const prior = sessions.filter((x) => x.date < date)
  const last = prior[prior.length - 1]
  const today = s.workoutLog.find((w) => w.date === date && w.day === day)
  const todaySets = (today?.sets ?? []).map((x, i) => ({ ...x, i })).filter((x) => x.exerciseId === ex.id)
  const pr = sessions.reduce((m, x) => Math.max(m, ...x.sets.map((y) => y.kg)), 0)
  const prSet = sessions.flatMap((x) => x.sets).filter((y) => y.kg === pr).sort((a, b) => b.reps - a.reps)[0]
  const trend = sessions.map((x) => Math.max(...x.sets.map((y) => y.kg)))
  const lastTop = last ? last.sets[last.sets.length - 1] : undefined
  const [reps, setReps] = useState(lastTop ? String(lastTop.reps) : '')
  const [kg, setKg] = useState(lastTop ? String(lastTop.kg) : '')
  const log = () => {
    const r = Math.round(num(reps))
    const k = num(kg)
    if (r <= 0 || k < 0) return
    const set: SetEntry = { exerciseId: ex.id, reps: r, kg: k }
    addSet(date, day, set)
  }
  return (
    <Tilt className="ex-card" max={3}>
      <div className="card-head">
        <div>
          <h3>{ex.name}</h3>
          <small className="muted">{ex.muscleGroup} · target {scheme}</small>
        </div>
        {pr > 0 && <span className="badge pr">🏆 PR {pr} kg{prSet ? ` × ${prSet.reps}` : ''}</span>}
      </div>
      <div className="ex-body">
        <div className="ex-last">
          <small className="muted">Last session{last ? ` · ${fmtDate(last.date, { month: 'short', day: 'numeric' })}` : ''}</small>
          {last ? (
            <div className="set-pills">
              {last.sets.map((x, i) => (
                <span key={i}>{x.kg}×{x.reps}</span>
              ))}
            </div>
          ) : (
            <div className="muted small">First time — set the baseline today.</div>
          )}
        </div>
        <Sparkline values={trend} />
      </div>
      {todaySets.length > 0 && (
        <ol className="logged-sets">
          {todaySets.map((x, n) => (
            <li key={x.i}>
              <span>Set {n + 1}</span>
              <b>{x.kg} kg × {x.reps}</b>
              <button className="icon-btn danger sm" onClick={() => deleteSet(date, day, x.i)} aria-label="Delete set">✕</button>
            </li>
          ))}
        </ol>
      )}
      <form className="set-form" onSubmit={(e) => { e.preventDefault(); log() }}>
        <label><span>kg</span><input type="number" inputMode="decimal" step="0.5" min="0" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="0" /></label>
        <label><span>reps</span><input type="number" inputMode="numeric" min="1" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="0" /></label>
        <button className="btn primary" disabled={!reps}>＋ Set</button>
      </form>
    </Tilt>
  )
}

export default function Workouts() {
  const s = useApp()
  const [date, setDate] = useState(todayStr())
  const scheduled = SCHEDULE[weekdayIdx(date)]
  const [override, setOverride] = useState<DayKey | null>(null)
  const day: DayKey = override ?? scheduled ?? nextDay(date)
  const plan = WORKOUT_SPLIT.find((d) => d.day === day)!
  const exMap = new Map(s.exercises.map((e) => [e.id, e]))
  const sessionsThisWeek = s.workoutLog.filter((w) => w.date >= weekStartOf(date) && w.date <= date).length
  const volume = (s.workoutLog.find((w) => w.date === date && w.day === day)?.sets ?? []).reduce((a, x) => a + x.kg * x.reps, 0)

  return (
    <div className="screen">
      <header className="page-head">
        <div><p className="eyebrow">Train</p><h1>Workouts</h1></div>
        <DateNav date={date} onChange={(d) => { setDate(d); setOverride(null) }} todayStr={todayStr()} />
      </header>

      <div className="week-strip">
        {WEEKDAY_NAMES.map((n, i) => {
          const dk = SCHEDULE[i]
          const isToday = weekdayIdx(date) === i
          return (
            <button key={n} className={`wk ${isToday ? 'today' : ''} ${dk ? '' : 'rest'} ${dk && dk === day ? 'sel' : ''}`} disabled={!dk} onClick={() => dk && setOverride(dk)}>
              <small>{n}</small>
              <b>{dk ?? '–'}</b>
            </button>
          )
        })}
      </div>
      <p className="muted small">{SCHEDULE_NOTE}</p>

      <div className="seg day-seg" role="tablist">
        {WORKOUT_SPLIT.map((d) => (
          <button key={d.day} className={d.day === day ? 'on' : ''} onClick={() => setOverride(d.day)}>
            <b>{d.day}</b><span> {d.name}</span>
          </button>
        ))}
      </div>

      {!scheduled && !override && (
        <div className="gap-card">Rest day — recover and eat. Showing next up: <b>Day {day}</b>.</div>
      )}
      <div className="stat-row">
        <div className="stat"><small>This session volume</small><b>{Math.round(volume).toLocaleString()} kg</b></div>
        <div className="stat"><small>Sessions this week</small><b>{sessionsThisWeek}</b></div>
        <div className="stat"><small>Exercises</small><b>{plan.exercises.length}</b></div>
      </div>

      {plan.exercises.length === 0 ? (
        <Empty icon="🏋️" title="Nothing planned" />
      ) : (
        <div className="ex-grid">
          {plan.exercises.map((p, i) => {
            const ex = exMap.get(p.id)
            return ex ? <ExerciseCard key={p.id + i} ex={ex} scheme={p.scheme} date={date} day={day} /> : null
          })}
        </div>
      )}
    </div>
  )
}

function weekStartOf(d: string) {
  const dt = new Date(d + 'T00:00:00')
  dt.setDate(dt.getDate() - weekdayIdx(d))
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
function nextDay(date: string): DayKey {
  for (let i = weekdayIdx(date); i < 14; i++) {
    const k = SCHEDULE[i % 7]
    if (k) return k
  }
  return 'A'
}
