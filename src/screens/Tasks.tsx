import { useState } from 'react'
import { useApp } from '../lib/store'
import { deleteTask, saveTask, toggleTask } from '../lib/actions'
import { Empty, Modal, Tilt } from '../components/ui'
import { diffDays, fmtDate, todayStr } from '../lib/util'
import type { Priority, Task } from '../types'

const PR: Record<Priority, { label: string; w: number }> = { high: { label: 'High', w: 0 }, med: { label: 'Medium', w: 1 }, low: { label: 'Low', w: 2 } }

function dueLabel(due: string | undefined) {
  if (!due) return { text: 'No due date', cls: '' }
  const d = diffDays(due, todayStr())
  if (d < 0) return { text: `Overdue · ${fmtDate(due)}`, cls: 'late' }
  if (d === 0) return { text: 'Due today', cls: 'soon' }
  if (d === 1) return { text: 'Due tomorrow', cls: 'soon' }
  if (d <= 7) return { text: `Due ${fmtDate(due)} · in ${d} days`, cls: 'soon' }
  return { text: `Due ${fmtDate(due, { month: 'short', day: 'numeric', year: 'numeric' })}`, cls: '' }
}

function TaskForm({ initial, onClose }: { initial?: Task; onClose: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [due, setDue] = useState(initial?.due ?? '')
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'med')
  return (
    <Modal onClose={onClose} title={initial ? 'Edit task' : 'New task'}>
      <form
        className="stack gap"
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return
          saveTask({ id: initial?.id, title: title.trim(), due: due || undefined, priority })
          onClose()
        }}
      >
        <label className="field"><span>What needs doing?</span><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="e.g. Renew gym membership" /></label>
        <div className="grid2">
          <label className="field"><span>Due date</span><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
          <div className="field"><span>Priority</span>
            <div className="seg small">{(['high', 'med', 'low'] as Priority[]).map((p) => <button type="button" key={p} className={priority === p ? 'on' : ''} onClick={() => setPriority(p)}>{PR[p].label}</button>)}</div>
          </div>
        </div>
        <div className="row gap end">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!title.trim()}>Save task</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Tasks() {
  const s = useApp()
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open')
  const [sort, setSort] = useState<'due' | 'priority'>('due')
  const [form, setForm] = useState<Task | 'new' | null>(null)
  const [quick, setQuick] = useState('')
  const list = s.tasks
    .filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : !t.done))
    .sort((a, b) =>
      sort === 'due'
        ? (a.due || '9999').localeCompare(b.due || '9999') || PR[a.priority].w - PR[b.priority].w
        : PR[a.priority].w - PR[b.priority].w || (a.due || '9999').localeCompare(b.due || '9999'),
    )
  const open = s.tasks.filter((t) => !t.done).length
  const done = s.tasks.length - open
  return (
    <div className="screen">
      <header className="page-head">
        <div><p className="eyebrow">{open} open · {done} done</p><h1>Tasks</h1></div>
        <button className="btn primary" onClick={() => setForm('new')}>＋ New task</button>
      </header>
      <form className="quick-task" onSubmit={(e) => { e.preventDefault(); if (quick.trim()) { saveTask({ title: quick.trim(), priority: 'med' }); setQuick('') } }}>
        <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Quick add — type and hit Enter" aria-label="Quick add task" />
      </form>
      <div className="row between wrap gap">
        <div className="seg small">{(['open', 'done', 'all'] as const).map((f) => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}</div>
        <div className="seg small"><button className={sort === 'due' ? 'on' : ''} onClick={() => setSort('due')}>By date</button><button className={sort === 'priority' ? 'on' : ''} onClick={() => setSort('priority')}>By priority</button></div>
      </div>
      {list.length === 0 ? (
        <Empty icon={filter === 'done' ? '📋' : '🎉'} title={filter === 'done' ? 'Nothing completed yet' : 'Nothing to do'} hint={filter === 'done' ? 'Tick a task and it lands here.' : 'Enjoy it — or add something new.'} action={<button className="btn primary" onClick={() => setForm('new')}>Add a task</button>} />
      ) : (
        <ul className="task-list">
          {list.map((t) => {
            const d = dueLabel(t.due)
            return (
              <li key={t.id}>
                <Tilt className={`task ${t.done ? 'done' : ''}`} max={2.5}>
                  <label className="todo big">
                    <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} aria-label={`Mark ${t.title} done`} />
                    <span className="box" aria-hidden />
                  </label>
                  <div className="task-main" onClick={() => setForm(t)}>
                    <strong>{t.title}</strong>
                    <small className={d.cls}>{t.done ? 'Done' : d.text}</small>
                  </div>
                  <span className={`prio ${t.priority}`}>{PR[t.priority].label}</span>
                  <button className="icon-btn danger" onClick={() => deleteTask(t.id)} aria-label="Delete task">🗑</button>
                </Tilt>
              </li>
            )
          })}
        </ul>
      )}
      {form && <TaskForm initial={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
    </div>
  )
}
