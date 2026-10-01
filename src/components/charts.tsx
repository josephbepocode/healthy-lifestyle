import { useId } from 'react'
import { fmtDate } from '../lib/util'

export function LineChart({ points, goal, height = 220, unit = 'kg', pad = 1 }: { points: { x: string; y: number }[]; goal?: number; height?: number; unit?: string; pad?: number }) {
  const id = useId().replace(/:/g, '')
  const W = 640
  const H = height
  const m = { l: 40, r: 16, t: 16, b: 28 }
  if (points.length === 0) return null
  const ys = points.map((p) => p.y).concat(goal !== undefined ? [goal] : [])
  let lo = Math.floor(Math.min(...ys) - pad)
  let hi = Math.ceil(Math.max(...ys) + pad)
  if (hi - lo < 4) hi = lo + 4
  const t0 = new Date(points[0].x).getTime()
  const t1 = new Date(points[points.length - 1].x).getTime()
  const span = Math.max(t1 - t0, 86400000 * 7)
  const X = (x: string) => m.l + ((new Date(x).getTime() - t0) / span) * (W - m.l - m.r)
  const Y = (y: number) => m.t + (1 - (y - lo) / (hi - lo)) * (H - m.t - m.b)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')
  const area = `${path} L${X(points[points.length - 1].x).toFixed(1)},${H - m.b} L${X(points[0].x).toFixed(1)},${H - m.b} Z`
  const ticks = 4
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Line chart">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity=".35" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = lo + ((hi - lo) * i) / ticks
        return (
          <g key={i}>
            <line x1={m.l} x2={W - m.r} y1={Y(v)} y2={Y(v)} className="grid" />
            <text x={m.l - 8} y={Y(v) + 4} className="axis" textAnchor="end">
              {Math.round(v * 10) / 10}
            </text>
          </g>
        )
      })}
      {goal !== undefined && goal >= lo && goal <= hi && (
        <g>
          <line x1={m.l} x2={W - m.r} y1={Y(goal)} y2={Y(goal)} className="goal" />
          <text x={W - m.r} y={Y(goal) - 6} className="axis goal-t" textAnchor="end">
            Goal {goal}
            {unit}
          </text>
        </g>
      )}
      <path d={area} fill={`url(#g${id})`} />
      <path d={path} className="line" pathLength={1} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={X(p.x)} cy={Y(p.y)} r={4.5} className="dot">
            <title>
              {fmtDate(p.x)} — {p.y}
              {unit}
            </title>
          </circle>
        </g>
      ))}
      <text x={m.l} y={H - 8} className="axis">
        {fmtDate(points[0].x, { month: 'short', day: 'numeric' })}
      </text>
      <text x={W - m.r} y={H - 8} className="axis" textAnchor="end">
        {fmtDate(points[points.length - 1].x, { month: 'short', day: 'numeric' })}
      </text>
    </svg>
  )
}

export function Sparkline({ values, height = 44 }: { values: number[]; height?: number }) {
  const W = 160
  if (values.length === 0) return <div className="spark-empty">No sessions yet</div>
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const r = hi - lo || 1
  const X = (i: number) => 6 + (values.length === 1 ? (W - 12) / 2 : (i / (values.length - 1)) * (W - 12))
  const Y = (v: number) => 6 + (1 - (v - lo) / r) * (height - 12)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="spark" role="img" aria-label="Progress chart">
      <path d={d} className="line" pathLength={1} />
      {values.map((v, i) => (
        <circle key={i} cx={X(i)} cy={Y(v)} r={i === values.length - 1 ? 3.6 : 2.6} className="dot" />
      ))}
    </svg>
  )
}

export function BarChart({ items, height = 190, fmt }: { items: { label: string; value: number; highlight?: boolean }[]; height?: number; fmt: (v: number) => string }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <div className="bars" style={{ height }}>
      {items.map((it, i) => (
        <div className="bar-col" key={it.label + i}>
          <span className="bar-val">{it.value > 0 ? fmt(it.value) : ''}</span>
          <div className="bar-wrap">
            <div className={`bar ${it.highlight ? 'hl' : ''}`} style={{ height: `${(it.value / max) * 100}%`, animationDelay: `${i * 45}ms` }} />
          </div>
          <span className="bar-lab">{it.label}</span>
        </div>
      ))}
    </div>
  )
}
