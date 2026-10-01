import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { confettiBus, toastBus, type ToastMsg } from '../lib/fx'
import { useEscape } from '../lib/hooks'
import { buzz, clamp } from '../lib/util'

/* ------------------------------------------------ Tilt card */
export function Tilt({ children, className = '', max = 7, glare = true, style, onClick, as = 'div' }: {
  children: ReactNode
  className?: string
  max?: number
  glare?: boolean
  style?: CSSProperties
  onClick?: () => void
  as?: 'div' | 'section' | 'article'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const raf = useRef(0)
  const move = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = clamp((e.clientX - r.left) / r.width, 0, 1)
    const py = clamp((e.clientY - r.top) / r.height, 0, 1)
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      el.style.setProperty('--rx', `${((0.5 - py) * max).toFixed(2)}deg`)
      el.style.setProperty('--ry', `${((px - 0.5) * max).toFixed(2)}deg`)
      el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
      el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
    })
  }
  const leave = () => {
    const el = ref.current
    if (!el) return
    cancelAnimationFrame(raf.current)
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }
  const Tag = as as 'div'
  return (
    <Tag ref={ref} className={`card tilt ${glare ? 'glare' : ''} ${className}`} style={style} onPointerMove={move} onPointerLeave={leave} onClick={onClick}>
      {children}
    </Tag>
  )
}

/* ------------------------------------------------ Modal */
export function Modal({ children, onClose, title, wide, full, className = '' }: { children: ReactNode; onClose: () => void; title?: ReactNode; wide?: boolean; full?: boolean; className?: string }) {
  useEscape(onClose)
  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [])
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true">
      <div className={`sheet ${wide ? 'wide' : ''} ${full ? 'full' : ''} ${className}`}>
        {title !== undefined && (
          <header className="sheet-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </header>
        )}
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/* ------------------------------------------------ Toasts */
export function Toaster() {
  const [items, setItems] = useState<(ToastMsg & { id: number })[]>([])
  useEffect(() => {
    let n = 0
    return toastBus.on((m) => {
      const id = ++n
      setItems((a) => [...a.slice(-2), { ...m, id }])
      setTimeout(() => setItems((a) => a.filter((x) => x.id !== id)), m.undo ? 5200 : 3000)
    })
  }, [])
  return (
    <div className="toaster" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.tone || ''}`}>
          <span>{t.text}</span>
          {t.undo && (
            <button
              onClick={() => {
                t.undo?.()
                setItems((a) => a.filter((x) => x.id !== t.id))
              }}
            >
              Undo
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------ Confetti */
interface P { x: number; y: number; vx: number; vy: number; r: number; vr: number; c: string; s: number; life: number }
export function Confetti() {
  const cv = useRef<HTMLCanvasElement>(null)
  const parts = useRef<P[]>([])
  const raf = useRef(0)
  useEffect(() => {
    const canvas = cv.current!
    const ctx = canvas.getContext('2d')!
    const fit = () => {
      canvas.width = innerWidth * devicePixelRatio
      canvas.height = innerHeight * devicePixelRatio
    }
    fit()
    addEventListener('resize', fit)
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#B6FF3B'
    const colors = [accent, accent, '#ffffff', '#d8ffa0', '#7affc8']
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const d = devicePixelRatio
      parts.current = parts.current.filter((p) => p.life > 0 && p.y < innerHeight + 40)
      for (const p of parts.current) {
        p.vy += 0.16
        p.vx *= 0.99
        p.x += p.vx
        p.y += p.vy
        p.r += p.vr
        p.life -= 1
        ctx.save()
        ctx.translate(p.x * d, p.y * d)
        ctx.rotate(p.r)
        ctx.globalAlpha = Math.min(1, p.life / 30)
        ctx.fillStyle = p.c
        ctx.fillRect((-p.s / 2) * d, (-p.s / 4) * d, p.s * d, (p.s / 2) * d)
        ctx.restore()
      }
      if (parts.current.length) raf.current = requestAnimationFrame(loop)
      else raf.current = 0
    }
    const off = confettiBus.on(({ x, y, big }) => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const ox = x ?? innerWidth / 2
      const oy = y ?? innerHeight * 0.35
      const n = big ? 150 : 70
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 3 + Math.random() * (big ? 9 : 6)
        parts.current.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length], s: 6 + Math.random() * 7, life: 90 + Math.random() * 60 })
      }
      if (!raf.current) raf.current = requestAnimationFrame(loop)
    })
    return () => {
      off()
      cancelAnimationFrame(raf.current)
      removeEventListener('resize', fit)
    }
  }, [])
  return <canvas ref={cv} className="confetti" aria-hidden />
}

/* ------------------------------------------------ small bits */
export function Empty({ icon, title, hint, action }: { icon: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>
        {icon}
      </div>
      <strong>{title}</strong>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  )
}

export function Bar({ value, max, label, unit = 'g', color }: { value: number; max: number; label: string; unit?: string; color?: string }) {
  const pct = clamp((value / (max || 1)) * 100, 0, 100)
  const over = value > max
  return (
    <div className="macro">
      <div className="macro-top">
        <span>{label}</span>
        <span>
          <b>{Math.round(value)}</b>
          <i>
            {' '}
            / {Math.round(max)}
            {unit}
          </i>
        </span>
      </div>
      <div className="track">
        <div className={`fill ${over ? 'over' : ''}`} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function Stepper({ value, onChange, step = 0.5, min = 0.25, format }: { value: number; onChange: (v: number) => void; step?: number; min?: number; format?: (v: number) => string }) {
  return (
    <div className="stepper">
      <button onClick={() => { buzz(5); onChange(Math.max(min, Math.round((value - step) * 100) / 100)) }} aria-label="Decrease">
        −
      </button>
      <span>{format ? format(value) : value}</span>
      <button onClick={() => { buzz(5); onChange(Math.round((value + step) * 100) / 100) }} aria-label="Increase">
        +
      </button>
    </div>
  )
}

export function DateNav({ date, onChange, todayStr }: { date: string; onChange: (d: string) => void; todayStr: string }) {
  const shift = (n: number) => {
    const [y, m, d] = date.split('-').map(Number)
    const dt = new Date(y, m - 1, d + n)
    onChange(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`)
  }
  return (
    <div className="datenav">
      <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous day">
        ‹
      </button>
      <input type="date" value={date} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Pick date" />
      <button className="icon-btn" onClick={() => shift(1)} aria-label="Next day">
        ›
      </button>
      {date !== todayStr && (
        <button className="chip" onClick={() => onChange(todayStr)}>
          Today
        </button>
      )}
    </div>
  )
}
