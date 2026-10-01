import { useMemo, useState } from 'react'
import { useApp } from '../lib/store'
import { MEALS, addMeal, deleteEntry, deleteFood, foodOf, moveEntry, newFoodId, saveFood, setServings, totalsFor, defaultMeal } from '../lib/actions'
import { Bar, DateNav, Empty, Modal, Stepper, Tilt } from '../components/ui'
import { PrepBadge } from '../components/Recipe'
import { openIdeas, openRecipe } from '../lib/fx'
import { num, round, todayStr } from '../lib/util'
import type { Food, MealKind } from '../types'

function FoodForm({ initial, onClose }: { initial?: Food; onClose: () => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? '',
    serving: initial?.serving ?? '1 serving',
    kcal: String(initial?.kcal ?? ''),
    protein: String(initial?.protein ?? ''),
    carbs: String(initial?.carbs ?? ''),
    fat: String(initial?.fat ?? ''),
    prep: String(initial?.prepMinutes ?? ''),
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const valid = f.name.trim() && f.kcal !== ''
  return (
    <Modal onClose={onClose} title={initial ? 'Edit food' : 'New food'}>
      <form
        className="stack gap"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          saveFood({
            id: initial?.id ?? newFoodId(f.name),
            name: f.name.trim(),
            serving: f.serving.trim() || '1 serving',
            kcal: Math.max(0, num(f.kcal)),
            protein: Math.max(0, num(f.protein)),
            carbs: Math.max(0, num(f.carbs)),
            fat: Math.max(0, num(f.fat)),
            ...(f.prep ? { prepMinutes: Math.max(1, num(f.prep)) } : {}),
          })
          onClose()
        }}
      >
        <p className="muted small">Macros are estimates — tweak them to match what you actually eat.</p>
        <label className="field"><span>Name</span><input value={f.name} onChange={set('name')} placeholder="e.g. Chicken suya wrap" autoFocus /></label>
        <label className="field"><span>Serving size</span><input value={f.serving} onChange={set('serving')} placeholder="1 plate" /></label>
        <div className="grid2">
          <label className="field"><span>Calories (kcal)</span><input type="number" inputMode="decimal" min={0} value={f.kcal} onChange={set('kcal')} /></label>
          <label className="field"><span>Protein (g)</span><input type="number" inputMode="decimal" min={0} value={f.protein} onChange={set('protein')} /></label>
          <label className="field"><span>Carbs (g)</span><input type="number" inputMode="decimal" min={0} value={f.carbs} onChange={set('carbs')} /></label>
          <label className="field"><span>Fat (g)</span><input type="number" inputMode="decimal" min={0} value={f.fat} onChange={set('fat')} /></label>
        </div>
        <label className="field"><span>Prep time (min, optional)</span><input type="number" inputMode="numeric" min={1} value={f.prep} onChange={set('prep')} /></label>
        <div className="row gap end">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!valid}>Save food</button>
        </div>
      </form>
    </Modal>
  )
}

function Picker({ date, meal, onClose }: { date: string; meal: MealKind; onClose: () => void }) {
  const s = useApp()
  const [q, setQ] = useState('')
  const list = s.foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <Modal onClose={onClose} title={`Add to ${meal}`}>
      <input className="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods…" />
      <ul className="pick-list">
        {list.map((f) => (
          <li key={f.id}>
            <button onClick={(e) => { addMeal(date, meal, f.id, 1, { origin: { x: e.clientX, y: e.clientY } }) }}>
              <span><strong>{f.name}</strong><small>{f.serving}</small></span>
              <span className="pick-macros">{f.kcal} kcal · {f.protein}g <PrepBadge minutes={f.prepMinutes} /></span>
            </button>
          </li>
        ))}
        {list.length === 0 && <Empty icon="🔍" title="No match" hint="Try another word, or add it in the Foods library." />}
      </ul>
    </Modal>
  )
}

export default function Meals() {
  const s = useApp()
  const [date, setDate] = useState(todayStr())
  const [tab, setTab] = useState<'log' | 'foods'>('log')
  const [pick, setPick] = useState<MealKind | null>(null)
  const [editing, setEditing] = useState<Food | 'new' | null>(null)
  const [q, setQ] = useState('')
  const t = totalsFor(s, date)
  const p = s.profile

  const foods = useMemo(() => s.foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)), [s.foods, q])

  return (
    <div className="screen">
      <header className="page-head">
        <div><p className="eyebrow">Fuel</p><h1>Meals</h1></div>
        <div className="seg" role="tablist">
          <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>Daily log</button>
          <button className={tab === 'foods' ? 'on' : ''} onClick={() => setTab('foods')}>Foods library</button>
        </div>
      </header>

      {tab === 'log' ? (
        <>
          <div className="row between wrap gap">
            <DateNav date={date} onChange={setDate} todayStr={todayStr()} />
            <button className="btn glow sm" onClick={openIdeas}>✨ Ideas</button>
          </div>
          <Tilt className="totals-card" max={3}>
            <div className="totals-top">
              <div><b>{Math.round(t.kcal).toLocaleString()}</b><span>/ {p.kcalTarget.toLocaleString()} kcal</span></div>
              <div className="totals-p"><b>{Math.round(t.protein)}g</b><span>/ {p.proteinTarget}g protein</span></div>
            </div>
            <div className="macro-grid four">
              <Bar label="Calories" value={t.kcal} max={p.kcalTarget} unit="" />
              <Bar label="Protein" value={t.protein} max={p.proteinTarget} />
              <Bar label="Carbs" value={t.carbs} max={p.carbsTarget} />
              <Bar label="Fat" value={t.fat} max={p.fatTarget} />
            </div>
          </Tilt>

          <div className="meal-cols">
            {MEALS.map((m) => {
              const entries = s.mealLog.filter((e) => e.date === date && e.meal === m.id)
              const mt = totalsFor(s, date, m.id)
              return (
                <Tilt key={m.id} className="meal-card" max={2.5}>
                  <div className="card-head">
                    <h2>{m.icon} {m.label}</h2>
                    <span className="muted">{Math.round(mt.kcal)} kcal · {Math.round(mt.protein)}g</span>
                  </div>
                  {entries.length === 0 ? (
                    <Empty icon={m.icon} title={`No ${m.label.toLowerCase()} yet`} hint="Add something tasty." />
                  ) : (
                    <ul className="entries">
                      {entries.map((e) => {
                        const f = foodOf(s, e)
                        return (
                          <li key={e.id}>
                            <div className="entry-main">
                              <strong>{f?.name ?? 'Unknown food'}</strong>
                              <small>
                                {f ? `${Math.round(f.kcal * e.servings)} kcal · ${round(f.protein * e.servings, 0)}p · ${round(f.carbs * e.servings, 0)}c · ${round(f.fat * e.servings, 0)}f` : ''}
                              </small>
                            </div>
                            <Stepper value={e.servings} onChange={(v) => setServings(e.id, v)} step={0.5} format={(v) => `${v}×`} />
                            <select className="mini-select" value={e.meal} onChange={(ev) => moveEntry(e.id, ev.target.value as MealKind)} aria-label="Move to meal">
                              {MEALS.map((x) => <option key={x.id} value={x.id}>{x.icon}</option>)}
                            </select>
                            <button className="icon-btn danger" onClick={() => deleteEntry(e.id)} aria-label="Delete entry">🗑</button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  <button className="btn ghost full" onClick={() => setPick(m.id)}>＋ Add to {m.label.toLowerCase()}</button>
                </Tilt>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div className="row gap wrap">
            <input className="search grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${s.foods.length} foods…`} />
            <button className="btn primary" onClick={() => setEditing('new')}>＋ New food</button>
          </div>
          <p className="muted small">All macros are rough estimates — edit anything to match your portions. Tap a food for its recipe &amp; cook mode.</p>
          {foods.length === 0 ? (
            <Empty icon="🥘" title={s.foods.length ? 'No match' : 'Your library is empty'} hint="Add a food with its macros and it appears in quick-add." action={<button className="btn primary" onClick={() => setEditing('new')}>Add a food</button>} />
          ) : (
            <div className="food-grid">
              {foods.map((f) => (
                <Tilt key={f.id} className="food-card" max={5}>
                  <button className="food-main" onClick={() => openRecipe(f.id)}>
                    <strong>{f.name}</strong>
                    <small>{f.serving}</small>
                    <div className="food-macros">
                      <span><b>{f.kcal}</b> kcal</span>
                      <span className="acc"><b>{f.protein}</b>g P</span>
                      <span><b>{f.carbs}</b>g C</span>
                      <span><b>{f.fat}</b>g F</span>
                    </div>
                    <PrepBadge minutes={f.prepMinutes} />
                  </button>
                  <div className="food-actions">
                    <button className="btn ghost sm" onClick={(e) => addMeal(todayStr(), defaultMeal(), f.id, 1, { origin: { x: e.clientX, y: e.clientY } })}>＋ Log</button>
                    <button className="btn ghost sm" onClick={() => setEditing(f)}>Edit</button>
                    <button className="btn ghost sm danger" onClick={() => deleteFood(f.id)}>Delete</button>
                  </div>
                </Tilt>
              ))}
            </div>
          )}
        </>
      )}
      {pick && <Picker date={date} meal={pick} onClose={() => setPick(null)} />}
      {editing && <FoodForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
