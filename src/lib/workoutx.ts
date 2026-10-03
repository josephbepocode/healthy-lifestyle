import { makeStore } from './kv'
import { beep, buzz } from './util'
import { useSyncExternalStore } from 'react'

/* ---------------- per-exercise rep ranges + rest timer settings ---------------- */
const COMPOUND = new Set(['squat', 'rdl', 'bench', 'ohp', 'pullup', 'row', 'deadlift', 'incline-db', 'leg-press'])
const TALL = new Set(['calf-raise', 'lateral-raise', 'face-pull'])
export const defaultRange = (id: string): [number, number] => (id === 'deadlift' ? [5, 8] : TALL.has(id) ? [12, 15] : COMPOUND.has(id) && id !== 'leg-press' && id !== 'incline-db' ? [6, 10] : [8, 12])
export const isCompound = (id: string) => COMPOUND.has(id) && id !== 'leg-press' && id !== 'incline-db'

export const wx = makeStore<{ v: 1; ranges: Record<string, [number, number]>; restOn: boolean; rest: number; restCompound: number }>('healthy-workout.v1', () => ({ v: 1, ranges: {}, restOn: true, rest: 90, restCompound: 120 }))
export const rangeOf = (id: string): [number, number] => wx.get().ranges[id] ?? defaultRange(id)
export const setRange = (id: string, r: [number, number]) => wx.set((s) => ({ ...s, ranges: { ...s.ranges, [id]: r } }))
export const setRest = (p: Partial<{ restOn: boolean; rest: number; restCompound: number }>) => wx.set((s) => ({ ...s, ...p }))

/** Progression: every set of the last session reached the top of the rep range → add 2.5 kg. */
export function progression(sets: { reps: number; kg: number }[], id: string): { add: boolean; hit: number; total: number; nextKg: number } {
  if (!sets.length) return { add: false, hit: 0, total: 0, nextKg: 0 }
  const [, hi] = rangeOf(id)
  const top = Math.max(...sets.map((x) => x.kg))
  const work = sets.filter((x) => x.kg >= top)
  const hit = work.filter((x) => x.reps >= hi).length
  return { add: work.length >= 2 && hit === work.length, hit, total: work.length, nextKg: top + 2.5 }
}

/* ---------------- rest timer (global so it survives tab changes) ---------------- */
interface Rest { end: number; total: number; ex: string } 
let rest: Rest | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
let timer = 0
export function startRest(exId: string) {
  const c = wx.get()
  if (!c.restOn) return
  const total = isCompound(exId) ? c.restCompound : c.rest
  rest = { end: Date.now() + total * 1000, total, ex: exId }
  clearTimeout(timer)
  timer = window.setTimeout(done, total * 1000 + 50)
  emit()
}
function done() {
  if (!rest) return
  rest = null
  beep(3)
  buzz(300)
  emit()
}
export function skipRest() {
  clearTimeout(timer)
  rest = null
  emit()
}
export function adjustRest(sec: number) {
  if (!rest) return
  const end = Math.max(Date.now() + 1000, rest.end + sec * 1000)
  rest = { ...rest, end, total: rest.total + sec }
  clearTimeout(timer)
  timer = window.setTimeout(done, end - Date.now() + 50)
  emit()
}
export const useRest = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => rest, () => rest)
