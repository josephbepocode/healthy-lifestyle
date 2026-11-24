import { addDays, todayStr } from './util'
import { getState } from './store'
import { getMoney, periodFor } from './money'
import { bills, dueDates } from './bills'
import { study } from './study'

/** Builds an .ics calendar of upcoming reminders. The phone's own Calendar app then alerts at the
 *  right time even when this web app is closed, which a server-less web app cannot do by itself. */
interface Ev { uid: string; date: string; time: string; title: string; body: string; rrule?: string; alarmsMin: number[] }

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
// RFC 5545: fold at 75 octets, never inside a character (emoji are 4 bytes in UTF-8)
const enc = new TextEncoder()
const fold = (line: string) => {
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of Array.from(line)) {
    const n = enc.encode(ch).length
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
      bytes = 0
    }
    cur += ch
    bytes += n
  }
  out.push(cur)
  return out.join('\r\n ')
}
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')

export function reminderEvents(opts: { days?: number; time?: string; frenchTime?: string } = {}, today = todayStr()): Ev[] {
  const days = opts.days ?? 90
  const time = opts.time ?? '09:00'
  const end = addDays(today, days)
  const evs: Ev[] = []
  const s = getState()
  const st = study.get()

  // weekly weigh-in, starting on the next due day
  const last = [...s.weighIns].sort((a, b) => a.date.localeCompare(b.date)).pop()
  let weigh = last ? addDays(last.date, 7) : today
  if (weigh < today) weigh = today
  evs.push({ uid: 'weigh-weekly', date: weigh, time: '07:30', title: '⚖️ Weigh-in day', body: 'Same time of day, before breakfast. Log it in Healthy Lifestyle (Progress).', rrule: 'FREQ=WEEKLY', alarmsMin: [0] })

  // paydays (every 14 days)
  const nextPay = getMoney().nextPayday
  if (nextPay) {
    const seen = new Set<string>()
    for (let d = today; d <= end; d = addDays(d, 1)) {
      const p = periodFor(nextPay, d)
      if (p.next >= today && p.next <= end && !seen.has(p.next)) {
        seen.add(p.next)
        evs.push({ uid: `pay-${p.next}`, date: p.next, time, title: '💵 Payday', body: 'Open Money and set up the new paycheck plan.', alarmsMin: [2 * 24 * 60, 0] })
      }
    }
  }

  // bills
  for (const b of bills.get().bills)
    for (const d of dueDates(b, today, end))
      evs.push({ uid: `bill-${b.id}-${d}`, date: d, time, title: `🧾 ${b.name} due`, body: `$${b.amount.toLocaleString()}: check it is covered.`, alarmsMin: [24 * 60, 0] })

  // study
  if (st.goalMin > 0)
    evs.push({ uid: 'french-daily', date: today, time: opts.frenchTime ?? '19:00', title: '🇫🇷 French practice', body: `${st.goalMin} min goal today.`, rrule: 'FREQ=DAILY', alarmsMin: [0] })
  if (!st.celpipDate) evs.push({ uid: 'celpip-book', date: addDays(today, 1), time, title: '🎧 Book your CELPIP test', body: 'Aim for December 2026. Set the date in Study once booked.', alarmsMin: [0] })
  if (today <= '2027-01-31') {
    const g = today > '2026-12-01' ? addDays(today, 1) : '2026-12-01'
    evs.push({ uid: 'gtest-2026', date: g, time, title: '🚗 Book the G road test', body: 'Eligible from January 2027. Book via DriveTest in December.', alarmsMin: [0] })
  }
  return evs
}

export function buildIcs(evs: Ev[]): string {
  const now = stamp()
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Healthy Lifestyle//Reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Healthy Lifestyle reminders']
  for (const e of evs) {
    const dt = e.date.replace(/-/g, '') + 'T' + e.time.replace(':', '') + '00'
    // floating local time: the phone uses its own time zone
    L.push('BEGIN:VEVENT', `UID:${e.uid}@healthy-lifestyle.josephbepocode.github.io`, `DTSTAMP:${now}`, `DTSTART:${dt}`, 'DURATION:PT15M', `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(e.body)}`)
    if (e.rrule) L.push(`RRULE:${e.rrule}`)
    for (const m of e.alarmsMin) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${m}M`, 'END:VALARM')
    L.push('END:VEVENT')
  }
  L.push('END:VCALENDAR')
  return L.map(fold).join('\r\n') + '\r\n'
}

/** Opens the share sheet on phones (Calendar can import from there), otherwise downloads the file. */
export async function exportReminderCalendar(): Promise<number> {
  const evs = reminderEvents()
  const text = buildIcs(evs)
  const name = 'healthy-lifestyle-reminders.ics'
  const file = typeof File !== 'undefined' ? new File([text], name, { type: 'text/calendar' }) : null
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (file && nav.canShare?.({ files: [file] }) && /Android|iPhone|iPad|iPod/.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: 'Healthy Lifestyle reminders' })
      return evs.length
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return evs.length
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return evs.length
}
