import { useEffect, useMemo, useRef, useState } from 'react'
import '../money.css'
import { Empty, Modal, Tilt } from '../components/ui'
import { toast } from '../lib/fx'
import { useCountUp } from '../lib/hooks'
import {
  CATS, DEFAULT_PAYDAY, addExpense, catOf, deleteExpense, deleteWish, dumpRemainderTo, fmtMoney, moveWish, periodFor, planWishes,
  resetAlloc, restoreExpenses, restoreWishes, saveWish, setAlloc, setFundFrom, setNextPayday, setPaycheck, sortWishesByPriority,
  spentByCat, toggleBought, totalAlloc, useMoney, type Expense, type Priority, type Wish,
} from '../lib/money'
import { addDays, clamp, fmtDate, num, todayStr } from '../lib/util'

/* ------------------------------------------------ small bits */
/** Number input that lets you type freely (empty / partial values) and syncs back when not focused. */
function NumInput({ value, onChange, label, step = 1, className = '' }: { value: number; onChange: (n: number) => void; label: string; step?: number; className?: string }) {
  const [txt, setTxt] = useState(String(value))
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (document.activeElement !== ref.current) setTxt(String(value))
  }, [value])
  return (
    <input
      ref={ref}
      className={className}
      type="number"
      inputMode="decimal"
      min={0}
      step={step}
      value={txt}
      aria-label={label}
      onChange={(e) => {
        setTxt(e.target.value)
        onChange(Math.max(0, num(e.target.value, 0)))
      }}
      onBlur={() => setTxt(String(value))}
    />
  )
}

function Donut({ parts, total, over }: { parts: { id: string; value: number; color: string }[]; total: number; over: boolean }) {
  const R = 74
  const C = 2 * Math.PI * R
  const denom = Math.max(total, parts.reduce((a, p) => a + p.value, 0), 1)
  let acc = 0
  return (
    <svg viewBox="0 0 200 200" className={`donut ${over ? 'over' : ''}`} role="img" aria-label="Budget allocation donut">
      <circle cx="100" cy="100" r={R} className="donut-track" />
      <g transform="rotate(-90 100 100)">
        {parts.filter((p) => p.value > 0).map((p) => {
          const len = (p.value / denom) * C
          const el = (
            <circle key={p.id} cx="100" cy="100" r={R} className="donut-seg" style={{ stroke: p.color }} strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-acc} />
          )
          acc += len
          return el
        })}
      </g>
    </svg>
  )
}

/* ------------------------------------------------ Wish form */
function WishForm({ initial, onClose }: { initial?: Wish; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [price, setPrice] = useState(initial ? String(initial.price) : '')
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'want')
  const [link, setLink] = useState(initial?.link ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const ok = name.trim() && num(price, -1) >= 0 && price !== ''
  return (
    <Modal onClose={onClose} title={initial ? 'Edit wish' : 'New wish'}>
      <form
        className="stack gap"
        onSubmit={(e) => {
          e.preventDefault()
          if (!ok) return
          saveWish({ id: initial?.id, name: name.trim(), price: num(price), priority, link: link.trim() || undefined, note: note.trim() || undefined })
          onClose()
        }}
      >
        {initial?.placeholder && <p className="hint">This price is a <b>placeholder</b> — confirm the real amount and save to replace it.</p>}
        <label className="field"><span>What do you want to buy?</span><input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Gym shoes" /></label>
        <div className="grid2">
          <label className="field"><span>Price (CAD)</span><input type="number" min={0} step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" /></label>
          <div className="field"><span>Priority</span>
            <div className="seg small">{(['need', 'want', 'someday'] as Priority[]).map((p) => <button type="button" key={p} className={priority === p ? 'on' : ''} onClick={() => setPriority(p)}>{p[0].toUpperCase() + p.slice(1)}</button>)}</div>
          </div>
        </div>
        <label className="field"><span>Link (optional)</span><input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" /></label>
        <label className="field"><span>Note (optional)</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Size, store, deadline…" /></label>
        <div className="row gap end">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!ok}>Save wish</button>
        </div>
      </form>
    </Modal>
  )
}

const safeLink = (l?: string) => (l && /^https?:\/\//i.test(l) ? l : undefined)

/* ------------------------------------------------ screen */
export default function Money() {
  const s = useMoney()
  const today = todayStr()
  const p = useMemo(() => periodFor(s.nextPayday, today), [s.nextPayday, today])
  const spent = useMemo(() => spentByCat(s, p), [s, p])
  const alloc = totalAlloc(s)
  const remainder = Math.round((s.paycheck - alloc) * 100) / 100
  const over = remainder < -0.004
  const totalSpent = Object.values(spent).reduce((a, b) => a + b, 0)
  const left = s.paycheck - totalSpent
  const plan = useMemo(() => planWishes(s, p, spent), [s, p, spent])
  const unbought = s.wishes.filter((w) => !w.bought)
  const bought = s.wishes.filter((w) => w.bought)
  const [form, setForm] = useState<Wish | 'new' | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const periodPct = (p.elapsed / p.length) * 100
  const shown = useCountUp(left)
  const nowItems = plan.slots.filter((x) => x.paychecks === 0)
  const nowCost = nowItems.reduce((a, x) => a + x.wish.price, 0)

  // expense form
  const [amt, setAmt] = useState('')
  const [cat, setCat] = useState('groceries')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const periodExpenses = s.expenses.filter((e) => e.date >= p.start && e.date <= p.end).sort((a, b) => b.date.localeCompare(a.date))
  const olderCount = s.expenses.length - periodExpenses.length

  const delWish = (w: Wish) => {
    const prev = s.wishes
    deleteWish(w.id)
    toast(`Removed “${w.name}”`, { undo: () => restoreWishes(prev) })
  }
  const delExp = (e: Expense) => {
    const prev = s.expenses
    deleteExpense(e.id)
    toast('Expense removed', { undo: () => restoreExpenses(prev) })
  }
  const move = (id: string, dir: -1 | 1) => {
    const ids = unbought.map((w) => w.id)
    const i = ids.indexOf(id)
    const t = ids[i + dir]
    if (t) moveWish(id, t)
  }

  // 6 paychecks projection
  const proj = Array.from({ length: 6 }, (_, i) => ({
    label: fmtDate(addDays(p.next, i * 14), { month: 'short', day: 'numeric' }),
    saved: (s.alloc.savings || 0) * (i + 1),
    spare: Math.max(0, remainder) * (i + 1),
  }))
  const projMax = Math.max(...proj.map((x) => x.saved + x.spare), 1)

  return (
    <div className="screen money">
      <header className="page-head">
        <div><p className="eyebrow">CAD · paid bi-weekly · next payday {fmtDate(p.next)}</p><h1>Money</h1></div>
        <button className="btn primary" onClick={() => setForm('new')}>＋ New wish</button>
      </header>

      {/* ---- Paycheck planner + donut ---- */}
      <div className="two-col">
        <Tilt className="pay-card" max={3}>
          <div className="card-head"><h2>Paycheck planner</h2><span className="chip">Bi-weekly</span></div>
          <div className="grid2">
            <label className="field"><span>Expected paycheck (CAD)</span><NumInput value={s.paycheck} onChange={setPaycheck} label="Expected paycheck" step={10} /></label>
            <label className="field"><span>Next payday</span><input type="date" value={s.nextPayday} onChange={(e) => setNextPayday(e.target.value)} aria-label="Next payday" /></label>
          </div>
          <div className="period">
            <div className="period-top">
              <div><small>Current pay period</small><b>{fmtDate(p.start, { month: 'short', day: 'numeric' })} → {fmtDate(p.end, { month: 'short', day: 'numeric' })}</b></div>
              <div className="period-days"><b>{p.daysLeft}</b><small>{p.daysLeft === 1 ? 'day' : 'days'} to payday</small></div>
            </div>
            <div className="track"><div className="fill" style={{ width: `${periodPct}%` }} /></div>
            <div className="row between small muted"><span>Day {Math.min(p.elapsed + 1, 14)} of 14</span><span>Payday {fmtDate(p.next, { weekday: 'long', month: 'short', day: 'numeric' })}</span></div>
          </div>
          <div className="row gap wrap small">
            <button className="linkish" onClick={() => setNextPayday(DEFAULT_PAYDAY)}>Reset payday to Fri Oct 9, 2026</button>
            <span className="muted">Date is a default — change it to your real payday.</span>
          </div>
        </Tilt>

        <Tilt className="donut-card" max={3}>
          <div className="card-head"><h2>Allocated vs paycheck</h2><span className="muted">starting guess</span></div>
          <div className="donut-wrap">
            <Donut parts={CATS.map((c) => ({ id: c.id, value: s.alloc[c.id] || 0, color: c.color }))} total={s.paycheck} over={over} />
            <div className={`donut-center ${over ? 'over' : ''}`}>
              <b>{fmtMoney(alloc)}</b>
              <span>of {fmtMoney(s.paycheck)}</span>
              <em>{over ? `Over by ${fmtMoney(-remainder)}` : remainder === 0 ? 'Fully allocated ✓' : `${fmtMoney(remainder)} unallocated`}</em>
            </div>
          </div>
          <div className={`stackbar ${over ? 'over' : ''}`} aria-hidden>
            {CATS.map((c) => (s.alloc[c.id] || 0) > 0 && <i key={c.id} style={{ flexGrow: s.alloc[c.id], background: c.color }} title={`${c.short} ${fmtMoney(s.alloc[c.id])}`} />)}
            {remainder > 0 && <i className="rest" style={{ flexGrow: remainder }} />}
          </div>
        </Tilt>
      </div>

      <div className="stat-row four">
        <div className="stat"><small>Left this period</small><b className={left < 0 ? 'neg' : 'acc'}>{fmtMoney(shown, true)}</b><i>paycheck − spent</i></div>
        <div className="stat"><small>Spent</small><b>{fmtMoney(totalSpent, true)}</b><i>{periodExpenses.length} expense{periodExpenses.length === 1 ? '' : 's'}</i></div>
        <div className="stat"><small>Unallocated</small><b className={over ? 'neg' : remainder === 0 ? '' : 'acc'}>{over ? '−' : ''}{fmtMoney(Math.abs(remainder))}</b><i>{over ? 'over-allocated' : 'to assign'}</i></div>
        <div className="stat"><small>Wish list left</small><b>{fmtMoney(plan.total)}</b><i>{unbought.length} item{unbought.length === 1 ? '' : 's'}</i></div>
      </div>

      {/* ---- Budget ---- */}
      <Tilt className="budget-card" max={1.5}>
        <div className="card-head">
          <div><h2>Budget for this pay period</h2><p className="hint" style={{ marginTop: 4 }}><b>Starting guess</b> — every number is editable. Groceries ≈ $240 (estimate range $200–260), gym membership and other amounts are placeholders.</p></div>
        </div>
        <ul className="alloc-list">
          {CATS.map((c) => {
            const v = s.alloc[c.id] || 0
            return (
              <li key={c.id}>
                <span className="dotc" style={{ background: c.color }} aria-hidden />
                <span className="alloc-name">{c.label}<small>{s.paycheck > 0 ? Math.round((v / s.paycheck) * 100) : 0}%</small></span>
                <input
                  type="range" className="slider" min={0} max={Math.max(s.paycheck, v, 1)} step={5} value={v}
                  onChange={(e) => setAlloc(c.id, num(e.target.value))} aria-label={`${c.label} amount slider`}
                  style={{ '--pct': `${clamp((v / Math.max(s.paycheck, v, 1)) * 100, 0, 100)}%`, '--c': c.color } as React.CSSProperties}
                />
                <span className="money-in"><i>$</i><NumInput value={v} onChange={(n) => setAlloc(c.id, n)} label={`${c.label} amount`} /></span>
              </li>
            )
          })}
        </ul>
        <div className={`remainder ${over ? 'over' : remainder === 0 ? 'ok' : ''}`}>
          <span>{over ? 'Over-allocated by' : remainder === 0 ? 'Every dollar has a job' : 'Unallocated'}</span>
          <b>{fmtMoney(Math.abs(remainder))}</b>
          <div className="row gap-s wrap">
            {remainder !== 0 && <button className="btn sm" onClick={() => dumpRemainderTo(remainder > 0 ? 'savings' : 'other')}>{remainder > 0 ? 'Put it in Savings' : 'Trim it from Other'}</button>}
            <button className="btn sm ghost" onClick={() => { resetAlloc(); toast('Budget reset to the starting guess') }}>Reset to starting guess</button>
          </div>
        </div>
      </Tilt>

      {/* ---- Wish list ---- */}
      <section className="stack gap">
        <header className="page-head">
          <div><p className="eyebrow">Things I want to buy</p><h2 className="h2">Wish list</h2></div>
          <div className="row gap-s wrap">
            <div className="seg small" title="Which money pays for wishes">
              <button className={s.fundFrom === 'both' ? 'on' : ''} onClick={() => setFundFrom('both')}>Wants + Savings</button>
              <button className={s.fundFrom === 'wants' ? 'on' : ''} onClick={() => setFundFrom('wants')}>Wants only</button>
            </div>
            <button className="btn sm" onClick={() => { sortWishesByPriority(); toast('Sorted: need → want → someday') }}>Sort by priority</button>
          </div>
        </header>
        <p className="hint" style={{ marginTop: -8 }}>Prices seeded here are <b>placeholder estimates</b>, not real quotes — edit each one after checking the official price.</p>

        <Tilt className={`afford ${nowItems.length ? 'yes' : ''}`} max={2}>
          <div className="afford-ic" aria-hidden>{nowItems.length ? '✨' : '⏳'}</div>
          <div className="afford-main">
            <strong>What can I afford this paycheck?</strong>
            {nowItems.length ? (
              <p>{nowItems.map((x) => x.wish.name).join(' · ')} — <b>{fmtMoney(nowCost)}</b> of <b>{fmtMoney(plan.avail)}</b> available ({fmtMoney(plan.avail - nowCost)} left over).</p>
            ) : plan.per <= 0 ? (
              <p>Give Wants{s.fundFrom === 'both' ? ' or Savings' : ''} some budget above to see a plan.</p>
            ) : (
              <p>Nothing in the queue fits yet — {fmtMoney(plan.avail)} available this period ({fmtMoney(plan.per)} per paycheck).</p>
            )}
          </div>
        </Tilt>

        {unbought.length === 0 ? (
          <Empty icon="🛍" title="Wish list is empty" hint="Add something you’re saving for." action={<button className="btn primary" onClick={() => setForm('new')}>Add a wish</button>} />
        ) : (
          <ul className="wish-list">
            {plan.slots.map((x, i) => {
              const w = x.wish
              const l = safeLink(w.link)
              const now = x.paychecks === 0
              return (
                <li
                  key={w.id}
                  draggable
                  onDragStart={(e) => { setDragId(w.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', w.id) }}
                  onDragOver={(e) => { e.preventDefault(); setOverId(w.id) }}
                  onDragEnd={() => { setDragId(null); setOverId(null) }}
                  onDrop={(e) => { e.preventDefault(); if (dragId) moveWish(dragId, w.id); setDragId(null); setOverId(null) }}
                  className={`${dragId === w.id ? 'dragging' : ''} ${overId === w.id && dragId !== w.id ? 'drop' : ''}`}
                >
                  <Tilt className={`wish ${now ? 'now' : ''}`} max={2.5}>
                    <div className="wish-order">
                      <button className="icon-btn sm" onClick={() => move(w.id, -1)} disabled={i === 0} aria-label={`Move ${w.name} up`}>▲</button>
                      <span className="grip" aria-hidden title="Drag to reorder">⠿</span>
                      <button className="icon-btn sm" onClick={() => move(w.id, 1)} disabled={i === plan.slots.length - 1} aria-label={`Move ${w.name} down`}>▼</button>
                    </div>
                    <label className="todo big">
                      <input type="checkbox" checked={false} onChange={() => { toggleBought(w.id); toast(`Marked “${w.name}” as bought`, { tone: 'win', undo: () => toggleBought(w.id) }) }} aria-label={`Mark ${w.name} bought`} />
                      <span className="box" aria-hidden />
                    </label>
                    <div className="wish-main">
                      <div className="row gap-s wrap">
                        <strong onClick={() => setForm(w)} className="wish-name">{w.name}</strong>
                        <span className={`prio-w ${w.priority}`}>{w.priority}</span>
                        {w.placeholder && <span className="badge soft" title="Seeded estimate — edit with the real price">placeholder price</span>}
                        {now && <span className="badge pr">Affordable now</span>}
                      </div>
                      {(w.note || l) && <small className="wish-note">{w.note}{l && <> {w.note ? '· ' : ''}<a href={l} target="_blank" rel="noopener noreferrer">link ↗</a></>}</small>}
                      <div className="wish-time">
                        <div className="track"><div className={`fill ${now ? '' : 'dim'}`} style={{ width: `${x.funded * 100}%` }} /></div>
                        <small>
                          {now ? 'Fundable from this paycheck' : Number.isFinite(x.paychecks) ? `Affordable in ${x.paychecks} paycheck${x.paychecks === 1 ? '' : 's'} · ~${fmtDate(x.date, { month: 'short', day: 'numeric' })}` : 'Needs Wants/Savings budget'}
                        </small>
                      </div>
                    </div>
                    <div className="wish-side">
                      <b>{fmtMoney(w.price)}</b>
                      <div className="row gap-s">
                        <button className="icon-btn sm" onClick={() => setForm(w)} aria-label={`Edit ${w.name}`}>✎</button>
                        <button className="icon-btn sm danger" onClick={() => delWish(w)} aria-label={`Delete ${w.name}`}>🗑</button>
                      </div>
                    </div>
                  </Tilt>
                </li>
              )
            })}
          </ul>
        )}
        {bought.length > 0 && (
          <details className="bought">
            <summary>Bought ({bought.length}) · {fmtMoney(bought.reduce((a, w) => a + w.price, 0))}</summary>
            <ul>
              {bought.map((w) => (
                <li key={w.id}>
                  <span>{w.name}</span><b>{fmtMoney(w.price)}</b>
                  <button className="linkish" onClick={() => toggleBought(w.id)}>Undo</button>
                  <button className="icon-btn sm danger" onClick={() => delWish(w)} aria-label={`Delete ${w.name}`}>🗑</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* ---- Spending ---- */}
      <section className="stack gap">
        <header className="page-head"><div><p className="eyebrow">{fmtDate(p.start, { month: 'short', day: 'numeric' })} – {fmtDate(p.end, { month: 'short', day: 'numeric' })}</p><h2 className="h2">Spending log</h2></div></header>
        <div className="two-col">
          <Tilt max={2}>
            <div className="card-head"><h2>Quick add expense</h2></div>
            <form
              className="stack gap"
              onSubmit={(e) => {
                e.preventDefault()
                const a = num(amt, 0)
                if (a <= 0 || !date) return
                addExpense({ amount: a, cat, date, note: note.trim() || undefined })
                setAmt('')
                setNote('')
                toast(`Logged ${fmtMoney(a, true)} · ${catOf(cat).short}`)
              }}
            >
              <div className="grid2">
                <label className="field"><span>Amount (CAD)</span><input type="number" min={0} step="0.01" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00" /></label>
                <label className="field"><span>Category</span><select value={cat} onChange={(e) => setCat(e.target.value)}>{CATS.map((c) => <option key={c.id} value={c.id}>{c.short}</option>)}</select></label>
              </div>
              <div className="grid2">
                <label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                <label className="field"><span>Note</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" /></label>
              </div>
              <button className="btn primary" disabled={num(amt, 0) <= 0 || !date}>Add expense</button>
            </form>
            <h3 className="sub-h">This pay period {olderCount > 0 && <small className="muted">· {olderCount} outside it</small>}</h3>
            {periodExpenses.length === 0 ? (
              <Empty icon="🧾" title="No spending logged yet" hint="Add your first expense above." />
            ) : (
              <ul className="entry-list exp-list">
                {periodExpenses.map((e) => (
                  <li key={e.id}>
                    <span className="dotc" style={{ background: catOf(e.cat).color }} aria-hidden />
                    <div><strong>{catOf(e.cat).short}</strong><small>{fmtDate(e.date)}{e.note ? ` · ${e.note}` : ''}</small></div>
                    <b>{fmtMoney(e.amount, true)}</b>
                    <button className="icon-btn sm danger" onClick={() => delExp(e)} aria-label="Delete expense">🗑</button>
                  </li>
                ))}
              </ul>
            )}
          </Tilt>

          <Tilt max={2}>
            <div className="card-head"><h2>Spent vs allocated</h2><span className="muted">{fmtMoney(left, true)} left of {fmtMoney(s.paycheck)}</span></div>
            <div className="cat-list">
              {CATS.map((c) => {
                const a = s.alloc[c.id] || 0
                const sp = spent[c.id] || 0
                const pct = a > 0 ? clamp((sp / a) * 100, 0, 100) : sp > 0 ? 100 : 0
                const overC = sp > a
                return (
                  <div key={c.id}>
                    <div className="macro-top"><span><i className="dotc" style={{ background: c.color }} /> {c.short}</span><span><b className={overC ? 'neg' : ''}>{fmtMoney(sp, true)}</b><i> / {fmtMoney(a)}</i></span></div>
                    <div className="track"><div className={`fill ${overC ? 'bad' : ''}`} style={{ width: `${pct}%` }} /></div>
                  </div>
                )
              })}
            </div>
          </Tilt>
        </div>

        <Tilt max={1.5}>
          <div className="card-head"><h2>Next 6 paychecks — savings projection</h2><span className="muted">if you stick to the plan</span></div>
          <div className="proj" role="img" aria-label="Projected cumulative savings over six paychecks">
            {proj.map((x, i) => (
              <div className="proj-col" key={i}>
                <span className="bar-val">{fmtMoney(x.saved + x.spare)}</span>
                <div className="bar-wrap">
                  <div className="proj-bar" style={{ height: `${((x.saved + x.spare) / projMax) * 100}%`, animationDelay: `${i * 60}ms` }}>
                    {x.spare > 0 && <i className="spare" style={{ flexGrow: x.spare }} />}
                    <i className="saved" style={{ flexGrow: x.saved }} />
                  </div>
                </div>
                <span className="bar-lab">#{i + 1} · {x.label}</span>
              </div>
            ))}
          </div>
          <div className="ring-legend" style={{ marginTop: 10 }}><span><i className="lg acc-bg" />Savings ({fmtMoney(s.alloc.savings || 0)}/cheque)</span><span><i className="lg white-bg" style={{ opacity: 0.35 }} />Unallocated</span></div>
          <p className="hint center-t">Estimate only — assumes the same paycheck and allocations every time, and savings not touched.</p>
        </Tilt>
      </section>

      {form && <WishForm initial={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
    </div>
  )
}
