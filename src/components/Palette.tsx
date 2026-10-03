import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../lib/store'
import { CATEGORIES, MEALS, addMeal, addWeighIn, defaultMeal, saveTask, startTimer } from '../lib/actions'
import { CATS, addExpense } from '../lib/money'
import { addWater, habits } from '../lib/habits'
import { toast } from '../lib/fx'
import { useEscape } from '../lib/hooks'
import { num, round, todayStr } from '../lib/util'

export interface Nav { id: string; label: string; icon: string; key?: string }
type Mode = null | 'expense' | 'task' | 'weigh' | 'timer' | 'meal'
interface Cmd { key: string; icon: string; label: string; hint?: string; run: () => void }

export default function Palette({ onClose, go, tabs }: { onClose: () => void; go: (t: string) => void; tabs: Nav[] }) {
  const s = useApp()
  const h = habits.get()
  const [q, setQ] = useState('')
  const [mode, setMode] = useState<Mode>(null)
  const [sel, setSel] = useState(0)
  const [f, setF] = useState<Record<string, string>>({})
  const [meal, setMeal] = useState(defaultMeal())
  const input = useRef<HTMLInputElement>(null)
  useEscape(onClose)
  useEffect(() => {
    document.body.classList.add('modal-open')
    input.current?.focus()
    return () => document.body.classList.remove('modal-open')
  }, [mode])
  const done = (msg: string) => { toast(msg, { tone: 'win' }); onClose() }
  const today = todayStr()

  const cmds: Cmd[] = useMemo(() => [
    { key: 'meal', icon: '🍽', label: 'Log a meal', hint: 'search any food', run: () => (setMode('meal'), setQ('')) },
    { key: 'w250', icon: '💧', label: `Add water +${h.glass} ml`, hint: 'one glass', run: () => (addWater(today, h.glass), done(`+${h.glass} ml water`)) },
    { key: 'w500', icon: '💧', label: 'Add water +500 ml', run: () => (addWater(today, 500), done('+500 ml water')) },
    { key: 'expense', icon: '💵', label: 'Log an expense', hint: 'Money tab', run: () => (setMode('expense'), setQ('')) },
    { key: 'task', icon: '✓', label: 'Add a task', run: () => (setMode('task'), setQ('')) },
    { key: 'weigh', icon: '⚖️', label: 'Log a weigh-in', run: () => (setMode('weigh'), setQ('')) },
    { key: 'timer', icon: '⏱', label: 'Start a timer', run: () => (setMode('timer'), setQ('')) },
    ...tabs.map((t) => ({ key: 'go-' + t.id, icon: t.icon, label: `Go to ${t.label}`, hint: t.key ? `key ${t.key}` : undefined, run: () => (go(t.id), onClose()) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [h.glass, tabs])

  const items: Cmd[] = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (mode === 'meal') return s.foods.filter((x) => !t || x.name.toLowerCase().includes(t)).slice(0, 8).map((x) => ({ key: x.id, icon: '🍴', label: x.name, hint: `${Math.round(x.kcal)} kcal · ${Math.round(x.protein)} g protein`, run: () => (addMeal(today, meal, x.id, 1, { silent: true }), done(`Added ${x.name} to ${meal}`)) }))
    if (mode) return []
    const c = cmds.filter((x) => !t || x.label.toLowerCase().includes(t) || (x.hint || '').toLowerCase().includes(t))
    const foods = t.length >= 2 ? s.foods.filter((x) => x.name.toLowerCase().includes(t)).slice(0, 4).map((x) => ({ key: 'f' + x.id, icon: '🍴', label: `Log ${x.name}`, hint: `→ ${meal} · ${Math.round(x.kcal)} kcal`, run: () => (addMeal(today, meal, x.id, 1, { silent: true }), done(`Added ${x.name} to ${meal}`)) })) : []
    return [...foods, ...c].slice(0, 10)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, mode, cmds, s.foods, meal])
  useEffect(() => setSel(0), [q, mode])

  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') (e.preventDefault(), setSel((i) => Math.min(i + 1, items.length - 1)))
    else if (e.key === 'ArrowUp') (e.preventDefault(), setSel((i) => Math.max(i - 1, 0)))
    else if (e.key === 'Enter' && !mode) (e.preventDefault(), items[sel]?.run())
    else if (e.key === 'Enter' && mode === 'meal') (e.preventDefault(), items[sel]?.run())
    else if (e.key === 'Backspace' && mode && !q) setMode(null)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'expense') { const a = num(f.amount); if (a <= 0) return; addExpense({ amount: round(a, 2), cat: f.cat || 'groceries', date: today, note: f.note?.trim() || undefined }); done(`Logged $${round(a, 2)} expense`) }
    if (mode === 'task') { if (!f.title?.trim()) return; saveTask({ title: f.title.trim(), due: f.due || undefined, priority: 'med' }); done('Task added') }
    if (mode === 'weigh') { const k = num(f.kg); if (k < 20 || k > 300) return; addWeighIn(today, round(k, 1)); onClose() }
    if (mode === 'timer') { startTimer(f.label || '', f.cat || CATEGORIES[0]); done('Timer started') }
  }
  const F = (k: string, label: string, p: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="field"><span>{label}</span><input {...p} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  )
  return createPortal(
    <div className="overlay pal-ov" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="Quick add">
      <div className="palette">
        {(!mode || mode === 'meal') ? (
          <>
            <div className="pal-in">
              <span aria-hidden>{mode === 'meal' ? '🍽' : '⌕'}</span>
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder={mode === 'meal' ? 'Search a food… Enter to add' : 'Type a command or food — meal, water, expense, task, weigh-in, timer…'} aria-label="Quick add command" />
              <kbd>esc</kbd>
            </div>
            {mode === 'meal' && (
              <div className="pal-meals">{MEALS.map((m) => <button key={m.id} className={meal === m.id ? 'on' : ''} onClick={() => setMeal(m.id)}>{m.icon} {m.label}</button>)}<button onClick={() => setMode(null)}>← back</button></div>
            )}
            <ul className="pal-list" role="listbox">
              {items.map((c, i) => (
                <li key={c.key}><button role="option" aria-selected={i === sel} className={i === sel ? 'on' : ''} onMouseEnter={() => setSel(i)} onClick={c.run}><span className="pi">{c.icon}</span><span className="pl">{c.label}</span>{c.hint && <small>{c.hint}</small>}</button></li>
              ))}
              {items.length === 0 && <li className="pal-empty">Nothing matches “{q}”.</li>}
            </ul>
            <div className="pal-foot"><span>↑↓ choose</span><span>↵ run</span><span>⌘/Ctrl K open anywhere</span></div>
          </>
        ) : (
          <form className="pal-form" onSubmit={submit}>
            <div className="pal-title"><button type="button" className="icon-btn sm" onClick={() => setMode(null)} aria-label="Back">←</button><h2>{{ expense: '💵 Log an expense', task: '✓ Add a task', weigh: '⚖️ Log a weigh-in', timer: '⏱ Start a timer' }[mode]}</h2></div>
            {mode === 'expense' && (<>
              {F('amount', 'Amount ($)', { type: 'number', step: '0.01', min: '0', inputMode: 'decimal', autoFocus: true })}
              <label className="field"><span>Category</span><select value={f.cat || 'groceries'} onChange={(e) => setF({ ...f, cat: e.target.value })}>{CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
              {F('note', 'Note (optional)')}</>)}
            {mode === 'task' && (<>{F('title', 'Task', { autoFocus: true })}{F('due', 'Due (optional)', { type: 'date' })}</>)}
            {mode === 'weigh' && F('kg', 'Weight (kg)', { type: 'number', step: '0.1', inputMode: 'decimal', autoFocus: true, placeholder: String(s.profile.weightKg) })}
            {mode === 'timer' && (<>{F('label', 'What are you working on?', { autoFocus: true })}<label className="field"><span>Category</span><select value={f.cat || CATEGORIES[0]} onChange={(e) => setF({ ...f, cat: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label></>)}
            <div className="row gap end"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Save</button></div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}
