import { useEffect } from 'react'
import { Tilt } from '../components/ui'
import { moveItem, money, PRICE_META, useShop } from '../lib/shopping'
import { LOW_DAYS, lowItems, proteinRanking, shopx } from '../lib/nutri'
import { diffDays, todayStr } from '../lib/util'
import { toast } from '../lib/fx'

export default function ShoppingExtras() {
  const s = useShop()
  const x = shopx.use()
  const today = todayStr()
  // note the day each item lands In stock (and forget items that left stock)
  useEffect(() => {
    const at = { ...shopx.get().at }
    let ch = false
    for (const i of s.items) {
      if (i.stock === 'have' && !at[i.id]) ((at[i.id] = today), (ch = true))
      if (i.stock !== 'have' && at[i.id]) (delete at[i.id], (ch = true))
    }
    for (const id of Object.keys(at)) if (!s.items.some((i) => i.id === id)) (delete at[id], (ch = true))
    if (ch) shopx.set((v) => ({ ...v, at }))
  }, [s.items, today])
  const low = lowItems(today)
  const rank = proteinRanking()
  const best = rank[0]?.per10g || 1
  return (
    <>
      {low.length > 0 && (
        <Tilt className="low-card">
          <div className="card-head"><h2>⏳ Running low?</h2><span className="muted">in stock {LOW_DAYS}+ days</span></div>
          <ul className="low-list">
            {low.map((i) => (
              <li key={i.id}>
                <div><strong>{i.name}</strong><small>in stock for {diffDays(today, x.at[i.id])} days — check if you need more</small></div>
                <button className="btn sm" onClick={() => { moveItem(i.id, 'need'); toast(`“${i.name}” is back on Need to get`) }}>Ran out</button>
                <button className="btn sm ghost" onClick={() => shopx.set((v) => ({ ...v, at: { ...v.at, [i.id]: today } }))}>Still good</button>
              </li>
            ))}
          </ul>
        </Tilt>
      )}
      <Tilt className="protein-card no-print">
        <div className="card-head"><h2>💪 Cheapest protein</h2><span className="muted">cost per 10 g of protein</span></div>
        <ol className="rank">
          {rank.map((r, n) => (
            <li key={r.id}>
              <span className="n">{n + 1}</span>
              <div className="rk"><strong>{r.label}</strong><div className="track"><div className="fill" style={{ width: `${Math.min(100, (best / r.per10g) * 100)}%` }} /></div></div>
              <b>~{money(r.per10g)}</b>
              <small>{r.src === 'estimate' ? 'store price' : 'placeholder price'}{r.bulk ? ' · bulk' : ''}{r.approx ? ' · ≈ weight' : ''}</small>
            </li>
          ))}
        </ol>
        <p className="hint">Uses the real Oshawa shelf prices (checked Oct 3 2026) and <b>approximate</b> protein per pack (label-style averages, not exact). <b>Bulk</b> = Skyfarm 5 kg bags you order by phone, so they are cheap per gram but a big upfront spend (freeze in portions); FreshCo packs are what you can grab today. <b>≈ weight</b> = the shelf shows no pack weight (chicken thighs 6 ct, chicken breast 7 pc, leg meat), so the weight — and the cost per gram — is an assumption. “Placeholder price” = no real price yet. Skyfarm flyer cuts (beef back ribs, beef shank, lamb shank) are <b>protein unknown</b> (bone-in, so protein per lb isn’t reliable) and are left out of this ranking rather than guessed.</p>
      </Tilt>
    </>
  )
}

/** Where the prices come from + the Skyfarm flyer note. */
export function PriceSources() {
  const src = PRICE_META.sources ?? {}
  const phone = src.Skyfarm?.phone
  const line = src.Skyfarm?.line ?? ''
  return (
    <div className="price-src">
      <small>🏬 {src.FreshCo?.line ?? 'FreshCo, Oshawa'}</small>
      <small>🥩 {phone ? <>{line.split(phone)[0]}<a href={`tel:${phone.replace(/[^0-9]/g, '')}`}>{phone}</a>{line.split(phone)[1]}</> : line}</small>
      {PRICE_META.flyer && <small className="muted">🏷 Skyfarm weekly flyer ({PRICE_META.flyer.text}) — beef back ribs, beef shank and lamb shank are in Staples at their per-lb flyer prices; after {new Date(PRICE_META.flyer.until + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} they show “{PRICE_META.flyer.expired}”.</small>}
      <small className="muted">Real prices, but they change — a price you type always wins. Weight-less packs are approximate for protein-per-gram.</small>
    </div>
  )
}
