import { makeStore } from './kv'
import { addDays, diffDays, parseYmd, todayStr, uid, ymd } from './util'

export interface Bill {
  id: string
  name: string
  amount: number
  freq: 'monthly' | 'biweekly'
  /** monthly: day of month (1–31). biweekly: ignored (uses anchor) */
  day: number
  /** biweekly: any date it was/is due; every 14 days from it */
  anchor?: string
}
export const bills = makeStore<{ v: 1; bills: Bill[] }>('healthy-bills.v1', () => ({
  v: 1,
  bills: [{ id: 'rent', name: 'Rent', amount: 990, freq: 'monthly', day: 1 }],
}))
export const saveBill = (b: Omit<Bill, 'id'> & { id?: string }) =>
  bills.set((s) => ({ ...s, bills: b.id && s.bills.some((x) => x.id === b.id) ? s.bills.map((x) => (x.id === b.id ? { ...x, ...b } as Bill : x)) : [...s.bills, { ...b, id: uid('b') } as Bill] }))
export const deleteBill = (id: string) => bills.set((s) => ({ ...s, bills: s.bills.filter((b) => b.id !== id) }))

/** every due date of a bill inside [from, to] (inclusive, YYYY-MM-DD) */
export function dueDates(b: Bill, from: string, to: string): string[] {
  const out: string[] = []
  if (to < from) return out
  if (b.freq === 'biweekly') {
    const a = b.anchor || from
    let n = Math.ceil(diffDays(from, a) / 14)
    for (let d = addDays(a, n * 14); d <= to; d = addDays(d, 14)) if (d >= from) out.push(d)
    return out
  }
  const f = parseYmd(from)
  const t = parseYmd(to)
  let y = f.getFullYear()
  let m = f.getMonth()
  while (y < t.getFullYear() || (y === t.getFullYear() && m <= t.getMonth())) {
    const dim = new Date(y, m + 1, 0).getDate()
    const d = ymd(new Date(y, m, Math.min(Math.max(1, b.day), dim)))
    if (d >= from && d <= to) out.push(d)
    m++
    if (m > 11) {
      m = 0
      y++
    }
  }
  return out
}
export const nextDue = (b: Bill, today = todayStr()) => dueDates(b, today, addDays(today, 70))[0]
