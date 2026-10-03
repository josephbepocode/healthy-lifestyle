import { useState } from 'react'
import Money from './Money'
import { Tilt } from '../components/ui'
import { bills, saveBill, deleteBill, dueDates, nextDue, type Bill } from '../lib/bills'
import { useMoney, periodFor, fmtMoney, totalAlloc } from '../lib/money'
import { addDays, diffDays, fmtDate, num, todayStr } from '../lib/util'
import { toast } from '../lib/fx'

export function BillsCard() {
  const b = bills.use()
  const m = useMoney()
  const today = todayStr()
  const p = periodFor(m.nextPayday, today)
  const [edit, setEdit] = useState<Partial<Bill> | null>(null)
  const due = b.bills.flatMap((x) => dueDates(x, today, p.end).map((d) => ({ x, d }))).sort((a, c) => a.d.localeCompare(c.d))
  const dueTotal = due.reduce((a, r) => a + r.x.amount, 0)
  const rentAlloc = m.alloc.rent || 0
  const hasRent = b.bills.some((x) => /rent/i.test(x.name))
  return (
    <Tilt className="bills-card">
      <div className="card-head"><h2>🧾 Bills &amp; subscriptions</h2><button className="btn sm" onClick={() => setEdit({ name: '', amount: 0, freq: 'monthly', day: 1 })}>＋ Add bill</button></div>
      <div className="bill-sum">
        <div><small>Due before next payday ({fmtDate(p.next, { month: 'short', day: 'numeric' })})</small><b>{fmtMoney(dueTotal, true)}</b></div>
        <div><small>Paycheck − those bills</small><b className={m.paycheck - dueTotal < 0 ? 'neg' : ''}>{fmtMoney(m.paycheck - dueTotal, true)}</b></div>
      </div>
      {hasRent && <p className="hint">Your plan already sets aside <b>{fmtMoney(rentAlloc)}</b> of each paycheck for rent (monthly rent × 12 ÷ 26), and that allocation is unchanged. Rent is only <i>shown</i> here by due date — it is not subtracted again from the planner’s allocations. “Paycheck − bills” is a cash-on-hand view; planned total is {fmtMoney(totalAlloc(m))}.</p>}
      <ul className="bill-list">
        {b.bills.length === 0 && <li className="muted">No bills yet.</li>}
        {[...b.bills].sort((a, c) => (nextDue(a) || '9').localeCompare(nextDue(c) || '9')).map((x) => {
          const nd = nextDue(x)
          const before = nd && nd <= p.end
          return (
            <li key={x.id} className={before ? 'soon' : ''}>
              <div><strong>{x.name}</strong><small>{x.freq === 'monthly' ? `monthly · day ${x.day}` : 'every 2 weeks'}{nd ? ` · next ${fmtDate(nd)} (${diffDays(nd, today) === 0 ? 'today' : `in ${diffDays(nd, today)} d`})` : ''}</small></div>
              <span className={`tag ${before ? 'warn' : ''}`}>{before ? 'before payday' : 'after payday'}</span>
              <b>{fmtMoney(x.amount, true)}</b>
              <button className="icon-btn sm" aria-label={`Edit ${x.name}`} onClick={() => setEdit(x)}>✎</button>
              <button className="icon-btn sm danger" aria-label={`Delete ${x.name}`} onClick={() => { const prev = x; deleteBill(x.id); toast(`Removed ${x.name}`, { undo: () => saveBill(prev) }) }}>🗑</button>
            </li>)
        })}
      </ul>
      {due.length > 0 && <p className="hint">Falls before {fmtDate(p.next)}: {due.map((r) => `${r.x.name} ${fmtDate(r.d, { month: 'short', day: 'numeric' })}`).join(', ')}. Pay period ends {fmtDate(addDays(p.next, -1), { month: 'short', day: 'numeric' })}.</p>}
      {edit && (
        <form className="bill-form" onSubmit={(e) => { e.preventDefault(); if (!edit.name?.trim() || !(edit.amount && edit.amount > 0)) return; saveBill({ id: edit.id, name: edit.name.trim(), amount: edit.amount, freq: edit.freq || 'monthly', day: edit.day || 1, anchor: edit.freq === 'biweekly' ? edit.anchor || today : undefined }); setEdit(null) }}>
          <label className="field"><span>Name</span><input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus /></label>
          <label className="field"><span>Amount ($)</span><input type="number" step="0.01" min="0" value={edit.amount ?? ''} onChange={(e) => setEdit({ ...edit, amount: num(e.target.value) })} /></label>
          <label className="field"><span>Repeats</span><select value={edit.freq} onChange={(e) => setEdit({ ...edit, freq: e.target.value as Bill['freq'] })}><option value="monthly">Monthly</option><option value="biweekly">Every 2 weeks</option></select></label>
          {edit.freq === 'biweekly' ? <label className="field"><span>A due date</span><input type="date" value={edit.anchor || today} onChange={(e) => setEdit({ ...edit, anchor: e.target.value })} /></label> : <label className="field"><span>Day of month</span><input type="number" min="1" max="31" value={edit.day ?? 1} onChange={(e) => setEdit({ ...edit, day: Math.min(31, Math.max(1, Math.round(num(e.target.value, 1)))) })} /></label>}
          <div className="row gap-s"><button className="btn primary sm">Save</button><button type="button" className="btn ghost sm" onClick={() => setEdit(null)}>Cancel</button></div>
        </form>
      )}
    </Tilt>
  )
}

/** The Money tab (unchanged) with the bills card below it. */
export default function MoneyTab() {
  return (
    <>
      <Money />
      <div className="screen bills-wrap"><BillsCard /></div>
    </>
  )
}
