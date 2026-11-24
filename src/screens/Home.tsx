import { useMemo, useState } from 'react'
import { useApp } from '../lib/store'
import { MEALS, addMeal, addWeighIn, defaultMeal, totalsFor } from '../lib/actions'
import { Modal } from '../components/ui'
import NotifyCard from '../components/NotifyCard'
import { SCHEDULE, WORKOUT_SPLIT, isBlockedFood } from '../lib/seed'
import { habits, addWater } from '../lib/habits'
import { activeReminders, markDone, reminders, snoozeReminder } from '../lib/reminders'
import { notifyPermission } from '../lib/notify'
import { toast } from '../lib/fx'
import { buzz, diffDays, fmtDate, num, round, todayStr, weekdayIdx } from '../lib/util'
import type { MealKind } from '../types'

function Bar({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(target, 1)) * 100))
  return (
    <div className="h-bar">
      <div className="h-bar-top"><span>{label}</span><b>{Math.round(value).toLocaleString()} / {Math.round(target).toLocaleString()} {unit}</b></div>
      <div className="h-track"><i style={{ width: pct + '%' }} /></div>
    </div>
  )
}

export default function Home({ go }: { go: (t: string) => void }) {
  const s = useApp()
  const h = habits.use()
  const rem = reminders.use()
  const date = todayStr()
  const t = totalsFor(s, date)
  const { kcalTarget, proteinTarget } = s.profile
  const water = h.water[date] || 0
  const [sheet, setSheet] = useState<null | 'food' | 'weigh'>(null)
  const [meal, setMeal] = useState<MealKind>(defaultMeal())
  const [kg, setKg] = useState('')

  // workout of the day
  const plan = SCHEDULE[weekdayIdx(date)]
  const split = plan ? WORKOUT_SPLIT.find((d) => d.day === plan) : undefined
  const setsToday = s.workoutLog.filter((w) => w.date === date).reduce((a, w) => a + w.sets.length, 0)

  // weigh-in
  const last = [...s.weighIns].sort((a, b) => a.date.localeCompare(b.date)).pop()
  const since = last ? diffDays(date, last.date) : null

  // most-used foods first, never blocked ones (no tuna, no fresh fish, no swallows)
  const foods = useMemo(() => {
    const counts = new Map<string, number>()
    s.mealLog.forEach((e) => counts.set(e.foodId, (counts.get(e.foodId) || 0) + 1))
    return s.foods
      .filter((f) => !isBlockedFood(f))
      .sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || b.protein / (b.kcal || 1) - a.protein / (a.kcal || 1))
      .slice(0, 10)
  }, [s.foods, s.mealLog])

  const todo = activeReminders(date).slice(0, 4)
  const needsSetup = !(rem.notify && notifyPermission() === 'granted')

  const saveWeigh = () => {
    const v = num(kg)
    if (!(v > 25 && v < 300)) return toast('Enter your weight in kg, for example 72.5')
    addWeighIn(date, round(v, 1))
    setSheet(null)
    setKg('')
    toast(`Saved ${round(v, 1)} kg`, { tone: 'win' })
  }

  return (
    <div className="screen home">
      <header className="home-head">
        <p className="muted">{fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1>Today</h1>
      </header>

      <section className="card h-progress">
        <Bar label="Calories" value={t.kcal} target={kcalTarget} unit="kcal" />
        <Bar label="Protein" value={t.protein} target={proteinTarget} unit="g" />
        <Bar label="Water" value={water / 1000} target={h.waterTarget / 1000} unit="L" />
      </section>

      <div className="h-actions">
        <button className="h-act" onClick={() => setSheet('food')}><span>🍽</span><b>Log food</b><small>{Math.max(0, Math.round(kcalTarget - t.kcal)).toLocaleString()} kcal left</small></button>
        <button className="h-act" onClick={() => { addWater(date, h.glass); buzz(10); toast(`+${h.glass} ml water`) }}><span>💧</span><b>Add a glass</b><small>{Math.round(water / h.glass)} of {Math.round(h.waterTarget / h.glass)} glasses</small></button>
        <button className="h-act" onClick={() => go('workouts')}><span>🏋</span><b>Workout</b><small>{split ? (setsToday ? `${setsToday} sets done` : split.name) : 'Rest day'}</small></button>
        <button className="h-act" onClick={() => setSheet('weigh')}><span>⚖️</span><b>Weigh in</b><small>{since === null ? 'Not yet' : since === 0 ? `${last!.kg} kg today` : `${since} days ago`}</small></button>
      </div>

      {todo.length > 0 && (
        <section className="card h-todo">
          <h2>To do</h2>
          {todo.map((r) => (
            <div className="h-rem" key={r.id}>
              <button className="h-rem-main" onClick={() => go(r.go)}><span aria-hidden>{r.icon}</span><span><b>{r.title}</b><small>{r.body}</small></span></button>
              <div className="h-rem-btns">
                <button className="btn primary" onClick={() => { markDone(r.id); buzz(10) }}>Done</button>
                <button className="btn ghost" onClick={() => snoozeReminder(r.id)}>Later</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {needsSetup && <NotifyCard compact />}
      {!needsSetup && <button className="link-btn" onClick={() => go('settings')}>🔔 Reminders are on · change</button>}

      {sheet === 'food' && (
        <Modal title="Log food" onClose={() => setSheet(null)}>
          <div className="seg big">
            {MEALS.map((m) => <button key={m.id} className={meal === m.id ? 'on' : ''} onClick={() => setMeal(m.id)}>{m.label}</button>)}
          </div>
          <p className="muted small">Tap a food to add one serving to {MEALS.find((m) => m.id === meal)?.label.toLowerCase()}.</p>
          <div className="food-list">
            {foods.map((f) => (
              <button key={f.id} className="food-row" onClick={() => { addMeal(date, meal, f.id, 1); buzz(10) }}>
                <span><b>{f.name}</b><small>{Math.round(f.kcal)} kcal · {Math.round(f.protein)} g protein</small></span><i>＋</i>
              </button>
            ))}
          </div>
          <button className="big-btn ghost" onClick={() => { setSheet(null); go('meals') }}>Search all foods</button>
        </Modal>
      )}
      {sheet === 'weigh' && (
        <Modal title="Weigh in" onClose={() => setSheet(null)}>
          <label className="field big"><span>Weight (kg)</span><input inputMode="decimal" autoFocus placeholder={last ? String(last.kg) : '72.5'} value={kg} onChange={(e) => setKg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveWeigh()} /></label>
          <button className="big-btn" onClick={saveWeigh}>Save</button>
        </Modal>
      )}
    </div>
  )
}
