import { useState } from 'react'
import { Tilt, Empty } from '../components/ui'
import { BarChart } from '../components/charts'
import { study, STUDY_TYPES, logSession, deleteSession, studyMin, daysTo, type StudyType } from '../lib/study'
import { streakOf } from '../lib/habits'
import { addDays, clamp, fmtDate, num, todayStr, uid, weekStart } from '../lib/util'
import { toast } from '../lib/fx'
import { useApp } from '../lib/store'

export default function Study() {
  useApp() // re-render when Time-tab "Study" entries change
  const st = study.use()
  const today = todayStr()
  const [type, setType] = useState<StudyType>('French')
  const [min, setMin] = useState('30')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [item, setItem] = useState('')
  const todayMin = studyMin(today)
  const streak = streakOf((d) => studyMin(d) >= st.goalMin)
  const ws = weekStart(today)
  const week = Array.from({ length: 7 }, (_, i) => ({ label: fmtDate(addDays(ws, i), { weekday: 'short' }), value: studyMin(addDays(ws, i)), highlight: addDays(ws, i) === today }))
  const weekTotal = week.reduce((a, d) => a + d.value, 0)
  const fr = daysTo(st.frenchDate)
  const ce = daysTo(st.celpipDate)
  const byType = STUDY_TYPES.map((t) => ({ t, m: st.sessions.filter((x) => x.date >= ws && x.type === t).reduce((a, x) => a + x.min, 0) }))
  const doneN = st.checklist.filter((c) => c.done).length
  return (
    <div className="screen">
      <header className="page-head"><div><p className="eyebrow">French &amp; exams</p><h1>Study</h1></div></header>
      <div className="bento b-study">
        <Tilt className="st-today">
          <div className="card-head"><h2>Today</h2><span className="muted">daily goal</span></div>
          <div className="big-num"><b>{todayMin}</b><span>/ {st.goalMin} min</span></div>
          <div className="track"><div className="fill" style={{ width: `${clamp((todayMin / st.goalMin) * 100, 0, 100)}%` }} /></div>
          <div className="row between wrap gap-s"><span className="muted small">🔥 {streak} day streak · {weekTotal} min this week</span>
            <label className="field inline"><span>Goal (min)</span><input type="number" min="5" max="480" value={st.goalMin} onChange={(e) => study.set((s) => ({ ...s, goalMin: clamp(Math.round(num(e.target.value, 30)), 5, 480) }))} /></label></div>
        </Tilt>
        <Tilt className="st-fr">
          <div className="card-head"><h2>🇫🇷 French by</h2><span className="muted">{fmtDate(st.frenchDate, { month: 'long', day: 'numeric', year: 'numeric' })}</span></div>
          <div className="big-num"><b>{fr !== null && fr >= 0 ? fr : 0}</b><span>days left</span></div>
          <p className="hint">≈ {fr !== null && fr > 0 ? Math.round(fr / 7) : 0} weeks. {fr !== null && fr > 0 ? `${Math.ceil((st.goalMin * fr) / 60)} h of practice if you hit your daily goal every day.` : ''}</p>
        </Tilt>
        <Tilt className="st-ce">
          <div className="card-head"><h2>🎧 CELPIP test</h2><span className="muted">{st.celpipDate ? fmtDate(st.celpipDate, { month: 'long', day: 'numeric', year: 'numeric' }) : 'not booked — target Dec 2026'}</span></div>
          <div className="big-num"><b>{ce !== null && ce >= 0 ? ce : '—'}</b><span>{ce !== null ? 'days left' : 'set your test date'}</span></div>
          <label className="field"><span>Test date (set once booked)</span><input type="date" value={st.celpipDate} onChange={(e) => study.set((s) => ({ ...s, celpipDate: e.target.value }))} /></label>
        </Tilt>
        <Tilt className="st-log">
          <div className="card-head"><h2>Log a session</h2></div>
          <form className="stack gap-s" onSubmit={(e) => { e.preventDefault(); const m = Math.round(num(min)); if (m < 1 || m > 600) return; logSession(type, m, date, note.trim() || undefined); setNote(''); toast(`Logged ${m} min of ${type}`, { tone: 'win' }) }}>
            <div className="seg small wrapseg" role="group" aria-label="Session type">{STUDY_TYPES.map((t) => <button type="button" key={t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>{t.replace('CELPIP ', '')}</button>)}</div>
            <div className="grid3"><label className="field"><span>Minutes</span><input type="number" min="1" value={min} onChange={(e) => setMin(e.target.value)} /></label><label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><label className="field"><span>Note</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" /></label></div>
            <div className="row gap-s wrap">{[15, 30, 45].map((m) => <button type="button" className="chip" key={m} onClick={() => setMin(String(m))}>{m} min</button>)}<span className="grow" /><button className="btn primary">Log session</button></div>
            <p className="hint">Sessions also appear in the Time tab under “Study”. Anything you time with a Study timer counts too (not twice).</p>
          </form>
        </Tilt>
        <Tilt className="st-week">
          <div className="card-head"><h2>This week</h2><span className="muted">{weekTotal} min</span></div>
          <BarChart items={week} height={150} fmt={(v) => `${Math.round(v)}m`} />
          <div className="chips-row">{byType.filter((x) => x.m).map((x) => <span className="badge soft" key={x.t}>{x.t.replace('CELPIP ', 'C·')} {x.m}m</span>)}</div>
        </Tilt>
        <Tilt className="st-check">
          <div className="card-head"><h2>CELPIP prep checklist</h2><span className="muted">{doneN}/{st.checklist.length}</span></div>
          <ul className="todo-list">{st.checklist.map((c) => (
            <li key={c.id} className="row between"><label className="todo"><input type="checkbox" checked={c.done} onChange={() => study.set((s) => ({ ...s, checklist: s.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) }))} /><span className="box" aria-hidden /><span className="todo-text">{c.text}</span></label>
              <button className="icon-btn sm danger" aria-label="Remove" onClick={() => study.set((s) => ({ ...s, checklist: s.checklist.filter((x) => x.id !== c.id) }))}>✕</button></li>))}</ul>
          <form className="row gap-s" onSubmit={(e) => { e.preventDefault(); if (item.trim()) { study.set((s) => ({ ...s, checklist: [...s.checklist, { id: uid('c'), text: item.trim(), done: false }] })); setItem('') } }}><input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Add a prep task…" aria-label="Add a prep task" /><button className="btn sm">Add</button></form>
        </Tilt>
        <Tilt className="st-recent">
          <div className="card-head"><h2>Recent sessions</h2></div>
          {st.sessions.length === 0 ? <Empty icon="📚" title="No sessions yet" hint="Log your first 15 minutes of French." /> : (
            <ul className="weigh-list">{[...st.sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((x) => (
              <li key={x.id}><span>{fmtDate(x.date)}</span><b>{x.type}</b><em>{x.min} min</em><button className="icon-btn danger sm" aria-label="Delete session" onClick={() => deleteSession(x.id)}>✕</button></li>))}</ul>)}
        </Tilt>
      </div>
    </div>
  )
}
