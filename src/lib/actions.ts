import { getState, restoreState, setState } from './store'
import { confetti, toast } from './fx'
import { buzz, round, todayStr, uid } from './util'
import type { AppState, Food, MealEntry, MealKind, Priority, Recipe, SetEntry, Task, TimeEntry, DayKey } from '../types'
import { SEED_RECIPES } from './seed'

export const MEALS: { id: MealKind; label: string; icon: string }[] = [
  { id: 'breakfast', label: 'Breakfast', icon: '☀️' },
  { id: 'lunch', label: 'Lunch', icon: '🥗' },
  { id: 'dinner', label: 'Dinner', icon: '🍲' },
  { id: 'snack', label: 'Snack', icon: '🍌' },
]
export const defaultMeal = (d = new Date()): MealKind => {
  const h = d.getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

export interface Totals {
  kcal: number
  protein: number
  carbs: number
  fat: number
}
export const zero = (): Totals => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 })

export function foodOf(s: AppState, e: MealEntry): (Food & { deleted?: boolean }) | undefined {
  const f = s.foods.find((x) => x.id === e.foodId)
  if (f) return f
  if (e.snap) return { id: e.foodId, ...e.snap, deleted: true }
  return undefined
}
export function totalsFor(s: AppState, date: string, meal?: MealKind): Totals {
  const t = zero()
  for (const e of s.mealLog) {
    if (e.date !== date || (meal && e.meal !== meal)) continue
    const f = foodOf(s, e)
    if (!f) continue
    t.kcal += f.kcal * e.servings
    t.protein += f.protein * e.servings
    t.carbs += f.carbs * e.servings
    t.fat += f.fat * e.servings
  }
  return t
}
export const recipeFor = (s: AppState, foodId: string): Recipe | undefined => s.customRecipes[foodId] || SEED_RECIPES[foodId]

function snapshot(): AppState {
  return getState()
}
function undoer(prev: AppState) {
  return () => {
    restoreState(prev)
    buzz(8)
  }
}

/* ---------------------------------------------------------- meals */
export function addMeal(date: string, meal: MealKind, foodId: string, servings = 1, opts: { silent?: boolean; origin?: { x: number; y: number } } = {}) {
  const prev = snapshot()
  const before = totalsFor(prev, date)
  const entry: MealEntry = { id: uid('m'), date, meal, foodId, servings }
  // merge with an identical entry in the same meal so repeated taps just bump servings
  const existing = prev.mealLog.find((e) => e.date === date && e.meal === meal && e.foodId === foodId)
  setState((s) => ({
    ...s,
    mealLog: existing
      ? s.mealLog.map((e) => (e.id === existing.id ? { ...e, servings: round(e.servings + servings, 2) } : e))
      : [...s.mealLog, entry],
  }))
  buzz(15)
  const after = totalsFor(getState(), date)
  const p = prev.profile
  const food = prev.foods.find((f) => f.id === foodId)
  const hitK = before.kcal < p.kcalTarget && after.kcal >= p.kcalTarget
  const hitP = before.protein < p.proteinTarget && after.protein >= p.proteinTarget
  if (date === todayStr() && (hitK || hitP)) {
    confetti({ big: true, ...(opts.origin || {}) })
    toast(hitK && hitP ? 'Both targets hit — absolute machine 🔥' : hitK ? 'Calorie target smashed 🎯' : 'Protein target hit 💪', { tone: 'win' })
  } else if (!opts.silent) {
    toast(`Added ${servings === 1 ? '1 serving' : servings + ' servings'} of ${food?.name ?? 'food'} to ${meal}`, { undo: undoer(prev) })
  }
}
export function setServings(id: string, servings: number) {
  setState((s) => ({ ...s, mealLog: s.mealLog.map((e) => (e.id === id ? { ...e, servings: Math.max(0.25, round(servings, 2)) } : e)) }))
  buzz(6)
}
export function moveEntry(id: string, meal: MealKind) {
  setState((s) => ({ ...s, mealLog: s.mealLog.map((e) => (e.id === id ? { ...e, meal } : e)) }))
}
export function deleteEntry(id: string) {
  const prev = snapshot()
  setState((s) => ({ ...s, mealLog: s.mealLog.filter((e) => e.id !== id) }))
  toast('Entry removed', { undo: undoer(prev) })
}

/* ---------------------------------------------------------- foods */
export function saveFood(f: Food) {
  setState((s) => {
    const exists = s.foods.some((x) => x.id === f.id)
    return { ...s, foods: exists ? s.foods.map((x) => (x.id === f.id ? f : x)) : [...s.foods, f] }
  })
  toast(`Saved ${f.name}`)
}
export function newFoodId(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'food'
  const ids = new Set(getState().foods.map((f) => f.id))
  let id = `my-${base}`
  let n = 2
  while (ids.has(id)) id = `my-${base}-${n++}`
  return id
}
export function deleteFood(id: string) {
  const prev = snapshot()
  const f = prev.foods.find((x) => x.id === id)
  if (!f) return
  const { id: _omit, ...snap } = f
  void _omit
  setState((s) => ({
    ...s,
    foods: s.foods.filter((x) => x.id !== id),
    mealLog: s.mealLog.map((e) => (e.foodId === id ? { ...e, snap } : e)),
  }))
  toast(`Deleted ${f.name}`, { undo: undoer(prev) })
}
export function saveRecipe(foodId: string, r: Recipe) {
  setState((s) => ({ ...s, customRecipes: { ...s.customRecipes, [foodId]: r } }))
  toast('Recipe saved')
}

/* ---------------------------------------------------------- profile */
export function updateProfile(p: Partial<AppState['profile']>) {
  setState((s) => ({ ...s, profile: { ...s.profile, ...p } }))
}

/* ---------------------------------------------------------- weigh-ins */
export function addWeighIn(date: string, kg: number) {
  setState((s) => {
    const others = s.weighIns.filter((w) => w.date !== date)
    const weighIns = [...others, { date, kg }].sort((a, b) => a.date.localeCompare(b.date))
    return { ...s, weighIns, profile: { ...s.profile, weightKg: weighIns[weighIns.length - 1].kg } }
  })
  buzz(15)
  toast(`Logged ${kg} kg`)
}
export function deleteWeighIn(date: string) {
  const prev = snapshot()
  setState((s) => {
    const weighIns = s.weighIns.filter((w) => w.date !== date)
    return { ...s, weighIns, profile: { ...s.profile, weightKg: weighIns.length ? weighIns[weighIns.length - 1].kg : s.profile.weightKg } }
  })
  toast('Weigh-in removed', { undo: undoer(prev) })
}

/* ---------------------------------------------------------- workouts */
export function addSet(date: string, day: DayKey, set: SetEntry) {
  const prev = snapshot()
  const prHit = isPR(prev, set.exerciseId, set.kg, date)
  setState((s) => {
    const log = s.workoutLog.find((w) => w.date === date && w.day === day)
    return {
      ...s,
      workoutLog: log
        ? s.workoutLog.map((w) => (w === log ? { ...w, sets: [...w.sets, set] } : w))
        : [...s.workoutLog, { date, day, sets: [set] }],
    }
  })
  buzz(20)
  if (prHit) {
    confetti({ big: false })
    toast(`New PR! ${set.kg} kg × ${set.reps} 🏆`, { tone: 'win' })
  }
}
export function isPR(s: AppState, exerciseId: string, kg: number, date: string) {
  let best = 0
  let any = false
  for (const w of s.workoutLog) {
    for (const x of w.sets) {
      if (x.exerciseId !== exerciseId) continue
      if (w.date === date) {
        best = Math.max(best, x.kg)
        any = true
      } else {
        best = Math.max(best, x.kg)
        any = true
      }
    }
  }
  return any && kg > best
}
export function deleteSet(date: string, day: DayKey, index: number) {
  setState((s) => ({
    ...s,
    workoutLog: s.workoutLog
      .map((w) => (w.date === date && w.day === day ? { ...w, sets: w.sets.filter((_, i) => i !== index) } : w))
      .filter((w) => w.sets.length > 0),
  }))
}

/* ---------------------------------------------------------- tasks */
export function saveTask(t: Partial<Task> & { title: string }) {
  setState((s) => {
    if (t.id && s.tasks.some((x) => x.id === t.id)) return { ...s, tasks: s.tasks.map((x) => (x.id === t.id ? { ...x, ...t } : x)) }
    const task: Task = { id: uid('t'), title: t.title, due: t.due || undefined, priority: (t.priority as Priority) || 'med', done: false, createdAt: new Date().toISOString() }
    return { ...s, tasks: [...s.tasks, task] }
  })
}
export function toggleTask(id: string) {
  const t = getState().tasks.find((x) => x.id === id)
  setState((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) }))
  buzz(10)
  if (t && !t.done) {
    const open = getState().tasks.filter((x) => !x.done).length
    if (open === 0) {
      confetti({ big: true })
      toast('Inbox zero — all tasks done 🎉', { tone: 'win' })
    }
  }
}
export function deleteTask(id: string) {
  const prev = snapshot()
  setState((s) => ({ ...s, tasks: s.tasks.filter((x) => x.id !== id) }))
  toast('Task deleted', { undo: undoer(prev) })
}

/* ---------------------------------------------------------- time */
export function startTimer(label: string, category: string) {
  setState((s) => ({ ...s, activeTimer: { label: label.trim() || category, category, startedAt: Date.now() } }))
  buzz(15)
}
export function stopTimer() {
  const a = getState().activeTimer
  if (!a) return
  const seconds = Math.round((Date.now() - a.startedAt) / 1000)
  setState((s) => {
    const entry: TimeEntry = { id: uid('te'), date: todayStr(), label: a.label, category: a.category, seconds, startedAt: new Date(a.startedAt).toISOString() }
    return { ...s, activeTimer: null, timeEntries: seconds >= 1 ? [...s.timeEntries, entry] : s.timeEntries }
  })
  buzz(15)
  toast(`Logged ${Math.max(1, Math.round(seconds / 60))} min on ${a.label}`)
}
export function discardTimer() {
  setState((s) => ({ ...s, activeTimer: null }))
}
export function addTimeEntry(e: Omit<TimeEntry, 'id'>) {
  setState((s) => ({ ...s, timeEntries: [...s.timeEntries, { ...e, id: uid('te') }] }))
  toast('Time entry added')
}
export function deleteTimeEntry(id: string) {
  const prev = snapshot()
  setState((s) => ({ ...s, timeEntries: s.timeEntries.filter((x) => x.id !== id) }))
  toast('Entry deleted', { undo: undoer(prev) })
}
export const CATEGORIES = ['Study', 'Work', 'Workout', 'Cooking', 'Admin', 'Other']
