import { priceEntry, type Store } from './shopping'

/** Approximate grams of protein in ONE priced pack (per kg for per-kg items). Label-style averages, NOT exact.
 *  `approx` = the shelf price shows no pack weight, so the weight (and protein) is an assumption. `bulk` = Skyfarm 5 kg bag (phone order). */
interface PRow { cat: string; store: Store; g: number; label: string; approx?: boolean; bulk?: boolean }
export const PROTEIN_ROWS: PRow[] = [
  { cat: 'eggs', store: 'FreshCo', g: 76, label: '12 eggs' },
  { cat: 'milk', store: 'FreshCo', g: 135, label: '4 L milk (2%)' },
  { cat: 'yoghurt', store: 'FreshCo', g: 65, label: '650 g Greek yogurt 0%' },
  { cat: 'oats', store: 'FreshCo', g: 130, label: '1 kg quick oats' },
  { cat: 'rice', store: 'FreshCo', g: 360, label: '4.54 kg basmati' },
  { cat: 'pasta', store: 'FreshCo', g: 112, label: '900 g pasta' },
  { cat: 'bread', store: 'FreshCo', g: 74, label: '675 g whole wheat bread' },
  { cat: 'pb', store: 'FreshCo', g: 250, label: '1 kg peanut butter' },
  { cat: 'nuts', store: 'FreshCo', g: 53, label: '250 g almonds' },
  { cat: 'sardines', store: 'FreshCo', g: 33, label: '155 g tin sardines' },
  { cat: 'beans', store: 'FreshCo', g: 28, label: '540 ml tin kidney beans' },
  { cat: 'chicken', store: 'FreshCo', g: 150, label: 'FreshCo chicken thighs, 6 ct bone-in', approx: true },
  { cat: 'beef', store: 'FreshCo', g: 95, label: 'FreshCo extra-lean ground beef, 450 g' },
  { cat: 'chicken-breast', store: 'FreshCo', g: 300, label: 'FreshCo chicken breast, 7 pc', approx: true },
  { cat: 'chicken-breast', store: 'Skyfarm', g: 1100, label: 'Skyfarm chicken breast, 5 kg bag (bulk)', bulk: true },
  { cat: 'chicken-legs', store: 'Skyfarm', g: 900, label: 'Skyfarm chicken leg meat, 5 kg bag (bulk)', bulk: true, approx: true },
  { cat: 'cheese', store: 'FreshCo', g: 100, label: '400 g cheese' },
]
/** Skyfarm flyer cuts: bone-in, protein per lb not reliably known, so they are NOT ranked (no guessing). */
export const PROTEIN_UNKNOWN = ['beef-ribs', 'beef-shank', 'lamb-shank']
export interface ProteinCost {
  per10g: number
  src: 'estimate' | 'placeholder'
  approx?: boolean
  bulk?: boolean
}
const rowFor = (catId: string, store: Store) => PROTEIN_ROWS.find((r) => r.cat === catId && r.store === store)
/** $ per 10 g of protein for a catalogue item at a store (undefined if we have no price or no protein figure). */
export function costPer10g(catId: string | undefined, store: Store): ProteinCost | undefined {
  if (!catId) return undefined
  const p = rowFor(catId, store)
  const x = priceEntry(catId, store)
  if (!p || !x) return undefined
  return { per10g: (x.e.price / p.g) * 10, src: x.src, approx: p.approx || x.e.approx, bulk: p.bulk }
}
export function proteinRanking() {
  const out: { id: string; store: Store; label: string; per10g: number; src: 'estimate' | 'placeholder'; approx?: boolean; bulk?: boolean }[] = []
  for (const r of PROTEIN_ROWS) {
    const c = costPer10g(r.cat, r.store)
    if (c) out.push({ id: r.cat + '|' + r.store, store: r.store, label: r.label, per10g: c.per10g, src: c.src, approx: c.approx, bulk: c.bulk })
  }
  return out.sort((a, b) => a.per10g - b.per10g)
}

/* ---------------- running-low tracking (when did each item move into stock?) ---------------- */
import { makeStore } from './kv'
import { getShop } from './shopping'
import { diffDays, todayStr } from './util'
export const shopx = makeStore<{ v: 1; at: Record<string, string> }>('healthy-shopextra.v1', () => ({ v: 1, at: {} }))
export const LOW_DAYS = 7
export function lowItems(today = todayStr()) {
  const at = shopx.get().at
  return getShop().items.filter((i) => i.stock === 'have' && at[i.id] && diffDays(today, at[i.id]) >= LOW_DAYS)
}
