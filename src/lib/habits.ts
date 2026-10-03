import { makeStore } from './kv'
import { addDays, round, todayStr } from './util'

/* ---------------- habits: water, creatine, sleep ---------------- */
export interface HabitsState {
  v: 1
  waterTarget: number
  glass: number
  sleepTarget: number
  water: Record<string, number>
  creatine: Record<string, boolean>
  sleep: Record<string, number>
}
export const habits = makeStore<HabitsState>('healthy-habits.v1', () => ({ v: 1, waterTarget: 3000, glass: 250, sleepTarget: 7, water: {}, creatine: {}, sleep: {} }))
export const addWater = (date: string, ml: number) => habits.set((s) => ({ ...s, water: { ...s.water, [date]: Math.max(0, (s.water[date] || 0) + ml) } }))
export const setCreatine = (date: string, on: boolean) => habits.set((s) => ({ ...s, creatine: { ...s.creatine, [date]: on } }))
export const setSleep = (date: string, h: number) => habits.set((s) => ({ ...s, sleep: { ...s.sleep, [date]: h } }))
export const setHabitCfg = (p: Partial<Pick<HabitsState, 'waterTarget' | 'glass' | 'sleepTarget'>>) => habits.set((s) => ({ ...s, ...p }))

/** consecutive days ending today (or yesterday if today isn't done yet) where ok(day) is true */
export function streakOf(ok: (d: string) => boolean, today = todayStr()): number {
  let d = ok(today) ? today : addDays(today, -1)
  let n = 0
  while (n < 3650 && ok(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}
export const waterOk = (s: HabitsState) => (d: string) => (s.water[d] || 0) >= s.waterTarget
export const creatineOk = (s: HabitsState) => (d: string) => !!s.creatine[d]
export const sleepOk = (s: HabitsState) => (d: string) => (s.sleep[d] || 0) >= s.sleepTarget

/* ---------------- body measurements (cm) ---------------- */
export const SITES = [
  { id: 'waist', label: 'Waist' },
  { id: 'chest', label: 'Chest' },
  { id: 'arms', label: 'Arms' },
  { id: 'thighs', label: 'Thighs' },
] as const
export type Site = (typeof SITES)[number]['id']
export interface BodyEntry {
  date: string
  waist?: number
  chest?: number
  arms?: number
  thighs?: number
}
export const body = makeStore<{ v: 1; entries: BodyEntry[] }>('healthy-body.v1', () => ({ v: 1, entries: [] }))
export function saveBody(e: BodyEntry) {
  body.set((s) => {
    const prev = s.entries.find((x) => x.date === e.date)
    const merged = { ...prev, ...e }
    return { ...s, entries: [...s.entries.filter((x) => x.date !== e.date), merged].sort((a, b) => a.date.localeCompare(b.date)) }
  })
}
export const deleteBody = (date: string) => body.set((s) => ({ ...s, entries: s.entries.filter((x) => x.date !== date) }))

/* ---------------- weekly weigh-in check ---------------- */
export interface WeighCheck {
  state: 'need' | 'slow' | 'ok' | 'fast'
  rate?: number
  from?: { date: string; kg: number }
  to?: { date: string; kg: number }
  days?: number
  need?: string
}
/** Average weekly change between the latest weigh-in and the oldest one inside the 14–7 days before it. */
export function weighCheck(w: { date: string; kg: number }[]): WeighCheck {
  const s = [...w].sort((a, b) => a.date.localeCompare(b.date))
  const last = s[s.length - 1]
  if (!last) return { state: 'need', need: 'Log your first weigh-in to start the weekly check.' }
  const day = (a: string, b: string) => Math.round((new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime()) / 86400000)
  const older = s.filter((x) => day(last.date, x.date) >= 7)
  if (!older.length) return { state: 'need', to: last, need: `Need a second weigh-in at least 7 days apart — your latest is ${last.date}; log another on or after ${addDays(last.date, 7)}.` }
  const inWin = older.filter((x) => day(last.date, x.date) <= 14)
  const ref = inWin.length ? inWin[0] : older[older.length - 1]
  const days = day(last.date, ref.date)
  const rate = round((last.kg - ref.kg) / (days / 7), 2)
  return { state: rate < 0.25 ? 'slow' : rate > 0.5 ? 'fast' : 'ok', rate, from: ref, to: last, days }
}
