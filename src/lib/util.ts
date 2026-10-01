export const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayStr = () => ymd(new Date())
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
export const addDays = (s: string, n: number) => {
  const d = parseYmd(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}
export const diffDays = (a: string, b: string) =>
  Math.round((parseYmd(a).getTime() - parseYmd(b).getTime()) / 86400000)
/** Monday-start week */
export const weekStart = (s: string) => {
  const d = parseYmd(s)
  const wd = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - wd)
  return ymd(d)
}
/** 0 = Monday … 6 = Sunday */
export const weekdayIdx = (s: string) => (parseYmd(s).getDay() + 6) % 7
export const fmtDate = (s: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  parseYmd(s).toLocaleDateString('en-CA', opts)
export const uid = (p = 'id') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export const round = (n: number, d = 0) => {
  const f = 10 ** d
  return Math.round(n * f) / f
}
export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))
export const num = (v: string | number, fallback = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

export function fmtDur(sec: number) {
  sec = Math.max(0, Math.round(sec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${pad(m)}m`
  if (m > 0) return `${m}m`
  return sec > 0 ? `${sec}s` : '0m'
}
export function clock(sec: number) {
  sec = Math.max(0, Math.floor(sec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function buzz(ms = 12) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms)
  } catch {
    /* ignore */
  }
}

let audioCtx: AudioContext | null = null
export function beep(times = 3) {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = audioCtx || new AC()
    for (let i = 0; i < times; i++) {
      const o = audioCtx.createOscillator()
      const g = audioCtx.createGain()
      o.type = 'sine'
      o.frequency.value = 880
      const t = audioCtx.currentTime + i * 0.28
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
      o.connect(g).connect(audioCtx.destination)
      o.start(t)
      o.stop(t + 0.22)
    }
    buzz(200)
  } catch {
    /* ignore */
  }
}

/** Scale every number inside an ingredient amount string ("1 cup", "1/2 tsp", "2-3 eggs"). */
export function scaleAmount(amount: string, factor: number): string {
  if (factor === 1) return amount
  return amount.replace(/(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)/g, (m) => {
    let v: number
    if (m.includes('/')) {
      const parts = m.trim().split(/\s+/)
      if (parts.length === 2) {
        const [a, b] = parts[1].split('/').map(Number)
        v = Number(parts[0]) + a / b
      } else {
        const [a, b] = m.split('/').map(Number)
        v = a / b
      }
    } else v = Number(m)
    return niceNum(v * factor)
  })
}
function niceNum(v: number) {
  if (v >= 20) return String(Math.round(v / (v >= 100 ? 5 : 1)) * (v >= 100 ? 5 : 1))
  const whole = Math.floor(v)
  const frac = v - whole
  const q = Math.round(frac * 4) / 4
  if (q === 1) return String(whole + 1)
  const fr = q === 0 ? '' : q === 0.25 ? '¼' : q === 0.5 ? '½' : '¾'
  if (!fr) return whole === 0 ? String(round(v, 1)) : String(whole)
  return whole ? `${whole}${fr}` : fr
}
