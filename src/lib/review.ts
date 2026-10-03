import { makeStore } from './kv'
import { addDays, round, todayStr, weekStart } from './util'
import { getState, subscribe } from './store'
import { totalsFor } from './actions'
import { SCHEDULE } from './seed'
import { getMoney, periodFor, totalAlloc } from './money'
import { habits, creatineOk, sleepOk, streakOf, waterOk } from './habits'
import { studyMin, study } from './study'

/* tasks have no completion date in the main data, so we note the day we first see a task as done */
export const taskDone = makeStore<{ v: 1; at: Record<string, string> }>('healthy-taskdone.v1', () => ({ v: 1, at: {} }))
export function trackTasks() {
  const sync = () => {
    const s = getState()
    const at = taskDone.get().at
    let ch = false
    const next = { ...at }
    for (const t of s.tasks) {
      if (t.done && !next[t.id]) ((next[t.id] = todayStr()), (ch = true))
      if (!t.done && next[t.id]) (delete next[t.id], (ch = true))
    }
    if (ch) taskDone.set((x) => ({ ...x, at: next }))
  }
  sync()
  return subscribe(sync)
}

export interface Suggestion {
  tone: 'warn' | 'ok' | 'info'
  text: string
}
export function weeklyReview(today = todayStr(), offsetWeeks = 0) {
  const s = getState()
  const ws = addDays(weekStart(today), -7 * offsetWeeks)
  const we = addDays(ws, 6)
  const upto = we < today ? we : today
  const days: string[] = []
  for (let d = ws; d <= upto; d = addDays(d, 1)) days.push(d)
  const { kcalTarget, proteinTarget } = s.profile
  const per = days.map((d) => ({ d, t: totalsFor(s, d) }))
  const logged = per.filter((x) => x.t.kcal > 0)
  const avgK = logged.length ? round(logged.reduce((a, x) => a + x.t.kcal, 0) / logged.length) : 0
  const avgP = logged.length ? round(logged.reduce((a, x) => a + x.t.protein, 0) / logged.length) : 0
  const hit = logged.filter((x) => x.t.kcal >= kcalTarget * 0.9 && x.t.protein >= proteinTarget * 0.9).length
  const planned = SCHEDULE.filter(Boolean).length
  const workouts = new Set(s.workoutLog.filter((w) => w.date >= ws && w.date <= we && w.sets.length).map((w) => w.date)).size
  const plannedSoFar = SCHEDULE.slice(0, days.length).filter(Boolean).length
  const wi = [...s.weighIns].sort((a, b) => a.date.localeCompare(b.date))
  const endW = [...wi].filter((w) => w.date <= we).pop()
  const startW = [...wi].filter((w) => w.date < ws).pop()
  const inWeek = wi.filter((w) => w.date >= ws && w.date <= we)
  const delta = endW && startW && inWeek.length ? round(endW.kg - startW.kg, 1) : null
  const m = getMoney()
  const p = periodFor(m.nextPayday, today)
  const weekSpent = m.expenses.filter((e) => e.date >= ws && e.date <= we).reduce((a, e) => a + e.amount, 0)
  const periodSpent = m.expenses.filter((e) => e.date >= p.start && e.date <= p.end).reduce((a, e) => a + e.amount, 0)
  const budget = totalAlloc(m)
  const tasksDone = Object.values(taskDone.get().at).filter((d) => d >= ws && d <= we).length
  const studyMins = days.reduce((a, d) => a + studyMin(d), 0)
  const st = study.get()
  const h = habits.get()
  const waterDays = days.filter((d) => waterOk(h)(d)).length
  const creatineDays = days.filter((d) => creatineOk(h)(d)).length
  const sleepVals = days.map((d) => h.sleep[d]).filter((x): x is number => !!x)
  const avgSleep = sleepVals.length ? round(sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length, 1) : null
  const streaks = { water: streakOf(waterOk(h)), creatine: streakOf(creatineOk(h)), sleep: streakOf(sleepOk(h)), study: streakOf((d) => studyMin(d) >= st.goalMin) }

  const sug: Suggestion[] = []
  if (logged.length < Math.min(days.length, 3)) sug.push({ tone: 'info', text: `Only ${logged.length} day${logged.length === 1 ? '' : 's'} of meals logged — log everything for a few days so the averages mean something.` })
  else {
    if (avgK < kcalTarget * 0.9) sug.push({ tone: 'warn', text: `You averaged ${avgK} kcal vs ${kcalTarget}. Add a ~${Math.round((kcalTarget - avgK) / 50) * 50} kcal snack or shake daily (peanut butter oats, milk, banana).` })
    if (avgP < proteinTarget * 0.9) sug.push({ tone: 'warn', text: `Protein averaged ${avgP} g vs ${proteinTarget} g. Add one high-protein item a day — Greek yogurt, eggs, or chicken.` })
  }
  if (plannedSoFar > workouts) sug.push({ tone: 'warn', text: `${workouts}/${plannedSoFar} planned workouts done so far — book the missed session before the weekend.` })
  if (delta !== null) {
    if (delta < 0.1 && logged.length >= 4) sug.push({ tone: 'warn', text: `Weight ${delta >= 0 ? '+' : ''}${delta} kg this week. If this holds for 2 weeks, raise calories by 150–200 kcal (Progress has a button).` })
    else if (delta > 0.6) sug.push({ tone: 'info', text: `Weight +${delta} kg in a week is fast — a bit of water weight is normal, but watch the 2-week trend.` })
  }
  if (days.length >= 3 && studyMins < st.goalMin * days.length * 0.6) sug.push({ tone: 'warn', text: `Study: ${studyMins} min vs a goal of ${st.goalMin * days.length}. Put a 20-minute French block right after breakfast.` })
  if (days.length >= 3 && waterDays < Math.ceil(days.length / 2)) sug.push({ tone: 'info', text: `Water target hit ${waterDays}/${days.length} days — keep a bottle at your desk.` })
  if (periodSpent > budget && budget > 0) sug.push({ tone: 'warn', text: `Spending this pay period ($${Math.round(periodSpent)}) is above the plan ($${Math.round(budget)}). Check the Money tab.` })
  if (!sug.length) sug.push({ tone: 'ok', text: 'Everything is on track this week. Keep the routine and re-check next Sunday.' })
  return { ws, we, days: days.length, logged: logged.length, avgK, avgP, hit, kcalTarget, proteinTarget, planned, plannedSoFar, workouts, delta, startW, endW, weekSpent, periodSpent, budget, tasksDone, studyMins, studyGoal: st.goalMin * days.length, waterDays, creatineDays, avgSleep, streaks, sug }
}
