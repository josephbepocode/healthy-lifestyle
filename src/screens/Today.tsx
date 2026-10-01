import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { useApp } from '../lib/store'
import { MEALS, addMeal, defaultMeal, toggleTask, totalsFor } from '../lib/actions'
import { Bar, Empty, Tilt } from '../components/ui'
import TimerWidget from '../components/TimerWidget'
import { PrepBadge } from '../components/Recipe'
import { SvgRings } from '../components/SvgRings'
import { openIdeas, openRecipe } from '../lib/fx'
import { useCountUp } from '../lib/hooks'
import { addDays, clamp, fmtDate, todayStr } from '../lib/util'
import type { MealKind } from '../types'

const Ring3D = lazy(() => import('../components/Ring3D'))

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Today({ go }: { go: (t: string) => void }) {
  const s = useApp()
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
  const lastTap = useRef(0)

  // quick-add: most-logged first, then high-protein starters
  const chips = useMemo(() => {
    const counts = new Map<string, number>()
    s.mealLog.forEach((e) => counts.set(e.foodId, (counts.get(e.foodId) || 0) + 1))
    return [...s.foods]
      .sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || b.protein / (b.kcal || 1) - a.protein / (a.kcal || 1))
      .slice(0, 12)
  }, [s.foods, s.mealLog])

  const todayLog = s.mealLog.filter((e) => e.date === date).length
  const tasks = s.tasks
    .filter((x) => !x.done)
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
  const doneToday = s.tasks.filter((x) => x.done).length
  const weekEnd = addDays(date, 7)
  const shown = tasks.filter((x) => !x.due || x.due <= weekEnd).slice(0, 5)
  const remK = Math.max(0, kcalTarget - t.kcal)
  const remP = Math.max(0, proteinTarget - t.protein)

  const quickAdd = (id: string, m: MealKind, el?: HTMLElement | null) => {
    const r = el?.getBoundingClientRect()
    addMeal(date, m, id, 1, { origin: r ? { x: r.left + r.width / 2, y: r.top } : undefined })
  }

  return (
    <div className="screen today">
      <header className="hero-head">
        <div>
          <p className="eyebrow">{fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1>
            {greeting()}, <span className="acc">Deji</span>
          </h1>
        </div>
        <button className="btn glow" onClick={openIdeas}>
          ✨ What should I eat?
        </button>
      </header>

      <div className="today-grid">
        <Tilt className="ring-card" max={4}>
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
          <p className="ring-note">
            {kP >= 1 && pP >= 1
              ? '🔥 Both targets hit. Legend.'
              : todayLog === 0
                ? 'Nothing logged yet — tap a food below to fill the ring.'
                : `${Math.round(remK)} kcal and ${Math.round(remP)}g protein to go.`}
          </p>
          <div className="macro-grid">
            <Bar label="Carbs" value={t.carbs} max={carbsTarget} />
            <Bar label="Fat" value={t.fat} max={fatTarget} />
          </div>
        </Tilt>

        <Tilt className="quick-card" max={3}>
          <div className="card-head">
            <h2>Quick add</h2>
            <span className="muted">tap — or drag onto a meal</span>
          </div>
          <div className="seg meal-seg" role="radiogroup" aria-label="Add to meal">
            {MEALS.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={meal === m.id}
                className={`${meal === m.id ? 'on' : ''} ${dragOver === m.id ? 'drop' : ''} ${dragging ? 'target' : ''}`}
                onClick={() => setMeal(m.id)}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(m.id)
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/plain')
                  setDragOver(null)
                  setDragging(false)
                  if (id) {
                    setMeal(m.id)
                    quickAdd(id, m.id, e.currentTarget as HTMLElement)
                  }
                }}
              >
                {m.icon}
                <span> {m.label}</span>
              </button>
            ))}
          </div>
          <div className="chips">
            {chips.map((f) => (
              <button
                key={f.id}
                className="food-chip"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', f.id)
                  e.dataTransfer.effectAllowed = 'copy'
                  setDragging(true)
                }}
                onDragEnd={() => setDragging(false)}
                onClick={(e) => quickAdd(f.id, meal, e.currentTarget)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  openRecipe(f.id)
                }}
                onPointerDown={() => (lastTap.current = Date.now())}
                title={`${f.name} — ${f.serving}`}
              >
                <span className="chip-name">{f.name.replace(/\s*\(.*\)/, '')}</span>
                <span className="chip-meta">
                  {f.kcal} kcal · {f.protein}g
                  <PrepBadge minutes={f.prepMinutes} />
                </span>
                <span className="chip-plus" aria-hidden>＋</span>
              </button>
            ))}
          </div>
          <p className="hint">Adding to <b>{MEALS.find((m) => m.id === meal)?.label}</b> · long-press / right-click a chip for its recipe</p>
        </Tilt>

        <Tilt className="tasks-card" max={3}>
          <div className="card-head">
            <h2>To-dos</h2>
            <button className="linkish" onClick={() => go('tasks')}>All tasks →</button>
          </div>
          {shown.length === 0 ? (
            <Empty icon="✨" title="All clear" hint={doneToday ? `${doneToday} done. Nothing due this week.` : 'Add a task and it will show up here.'} />
          ) : (
            <ul className="todo-list">
              {shown.map((x) => {
                const overdue = x.due && x.due < date
                return (
                  <li key={x.id}>
                    <label className="todo">
                      <input type="checkbox" checked={x.done} onChange={() => toggleTask(x.id)} />
                      <span className="box" aria-hidden />
                      <span className="todo-text">
                        {x.title}
                        {x.due && <small className={overdue ? 'late' : ''}>{overdue ? 'Overdue · ' : ''}{fmtDate(x.due)}</small>}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </Tilt>

        <Tilt className="timer-card" max={3}>
          <div className="card-head">
            <h2>Time tracker</h2>
            <button className="linkish" onClick={() => go('time')}>History →</button>
          </div>
          <TimerWidget />
        </Tilt>
      </div>
    </div>
  )
}
