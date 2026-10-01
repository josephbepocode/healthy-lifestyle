import { useSyncExternalStore } from 'react'
import type { AppState } from '../types'
import { BLOCKED_SEED_IDS, SEED_EXERCISES, SEED_FOODS, SEED_PROFILE, SEED_TASKS, isBlockedFood } from './seed'

const KEY = 'healthy-lifestyle.v1'

function fresh(): AppState {
  return {
    v: 1,
    profile: { ...SEED_PROFILE },
    foods: [],
    mealLog: [],
    weighIns: [],
    exercises: [],
    workoutLog: [],
    tasks: [],
    timeEntries: [],
    activeTimer: null,
    customRecipes: {},
    meta: { seededFoodIds: [], seededExerciseIds: [], tasksSeeded: false, weighInSeeded: false },
  }
}

/**
 * Merge seed data into whatever is in localStorage WITHOUT overwriting user edits:
 *  - foods/exercises: only seed ids never seen before are added (deleted ones stay deleted, edited ones stay edited)
 *  - blocked seed foods (swallows / tuna / fresh fish) are removed if an older build stored them
 *  - tasks and the starting weigh-in are seeded once
 */
function reconcile(s: AppState): AppState {
  const next = { ...fresh(), ...s, meta: { ...fresh().meta, ...(s.meta || {}) } }
  next.profile = { ...SEED_PROFILE, ...(s.profile || {}) }
  const seenF = new Set(next.meta.seededFoodIds)
  const foods = (next.foods || []).filter((f) => !BLOCKED_SEED_IDS.has(f.id) && !(seenF.has(f.id) && isBlockedFood(f)))
  const have = new Set(foods.map((f) => f.id))
  for (const f of SEED_FOODS) {
    if (!seenF.has(f.id)) {
      seenF.add(f.id)
      if (!have.has(f.id)) foods.push({ ...f })
    }
  }
  next.foods = foods
  next.mealLog = (next.mealLog || []).filter((m) => !BLOCKED_SEED_IDS.has(m.foodId))
  next.meta.seededFoodIds = [...seenF]

  const seenE = new Set(next.meta.seededExerciseIds)
  const ex = [...(next.exercises || [])]
  const haveE = new Set(ex.map((e) => e.id))
  for (const e of SEED_EXERCISES) {
    if (!seenE.has(e.id)) {
      seenE.add(e.id)
      if (!haveE.has(e.id)) ex.push({ ...e })
    }
  }
  next.exercises = ex
  next.meta.seededExerciseIds = [...seenE]

  if (!next.meta.tasksSeeded) {
    next.meta.tasksSeeded = true
    const ids = new Set((next.tasks || []).map((t) => t.id))
    next.tasks = [
      ...(next.tasks || []),
      ...SEED_TASKS.filter((t) => !ids.has(t.id)).map((t) => ({ ...t, done: false, createdAt: new Date().toISOString() })),
    ]
  }
  if (!next.meta.weighInSeeded) {
    next.meta.weighInSeeded = true
    if (!(next.weighIns || []).some((w) => w.date === '2026-10-01')) {
      next.weighIns = [...(next.weighIns || []), { date: '2026-10-01', kg: 70 }]
    }
  }
  return next
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return reconcile(JSON.parse(raw) as AppState)
  } catch (e) {
    console.warn('Could not read saved data, starting fresh', e)
  }
  return reconcile(fresh())
}

let state: AppState = load()
try {
  localStorage.setItem(KEY, JSON.stringify(state))
} catch {
  /* storage unavailable */
}
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function getState() {
  return state
}
export function setState(fn: (s: AppState) => AppState) {
  state = fn(state)
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('Could not save', e)
  }
  emit()
}
/** replace whole state (used by undo) */
export function restoreState(s: AppState) {
  setState(() => s)
}
export function resetAll() {
  state = reconcile(fresh())
  localStorage.setItem(KEY, JSON.stringify(state))
  emit()
}
export function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && e.newValue) {
      try {
        state = reconcile(JSON.parse(e.newValue))
        emit()
      } catch {
        /* ignore */
      }
    }
  })
}
export function useApp(): AppState {
  return useSyncExternalStore(subscribe, getState, getState)
}
