import { useState } from 'react'
import { useApp } from '../lib/store'
import { CATEGORIES, discardTimer, startTimer, stopTimer } from '../lib/actions'
import { useNow } from '../lib/hooks'
import { clock, fmtDur, todayStr } from '../lib/util'

export function useTodaySeconds() {
  const s = useApp()
  const now = useNow(1000)
  const t = todayStr()
  const done = s.timeEntries.filter((e) => e.date === t).reduce((a, e) => a + e.seconds, 0)
  const live = s.activeTimer ? Math.max(0, Math.floor((now - s.activeTimer.startedAt) / 1000)) : 0
  return { total: done + live, live }
}

export default function TimerWidget() {
  const s = useApp()
  const { total, live } = useTodaySeconds()
  const [label, setLabel] = useState('')
  const [cat, setCat] = useState(CATEGORIES[0])
  const a = s.activeTimer
  return (
    <div className="timer">
      <div className={`timer-face ${a ? 'running' : ''}`}>
        <span className="timer-clock">{clock(live)}</span>
        {a ? (
          <span className="timer-sub">
            <i className="pulse-dot" /> {a.label} · {a.category}
          </span>
        ) : (
          <span className="timer-sub">Ready when you are</span>
        )}
      </div>
      {a ? (
        <div className="row gap">
          <button className="btn danger grow" onClick={stopTimer}>
            ■ Stop &amp; save
          </button>
          <button className="btn ghost" onClick={discardTimer} title="Discard without saving">
            Discard
          </button>
        </div>
      ) : (
        <form
          className="stack gap-s"
          onSubmit={(e) => {
            e.preventDefault()
            startTimer(label, cat)
            setLabel('')
          }}
        >
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What are you working on?" aria-label="Timer label" />
          <div className="row gap">
            <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button className="btn primary grow" type="submit">
              ▶ Start
            </button>
          </div>
        </form>
      )}
      <div className="timer-total">
        Today <b>{fmtDur(total)}</b> tracked
      </div>
    </div>
  )
}
