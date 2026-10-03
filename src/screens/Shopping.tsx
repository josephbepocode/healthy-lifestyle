import { useMemo, useState } from 'react'
import '../shopping.css'
import { Empty, Modal, Stepper, Tilt } from '../components/ui'
import { toast } from '../lib/fx'
import { buzz, num } from '../lib/util'
import ShoppingExtras, { PriceSources } from './ShoppingExtras'
import { PROTEIN_UNKNOWN, costPer10g } from '../lib/nutri'
import { useApp } from '../lib/store'
import { recipeFor } from '../lib/actions'
import {
  AISLES, CATALOG, STORES, addFromCatalog, addLines, buildLines, clearStock, copyText, cycleStore, deleteItem, fmtQty, groupItems, listText, money,
  flyerStatus, moveItem, priceInfo, priceTag, REGION_NOTE, SKYFARM_NOTE, planWeek, quickAdd, readBudget, resetStarter, restoreItems, saveItem, setFilter, setGroupBy, setStoreMode, sumPrices, useShop,
  type Aisle, type Item, type Store,
} from '../lib/shopping'

const UNITS = ['', 'kg', 'g', 'L', 'ml', 'lb', 'dozen', 'pack', 'bag', 'tin', 'jar', 'loaf', 'bunch', 'bottle', 'tub', 'block', 'cup', 'tbsp', 'tsp', 'slice', 'clove']

/* ------------------------------------------------ item form */
function ItemForm({ initial, onClose }: { initial?: Item; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [qty, setQty] = useState(String(initial?.qty ?? 1))
  const [unit, setUnit] = useState(initial?.unit ?? '')
  const [aisle, setAisle] = useState<Aisle>(initial?.aisle ?? 'Other')
  const [store, setStore] = useState<Store>(initial?.store ?? 'FreshCo')
  const [price, setPrice] = useState(initial?.price !== undefined ? String(initial.price) : '')
  const [note, setNote] = useState(initial?.note ?? '')
  const ok = name.trim() && num(qty, 0) > 0
  return (
    <Modal onClose={onClose} title={initial ? 'Edit item' : 'New item'}>
      <form
        className="stack gap"
        onSubmit={(e) => {
          e.preventDefault()
          if (!ok) return
          saveItem({ id: initial?.id, name: name.trim(), qty: num(qty, 1), unit: unit.trim(), aisle, store, price: price === '' ? undefined : num(price, 0), note: note.trim() || undefined })
          onClose()
        }}
      >
        <label className="field"><span>Item</span><input value={name} onChange={(e) => {
          setName(e.target.value)
          if (!initial) {
            const c = CATALOG.find((x) => x.re.test(e.target.value.toLowerCase()))
            if (c) { setAisle(c.aisle); setStore(c.store); setUnit(c.unit) }
          }
        }} autoFocus placeholder="e.g. Chicken thighs" /></label>
        <div className="grid2">
          <label className="field"><span>Quantity</span><input type="number" min={0} step="any" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
          <label className="field"><span>Unit</span><input list="shop-units" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="each / kg / tin…" /></label>
        </div>
        <datalist id="shop-units">{UNITS.filter(Boolean).map((u) => <option key={u} value={u} />)}</datalist>
        <div className="grid2">
          <label className="field"><span>Aisle</span><select value={aisle} onChange={(e) => setAisle(e.target.value as Aisle)}>{AISLES.map((a) => <option key={a}>{a}</option>)}</select></label>
          <div className="field"><span>Store</span>
            <div className="seg small">{STORES.map((s) => <button type="button" key={s} className={store === s ? 'on' : ''} onClick={() => setStore(s)}>{s}</button>)}</div>
          </div>
        </div>
        <label className="field"><span>Price for this line (CAD, optional)</span><input type="number" min={0} step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="leave blank to use the store price" /></label>
        <p className="hint">Prices you don’t type are <b>store prices</b> (real Oshawa shelf prices, checked Oct 3 2026) or <b>placeholder prices</b> (no real price yet). Type the price you actually paid to replace it.</p>
        <label className="field"><span>Note (optional)</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="brand, size, deal…" /></label>
        <div className="row gap end">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!ok}>Save item</button>
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------ build from meals */
function MealsModal({ onClose }: { onClose: () => void }) {
  const s = useApp()
  const foods = useMemo(() => s.foods.filter((f) => recipeFor(s, f.id)), [s])
  const [sv, setSv] = useState<Record<string, number>>({})
  const [days, setDays] = useState(7)
  const [seed, setSeed] = useState(0)
  const [plan, setPlan] = useState<ReturnType<typeof planWeek> | null>(null)
  const [q, setQ] = useState('')
  const picked = foods.filter((f) => (sv[f.id] || 0) > 0)
  const sel = picked.map((f) => ({ name: f.name, recipe: recipeFor(s, f.id)!, servings: sv[f.id] }))
  const preview = useMemo(() => buildLines(sel), [sel.map((x) => x.name + x.servings).join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  const foodName = (id: string) => foods.find((f) => f.id === id)?.name ?? id

  const suggest = (nextSeed: number) => {
    const p = planWeek(foods, days, s.profile.kcalTarget, s.profile.proteinTarget, nextSeed)
    const tot: Record<string, number> = {}
    p.forEach((d) => d.forEach((m) => (tot[m.id] = (tot[m.id] || 0) + m.sv)))
    setPlan(p)
    setSv(tot)
    setSeed(nextSeed)
    buzz(10)
  }
  const shown = foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <Modal onClose={onClose} wide title="Build list from meals">
      <div className="stack gap">
        <div className="gap-card plan-bar">
          <div><small>Plan the week</small><b>{s.profile.kcalTarget} kcal · {s.profile.proteinTarget} g / day</b></div>
          <div className="row gap-s wrap">
            <Stepper value={days} onChange={(v) => setDays(Math.round(v))} step={1} min={1} format={(v) => `${v} day${v === 1 ? '' : 's'}`} />
            <button className="btn primary sm" onClick={() => suggest(0)}>✨ Pick meals</button>
            {plan && <button className="btn ghost sm" onClick={() => suggest(seed + 1)}>🎲 Shuffle</button>}
          </div>
        </div>
        {plan && (
          <div className="plan-days">
            {plan.map((d, i) => (
              <div key={i} className="plan-day">
                <b>Day {i + 1}</b>
                <small>{Math.round(d.reduce((a, m) => a + m.kcal, 0))} kcal · {Math.round(d.reduce((a, m) => a + m.protein, 0))} g protein</small>
                <span>{d.map((m) => `${foodName(m.id)}${m.sv !== 1 ? ` ×${m.sv}` : ''}`).join(' · ')}</span>
              </div>
            ))}
          </div>
        )}
        <p className="hint">…or tick meals yourself. Servings = how many portions you’ll cook in total (e.g. 3 for the same dinner on 3 days). Ingredients are merged; anything already <b>In stock</b> is skipped.</p>
        <input className="search" placeholder="Search recipes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search recipes" />
        <ul className="meal-pick">
          {shown.map((f) => {
            const v = sv[f.id] || 0
            return (
              <li key={f.id} className={v > 0 ? 'on' : ''}>
                <button className="mp-main" onClick={() => setSv({ ...sv, [f.id]: v > 0 ? 0 : 1 })} aria-pressed={v > 0}>
                  <span className="check" aria-hidden>{v > 0 ? '✓' : ''}</span>
                  <span className="mp-name">{f.name}<small>{Math.round(f.kcal)} kcal · {Math.round(f.protein)} g protein</small></span>
                </button>
                {v > 0 && <Stepper value={v} onChange={(n) => setSv({ ...sv, [f.id]: n })} step={0.5} min={0.5} format={(n) => `${n}×`} />}
              </li>
            )
          })}
        </ul>
        <div className="meal-foot">
          <div>
            <b>{preview.lines.length}</b> ingredient line{preview.lines.length === 1 ? '' : 's'} from <b>{picked.length}</b> meal{picked.length === 1 ? '' : 's'}
            {preview.skipped.length > 0 && <small className="muted"> · skipped (not in your diet): {preview.skipped.join(', ')}</small>}
          </div>
          <button
            className="btn primary big"
            disabled={!preview.lines.length}
            onClick={() => {
              const r = addLines(preview.lines)
              toast(`Added ${r.added} new, merged ${r.merged}${r.inStock.length ? `, ${r.inStock.length} already in stock` : ''}`, { tone: 'win' })
              onClose()
            }}
          >
            ＋ Add to Need to get
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------ screen */
export default function Shopping() {
  const s = useShop()
  const [form, setForm] = useState<Item | 'new' | null>(null)
  const [meals, setMeals] = useState(false)
  const [fading, setFading] = useState<Set<string>>(new Set())
  const [quick, setQuick] = useState('')
  const need = s.items.filter((i) => i.stock === 'need')
  const have = s.items.filter((i) => i.stock === 'have')
  const budget = readBudget()
  const total = sumPrices(need)
  const unpriced = need.filter((i) => i.price === undefined).length
  const nEst = need.filter((i) => i.priceSrc === 'estimate').length
  const nPh = need.filter((i) => i.priceSrc === 'placeholder').length
  const nTyped = need.filter((i) => i.priceSrc === 'edited').length
  const pct = budget ? Math.min(100, (total / budget.perPaycheck) * 100) : 0
  const over = !!budget && total > budget.perPaycheck
  const needGroups = groupItems(need, s.groupBy, s.filter)
  const haveGroups = groupItems(have, s.groupBy, s.filter)

  const tick = (it: Item) => {
    if (fading.has(it.id)) return
    buzz(14)
    setFading((f) => new Set(f).add(it.id))
    setTimeout(() => {
      moveItem(it.id, 'have')
      setFading((f) => {
        const n = new Set(f)
        n.delete(it.id)
        return n
      })
      toast(`Bought “${it.name}” → In stock`, { tone: 'win', undo: () => moveItem(it.id, 'need') })
    }, 420)
  }
  const del = (it: Item) => {
    const prev = s.items
    deleteItem(it.id)
    toast(`Removed “${it.name}”`, { undo: () => restoreItems(prev) })
  }

  const row = (it: Item) => {
    const isHave = it.stock === 'have'
    const qty = fmtQty(it.qty, it.unit)
    const info = priceInfo(it)
    const pc = costPer10g(it.cat, it.store)
    const fs = flyerStatus(it.cat, it.store)
    return (
      <li key={it.id} className={`shop-li ${fading.has(it.id) ? 'bought' : ''}`}>
        <Tilt className={`shop-row ${isHave ? 'have' : ''}`} max={2} glare={false}>
          {isHave ? (
            <span className="stock-ic" aria-hidden>✓</span>
          ) : (
            <label className="todo big">
              <input type="checkbox" checked={fading.has(it.id)} onChange={() => tick(it)} aria-label={`Bought ${it.name}`} />
              <span className="box" aria-hidden />
            </label>
          )}
          <div className="shop-main" onClick={() => setForm(it)}>
            <div className="row gap-s wrap">
              <strong>{it.name}</strong>
              {qty && <span className="qty">{qty}</span>}
            </div>
            <small>
              {it.price !== undefined ? (
                it.priceSrc === 'placeholder' ? <><i className="ph">~{money(it.price)}</i> · placeholder price</>
                : it.priceSrc === 'estimate' ? <><i className="ph">{money(it.price)}</i> · store price{info?.kg ? ` (per ${info.per ?? 'kg'})` : ''}{info?.packLabel && !info.kg ? ` · pack: ${info.packLabel}` : ''}{info?.sale ? ' · sale' : ''}{info?.note ? ` · ${info.note}` : ''}{info?.oos ? ' · OUT OF STOCK' : ''}</>
                : <>{money(it.price)}</>
              ) : <span className="muted">no price</span>}
              {pc && it.price !== undefined ? ` · ~${money(pc.per10g)}/10 g protein (${pc.src === 'estimate' ? 'store price' : 'placeholder'}${pc.bulk ? ', bulk bag' : ''}${pc.approx ? ', weight approximate' : ''})` : ''}
              {it.note ? ` · ${it.note}` : ''}
              {it.cat && PROTEIN_UNKNOWN.includes(it.cat) ? ' · protein unknown (not ranked)' : ''}
              {fs && <span className={fs.expired ? 'neg' : 'phone-note'}> · {fs.text}</span>}
              {it.store === 'Skyfarm' && <span className="phone-note"> · ☎ {SKYFARM_NOTE}</span>}
            </small>
          </div>
          <button className={`store-badge ${it.store}`} onClick={() => { cycleStore(it.id); buzz(8) }} title="Tap to switch store" aria-label={`Store ${it.store}, tap to switch`}>{it.store}</button>
          {isHave ? (
            <button className="btn sm" onClick={() => { moveItem(it.id, 'need'); toast(`“${it.name}” is back on Need to get`) }}>Ran out</button>
          ) : null}
          <div className="shop-actions">
            <button className="icon-btn sm" onClick={() => setForm(it)} aria-label={`Edit ${it.name}`}>✎</button>
            <button className="icon-btn sm danger" onClick={() => del(it)} aria-label={`Delete ${it.name}`}>🗑</button>
          </div>
        </Tilt>
      </li>
    )
  }
  const renderGroups = (groups: ReturnType<typeof groupItems>) =>
    groups.map((g) => (
      <div className="shop-group" key={g.store ?? 'all'}>
        {g.store && (
          <h3 className={`store-h ${g.store}`}>
            <span>{g.store}</span>
            <small>{g.store === 'Skyfarm' ? `meat · ${SKYFARM_NOTE}` : 'general groceries'} · {g.items.length} item{g.items.length === 1 ? '' : 's'}{g.items.some((i) => i.price !== undefined) ? ` · ~${money(sumPrices(g.items))}` : ''}</small>
          </h3>
        )}
        {g.aisles.map((a) => (
          <div key={a.aisle}>
            <h4 className="aisle-h">{a.aisle}</h4>
            <ul className="shop-list">{a.items.map((it) => row(it))}</ul>
          </div>
        ))}
      </div>
    ))

  return (
    <div className={`screen shopping ${s.storeMode ? 'instore' : ''}`}>
      <header className="page-head no-print">
        <div><p className="eyebrow">{need.length} to get · {have.length} in stock</p><h1>Shopping</h1></div>
        <div className="row gap-s wrap">
          <button className="btn" onClick={() => setMeals(true)}>🍲 Build from meals</button>
          <button className="btn primary" onClick={() => setForm('new')}>＋ Add item</button>
        </div>
      </header>

      <Tilt className="budget-shop no-print" max={2}>
        <div className="row between wrap gap">
          <div>
            <small className="lbl">Cost of Need to get (store prices)</small>
            <div className={`big-total ${over ? 'neg' : ''}`}>{money(total)}</div>
            <small className="muted">{[nEst ? `${nEst} store price${nEst === 1 ? '' : 's'}` : '', nPh ? `${nPh} placeholder price${nPh === 1 ? '' : 's'}` : '', nTyped ? `${nTyped} typed by you` : '', unpriced ? `${unpriced} without a price` : ''].filter(Boolean).join(' · ') || 'no prices yet'} · not exact</small>
            <small className="price-note">{REGION_NOTE}</small>
            <PriceSources />
          </div>
          {budget ? (
            <div className="budget-side">
              <small className="lbl">Grocery budget / paycheck (Money tab)</small>
              <b>{money(budget.perPaycheck)}</b>
              <small className="muted">groceries {money(budget.groceries)} + protein extras {money(budget.protein)}</small>
            </div>
          ) : (
            <div className="budget-side">
              <small className="lbl">Grocery budget</small>
              <small className="muted">No Money-tab budget saved yet.</small>
              <a className="linkish" href="#money">Set one in Money →</a>
            </div>
          )}
        </div>
        {over && budget && <div className="over-banner" role="alert">⚠ Over your grocery budget by {money(total - budget.perPaycheck)} — trim the list or move items to the next trip.</div>}
        {budget && (
          <>
            <div className="track"><div className={`fill ${over ? 'bad' : ''}`} style={{ width: `${pct}%` }} /></div>
            <small className={over ? 'neg' : 'muted'}>{over ? `Over budget by ${money(total - budget.perPaycheck)}` : `${money(budget.perPaycheck - total)} left in the budget`} · {Math.round((total / budget.perPaycheck) * 100)}% used</small>
          </>
        )}
      </Tilt>

      <ShoppingExtras />

      <div className="row between wrap gap no-print">
        <div className="row gap-s wrap">
          <div className="seg small" role="group" aria-label="Group by">
            <button className={s.groupBy === 'store' ? 'on' : ''} onClick={() => setGroupBy('store')}>By store</button>
            <button className={s.groupBy === 'aisle' ? 'on' : ''} onClick={() => setGroupBy('aisle')}>By aisle</button>
          </div>
          <div className="seg small" role="group" aria-label="Store filter">
            <button className={s.filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All stores</button>
            {STORES.map((st) => <button key={st} className={s.filter === st ? 'on' : ''} onClick={() => setFilter(st)}>{st}</button>)}
          </div>
        </div>
        <div className="row gap-s wrap">
          <button className={`btn sm ${s.storeMode ? 'glow' : ''}`} onClick={() => setStoreMode(!s.storeMode)} aria-pressed={s.storeMode}>🛒 In-store mode</button>
          <button className="btn sm" onClick={async () => { toast((await copyText(listText(s.items, s.groupBy, s.filter))) ? 'List copied to clipboard' : 'Could not copy — try Print') }}>📋 Copy list</button>
          <button className="btn sm" onClick={() => window.print()}>🖨 Print</button>
        </div>
      </div>

      <form className="quick-task no-print" onSubmit={(e) => { e.preventDefault(); if (quick.trim()) { quickAdd(quick); setQuick('') } }}>
        <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Quick add — type an item and hit Enter (store & aisle are guessed)" aria-label="Quick add item" />
      </form>

      <section className="staples no-print" aria-label="Staples">
        <div className="row between wrap"><h2>Staples</h2><small className="muted">tap to add · “store price” = real Oshawa shelf price (Oct 3) · “placeholder” = no real price yet</small></div>
        <div className="chips-row">
          {CATALOG.filter((c) => c.chip).map((c) => {
            const onList = need.some((i) => i.cat === c.id)
            return (
              <button key={c.id} className={`staple ${onList ? 'on' : ''}`} onClick={() => {
                const r = addFromCatalog(c.id)
                toast(r === 'exists' ? `${c.name} is already on the list` : r === 'restocked' ? `${c.name} added (you had it in stock)` : `Added ${c.name}`)
              }}>
                <span>{c.name}</span>
                <small>{onList ? 'on list ✓' : priceTag(c.id, c.store)}</small>
              </button>
            )
          })}
        </div>
      </section>

      <section className="stack gap print-area">
        <header className="sec-head">
          <h2>Need to get <span className="count">{need.length}</span></h2>
          {need.length > 0 && <small className="muted no-print">tick = bought → moves to In stock</small>}
        </header>
        {need.length === 0 ? (
          <Empty icon="🛍" title="Nothing left to get" hint="Add items, tap a staple, or build a list from meals." action={<button className="btn primary" onClick={() => setMeals(true)}>Build from meals</button>} />
        ) : needGroups.length === 0 ? (
          <Empty icon="🔎" title={`Nothing to get from ${s.filter}`} hint="Switch the store filter to see everything." />
        ) : renderGroups(needGroups)}
      </section>

      <section className="stack gap no-print-lite">
        <header className="sec-head">
          <h2>In stock <span className="count">{have.length}</span></h2>
          {have.length > 0 && (
            <button className="btn sm ghost no-print" onClick={() => {
              const prev = s.items
              clearStock()
              toast('Cleared In stock', { undo: () => restoreItems(prev) })
            }}>Clear all in stock</button>
          )}
        </header>
        {have.length === 0 ? (
          <Empty icon="🧺" title="Your kitchen is empty" hint="Tick items under Need to get when you buy them — they land here. Tap “Ran out” to move one back." />
        ) : haveGroups.length === 0 ? (
          <Empty icon="🔎" title={`Nothing in stock from ${s.filter}`} />
        ) : renderGroups(haveGroups)}
      </section>

      <div className="row gap wrap no-print">
        <button className="linkish" onClick={() => { const prev = s.items; resetStarter(); toast('Starter list restored', { undo: () => restoreItems(prev) }) }}>Reset Need to get to the starter list</button>
        <small className="muted">Starter items are editable. Prices are Oshawa store prices (checked Oct 3 2026) or placeholders until you type real ones. No tuna, fresh fish or swallow ingredients.</small>
      </div>

      {form && <ItemForm initial={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
      {meals && <MealsModal onClose={() => setMeals(false)} />}
    </div>
  )
}
