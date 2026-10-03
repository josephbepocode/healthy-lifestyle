import { useSyncExternalStore } from 'react'
import pricesRaw from '../data/shopping-prices.json'
import { round, todayStr, uid } from './util'
import type { Recipe } from '../types'

/** Shopping tab state — its OWN localStorage key; never touches the main app data. */
const KEY = 'healthy-shopping.v1'
const MONEY_KEY = 'healthy-money.v1'

export const AISLES = ['Produce', 'Meat & eggs', 'Dairy', 'Grains & staples', 'Canned/pantry', 'Snacks', 'Household', 'Other'] as const
export type Aisle = (typeof AISLES)[number]
export const STORES = ['FreshCo', 'Skyfarm'] as const
export type Store = (typeof STORES)[number]
/** 'estimate' (kept as the stored value so saved lists keep working; shown as "store price") = real price from src/data/shopping-prices.json; placeholder = made-up number; edited = typed by the user (wins over everything) */
export type PriceSrc = 'estimate' | 'placeholder' | 'edited' | 'none'
export type Stock = 'need' | 'have'

export interface Item {
  id: string
  name: string
  qty: number
  unit: string
  aisle: Aisle
  store: Store
  /** estimated cost of the whole line (CAD) */
  price?: number
  priceSrc: PriceSrc
  cat?: string
  stock: Stock
  note?: string
  /** quantity was built from meals (so a second build adds up instead of taking the max) */
  meals?: boolean
}
export interface ShopState {
  v: 1
  items: Item[]
  groupBy: 'store' | 'aisle'
  filter: 'all' | Store
  storeMode: boolean
}

/* ------------------------------------------------ catalog */
type Fam = 'wt' | 'vol' | 'cnt' | 'pack'
export interface Cat {
  id: string
  name: string
  aisle: Aisle
  store: Store
  /** pack unit used when added from a chip ('' = each) */
  unit: string
  fam: Fam
  /** how many of a unit make one priced pack */
  per: Record<string, number>
  re: RegExp
  chip?: boolean
  /** never picked for recipe ingredients (only for manual adds / chips) */
  noBuild?: boolean
}
const C = (id: string, name: string, aisle: Aisle, store: Store, unit: string, fam: Fam, per: Record<string, number>, re: RegExp, chip = false, noBuild = false): Cat => ({ id, name, aisle, store, unit, fam, per: { [unit]: 1, ...per }, re, chip, noBuild })

/** Order matters: the first regex that matches an ingredient wins. */
export const CATALOG: Cat[] = [
  C('olive-oil', 'Olive oil', 'Canned/pantry', 'FreshCo', 'bottle', 'cnt', {}, /olive/, true),
  C('oil', 'Cooking oil', 'Canned/pantry', 'FreshCo', 'bottle', 'vol', { ml: 1000, L: 1 }, /\boil\b|palm/),
  C('curry', 'Curry powder', 'Canned/pantry', 'FreshCo', 'pack', 'pack', {}, /curry powder/, true, true),
  C('bouillon', 'Knorr chicken bouillon cubes', 'Canned/pantry', 'FreshCo', 'pack', 'pack', {}, /knorr|bouillon cubes/, true, true),
  C('spices', 'Basic spices & stock cubes', 'Canned/pantry', 'FreshCo', 'pack', 'pack', {}, /\b(salt|spices?|curry|thyme|paprika|bouillon|seasoning|stock|crayfish|locust|iru)\b/, true),
  C('chicken-breast', 'Chicken breast (Skyfarm 5 kg bag)', 'Meat & eggs', 'Skyfarm', 'bag', 'cnt', {}, /chicken breast/, true, true),
  C('chicken-legs', 'Chicken leg meat (Skyfarm 5 kg bag)', 'Meat & eggs', 'Skyfarm', 'bag', 'cnt', {}, /chicken leg meat bulk/, true, true),
  C('lamb-shank', 'Lamb shank (Skyfarm flyer, per lb)', 'Meat & eggs', 'Skyfarm', 'lb', 'wt', {}, /lamb shank|lamb/, true, true),
  C('beef-shank', 'Beef shank (Skyfarm flyer, per lb)', 'Meat & eggs', 'Skyfarm', 'lb', 'wt', {}, /shank/, true, true),
  C('beef-ribs', 'Beef back ribs (Skyfarm flyer, per lb)', 'Meat & eggs', 'Skyfarm', 'lb', 'wt', {}, /back ribs|beef ribs/, true, true),
  C('chicken', 'Chicken thighs', 'Meat & eggs', 'FreshCo', 'kg', 'wt', { g: 1000, '': 6 }, /chicken|drumstick/, true),
  C('beef', 'Ground beef', 'Meat & eggs', 'FreshCo', 'kg', 'wt', { g: 1000 }, /beef|mince/, true),
  C('eggs', 'Eggs', 'Meat & eggs', 'FreshCo', 'dozen', 'cnt', { '': 12 }, /\beggs?\b/, true),
  C('sardines', 'Canned sardines', 'Canned/pantry', 'FreshCo', 'tin', 'cnt', {}, /sardine/, true),
  C('cottage', 'Cottage cheese', 'Dairy', 'FreshCo', 'tub', 'cnt', { cup: 2 }, /cottage/),
  C('cheese', 'Cheese', 'Dairy', 'FreshCo', 'block', 'cnt', { g: 400 }, /cheese/),
  C('yoghurt', 'Greek yogurt', 'Dairy', 'FreshCo', 'tub', 'cnt', { cup: 3 }, /yog/, true),
  C('milk', 'Milk', 'Dairy', 'FreshCo', 'L', 'vol', { ml: 1000 }, /\bmilk\b/, true),
  C('tomato-paste', 'Tomato paste / passata', 'Canned/pantry', 'FreshCo', 'tin', 'cnt', { tbsp: 10, cup: 2 }, /tomato paste|passata|tomato sauce/, true),
  C('sweet-potatoes', 'Sweet potatoes', 'Produce', 'FreshCo', 'kg', 'wt', { g: 1000 }, /sweet potato/, true),
  C('tomatoes', 'Tomatoes', 'Produce', 'FreshCo', 'kg', 'cnt', { '': 6, g: 1000, cup: 4 }, /tomato/, true),
  C('onions', 'Onions', 'Produce', 'FreshCo', 'bag', 'cnt', { '': 8 }, /onion/, true),
  C('chilli', 'Scotch bonnet / chilli', 'Produce', 'FreshCo', 'pack', 'cnt', { '': 4 }, /scotch bonnet|chil/),
  C('peppers', 'Bell peppers', 'Produce', 'FreshCo', '', 'cnt', {}, /pepper/, true),
  C('garlic', 'Garlic', 'Produce', 'FreshCo', 'pack', 'pack', {}, /garlic/, true),
  C('ginger', 'Ginger', 'Produce', 'FreshCo', 'kg', 'wt', { g: 1000 }, /ginger/, true),
  C('avocado', 'Avocados', 'Produce', 'FreshCo', '', 'cnt', {}, /avocado/, true),
  C('bananas', 'Bananas', 'Produce', 'FreshCo', 'bunch', 'cnt', { '': 6 }, /banana/, true),
  C('plantain', 'Plantain', 'Produce', 'FreshCo', '', 'cnt', {}, /plantain/),
  C('yam', 'Yam (tuber)', 'Produce', 'FreshCo', 'kg', 'wt', { g: 1000 }, /\byam\b/),
  C('potatoes', 'Potatoes', 'Produce', 'FreshCo', 'bag', 'cnt', {}, /potato/, true),
  C('spinach', 'Spinach', 'Produce', 'FreshCo', 'bunch', 'cnt', {}, /^(?!.*frozen).*spinach/, true),
  C('veg', 'Veg (fresh / frozen mix, leafy greens)', 'Produce', 'FreshCo', 'bag', 'pack', {}, /veg|spinach|ugu|lettuce|cucumber|leaf|basil|scent/, true),
  C('beans', 'Beans (canned)', 'Canned/pantry', 'FreshCo', 'tin', 'cnt', { cup: 1.5 }, /(canned|tinned).*bean|bean.*(canned|tinned)/, true),
  C('beans-dry', 'Beans (dried)', 'Grains & staples', 'FreshCo', 'bag', 'cnt', { cup: 10 }, /bean/),
  C('pb', 'Peanut butter', 'Canned/pantry', 'FreshCo', 'jar', 'cnt', { tbsp: 60 }, /peanut butter/, true),
  C('nuts', 'Nuts (almonds)', 'Snacks', 'FreshCo', 'bag', 'cnt', { cup: 2 }, /nut|peanut|almond/, true),
  C('rice', 'Rice', 'Grains & staples', 'FreshCo', 'bag', 'cnt', { cup: 22 }, /\brice\b/, true),
  C('oats', 'Rolled oats', 'Grains & staples', 'FreshCo', 'bag', 'cnt', { cup: 12 }, /\boats?\b/, true),
  C('pasta', 'Pasta', 'Grains & staples', 'FreshCo', 'pack', 'cnt', { g: 900 }, /pasta|spaghetti/, true),
  C('bread', 'Bread', 'Grains & staples', 'FreshCo', 'loaf', 'cnt', { slice: 20 }, /\bbread\b/, true),
  C('tortillas', 'Tortillas', 'Grains & staples', 'FreshCo', 'pack', 'cnt', { '': 8 }, /tortilla/),
  C('noodles', 'Instant noodles', 'Canned/pantry', 'FreshCo', 'pack', 'cnt', {}, /noodle|indomie/),
  C('honey', 'Honey / sugar', 'Canned/pantry', 'FreshCo', 'jar', 'cnt', { tbsp: 40, tsp: 120 }, /honey|sugar/),
  C('mayo', 'Mayo', 'Canned/pantry', 'FreshCo', 'jar', 'cnt', { tbsp: 30 }, /mayo/),
]
export const catById = (id?: string) => CATALOG.find((c) => c.id === id)
export const matchCat = (name: string, forMeals = false) => CATALOG.find((c) => !(forMeals && c.noBuild) && c.re.test(name.toLowerCase()))

/* ------------------------------------------------ prices (src/data/shopping-prices.json)
   A plain number = PLACEHOLDER price (per catalogue pack). An object = a REAL store price (checked on _meta.checked):
   { price, basis?: 'pack' | 'kg', packLabel?, packQty?, kgPer?, sale?, note? }
   packQty = how many catalogue units (cat.unit) one real pack holds; kgPer = kg per catalogue unit (kg-priced items). */
export interface PriceEntry {
  price: number
  basis?: 'pack' | 'kg' | 'lb'
  packLabel?: string
  packQty?: number
  kgPer?: number
  sale?: boolean
  note?: string
  /** out of stock at the store when checked */
  oos?: boolean
  /** pack weight not shown on the shelf, so protein per gram is approximate */
  approx?: boolean
  /** bulk bag weight in kg (Skyfarm phone orders) */
  bulkKg?: number
  /** last day (YYYY-MM-DD) the weekly flyer price is valid */
  flyerUntil?: string
}
type RawEntry = number | PriceEntry
const PRICES = pricesRaw as unknown as Record<string, Partial<Record<Store, RawEntry>> | Record<string, string>>
export interface PriceMeta { regionNote?: string; skyfarmNote?: string; checked?: string; sources?: Record<string, { line: string; phone?: string }>; flyer?: { from: string; until: string; text: string; expired: string } }
export const PRICE_META = ((pricesRaw as unknown as { _meta?: PriceMeta })._meta ?? {}) as PriceMeta
export const REGION_NOTE = PRICE_META.regionNote ?? 'Prices are real shelf prices from the Oshawa stores (checked Oct 3 2026). Prices change, so type what you actually paid to override them.'
export const SKYFARM_NOTE = PRICE_META.skyfarmNote ?? 'order by phone'

/** The entry used for a catalogue item at a store, normalised. */
export function priceEntry(catId: string, store: Store): { e: PriceEntry; src: 'estimate' | 'placeholder' } | undefined {
  const p = PRICES[catId] as Partial<Record<Store, RawEntry>> | undefined
  if (!p || catId.startsWith('_')) return undefined
  const own = p[store]
  if (own !== undefined) return typeof own === 'number' ? { e: { price: own }, src: 'placeholder' } : { e: own, src: 'estimate' }
  // no price for this store: only borrow another store's *placeholder*; never pass a real estimate off as another store's price
  const other = STORES.map((s) => p[s]).find((v) => typeof v === 'number')
  return typeof other === 'number' ? { e: { price: other }, src: 'placeholder' } : undefined
}
/** Wording for a price that comes from the data file (real store price) vs a placeholder. */
export const srcLabel = (src: 'estimate' | 'placeholder' | string) => (src === 'estimate' ? 'store price' : 'placeholder price')
/** Weekly-flyer status for a catalogue item at a store: null when it is not a flyer price. Expires automatically by date. */
export function flyerStatus(catId: string | undefined, store: Store, today = todayStr()): { text: string; expired: boolean } | null {
  if (!catId) return null
  const x = priceEntry(catId, store)
  if (!x || x.src !== 'estimate' || !x.e.flyerUntil) return null
  const expired = today > x.e.flyerUntil
  return { text: expired ? (PRICE_META.flyer?.expired ?? 'flyer expired - confirm price') : (PRICE_META.flyer?.text ?? 'flyer prices may change after the end date'), expired }
}
/** Short price tag for a catalogue chip, e.g. "$4.39/kg store price". */
export function priceTag(catId: string, store: Store): string {
  const x = priceEntry(catId, store)
  if (!x) return 'no price'
  const per = x.e.basis === 'kg' ? '/kg' : x.e.basis === 'lb' ? '/lb' : ''
  const fs = flyerStatus(catId, store)
  return x.src === 'estimate' ? `${money(x.e.price)}${per}${x.e.oos ? ' · out of stock' : ''}${fs ? (fs.expired ? ' · flyer expired' : ' · flyer') : ''}` : `~${money(x.e.price)}${per} placeholder`
}
/** Cost of qty × unit for a catalogue item, bought by whole packs (kg-priced items: price × kg). */
export function estimate(catId: string | undefined, qty: number, unit: string, store: Store): { price: number; src: 'estimate' | 'placeholder' } | undefined {
  const cat = catById(catId)
  if (!cat) return undefined
  const x = priceEntry(cat.id, store)
  if (!x) return undefined
  const { e, src } = x
  if (cat.fam === 'pack') return { price: round(e.price, 2), src }
  const per = cat.per[unit]
  const inCat = per ? qty / per : unit === cat.unit ? qty : 1 // catalogue units wanted (unknown unit → one pack)
  if (e.basis === 'kg' || e.basis === 'lb') return { price: round(e.price * (e.kgPer ?? 1) * Math.max(inCat, 0), 2), src }
  let packs = inCat / (e.packQty ?? 1)
  if (src === 'estimate' || !['g', 'ml', 'kg', 'L'].includes(unit)) packs = Math.ceil(packs - 1e-9)
  return { price: round(e.price * Math.max(packs, 0), 2), src }
}
/** Label info for a row: pack size / sale / note, only while the price comes from the file. */
export function priceInfo(it: { cat?: string; store: Store; priceSrc: PriceSrc }): { packLabel?: string; kg?: boolean; per?: 'kg' | 'lb'; sale?: boolean; note?: string; oos?: boolean; approx?: boolean } | null {
  if (it.priceSrc !== 'estimate' || !it.cat) return null
  const x = priceEntry(it.cat, it.store)
  return x && x.src === 'estimate' ? { packLabel: x.e.packLabel, kg: x.e.basis === 'kg' || x.e.basis === 'lb', per: x.e.basis === 'lb' ? 'lb' : 'kg', sale: x.e.sale, note: x.e.note, oos: x.e.oos, approx: x.e.approx } : null
}

/* ------------------------------------------------ store */
function starter(): Item[] {
  const row = (catId: string, qty: number, unit?: string, store?: Store, name?: string): Item => {
    const c = catById(catId)!
    const u = unit ?? c.unit
    const st = store ?? c.store
    const e = estimate(catId, qty, u, st)
    return { id: 's-' + catId, name: name ?? c.name, qty, unit: u, aisle: c.aisle, store: st, cat: catId, price: e?.price, priceSrc: e ? e.src : 'none', stock: 'need' }
  }
  return [
    row('chicken', 1),
    row('eggs', 1),
    row('beef', 0.45),
    row('sardines', 4),
    row('yoghurt', 1),
    row('milk', 2),
    row('rice', 1),
    row('oats', 1),
    row('pasta', 2),
    row('potatoes', 1),
    row('bread', 1),
    row('bananas', 1),
    row('pb', 1),
    row('olive-oil', 1),
    row('nuts', 1),
    row('avocado', 3),
    row('veg', 1, 'bag', 'FreshCo', 'Veg (frozen mix / greens)'),
    row('beans', 4),
    row('spices', 1, 'pack', 'FreshCo', 'Basic spices'),
  ]
}
function fresh(): ShopState {
  return { v: 1, items: starter(), groupBy: 'store', filter: 'all', storeMode: false }
}
function load(): ShopState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<ShopState>
      const f = fresh()
      // keep the user's list and edits; only re-derive prices that came from the data file (typed prices win)
      // chicken thighs / ground beef are not at Skyfarm any more: untouched (non-typed-price) rows move to FreshCo, which has real prices
      const mv = (i: Item): Item => ((i.cat === 'chicken' || i.cat === 'beef') && i.store === 'Skyfarm' && i.priceSrc !== 'edited' ? { ...i, store: 'FreshCo' } : i)
      const items = (Array.isArray(p.items) ? p.items : f.items).map(mv).map((i) => (i.cat && i.priceSrc !== 'edited' ? { ...i, ...repriced(i) } : i))
      return { ...f, ...p, v: 1, items }
    }
  } catch {
    /* corrupt — start fresh */
  }
  return fresh()
}
let state: ShopState = load()
const subs = new Set<() => void>()
function commit(next: ShopState) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage blocked — keep working in memory */
  }
  subs.forEach((f) => f())
}
export const getShop = () => state
export function useShop() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => state,
  )
}
if (typeof window !== 'undefined') {
  addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load()
      subs.forEach((f) => f())
    }
  })
}

/* ------------------------------------------------ actions */
export const setGroupBy = (groupBy: ShopState['groupBy']) => commit({ ...state, groupBy })
export const setFilter = (filter: ShopState['filter']) => commit({ ...state, filter })
export const setStoreMode = (storeMode: boolean) => commit({ ...state, storeMode })
export const restoreItems = (items: Item[]) => commit({ ...state, items })
export const deleteItem = (id: string) => commit({ ...state, items: state.items.filter((i) => i.id !== id) })
export const moveItem = (id: string, stock: Stock) => commit({ ...state, items: state.items.map((i) => (i.id === id ? { ...i, stock } : i)) })
export const clearStock = () => commit({ ...state, items: state.items.filter((i) => i.stock !== 'have') })
export const resetStarter = () => commit({ ...state, items: starter() })
export const cycleStore = (id: string) =>
  commit({
    ...state,
    items: state.items.map((i) => {
      if (i.id !== id) return i
      const store: Store = i.store === 'FreshCo' ? 'Skyfarm' : 'FreshCo'
      return { ...i, store, ...repriced({ ...i, store }) }
    }),
  })
/** keep a placeholder price in step with qty / store changes; leave user-edited prices alone */
function repriced(i: Item): Partial<Item> {
  if (i.priceSrc === 'edited') return {}
  const e = estimate(i.cat, i.qty, i.unit, i.store)
  return e === undefined ? { price: undefined, priceSrc: 'none' } : { price: e.price, priceSrc: e.src }
}
export interface ItemInput {
  id?: string
  name: string
  qty: number
  unit: string
  aisle: Aisle
  store: Store
  /** undefined = leave to the placeholder estimate */
  price?: number
  note?: string
  stock?: Stock
}
export function saveItem(x: ItemInput) {
  const cat = matchCat(x.name)
  if (x.id) {
    commit({
      ...state,
      items: state.items.map((i) => {
        if (i.id !== x.id) return i
        const next: Item = { ...i, name: x.name, qty: x.qty, unit: x.unit, aisle: x.aisle, store: x.store, note: x.note, cat: x.name === i.name ? i.cat : matchCat(x.name)?.id }
        if (x.price !== undefined && x.price !== i.price) {
          next.price = x.price
          next.priceSrc = 'edited'
        } else if (x.price === undefined && i.priceSrc === 'edited') {
          next.price = undefined
          next.priceSrc = 'none'
          Object.assign(next, repriced({ ...next, priceSrc: 'placeholder' }))
        } else Object.assign(next, repriced(next))
        return next
      }),
    })
    return
  }
  const it: Item = { id: uid('si'), name: x.name, qty: x.qty, unit: x.unit, aisle: x.aisle, store: x.store, cat: cat?.id, priceSrc: 'none', stock: x.stock ?? 'need', note: x.note }
  if (x.price !== undefined) {
    it.price = x.price
    it.priceSrc = 'edited'
  } else Object.assign(it, repriced({ ...it, priceSrc: 'placeholder' }))
  commit({ ...state, items: [...state.items, it] })
}
/** Quick-add by name: guesses aisle / store / placeholder price from the catalog. */
export function quickAdd(name: string) {
  const c = matchCat(name)
  saveItem({ name: name.trim(), qty: 1, unit: c && c.unit !== '' ? c.unit : '', aisle: c?.aisle ?? 'Other', store: c?.store ?? 'FreshCo' })
}
export type ChipResult = 'added' | 'exists' | 'restocked'
export function addFromCatalog(catId: string): ChipResult {
  const c = catById(catId)!
  if (state.items.some((i) => i.stock === 'need' && i.cat === catId)) return 'exists'
  const had = state.items.some((i) => i.stock === 'have' && i.cat === catId)
  const it: Item = { id: uid('si'), name: c.name, qty: 1, unit: c.unit, aisle: c.aisle, store: c.store, cat: catId, priceSrc: 'none', stock: 'need' }
  Object.assign(it, repriced({ ...it, priceSrc: 'placeholder' }))
  commit({ ...state, items: [...state.items, it] })
  return had ? 'restocked' : 'added'
}

/* ------------------------------------------------ recipes → shopping lines */
const COUNT_UNITS = new Set(['', 'slice', 'tin', 'pouch', 'pack', 'clove', 'bunch'])
const SKIP_RE = /^(warm |cold |hot )?water\b|^water,|recipe\)|see recipe|from the .* recipe/i
const BLOCK_RE = /\b(garri|gari|yam flour|elubo|semo|semovita|amala|eba|fufu|pounded)\b|tuna/i
export function parseAmount(a: string): { n: number; unit: string; vague: boolean } {
  const s = a.toLowerCase().trim()
  const m = s.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?:\s*-\s*(\d+\/\d+|\d+(?:\.\d+)?))?\s*(.*)$/)
  if (!m) return { n: 0, unit: '', vague: true }
  const val = (t: string) => {
    if (t.includes('/')) {
      const p = t.trim().split(/\s+/)
      const [x, y] = p[p.length - 1].split('/').map(Number)
      return (p.length === 2 ? Number(p[0]) : 0) + x / y
    }
    return Number(t)
  }
  const n = val(m[2] ?? m[1])
  const u = m[3].match(/^(kg|g|ml|l|cups?|tbsp|tsp|slices?|tins?|pouch(?:es)?|packs?|cloves?|pieces?|pcs?|bunch(?:es)?)\b/)
  let unit = u ? u[1] : ''
  unit = unit.replace(/^pieces?$|^pcs?$/, '').replace(/^cups$/, 'cup').replace(/^slices$/, 'slice').replace(/^tins$/, 'tin').replace(/^pouches$/, 'pouch').replace(/^packs$/, 'pack').replace(/^cloves$/, 'clove').replace(/^bunches$/, 'bunch')
  return { n, unit, vague: false }
}
export interface Line {
  key: string
  name: string
  qty: number
  unit: string
  cat?: string
  aisle: Aisle
  store: Store
  for: string[]
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export function buildLines(sel: { name: string; recipe: Recipe; servings: number }[]): { lines: Line[]; skipped: string[] } {
  const acc = new Map<string, { cat?: Cat; name: string; qty: number; unit: string; for: Set<string> }>()
  const skipped: string[] = []
  for (const r of sel) {
    const factor = r.servings / (r.recipe.servings || 1)
    for (const ing of r.recipe.ingredients) {
      const raw = ing.item
      if (SKIP_RE.test(raw.trim())) continue
      if (BLOCK_RE.test(raw)) {
        skipped.push(raw)
        continue
      }
      const cat = matchCat(raw, true)
      const pa = parseAmount(ing.amount)
      let q = pa.n * factor
      let u = pa.unit
      if (u === 'kg') (q *= 1000), (u = 'g')
      if (u === 'l') (q *= 1000), (u = 'ml')
      let key: string
      if (cat) {
        // catalog items are bought by the pack: convert whatever the recipe says into packs (bags, tins, kg, L…)
        if (cat.fam === 'pack') q = 1
        else if (cat.per[u]) q = q / cat.per[u]
        else q = 0.01 // unknown unit (e.g. "3 tbsp" of tomato) → just make sure one pack is on the list
        u = cat.unit
        key = cat.id
      } else key = `x:${raw.toLowerCase()}|${u}`
      const cur = acc.get(key)
      if (cur) {
        if (cat?.fam !== 'pack') cur.qty += q
        cur.for.add(r.name)
      } else acc.set(key, { cat, name: cat ? cat.name : cap(raw), qty: q, unit: u, for: new Set([r.name]) })
    }
  }
  const lines: Line[] = []
  for (const [key, v] of acc) {
    let { qty } = v
    let unit = v.unit
    if (qty <= 0) qty = 1
    if (v.cat) qty = unit === 'kg' || unit === 'L' ? Math.ceil(qty * 4 - 1e-9) / 4 : Math.ceil(qty - 1e-9)
    else if (unit === 'g') {
      if (qty >= 1000) (qty = round(qty / 1000, 2)), (unit = 'kg')
      else qty = Math.ceil(qty / 10) * 10
    } else if (unit === 'ml') qty = Math.ceil(qty / 10) * 10
    else if (COUNT_UNITS.has(unit)) qty = Math.ceil(qty - 1e-9)
    else qty = Math.ceil(qty * 4 - 1e-9) / 4
    lines.push({ key, name: v.name, qty, unit, cat: v.cat?.id, aisle: v.cat?.aisle ?? 'Other', store: v.cat?.store ?? 'FreshCo', for: [...v.for] })
  }
  return { lines, skipped }
}
/** Add lines to "Need to get": skips things already In stock, merges duplicates with matching units. */
export function addLines(lines: Line[]) {
  let items = [...state.items]
  const out = { added: 0, merged: 0, inStock: [] as string[] }
  const same = (i: Item, l: Line) => (l.cat ? i.cat === l.cat : !i.cat && i.name.toLowerCase() === l.name.toLowerCase())
  for (const l of lines) {
    if (items.some((i) => i.stock === 'have' && same(i, l))) {
      out.inStock.push(l.name)
      continue
    }
    const ex = items.find((i) => i.stock === 'need' && same(i, l) && i.unit === l.unit)
    const note = `for ${l.for.slice(0, 3).join(', ')}${l.for.length > 3 ? ` +${l.for.length - 3}` : ''}`
    if (ex) {
      const cat = catById(ex.cat)
      // items you added yourself keep your amount unless the meals need more; items built from meals add up
      const qty = cat?.fam === 'pack' ? ex.qty : ex.meals ? round(ex.qty + l.qty, 2) : Math.max(ex.qty, l.qty)
      const next = { ...ex, qty, meals: true, note: ex.note ? ex.note : note }
      items = items.map((i) => (i.id === ex.id ? { ...next, ...repriced(next) } : i))
      out.merged++
    } else {
      const it: Item = { id: uid('si'), name: l.name, qty: l.qty, unit: l.unit, aisle: l.aisle, store: l.store, cat: l.cat, priceSrc: 'none', stock: 'need', note, meals: true }
      Object.assign(it, repriced({ ...it, priceSrc: 'placeholder' }))
      items.push(it)
      out.added++
    }
  }
  commit({ ...state, items })
  return out
}

/* ------------------------------------------------ "Plan the week" — same scoring idea as the "What should I eat?" helper */
export function planWeek(foods: { id: string; kcal: number; protein: number }[], days: number, kcalT: number, protT: number, seed: number, mealsPerDay = 4) {
  const used: Record<string, number> = {}
  const plan: { id: string; sv: number; kcal: number; protein: number }[][] = []
  for (let d = 0; d < days; d++) {
    const today = new Set<string>()
    const day: { id: string; sv: number; kcal: number; protein: number }[] = []
    let remK = kcalT
    let remP = protT
    for (let m = 0; m < mealsPerDay; m++) {
      const left = mealsPerDay - m
      const perK = remK / left
      const perP = remP / left
      let best: { f: (typeof foods)[number]; sv: number; score: number } | null = null
      for (const f of foods) {
        if (today.has(f.id)) continue
        let b = { sv: 1, score: Infinity }
        for (const sv of [0.5, 1, 1.5, 2]) {
          const dk = (f.kcal * sv - perK) / Math.max(perK, 200)
          const dp = (f.protein * sv - perP) / Math.max(perP, 20)
          const over = f.kcal * sv > remK + 150 ? 2 : 0
          const sc = Math.abs(dk) * 0.8 + Math.abs(dp) * 1.2 + over
          if (sc < b.score) b = { sv, score: sc }
        }
        const dens = f.protein / Math.max(f.kcal, 1)
        const jitter = Math.abs((Math.sin((f.id.length + d * 7 + m * 13) * 12.9898 + seed * 78.233) * 43758.5453) % 1)
        const score = b.score - dens * 2 + (used[f.id] || 0) * 0.45 + jitter * (seed ? 0.6 : 0.15)
        if (!best || score < best.score) best = { f, sv: b.sv, score }
      }
      if (!best) break
      today.add(best.f.id)
      used[best.f.id] = (used[best.f.id] || 0) + 1
      remK -= best.f.kcal * best.sv
      remP -= best.f.protein * best.sv
      day.push({ id: best.f.id, sv: best.sv, kcal: best.f.kcal * best.sv, protein: best.f.protein * best.sv })
    }
    plan.push(day)
  }
  return plan
}

/* ------------------------------------------------ budget from the Money tab (read-only) */
export interface Budget {
  perPaycheck: number
  groceries: number
  protein: number
}
export function readBudget(): Budget | null {
  try {
    const raw = localStorage.getItem(MONEY_KEY)
    if (!raw) return null
    const m = JSON.parse(raw) as { alloc?: Record<string, number> }
    if (!m.alloc) return null
    const groceries = Number(m.alloc.groceries) || 0
    const protein = Number(m.alloc.protein) || 0
    return groceries + protein > 0 ? { perPaycheck: groceries + protein, groceries, protein } : null
  } catch {
    return null
  }
}

/* ------------------------------------------------ formatting / sharing */
const PLURAL: Record<string, string> = { tin: 'tins', slice: 'slices', pouch: 'pouches', clove: 'cloves', bunch: 'bunches', bag: 'bags', jar: 'jars', loaf: 'loaves', tub: 'tubs', bottle: 'bottles', block: 'blocks', cup: 'cups', pack: 'packs' }
export function fmtQty(qty: number, unit: string) {
  const q = round(qty, 2)
  const u = q === 1 ? unit : PLURAL[unit] || unit
  const short = ['kg', 'g', 'ml', 'L', 'tbsp', 'tsp'].includes(unit)
  return `${q}${short ? '' : ' '}${u}`.trim()
}
export const money = (n: number) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 })
export const sumPrices = (items: Item[]) => items.reduce((a, i) => a + (i.price ?? 0), 0)

export function groupItems(items: Item[], mode: 'store' | 'aisle', filter: 'all' | Store) {
  const list = items.filter((i) => filter === 'all' || i.store === filter)
  const byAisle = (xs: Item[]) =>
    AISLES.map((a) => ({ aisle: a, items: xs.filter((i) => i.aisle === a) })).filter((g) => g.items.length)
  if (mode === 'aisle') return [{ store: null as Store | null, items: list, aisles: byAisle(list) }]
  return STORES.map((s) => {
    const xs = list.filter((i) => i.store === s)
    return { store: s as Store | null, items: xs, aisles: byAisle(xs) }
  }).filter((g) => g.items.length)
}
export function listText(items: Item[], mode: 'store' | 'aisle', filter: 'all' | Store) {
  const need = items.filter((i) => i.stock === 'need')
  const line = (i: Item) => `[ ] ${i.name} — ${fmtQty(i.qty, i.unit) || '1'}${i.price !== undefined ? ` (~${money(i.price)} ${i.priceSrc === 'placeholder' ? 'placeholder price' : i.priceSrc === 'edited' ? '' : 'store price'})`.replace(' )', ')') : ''}${i.store === 'Skyfarm' ? ' [order by phone]' : ''}`
  const out: string[] = [`Shopping list — ${need.length} to get`, `(${REGION_NOTE} Items marked placeholder have no real price yet.)`, '']
  for (const g of groupItems(need, mode, filter)) {
    if (g.store) out.push(`== ${g.store} ==`)
    for (const a of g.aisles) {
      out.push(`-- ${a.aisle} --`, ...a.items.map(line))
    }
    out.push('')
  }
  return out.join('\n').trim() + '\n'
}
export async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = t
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
