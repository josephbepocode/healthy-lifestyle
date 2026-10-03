import { useState } from 'react'
import { Tilt } from '../components/ui'
import { habits, addWater, setCreatine, setSleep, setHabitCfg, streakOf, waterOk, creatineOk, sleepOk } from '../lib/habits'
import { useApp } from '../lib/store'
import { totalsFor } from '../lib/actions'
import { studyMin, study } from '../lib/study'
import { addDays, buzz, clamp, fmtDate, todayStr, weekStart } from '../lib/util'

type HeatKey = 'water' | 'creatine' | 'sleep' | 'meals' | 'study' | 'workout'

export function Heatmap({ value, weeks = 12 }: { value: (d: string) => number; weeks?: number }) {
  const today = todayStr()
  const start = addDays(weekStart(today), -7 * (weeks - 1))
  return (
    <div className="heat" role="img" aria-label="Weekly heatmap">
      <div className="heat-days">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <i key={i}>{d}</i>)}</div>
      <div className="heat-grid" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
        {Array.from({ length: weeks }, (_, w) => (
          <div key={w} className="heat-col">
            {Array.from({ length: 7 }, (_, d) => {
              const day = addDays(start, w * 7 + d)
              const v = day > today ? -1 : clamp(value(day), 0, 1)
              return <b key={d} className={v < 0 ? 'future' : ''} style={{ ['--v' as string]: v < 0 ? 0 : v }} title={`${fmtDate(day)} · ${Math.round(Math.max(v, 0) * 100)}%`} />
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export function WaterGlasses({ big }: { big?: boolean }) {
  const h = habits.use()
  const date = todayStr()
  const ml = h.water[date] || 0
  const n = Math.ceil(h.waterTarget / h.glass)
  const full = Math.floor(ml / h.glass)
  return (
    <div className={`glasses ${big ? 'big' : ''}`}>
      {Array.from({ length: n }, (_, i) => (
        <button key={i} className={`glass ${i < full ? 'full' : ''}`} aria-label={`Glass ${i + 1}`} onClick={() => { buzz(10); addWater(date, i < full ? -(full - i) * h.glass : (i + 1 - full) * h.glass) }}>
          <span style={{ height: i < full ? '100%' : i === full ? `${clamp(((ml % h.glass) / h.glass) * 100, 0, 100)}%` : '0%' }} />
        </button>
      ))}
    </div>
  )
}

export default function Habits() {
  const s = useApp()
  const h = habits.use()
  const st = study.use()
  const date = todayStr()
  const ml = h.water[date] || 0
  const [heat, setHeat] = useState<HeatKey>('water')
  const fns: Record<HeatKey, (d: string) => number> = {
    water: (d) => (h.water[d] || 0) / h.waterTarget,
    creatine: (d) => (h.creatine[d] ? 1 : 0),
    sleep: (d) => (h.sleep[d] || 0) / h.sleepTarget,
    meals: (d) => totalsFor(s, d).kcal / s.profile.kcalTarget,
    study: (d) => studyMin(d) / st.goalMin,
    workout: (d) => (s.workoutLog.some((w) => w.date === d && w.sets.length) ? 1 : 0),
  }
  const sw = streakOf(waterOk(h))
  const sc = streakOf(creatineOk(h))
  const ss = streakOf(sleepOk(h))
  return (
    <div className="screen">
      <header className="page-head"><div><p className="eyebrow">Daily basics</p><h1>Habits</h1></div></header>
      <div className="bento b-habits">
        <Tilt className="hb-water">
          <div className="card-head"><h2>💧 Water</h2><span className="muted">target {(h.waterTarget / 1000).toFixed(1)} L · glass {h.glass} ml</span></div>
          <div className="big-num"><b>{(ml / 1000).toFixed(2)}</b><span>/ {(h.waterTarget / 1000).toFixed(1)} L</span></div>
          <div className="track"><div className="fill" style={{ width: `${clamp((ml / h.waterTarget) * 100, 0, 100)}%` }} /></div>
          <WaterGlasses big />
          <div className="row gap-s wrap">
            <button className="btn primary" onClick={() => { buzz(12); addWater(date, h.glass) }}>＋ {h.glass} ml</button>
            <button className="btn" onClick={() => addWater(date, 500)}>＋ 500 ml</button>
            <button className="btn ghost" onClick={() => addWater(date, -h.glass)}>− glass</button>
            <label className="field inline"><span>Target L</span><input type="number" min="1" max="6" step="0.5" value={h.waterTarget / 1000} onChange={(e) => setHabitCfg({ waterTarget: Math.round(clamp(Number(e.target.value) || 3, 1, 6) * 1000) })} /></label>
          </div>
          <p className="hint">{ml >= h.waterTarget ? '🎉 Target hit today.' : `${((h.waterTarget - ml) / 1000).toFixed(2)} L to go — tap a glass to fill up to it.`}</p>
        </Tilt>
        <Tilt className="hb-supp">
          <div className="card-head"><h2>💊 Creatine / supplement</h2><span className="muted">streak {sc} d</span></div>
          <label className="todo big"><input type="checkbox" checked={!!h.creatine[date]} onChange={(e) => { setCreatine(date, e.target.checked); buzz(10) }} /><span className="box" aria-hidden /><span className="todo-text">Taken today<small>Daily dose — consistency matters more than timing.</small></span></label>
        </Tilt>
        <Tilt className="hb-sleep">
          <div className="card-head"><h2>😴 Sleep</h2><span className="muted">goal {h.sleepTarget} h · streak {ss} d</span></div>
          <div className="row gap center">
            <button className="icon-btn" onClick={() => setSleep(date, Math.max(0, (h.sleep[date] || 0) - 0.5))} aria-label="Less sleep">−</button>
            <div className="big-num"><b>{(h.sleep[date] || 0).toFixed(1)}</b><span>h last night</span></div>
            <button className="icon-btn" onClick={() => setSleep(date, Math.min(14, (h.sleep[date] || 0) + 0.5))} aria-label="More sleep">＋</button>
          </div>
        </Tilt>
        <Tilt className="hb-streak">
          <div className="card-head"><h2>🔥 Streaks</h2></div>
          <div className="streak-list">
            <div><b>{sw}</b><span>water days</span></div>
            <div><b>{sc}</b><span>supplement days</span></div>
            <div><b>{ss}</b><span>sleep ≥ {h.sleepTarget} h</span></div>
          </div>
        </Tilt>
        <Tilt className="hb-heat">
          <div className="card-head"><h2>Heatmap · last 12 weeks</h2>
            <div className="seg small" role="group" aria-label="Heatmap habit">
              {(['water', 'creatine', 'sleep', 'meals', 'study', 'workout'] as HeatKey[]).map((k) => <button key={k} className={heat === k ? 'on' : ''} onClick={() => setHeat(k)}>{k}</button>)}
            </div>
          </div>
          <Heatmap value={fns[heat]} />
          <p className="hint">Brighter = closer to / above the daily goal. Empty squares have no data logged.</p>
        </Tilt>
      </div>
    </div>
  )
}
