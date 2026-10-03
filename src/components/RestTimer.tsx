import { useEffect, useState } from 'react'
import { adjustRest, skipRest, useRest } from '../lib/workoutx'
import { clock } from '../lib/util'

export default function RestTimer() {
  const r = useRest()
  const [, tick] = useState(0)
  useEffect(() => {
    if (!r) return
    const t = setInterval(() => tick((n) => n + 1), 250)
    return () => clearInterval(t)
  }, [r])
  if (!r) return null
  const left = Math.max(0, Math.ceil((r.end - Date.now()) / 1000))
  const pct = Math.max(0, Math.min(100, (left / r.total) * 100))
  return (
    <div className="rest-bar" role="timer" aria-live="off">
      <div className="rest-fill" style={{ width: `${pct}%` }} />
      <span className="rest-lbl">Rest</span>
      <b className="rest-clock">{clock(left)}</b>
      <button onClick={() => adjustRest(-15)} aria-label="15 seconds less">−15</button>
      <button onClick={() => adjustRest(15)} aria-label="15 seconds more">＋15</button>
      <button className="skip" onClick={skipRest}>Skip</button>
    </div>
  )
}
