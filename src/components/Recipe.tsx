import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../lib/store'
import { MEALS, addMeal, defaultMeal, recipeFor, saveRecipe, totalsFor } from '../lib/actions'
import { Modal, Stepper } from './ui'
import { beep, buzz, clock, round, scaleAmount, todayStr } from '../lib/util'
import { modalBus, openRecipe, toast, type ModalReq } from '../lib/fx'
import { useEscape, useWakeLock } from '../lib/hooks'
import type { Food, MealKind, Recipe } from '../types'

export function PrepBadge({ minutes }: { minutes?: number }) {
  if (!minutes) return null
  return <span className="badge prep">⏱ {minutes} min</span>
}

const fmtSv = (v: number) => (v === 1 ? '1 serving' : `${v} servings`)

function RecipeEditor({ food, initial, onDone }: { food: Food; initial?: Recipe; onDone: () => void }) {
  const [ing, setIng] = useState(initial?.ingredients.map((i) => (i.amount ? `${i.amount} | ${i.item}` : i.item)).join('\n') ?? '')
  const [steps, setSteps] = useState(initial?.steps.map((s) => s.text).join('\n') ?? '')
  const [mins, setMins] = useState(String(initial?.totalMinutes ?? food.prepMinutes ?? 15))
  return (
    <div className="stack gap">
      <label className="field">
        <span>Ingredients (one per line — “amount | item”)</span>
        <textarea rows={5} value={ing} onChange={(e) => setIng(e.target.value)} placeholder={'2 | Eggs\n1 tbsp | Oil'} />
      </label>
      <label className="field">
        <span>Steps (one per line)</span>
        <textarea rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="Heat the pan…" />
      </label>
      <label className="field">
        <span>Total minutes</span>
        <input type="number" min={1} value={mins} onChange={(e) => setMins(e.target.value)} />
      </label>
      <div className="row gap end">
        <button className="btn ghost" onClick={onDone}>
          Cancel
        </button>
        <button
          className="btn primary"
          onClick={() => {
            const ingredients = ing
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
              .map((l) => {
                const [a, ...r] = l.split('|')
                return r.length ? { amount: a.trim(), item: r.join('|').trim() } : { amount: '', item: l }
              })
            const st = steps
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
              .map((text) => ({ text }))
            if (!st.length) return toast('Add at least one step')
            saveRecipe(food.id, { totalMinutes: Math.max(1, parseInt(mins) || 15), servings: 1, ingredients, steps: st })
            onDone()
          }}
        >
          Save recipe
        </button>
      </div>
    </div>
  )
}

export function RecipeModal({ foodId, onClose, onCook }: { foodId: string; onClose: () => void; onCook: (sv: number) => void }) {
  const s = useApp()
  const food = s.foods.find((f) => f.id === foodId)
  const recipe = recipeFor(s, foodId)
  const [sv, setSv] = useState(1)
  const [ticked, setTicked] = useState<Set<number>>(new Set())
  const [meal, setMeal] = useState<MealKind>(defaultMeal())
  const [editing, setEditing] = useState(false)
  if (!food) return null
  const f = sv
  const all = recipe ? recipe.ingredients.length : 0
  const toggle = (i: number) => {
    buzz(6)
    setTicked((t) => {
      const n = new Set(t)
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })
  }
  return (
    <Modal onClose={onClose} wide title={food.name}>
      <div className="recipe">
        <div className="recipe-meta">
          <span className="badge">{food.serving}</span>
          {recipe && <span className="badge prep">⏱ {recipe.totalMinutes} min total</span>}
          <span className="badge soft">estimates · editable in Foods</span>
        </div>

        <div className="macro-pills">
          <div><b>{Math.round(food.kcal * f)}</b><i>kcal</i></div>
          <div className="hi"><b>{round(food.protein * f, 0)}g</b><i>protein</i></div>
          <div><b>{round(food.carbs * f, 0)}g</b><i>carbs</i></div>
          <div><b>{round(food.fat * f, 0)}g</b><i>fat</i></div>
        </div>

        <div className="row between wrap gap">
          <div className="row gap center">
            <span className="muted">Servings</span>
            <Stepper value={sv} onChange={setSv} step={0.5} min={0.5} format={(v) => String(v)} />
          </div>
          {recipe && (
            <button className="btn ghost sm" onClick={() => setTicked(ticked.size === all ? new Set() : new Set(recipe.ingredients.map((_, i) => i)))}>
              {ticked.size === all ? 'Clear ticks' : 'Tick all'}
            </button>
          )}
        </div>

        {editing ? (
          <RecipeEditor food={food} initial={recipe} onDone={() => setEditing(false)} />
        ) : recipe ? (
          <>
            <h3 className="sec">
              Ingredients <small>{ticked.size}/{all} ready</small>
            </h3>
            <ul className="ingredients">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className={ticked.has(i) ? 'on' : ''}>
                  <button onClick={() => toggle(i)} aria-pressed={ticked.has(i)}>
                    <span className="check" aria-hidden>{ticked.has(i) ? '✓' : ''}</span>
                    <span className="ing-item">{ing.item}</span>
                    <span className="ing-amt">{scaleAmount(ing.amount, f)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <h3 className="sec">Method</h3>
            <ol className="steps">
              {recipe.steps.map((st, i) => (
                <li key={i}>
                  <span>{st.text}</span>
                  {st.timerSeconds ? <em className="badge">⏲ {Math.round(st.timerSeconds / 60)} min</em> : null}
                </li>
              ))}
            </ol>
            {recipe.tips?.map((t, i) => (
              <p className="tip" key={i}>💡 {t}</p>
            ))}
          </>
        ) : (
          <div className="empty compact">
            <strong>No recipe for this one yet</strong>
            <p>Add your own ingredients and steps and Cook mode will work for it too.</p>
          </div>
        )}

        {!editing && (
          <div className="recipe-actions">
            <div className="seg" role="radiogroup" aria-label="Meal">
              {MEALS.map((m) => (
                <button key={m.id} className={meal === m.id ? 'on' : ''} onClick={() => setMeal(m.id)} role="radio" aria-checked={meal === m.id}>
                  {m.icon}<span> {m.label}</span>
                </button>
              ))}
            </div>
            <div className="row gap wrap">
              {recipe && (
                <button className="btn big" onClick={() => onCook(sv)}>
                  👩‍🍳 Cook mode
                </button>
              )}
              <button
                className="btn primary big grow"
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  addMeal(todayStr(), meal, food.id, sv, { origin: { x: r.left + r.width / 2, y: r.top } })
                  onClose()
                }}
              >
                ＋ Log this meal ({fmtSv(sv)})
              </button>
            </div>
            <button className="linkish" onClick={() => setEditing(true)}>
              {recipe ? 'Edit recipe' : 'Write a recipe'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ Cook mode */
export function CookMode({ foodId, servings, onClose }: { foodId: string; servings: number; onClose: () => void }) {
  const s = useApp()
  const food = s.foods.find((f) => f.id === foodId)
  const recipe = recipeFor(s, foodId)
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const [left, setLeft] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [meal, setMeal] = useState<MealKind>(defaultMeal())
  const endAt = useRef(0)
  useWakeLock(true)
  useEscape(onClose)
  const steps = recipe?.steps ?? []
  const step = steps[i]

  // reset the timer when the step changes
  useEffect(() => {
    setRunning(false)
    setLeft(step?.timerSeconds ?? null)
  }, [i, step?.timerSeconds])

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      const rem = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000))
      setLeft(rem)
      if (rem <= 0) {
        setRunning(false)
        beep(4)
        toast(`Step ${i + 1} timer done ⏰`, { tone: 'win' })
      }
    }, 250)
    return () => clearInterval(t)
  }, [running, i])

  const go = useCallback(
    (d: number) => {
      buzz(8)
      setDir(d)
      setI((x) => Math.min(Math.max(0, x + d), steps.length))
    },
    [steps.length],
  )
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === ' ' && left) {
        e.preventDefault()
        toggleTimer()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })
  const toggleTimer = () => {
    if (left == null) return
    if (running) return setRunning(false)
    const start = left <= 0 ? step?.timerSeconds ?? 0 : left
    endAt.current = Date.now() + start * 1000
    setLeft(start)
    setRunning(true)
    buzz(10)
  }
  if (!food || !recipe) return null
  const finished = i >= steps.length
  const pct = (Math.min(i, steps.length) / steps.length) * 100
  const total = step?.timerSeconds ?? 0
  const frac = total && left != null ? left / total : 0
  const R = 54
  const C = 2 * Math.PI * R
  return (
    <Modal onClose={onClose} full className="cook">
      <div className="cook-wrap">
        <div className="cook-top">
          <div>
            <small className="muted">Cook mode · {servings} {servings === 1 ? 'serving' : 'servings'}</small>
            <strong>{food.name}</strong>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Exit cook mode">✕</button>
        </div>
        <div className="cook-progress"><i style={{ width: `${pct}%` }} /></div>
        <div className="cook-dots">
          {steps.map((_, k) => (
            <button key={k} className={k === i ? 'on' : k < i ? 'past' : ''} onClick={() => { setDir(k > i ? 1 : -1); setI(k) }} aria-label={`Step ${k + 1}`} />
          ))}
        </div>

        {!finished ? (
          <div className="cook-step" key={i} data-dir={dir > 0 ? 'fwd' : 'back'}>
            <span className="cook-num">Step {i + 1}<i> / {steps.length}</i></span>
            <p className="cook-text">{step.text}</p>
            {left != null && (
              <button className={`cook-timer ${running ? 'running' : ''} ${left === 0 ? 'done' : ''}`} onClick={toggleTimer} aria-label="Start or pause timer">
                <svg viewBox="0 0 120 120" aria-hidden>
                  <circle cx="60" cy="60" r={R} className="t-track" />
                  <circle cx="60" cy="60" r={R} className="t-prog" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 60 60)" />
                </svg>
                <b>{clock(left)}</b>
                <small>{left === 0 ? 'Done!' : running ? 'Tap to pause' : left < total ? 'Tap to resume' : 'Tap to start'}</small>
              </button>
            )}
            {left != null && left !== total && !running && (
              <button className="linkish" onClick={() => setLeft(total)}>Reset timer</button>
            )}
          </div>
        ) : (
          <div className="cook-step done" key="fin">
            <div className="cook-emoji">🍽️</div>
            <p className="cook-text">Done — enjoy!</p>
            <div className="seg" role="radiogroup">
              {MEALS.map((m) => (
                <button key={m.id} className={meal === m.id ? 'on' : ''} onClick={() => setMeal(m.id)}>{m.icon}</button>
              ))}
            </div>
            <button
              className="btn primary big"
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                addMeal(todayStr(), meal, foodId, servings, { origin: { x: r.left + r.width / 2, y: r.top } })
                onClose()
              }}
            >
              ＋ Log it to {meal}
            </button>
          </div>
        )}

        <div className="cook-nav">
          <button className="btn big" disabled={i === 0} onClick={() => go(-1)}>← Back</button>
          {!finished ? (
            <button className="btn primary big grow" onClick={() => go(1)}>{i === steps.length - 1 ? 'Finish ✓' : 'Next →'}</button>
          ) : (
            <button className="btn ghost big grow" onClick={onClose}>Close</button>
          )}
        </div>
        <small className="muted center-t">Screen stays awake while cooking · ← → keys · space starts the timer</small>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ What should I eat? */
export function IdeasModal({ onClose }: { onClose: () => void }) {
  const s = useApp()
  const date = todayStr()
  const t = totalsFor(s, date)
  const remK = Math.max(0, s.profile.kcalTarget - t.kcal)
  const remP = Math.max(0, s.profile.proteinTarget - t.protein)
  const [maxMin, setMaxMin] = useState<number>(0)
  const [seed, setSeed] = useState(0)
  const [meal, setMeal] = useState<MealKind>(defaultMeal())
  const hour = new Date().getHours()
  const mealsLeft = Math.max(1, hour < 11 ? 4 : hour < 16 ? 3 : hour < 21 ? 2 : 1)
  const perMeal = remK / mealsLeft
  const perMealP = remP / mealsLeft

  const ideas = useMemo(() => {
    void seed
    const scored = s.foods
      .map((f) => {
        const minutes = recipeFor(s, f.id)?.totalMinutes ?? f.prepMinutes ?? 0
        if (maxMin && (!minutes || minutes > maxMin)) return null
        // pick the servings (0.5 steps) that best fits the per-meal share
        let best = { sv: 1, score: Infinity }
        for (const sv of [0.5, 1, 1.5, 2]) {
          const dk = (f.kcal * sv - perMeal) / Math.max(perMeal, 200)
          const dp = (f.protein * sv - perMealP) / Math.max(perMealP, 20)
          const over = f.kcal * sv > remK + 150 ? 2 : 0
          const sc = Math.abs(dk) * 0.8 + Math.abs(dp) * 1.2 + over
          if (sc < best.score) best = { sv, score: sc }
        }
        // protein density bonus; small random jitter on shuffle
        const dens = f.protein / Math.max(f.kcal, 1)
        const jitter = (Math.sin(f.id.length * 12.9898 + seed * 78.233) * 43758.5453) % 1
        return { f, sv: best.sv, minutes, score: best.score - dens * 2 + Math.abs(jitter) * (seed ? 0.6 : 0.05) }
      })
      .filter(Boolean) as { f: Food; sv: number; minutes: number; score: number }[]
    return scored.sort((a, b) => a.score - b.score).slice(0, 6)
  }, [s, maxMin, seed, perMeal, perMealP, remK])

  return (
    <Modal onClose={onClose} wide title="What should I eat?">
      <div className="stack gap">
        {remK === 0 && remP === 0 ? (
          <div className="gap-card win">🎯 Targets already hit today — anything below is a bonus.</div>
        ) : (
          <div className="gap-card">
            <div><small>Still to go</small><b>{Math.round(remK)} kcal</b></div>
            <div><small>Protein gap</small><b>{Math.round(remP)} g</b></div>
            <div><small>≈ per remaining meal</small><b>{Math.round(perMeal)} kcal · {Math.round(perMealP)}g</b></div>
          </div>
        )}
        <div className="row gap wrap between">
          <div className="seg small" role="group" aria-label="Max prep time">
            {[0, 10, 15, 30].map((m) => (
              <button key={m} className={maxMin === m ? 'on' : ''} onClick={() => setMaxMin(m)}>
                {m ? `≤ ${m} min` : 'Any time'}
              </button>
            ))}
          </div>
          <button className="btn ghost sm" onClick={() => { buzz(10); setSeed((x) => x + 1) }}>🎲 Shuffle</button>
        </div>
        <div className="seg" role="radiogroup" aria-label="Log to meal">
          {MEALS.map((m) => (
            <button key={m.id} className={meal === m.id ? 'on' : ''} onClick={() => setMeal(m.id)}>{m.icon}<span> {m.label}</span></button>
          ))}
        </div>
        {ideas.length === 0 ? (
          <div className="empty compact"><strong>Nothing that quick</strong><p>Try a longer prep time.</p></div>
        ) : (
          <div className="ideas">
            {ideas.map(({ f, sv, minutes }, k) => (
              <div className="idea" key={f.id} style={{ animationDelay: `${k * 55}ms` }}>
                <button className="idea-main" onClick={() => { onClose(); setTimeout(() => openRecipe(f.id), 60) }}>
                  <strong>{f.name}</strong>
                  <span className="muted">{sv === 1 ? f.serving : `${sv} × ${f.serving}`}</span>
                  <span className="idea-macros">
                    <b>{Math.round(f.kcal * sv)}</b> kcal · <b className="acc">{Math.round(f.protein * sv)}g</b> protein
                    {minutes ? <PrepBadge minutes={minutes} /> : null}
                  </span>
                </button>
                <button
                  className="btn primary sm"
                  onClick={(e) => {
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    addMeal(date, meal, f.id, sv, { origin: { x: r.left, y: r.top } })
                  }}
                >
                  ＋ Log
                </button>
              </div>
            ))}
          </div>
        )}
        <small className="muted">Suggestions aim to close today’s gap, split across the meals you have left. Tap a card for the recipe.</small>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ host */
export function ModalHost() {
  const [m, setM] = useState<ModalReq | null>(null)
  useEffect(() => modalBus.on(setM), [])
  const close = () => setM(null)
  if (!m) return null
  if (m.kind === 'recipe') return <RecipeModal foodId={m.foodId} onClose={close} onCook={(sv) => setM({ kind: 'cook', foodId: m.foodId, servings: sv })} />
  if (m.kind === 'cook') return <CookMode foodId={m.foodId} servings={m.servings} onClose={close} />
  if (m.kind === 'ideas') return <IdeasModal onClose={onClose2(close)} />
  return null
}
function onClose2(f: () => void) {
  return f
}
