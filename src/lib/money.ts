import { useSyncExternalStore } from 'react'
import { addDays, clamp, diffDays, todayStr, uid } from './util'

/** Money tab state. Lives under its OWN localStorage key so the main app data is never touched. */
const KEY = 'healthy-money.v1'

export type Priority = 'need' | 'want' | 'someday'
export interface Wish {
  id: string
  name: string
  price: number
  priority: Priority
  link?: string
  note?: string
  bought: boolean
  /** true while the price is still the seeded placeholder (cleared once the user edits the item) */
  placeholder?: boolean
}
export interface Expense {
  id: string
  amount: number
  cat: string
  date: string
  note?: string
}
export interface MoneyState {
  v: 1
  paycheck: number
  nextPayday: string
  alloc: Record<string, number>
  fundFrom: 'wants' | 'both'
  wishes: Wish[]
  expenses: Expense[]
}

export const CATS = [
  { id: 'rent', label: 'Rent / housing', short: 'Rent', color: '#B6FF3B' },
  { id: 'groceries', label: 'Groceries', short: 'Groceries', color: '#7affc8' },
  { id: 'protein', label: 'Protein extras', short: 'Protein', color: '#4fd1c5' },
  { id: 'gym', label: 'Gym membership', short: 'Gym', color: '#7aa2ff' },
  { id: 'transport', label: 'Transport', short: 'Transport', color: '#a78bfa' },
  { id: 'bills', label: 'Phone / bills', short: 'Bills', color: '#f0abfc' },
  { id: 'savings', label: 'Savings', short: 'Savings', color: '#ffffff' },
  { id: 'fun', label: 'Fun', short: 'Fun', color: '#ffb86b' },
  { id: 'tests', label: 'Language / test fees (CELPIP, French)', short: 'Tests', color: '#ff8fa3' },
  { id: 'wants', label: 'Wants', short: 'Wants', color: '#e5ff8a' },
  { id: 'other', label: 'Other', short: 'Other', color: '#8b94a5' },
] as const
export type CatId = (typeof CATS)[number]['id']
export const catOf = (id: string) => CATS.find((c) => c.id === id) ?? CATS[CATS.length - 1]

/** Starting guess — sums to exactly 1800. All editable. */
export const SEED_ALLOC: Record<string, number> = {
  rent: 400,
  groceries: 240,
  protein: 25,
  gym: 30,
  transport: 120,
  bills: 100,
  savings: 300,
  fun: 100,
  tests: 150,
  wants: 200,
  other: 135,
}

const PLACEHOLDER_NOTE = 'Placeholder estimate — check the real price and edit.'
function seedWishes(): Wish[] {
  return [
    { id: 'w-celpip', name: 'CELPIP General test fee', price: 300, priority: 'need', note: PLACEHOLDER_NOTE + ' (approx. $300 CAD; confirm on the official site.)', bought: false, placeholder: true },
    { id: 'w-groad', name: 'G road test fee', price: 120, priority: 'need', note: PLACEHOLDER_NOTE, bought: false, placeholder: true },
    { id: 'w-french', name: 'French course / app', price: 80, priority: 'want', note: PLACEHOLDER_NOTE, bought: false, placeholder: true },
    { id: 'w-shoes', name: 'Gym shoes', price: 110, priority: 'want', note: PLACEHOLDER_NOTE, bought: false, placeholder: true },
  ]
}

export const DEFAULT_PAYDAY = '2026-10-09'

function fresh(): MoneyState {
  return { v: 1, paycheck: 1800, nextPayday: DEFAULT_PAYDAY, alloc: { ...SEED_ALLOC }, fundFrom: 'both', wishes: seedWishes(), expenses: [] }
}

function load(): MoneyState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<MoneyState>
      const f = fresh()
      return {
        ...f,
        ...p,
        v: 1,
        alloc: { ...f.alloc, ...(p.alloc || {}) },
        wishes: Array.isArray(p.wishes) ? p.wishes : f.wishes,
        expenses: Array.isArray(p.expenses) ? p.expenses : [],
      }
    }
  } catch {
    /* corrupt — fall back to a fresh state */
  }
  return fresh()
}

let state: MoneyState = load()
const subs = new Set<() => void>()
function commit(next: MoneyState) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage full / blocked — keep working in memory */
  }
  subs.forEach((f) => f())
}
export const getMoney = () => state
export function useMoney() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => state,
  )
}
if (typeof window !== 'undefined') {
  addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load()
      subs.forEach((f) => f())
    }
  })
}

/* ------------------------------------------------ actions */
export const setPaycheck = (n: number) => commit({ ...state, paycheck: clamp(Math.round(n * 100) / 100, 0, 1e6) })
export const setNextPayday = (d: string) => d && commit({ ...state, nextPayday: d })
export const setAlloc = (cat: string, n: number) => commit({ ...state, alloc: { ...state.alloc, [cat]: clamp(Math.round(n * 100) / 100, 0, 1e6) } })
export const resetAlloc = () => commit({ ...state, alloc: { ...SEED_ALLOC }, paycheck: 1800 })
export const setFundFrom = (f: 'wants' | 'both') => commit({ ...state, fundFrom: f })
export function dumpRemainderTo(cat: string) {
  const rem = state.paycheck - totalAlloc(state)
  commit({ ...state, alloc: { ...state.alloc, [cat]: Math.max(0, Math.round(((state.alloc[cat] || 0) + rem) * 100) / 100) } })
}
export function saveWish(w: Omit<Wish, 'id' | 'bought'> & { id?: string }) {
  if (w.id) commit({ ...state, wishes: state.wishes.map((x) => (x.id === w.id ? { ...x, ...w, placeholder: false } : x)) })
  else commit({ ...state, wishes: [...state.wishes, { ...w, id: uid('w'), bought: false, placeholder: false }] })
}
export const deleteWish = (id: string) => commit({ ...state, wishes: state.wishes.filter((w) => w.id !== id) })
export const restoreWishes = (list: Wish[]) => commit({ ...state, wishes: list })
export const toggleBought = (id: string) => commit({ ...state, wishes: state.wishes.map((w) => (w.id === id ? { ...w, bought: !w.bought } : w)) })
/** Move a wish to sit at the position of `targetId` (both among the same array). */
export function moveWish(id: string, targetId: string) {
  if (id === targetId) return
  const list = [...state.wishes]
  const from = list.findIndex((w) => w.id === id)
  const to = list.findIndex((w) => w.id === targetId)
  if (from < 0 || to < 0) return
  const [it] = list.splice(from, 1)
  list.splice(to, 0, it)
  commit({ ...state, wishes: list })
}
const PW: Record<Priority, number> = { need: 0, want: 1, someday: 2 }
export const sortWishesByPriority = () => commit({ ...state, wishes: [...state.wishes].sort((a, b) => PW[a.priority] - PW[b.priority]) })
export const addExpense = (e: Omit<Expense, 'id'>) => commit({ ...state, expenses: [{ ...e, id: uid('x') }, ...state.expenses] })
export const deleteExpense = (id: string) => commit({ ...state, expenses: state.expenses.filter((e) => e.id !== id) })
export const restoreExpenses = (list: Expense[]) => commit({ ...state, expenses: list })

/* ------------------------------------------------ derived */
export const totalAlloc = (s: MoneyState) => Object.values(s.alloc).reduce((a, b) => a + (b || 0), 0)

export interface Period {
  start: string // first day of the period (previous payday)
  next: string // next payday
  end: string // last day of the period
  length: number
  daysLeft: number
  elapsed: number
}
/** Bi-weekly: roll the chosen payday forward in 14-day steps so the period always contains today. */
export function periodFor(nextPayday: string, today = todayStr()): Period {
  let next = nextPayday
  if (diffDays(next, today) <= 0) {
    const steps = Math.ceil((diffDays(today, next) + 1) / 14)
    next = addDays(next, steps * 14)
  } else {
    while (diffDays(next, today) > 14) next = addDays(next, -14)
  }
  const start = addDays(next, -14)
  return { start, next, end: addDays(next, -1), length: 14, daysLeft: diffDays(next, today), elapsed: clamp(diffDays(today, start), 0, 14) }
}

export function spentByCat(s: MoneyState, p: Period) {
  const out: Record<string, number> = {}
  for (const e of s.expenses) if (e.date >= p.start && e.date <= p.end) out[e.cat] = (out[e.cat] || 0) + e.amount
  return out
}

export interface Slot {
  wish: Wish
  /** cumulative cost of this item and everything above it in the queue */
  cumulative: number
  /** 0 = fundable from this paycheck's money; n>0 = n more paychecks after this one */
  paychecks: number
  /** funded fraction right now (0..1) */
  funded: number
  date: string
}
export function planWishes(s: MoneyState, p: Period, spent: Record<string, number>) {
  const per = (s.alloc.wants || 0) + (s.fundFrom === 'both' ? s.alloc.savings || 0 : 0)
  const used = (spent.wants || 0) + (s.fundFrom === 'both' ? spent.savings || 0 : 0)
  const avail = Math.max(0, per - used)
  let cum = 0
  const slots: Slot[] = []
  for (const w of s.wishes) {
    if (w.bought) continue
    const prev = cum
    cum += w.price
    let n = 0
    if (cum > avail) n = per > 0 ? Math.ceil((cum - avail) / per) : Infinity
    slots.push({
      wish: w,
      cumulative: cum,
      paychecks: n,
      funded: w.price <= 0 ? 1 : clamp((avail - prev) / w.price, 0, 1),
      date: Number.isFinite(n) ? (n === 0 ? p.start : addDays(p.next, (n - 1) * 14)) : '',
    })
  }
  return { per, avail, slots, total: cum }
}

export const fmtMoney = (n: number, cents = false) =>
  n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: cents || !Number.isInteger(Math.round(n * 100) / 100) ? 2 : 0, maximumFractionDigits: 2 })
