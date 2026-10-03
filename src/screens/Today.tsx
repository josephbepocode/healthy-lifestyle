import { lazy, Suspense, useMemo, useState } from 'react'
import { useApp } from '../lib/store'
import { MEALS, addMeal, defaultMeal, toggleTask, totalsFor } from '../lib/actions'
import { Bar, Tilt } from '../components/ui'
import TimerWidget from '../components/TimerWidget'
import { PrepBadge } from '../components/Recipe'
import { SvgRings } from '../components/SvgRings'
import { Sparkline } from '../components/charts'
import { WaterGlasses } from './Habits'
import { openIdeas, openRecipe } from '../lib/fx'
import { useCountUp } from '../lib/hooks'
import { SCHEDULE, WEEKDAY_NAMES, WORKOUT_SPLIT } from '../lib/seed'
import { habits, addWater, streakOf, waterOk, weighCheck } from '../lib/habits'
import { study, studyMin, daysTo, logSession } from '../lib/study'
import { useMoney, periodFor, totalAlloc, fmtMoney } from '../lib/money'
import { bills, dueDates } from '../lib/bills'
import { activeReminders, markDone, reminders, snoozeReminder } from '../lib/reminders'
import { useShop, sumPrices, readBudget, money } from '../lib/shopping'
import { lowItems, shopx } from '../lib/nutri'
import { buzz, clamp, diffDays, fmtDate, todayStr, weekdayIdx } from '../lib/util'
import type { MealKind } from '../types'

const Ring3D = lazy(() => import('../components/Ring3D'))

export default function Today({ go }: { go: (t: string) => void }) {
  const s = useApp()
  const h = habits.use()
  const st = study.use()
  const m = useMoney()
  const sh = useShop()
  reminders.use(); bills.use(); shopx.use()
  const date = todayStr()
  const t = totalsFor(s, date)
  const { kcalTarget, proteinTarget, carbsTarget, fatTarget } = s.profile
  const kP = t.kcal / kcalTarget
  const pP = t.protein / proteinTarget
  const kc = useCountUp(t.kcal)
  const pc = useCountUp(t.protein)
  const hit = kP >= 1 || pP >= 1
  const [meal, setMeal] = useState<MealKind>(defaultMeal())
  const [dragOver, setDragOver] = useState<MealKind | null>(null)
  const [dragging, setDragging] = useState(false)

  const chips = useMemo(() => {
    const counts = new Map<string, number>()
    s.mealLog.forEach((e) => counts.set(e.foodId, (counts.get(e.foodId) || 0) + 1))
    return [...s.foods].sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || b.protein / (b.kcal || 1) - a.protein / (a.kcal || 1)).slice(0, 12)
  }, [s.foods, s.mealLog])

  const remK = Math.max(0, kcalTarget - t.kcal)
  const remP = Math.max(0, proteinTarget - t.protein)
  const nextMeal = defaultMeal()
  const slotsLeft = Math.max(1, { breakfast: 4, lunch: 3, dinner: 2, snack: 1 }[nextMeal])
  const ideas = useMemo(() => {
    const pk = remK / slotsLeft
    const pp = remP / slotsLeft
    return [...s.foods]
      .map((f) => ({ f, sc: Math.abs(f.kcal - pk) / Math.max(pk, 250) * 0.8 + Math.abs(f.protein - pp) / Math.max(pp, 25) * 1.2 - (f.protein / Math.max(f.kcal, 1)) * 2 }))
      .sort((a, b) => a.sc - b.sc)
      .slice(0, 3)
      .map((x) => x.f)
  }, [s.foods, remK, remP, slotsLeft])

  const quickAdd = (id: string, mk: MealKind, el?: HTMLElement | null) => {
    const r = el?.getBoundingClientRect()
    addMeal(date, mk, id, 1, { origin: r ? { x: r.left + r.width / 2, y: r.top } : undefined })
  }

  // workout of the day
  const wd = SCHEDULE[weekdayIdx(date)]
  const nextIdx = wd ? weekdayIdx(date) : [1, 2, 3, 4, 5, 6, 7].map((n) => (weekdayIdx(date) + n) % 7).find((i) => SCHEDULE[i]) ?? 0
  const planDay = wd ?? SCHEDULE[nextIdx] ?? 'A'
  const plan = WORKOUT_SPLIT.find((d) => d.day === planDay)!
  const setsToday = s.workoutLog.filter((w) => w.date === date).reduce((a, w) => a + w.sets.length, 0)
  const exName = (id: string) => s.exercises.find((e) => e.id === id)?.name ?? id

  // money
  const p = periodFor(m.nextPayday, date)
  const spent = m.expenses.filter((e) => e.date >= p.start && e.date <= p.end).reduce((a, e) => a + e.amount, 0)
  const plan$ = totalAlloc(m)
  const billsDue = bills.get().bills.flatMap((b) => dueDates(b, date, p.end).map((d) => ({ b, d })))

  // tasks, weigh-in, streaks, study
  const tasks = s.tasks.filter((x) => !x.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).slice(0, 3)
  const w = [...s.weighIns].sort((a, b) => a.date.localeCompare(b.date))
  const lw = w[w.length - 1]
  const wc = weighCheck(w)
  const sinceW = lw ? diffDays(date, lw.date) : null
  const mealStreak = streakOf((d) => totalsFor(s, d).kcal > 0)
  const waterStreak = streakOf(waterOk(h))
  const studyStreak = streakOf((d) => studyMin(d) >= st.goalMin)
  const studyToday = studyMin(date)
  const fr = daysTo(st.frenchDate)
  const water = h.water[date] || 0

  // shopping
  const need = sh.items.filter((i) => i.stock === 'need')
  const budget = readBudget()
  const total = sumPrices(need)
  const rem = activeReminders(date).slice(0, 3)
  const low = lowItems(date).length

  return (
    <div className="screen today">
      <header className="hero-head">
        <div>
          <p className="eyebrow">{fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="mega">{kP >= 1 && pP >= 1 ? <>Targets <span className="acc">hit</span></> : <><span className="acc">{Math.round(remK).toLocaleString()}</span> kcal to go</>}</h1>
        </div>
        <button className="btn glow" onClick={openIdeas}>✨ What should I eat?</button>
      </header>

      <div className="bento b-today">
        {rem.length > 0 && (
          <div className="t-remind" aria-label="Reminders">
            {rem.map((r) => (
              <div className="rem" key={r.id}>
                <span className="ri" aria-hidden>{r.icon}</span>
                <div className="rt"><strong>{r.title}</strong><small>{r.body}</small></div>
                <div className="ra"><button className="btn sm primary" onClick={() => go(r.go)}>Open</button><button className="btn sm" onClick={() => { markDone(r.id); buzz(10) }}>Done</button><button className="btn sm ghost" onClick={() => snoozeReminder(r.id)}>Snooze</button></div>
              </div>
            ))}
          </div>
        )}

        <Tilt className="t-ring" max={4}>
          <div className={`ring-stage ${hit ? 'hit' : ''}`}>
            <Suspense fallback={<SvgRings calories={kP} protein={pP} />}>
              <Ring3D calories={kP} protein={pP} hit={hit} />
            </Suspense>
            <div className="ring-center" aria-live="polite">
              <b>{Math.round(kc).toLocaleString()}</b>
              <span>of {kcalTarget.toLocaleString()} kcal</span>
              <em>{Math.round(pc)}g / {proteinTarget}g protein</em>
            </div>
          </div>
          <div className="ring-legend">
            <span><i className="lg acc-bg" /> Calories {Math.round(clamp(kP, 0, 9.99) * 100)}%</span>
            <span><i className="lg white-bg" /> Protein {Math.round(clamp(pP, 0, 9.99) * 100)}%</span>
          </div>
          <div className="macro-grid"><Bar label="Carbs" value={t.carbs} max={carbsTarget} /><Bar label="Fat" value={t.fat} max={fatTarget} /></div>
        </Tilt>

        <Tilt className="t-meal">
          <div className="card-head"><h2>Next: {MEALS.find((x) => x.id === nextMeal)!.label}</h2><button className="linkish" onClick={() => go('meals')}>Meals →</button></div>
          <p className="muted small">{Math.round(remK)} kcal and {Math.round(remP)} g protein left · ~{Math.round(remK / slotsLeft)} kcal per remaining meal</p>
          <ul className="idea-list">
            {ideas.map((f) => (
              <li key={f.id}>
                <button className="idea-name" onClick={() => openRecipe(f.id)}><strong>{f.name}</strong><small>{Math.round(f.kcal)} kcal · {Math.round(f.protein)} g protein <PrepBadge minutes={f.prepMinutes} /></small></button>
                <button className="btn sm primary" onClick={(e) => quickAdd(f.id, nextMeal, e.currentTarget)}>＋ Log</button>
              </li>
            ))}
          </ul>
        </Tilt>

        <Tilt className="t-wod">
          <div className="card-head"><h2>{wd ? 'Workout today' : 'Rest day'}</h2><span className="badge prep">Day {planDay}</span></div>
          <strong className="wod-name">{plan.name}</strong>
          {!wd && <p className="muted small">Next up {WEEKDAY_NAMES[nextIdx]} — recover and eat.</p>}
          <ul className="wod-list">{plan.exercises.slice(0, 5).map((e) => <li key={e.id}><span>{exName(e.id)}</span><i>{e.scheme}</i></li>)}</ul>
          <div className="row between"><small className="muted">{setsToday ? `${setsToday} sets logged` : 'No sets yet'}</small><button className="btn sm primary" onClick={() => go('workouts')}>{wd ? 'Start' : 'Preview'} →</button></div>
        </Tilt>

        <Tilt className="t-water">
          <div className="card-head"><h2>💧 Water</h2><span className="muted">{waterStreak} d streak</span></div>
          <div className="big-num"><b>{(water / 1000).toFixed(2)}</b><span>/ {(h.waterTarget / 1000).toFixed(1)} L</span></div>
          <WaterGlasses />
          <button className="btn sm primary" onClick={() => { buzz(12); addWater(date, h.glass) }}>＋ {h.glass} ml</button>
        </Tilt>

        <Tilt className="t-money">
          <div className="card-head"><h2>💵 This paycheck</h2><button className="linkish" onClick={() => go('money')}>Money →</button></div>
          <div className="big-num"><b>{fmtMoney(Math.max(0, plan$ - spent))}</b><span>left of {fmtMoney(plan$)}</span></div>
          <div className="track"><div className={`fill ${spent > plan$ ? 'bad' : ''}`} style={{ width: `${clamp((spent / Math.max(plan$, 1)) * 100, 0, 100)}%` }} /></div>
          <small className="muted">{fmtMoney(spent)} spent · payday {fmtDate(p.next, { month: 'short', day: 'numeric' })} ({p.daysLeft} d){billsDue.length ? ` · ${billsDue.length} bill${billsDue.length > 1 ? 's' : ''} before payday` : ''}</small>
        </Tilt>

        <Tilt className="t-streak">
          <div className="card-head"><h2>🔥 Streaks</h2></div>
          <div className="streak-list"><div><b>{mealStreak}</b><span>logging</span></div><div><b>{waterStreak}</b><span>water</span></div><div><b>{studyStreak}</b><span>study</span></div></div>
        </Tilt>

        <Tilt className="t-tasks">
          <div className="card-head"><h2>Top 3 tasks</h2><button className="linkish" onClick={() => go('tasks')}>All →</button></div>
          {tasks.length === 0 ? <p className="muted small">All clear ✨</p> : (
            <ul className="todo-list">{tasks.map((x) => (
              <li key={x.id}><label className="todo"><input type="checkbox" checked={x.done} onChange={() => toggleTask(x.id)} /><span className="box" aria-hidden />
                <span className="todo-text">{x.title}{x.due && <small className={x.due < date ? 'late' : ''}>{x.due < date ? 'Overdue · ' : ''}{fmtDate(x.due)}</small>}</span></label></li>))}</ul>
          )}
        </Tilt>

        <Tilt className="t-quick">
          <div className="card-head"><h2>Quick log</h2><span className="muted">tap — or drag onto a meal</span></div>
          <div className="seg meal-seg" role="radiogroup" aria-label="Add to meal">
            {MEALS.map((mm) => (
              <button key={mm.id} role="radio" aria-checked={meal === mm.id}
                className={`${meal === mm.id ? 'on' : ''} ${dragOver === mm.id ? 'drop' : ''} ${dragging ? 'target' : ''}`}
                onClick={() => setMeal(mm.id)}
                onDragOver={(e) => { e.preventDefault(); setDragOver(mm.id) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); setDragOver(null); setDragging(false); if (id) { setMeal(mm.id); quickAdd(id, mm.id, e.currentTarget as HTMLElement) } }}>
                {mm.icon}<span> {mm.label}</span>
              </button>
            ))}
          </div>
          <div className="chips">
            {chips.map((f) => (
              <button key={f.id} className="food-chip" draggable
                onDragStart={(e) => { e.dataTransfer.setData('text/plain', f.id); e.dataTransfer.effectAllowed = 'copy'; setDragging(true) }}
                onDragEnd={() => setDragging(false)}
                onClick={(e) => quickAdd(f.id, meal, e.currentTarget)}
                onContextMenu={(e) => { e.preventDefault(); openRecipe(f.id) }}>
                <span className="chip-name">{f.name}</span>
                <span className="chip-meta">{Math.round(f.kcal)} kcal · {Math.round(f.protein)}g<PrepBadge minutes={f.prepMinutes} /></span>
                <span className="chip-plus">＋</span>
              </button>
            ))}
          </div>
        </Tilt>

        <Tilt className="t-weigh">
          <div className="card-head"><h2>⚖️ Weigh-in</h2><button className="linkish" onClick={() => go('progress')}>Progress →</button></div>
          <div className="big-num"><b>{lw ? lw.kg : s.profile.weightKg}</b><span>kg{sinceW !== null ? ` · ${sinceW === 0 ? 'today' : sinceW + ' d ago'}` : ''}</span></div>
          <Sparkline values={w.slice(-8).map((x) => x.kg)} height={34} />
          <small className="muted">{wc.state === 'need' ? (sinceW !== null && sinceW >= 7 ? 'Weigh-in due today' : 'Next check needs 2 weigh-ins 7+ days apart') : `${wc.rate! > 0 ? '+' : ''}${wc.rate} kg/wk · ${wc.state === 'ok' ? 'on track' : wc.state === 'slow' ? 'too slow' : 'a bit fast'}`}</small>
        </Tilt>

        <Tilt className="t-study">
          <div className="card-head"><h2>📚 Study</h2><button className="linkish" onClick={() => go('study')}>Study →</button></div>
          <div className="big-num"><b>{studyToday}</b><span>/ {st.goalMin} min</span></div>
          <div className="track"><div className="fill" style={{ width: `${clamp((studyToday / st.goalMin) * 100, 0, 100)}%` }} /></div>
          <div className="row between"><small className="muted">🇫🇷 {fr !== null && fr >= 0 ? fr : 0} days to Jan 31</small><button className="btn sm" onClick={() => { logSession('French', 15); buzz(12) }}>＋15 min</button></div>
        </Tilt>

        <Tilt className="t-shop">
          <div className="card-head"><h2>🛒 Shopping</h2><button className="linkish" onClick={() => go('shopping')}>Open →</button></div>
          <div className="big-num"><b>{need.length}</b><span>to get · {money(total)} <em>at store prices</em></span></div>
          {budget && <div className="track"><div className={`fill ${total > budget.perPaycheck ? 'bad' : ''}`} style={{ width: `${clamp((total / budget.perPaycheck) * 100, 0, 100)}%` }} /></div>}
          <small className={budget && total > budget.perPaycheck ? 'neg' : 'muted'}>{budget ? (total > budget.perPaycheck ? `Over the ${money(budget.perPaycheck)} grocery budget` : `of ${money(budget.perPaycheck)} grocery budget`) : 'No grocery budget set'}{low ? ` · ${low} item${low > 1 ? 's' : ''} may be running low` : ''}</small>
        </Tilt>

        <Tilt className="t-timer">
          <div className="card-head"><h2>⏱ Time tracker</h2><button className="linkish" onClick={() => go('time')}>History →</button></div>
          <TimerWidget />
        </Tilt>
      </div>
    </div>
  )
}
