import { useState } from 'react'
import { useApp } from '../lib/store'
import { addWeighIn, deleteWeighIn, updateProfile } from '../lib/actions'
import { Empty, Modal, Tilt } from '../components/ui'
import { LineChart } from '../components/charts'
import { SITES, body, deleteBody, saveBody, weighCheck, type Site } from '../lib/habits'
import { toast } from '../lib/fx'
import { clamp, fmtDate, num, round, todayStr } from '../lib/util'

export default function Progress() {
  const s = useApp()
  const bd = body.use()
  const { goalKg, heightCm, kcalTarget } = s.profile
  const w = [...s.weighIns].sort((a, b) => a.date.localeCompare(b.date))
  const latest = w[w.length - 1]
  const first = w[0]
  const [date, setDate] = useState(todayStr())
  const [kg, setKg] = useState('')
  const [goalEdit, setGoalEdit] = useState(false)
  const [goalVal, setGoalVal] = useState(String(goalKg))
  const [apply, setApply] = useState<number | null>(null)
  const [site, setSite] = useState<Site>('waist')
  const [bm, setBm] = useState<Record<string, string>>({})
  const [bdate, setBdate] = useState(todayStr())

  const cur = latest?.kg ?? s.profile.weightKg
  const toGo = Math.max(0, goalKg - cur)
  const startKg = first?.kg ?? cur
  const pct = clamp(((cur - startKg) / Math.max(goalKg - startKg, 0.1)) * 100, 0, 100)
  const bmi = cur / Math.pow(heightCm / 100, 2)
  const weeksFast = Math.ceil(toGo / 0.5)
  const weeksSlow = Math.ceil(toGo / 0.25)
  const wc = weighCheck(w)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = num(kg)
    if (v < 20 || v > 300) return
    addWeighIn(date, round(v, 1))
    setKg('')
  }
  const saveM = (e: React.FormEvent) => {
    e.preventDefault()
    const e2: Record<string, number> = {}
    SITES.forEach((x) => {
      const v = num(bm[x.id] ?? '', NaN)
      if (Number.isFinite(v) && v > 10 && v < 250) e2[x.id] = round(v, 1)
    })
    if (!Object.keys(e2).length) return toast('Enter at least one measurement (cm).')
    saveBody({ date: bdate, ...e2 })
    setBm({})
    toast('Measurements saved', { tone: 'win' })
  }
  const pts = bd.entries.filter((x) => x[site] !== undefined).map((x) => ({ x: x.date, y: x[site] as number }))
  const lastM = pts[pts.length - 1]
  const firstM = pts[0]

  return (
    <div className="screen">
      <header className="page-head">
        <div><p className="eyebrow">Trend</p><h1>Progress</h1></div>
      </header>

      <div className="stat-row four">
        <Tilt className="stat-card"><small>Current</small><b>{cur} kg</b><i>BMI {round(bmi, 1)}</i></Tilt>
        <Tilt className="stat-card">
          <small>Goal</small>
          {goalEdit ? (
            <form className="row gap" onSubmit={(e) => { e.preventDefault(); const v = num(goalVal); if (v > 30) updateProfile({ goalKg: v }); setGoalEdit(false) }}>
              <input type="number" step="0.5" value={goalVal} onChange={(e) => setGoalVal(e.target.value)} autoFocus />
              <button className="btn primary sm">OK</button>
            </form>
          ) : (
            <b>{goalKg} kg <button className="linkish" onClick={() => { setGoalVal(String(goalKg)); setGoalEdit(true) }}>edit</button></b>
          )}
          <i>{heightCm} cm tall</i>
        </Tilt>
        <Tilt className="stat-card"><small>To gain</small><b>{round(toGo, 1)} kg</b><i>{toGo > 0 ? `≈ ${weeksFast}–${weeksSlow} weeks` : 'Goal reached 🎉'}</i></Tilt>
        <Tilt className="stat-card">
          <small>Journey</small><b>{Math.round(pct)}%</b>
          <div className="track"><div className="fill" style={{ width: `${pct}%` }} /></div>
        </Tilt>
      </div>

      <div className={`advice wcheck ${wc.state === 'slow' ? 'warn' : wc.state === 'ok' ? 'ok' : wc.state === 'fast' ? 'warn' : 'info'}`}>
        <div className="card-head"><strong>Weekly weigh-in check</strong><span className="muted">target +0.25–0.5 kg / week</span></div>
        {wc.state === 'need' ? (
          <p>{wc.need} <b>Needs at least 2 weigh-ins 7+ days apart</b> — then this card tells you whether to change calories.</p>
        ) : (
          <>
            <p className="wc-main">
              {wc.state === 'slow' && <>🐢 <b>Gaining too slowly</b> — </>}
              {wc.state === 'ok' && <>✅ <b>On track</b> — </>}
              {wc.state === 'fast' && <>🚀 <b>Gaining a bit fast</b> — </>}
              {wc.rate! > 0 ? '+' : ''}{wc.rate} kg/week ({wc.from!.kg} → {wc.to!.kg} kg over {wc.days} days, {fmtDate(wc.from!.date, { month: 'short', day: 'numeric' })} → {fmtDate(wc.to!.date, { month: 'short', day: 'numeric' })}).
            </p>
            {wc.state === 'slow' && (
              <>
                <p>Raise calories by <b>+150–200 kcal</b> a day (a peanut-butter oats bowl or a shake) and re-check in 2 weeks.</p>
                <button className="btn primary" onClick={() => setApply(175)}>Apply +175 kcal → {kcalTarget + 175}</button>
              </>
            )}
            {wc.state === 'ok' && <p>Keep calories at {kcalTarget} kcal. Same time of day, once a week, and judge the 2-week trend, not single days.</p>}
            {wc.state === 'fast' && (
              <>
                <p>Faster than 0.5 kg/week usually means more fat than muscle. Trim <b>about 100–150 kcal</b> a day and re-check in 2 weeks.</p>
                <button className="btn" onClick={() => setApply(-125)}>Apply −125 kcal → {kcalTarget - 125}</button>
              </>
            )}
          </>
        )}
      </div>

      <div className="two-col">
        <Tilt className="chart-card" max={2}>
          <div className="card-head"><h2>Weight vs goal</h2><span className="muted">target +0.25–0.5 kg / week</span></div>
          {w.length === 0 ? (
            <Empty icon="⚖️" title="No weigh-ins yet" hint="Log your first weight to start the line." />
          ) : (
            <LineChart points={w.map((x) => ({ x: x.date, y: x.kg }))} goal={goalKg} />
          )}
        </Tilt>

        <Tilt className="log-card" max={2}>
          <div className="card-head"><h2>Weekly weigh-in</h2></div>
          <form className="stack gap-s" onSubmit={submit}>
            <div className="grid2">
              <label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
              <label className="field"><span>Weight (kg)</span><input type="number" step="0.1" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder={String(cur)} /></label>
            </div>
            <button className="btn primary" disabled={!kg}>Log weigh-in</button>
          </form>
          <ul className="weigh-list">
            {[...w].reverse().map((x, i, arr) => {
              const prev = arr[i + 1]
              const d = prev ? x.kg - prev.kg : null
              return (
                <li key={x.date}>
                  <span>{fmtDate(x.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <b>{x.kg} kg</b>
                  <em className={d == null ? '' : d > 0 ? 'up' : d < 0 ? 'down' : ''}>{d == null ? 'start' : `${d > 0 ? '+' : ''}${round(d, 1)}`}</em>
                  <button className="icon-btn danger sm" onClick={() => deleteWeighIn(x.date)} aria-label="Delete weigh-in">✕</button>
                </li>
              )
            })}
          </ul>
        </Tilt>
      </div>

      <div className="two-col">
        <Tilt className="chart-card" max={2}>
          <div className="card-head"><h2>📏 Body measurements</h2>
            <div className="seg small" role="group" aria-label="Measurement site">{SITES.map((x) => <button key={x.id} className={site === x.id ? 'on' : ''} onClick={() => setSite(x.id)}>{x.label}</button>)}</div>
          </div>
          {pts.length === 0 ? <Empty icon="📏" title={`No ${site} measurements yet`} hint="Measure once every 2–4 weeks, same spot, same time of day." /> : (
            <>
              <LineChart points={pts} unit="cm" height={190} pad={2} />
              {lastM && firstM && pts.length > 1 && <p className="hint">{SITES.find((x) => x.id === site)!.label}: {firstM.y} → {lastM.y} cm ({lastM.y - firstM.y > 0 ? '+' : ''}{round(lastM.y - firstM.y, 1)} cm since {fmtDate(firstM.x, { month: 'short', day: 'numeric' })}).</p>}
            </>
          )}
        </Tilt>
        <Tilt className="log-card" max={2}>
          <div className="card-head"><h2>Log measurements (cm)</h2><span className="muted">all optional</span></div>
          <form className="stack gap-s" onSubmit={saveM}>
            <label className="field"><span>Date</span><input type="date" value={bdate} onChange={(e) => setBdate(e.target.value)} /></label>
            <div className="grid2">{SITES.map((x) => <label className="field" key={x.id}><span>{x.label}</span><input type="number" step="0.1" inputMode="decimal" value={bm[x.id] ?? ''} onChange={(e) => setBm({ ...bm, [x.id]: e.target.value })} placeholder="cm" /></label>)}</div>
            <button className="btn primary">Save measurements</button>
          </form>
          <ul className="weigh-list">
            {[...bd.entries].reverse().slice(0, 5).map((x) => (
              <li key={x.date}><span>{fmtDate(x.date, { month: 'short', day: 'numeric' })}</span><b>{SITES.filter((t) => x[t.id] !== undefined).map((t) => `${t.label[0]}${x[t.id]}`).join(' · ')}</b><em /><button className="icon-btn danger sm" aria-label="Delete measurement" onClick={() => deleteBody(x.date)}>✕</button></li>
            ))}
          </ul>
          <p className="hint">Progress photos are not included — this version stores no images.</p>
        </Tilt>
      </div>

      {apply !== null && (
        <Modal title="Change calorie target?" onClose={() => setApply(null)}>
          <div className="stack gap">
            <p>Daily target changes from <b>{kcalTarget}</b> to <b>{kcalTarget + apply} kcal</b> ({apply > 0 ? '+' : ''}{apply}). Meals, Today and the weekly review will use the new number. You can change it back any time.</p>
            <div className="row gap end"><button className="btn ghost" onClick={() => setApply(null)}>Cancel</button><button className="btn primary" onClick={() => { updateProfile({ kcalTarget: kcalTarget + apply }); setApply(null); toast(`Calorie target is now ${kcalTarget + apply} kcal`, { tone: 'win' }) }}>Confirm</button></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
