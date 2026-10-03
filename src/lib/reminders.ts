import { makeStore } from './kv'
import { addDays, diffDays, todayStr } from './util'
import { getState } from './store'
import { getMoney, periodFor } from './money'
import { bills, dueDates } from './bills'
import { study, studyMin } from './study'

export interface Reminder {
  id: string
  icon: string
  title: string
  body: string
  go: string
}
export const reminders = makeStore<{ v: 1; done: Record<string, string>; snooze: Record<string, string>; notify: boolean; notified: Record<string, string> }>('healthy-reminders.v1', () => ({
  v: 1,
  done: {},
  snooze: {},
  notify: false,
  notified: {},
}))
export const markDone = (id: string) => reminders.set((s) => ({ ...s, done: { ...s.done, [id]: todayStr() } }))
export const snoozeReminder = (id: string, days = 1) => reminders.set((s) => ({ ...s, snooze: { ...s.snooze, [id]: addDays(todayStr(), days) } }))
export const setNotify = (notify: boolean) => reminders.set((s) => ({ ...s, notify }))

/** All reminders that apply today (before done/snooze filtering). Ids change when the underlying event changes, so "done" resets itself. */
export function allReminders(today = todayStr()): Reminder[] {
  const s = getState()
  const out: Reminder[] = []
  const last = [...s.weighIns].sort((a, b) => a.date.localeCompare(b.date)).pop()
  if (!last || diffDays(today, last.date) >= 7)
    out.push({ id: `weigh-${last?.date ?? 'none'}`, icon: '⚖️', title: 'Weigh-in day', body: last ? `Last weigh-in was ${diffDays(today, last.date)} days ago. Same time of day, before breakfast.` : 'Log your first weigh-in.', go: 'progress' })
  const p = periodFor(getMoney().nextPayday, today)
  if (p.daysLeft <= 2) out.push({ id: `pay-${p.next}`, icon: '💵', title: p.daysLeft === 0 ? 'Payday today' : `Payday ${p.daysLeft === 1 ? 'tomorrow' : 'in 2 days'}`, body: 'Open Money and set up the new paycheck plan.', go: 'money' })
  for (const b of bills.get().bills)
    for (const d of dueDates(b, today, addDays(today, 3)))
      out.push({ id: `bill-${b.id}-${d}`, icon: '🧾', title: `${b.name} due ${d === today ? 'today' : d}`, body: `$${b.amount.toLocaleString()} — check it is covered.`, go: 'money' })
  const st = study.get()
  if (!st.celpipDate) out.push({ id: 'celpip-book', icon: '🎧', title: 'Book your CELPIP test', body: 'Aim for December 2026. Set the date in Study once booked.', go: 'study' })
  if (today >= '2026-12-01' && today <= '2027-01-31') out.push({ id: 'gtest-2026', icon: '🚗', title: 'Book the G road test', body: 'Eligible from January 2027 — book via DriveTest in December.', go: 'tasks' })
  const left = st.goalMin - studyMin(today)
  if (left > 0) out.push({ id: `french-${today}`, icon: '🇫🇷', title: 'French practice', body: `${Math.round(left)} min left of today’s ${st.goalMin} min goal.`, go: 'study' })
  return out
}
export function activeReminders(today = todayStr()): Reminder[] {
  const r = reminders.get()
  return allReminders(today).filter((x) => !r.done[x.id] && !(r.snooze[x.id] && r.snooze[x.id] > today))
}
