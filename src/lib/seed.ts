import starter from '../data/gym-starter-data.json'
import extra from '../data/extra-foods.json'
import recipesFile from '../data/recipes.json'
import type { DayKey, Exercise, Food, Profile, Recipe } from '../types'

/**
 * Deji's preferences — applied to ALL seed foods as a safeguard even if the
 * source JSON already has them removed.
 *  - no swallows (and their soups): egusi, pounded yam, eba, amala, fufu, semo…
 *  - no tuna
 *  - no fresh / fried / stewed fish (canned sardines are fine)
 */
const SWALLOW = /\b(egusi|pounded|eba|amala|fufu|semo|semovita|tuwo|ogbono|okra soup|oha|banga|edikang|afang)\b/i
const TUNA = /tuna/i
const FISH = /\b(fish|mackerel|tilapia|catfish|salmon|cod|titus|croaker|snapper|herring|sea ?bass|trout)\b/i

export function isBlockedFood(f: { id: string; name: string }): boolean {
  const text = `${f.id.replace(/-/g, ' ')} ${f.name}`
  if (SWALLOW.test(text) || TUNA.test(text)) return true
  if (FISH.test(text)) {
    // tinned/canned sardines are OK; everything else fish-related is out
    return !/sardine/i.test(text)
  }
  return false
}

type RawFood = Food & { prepMinutes?: number }
const rawFoods: RawFood[] = [...(starter.foods as RawFood[]), ...(extra.foods as RawFood[])]
const seen = new Set<string>()
export const SEED_FOODS: Food[] = rawFoods.filter((f) => {
  if (seen.has(f.id) || isBlockedFood(f)) return false
  seen.add(f.id)
  return true
})
export const BLOCKED_SEED_IDS = new Set(rawFoods.filter(isBlockedFood).map((f) => f.id))
// Ids that earlier builds of the app may have seeded (kept in sync with Gym's older lists)
;['egusi', 'pounded-yam', 'eba', 'mackerel', 'tuna-rice-bowl', 'mackerel-yam-quick'].forEach((i) => BLOCKED_SEED_IDS.add(i))

export const SEED_EXERCISES: Exercise[] = starter.exercises as Exercise[]
export const SEED_PROFILE: Profile = { ...(starter.profile as Profile) }

export interface SplitDay {
  day: DayKey
  name: string
  exercises: { id: string; scheme: string }[]
}
export const WORKOUT_SPLIT: SplitDay[] = (starter.workoutSplit as { day: DayKey; name: string; exercises: [string, string][] }[]).map(
  (d) => ({ day: d.day, name: d.name, exercises: d.exercises.map(([id, scheme]) => ({ id, scheme })) }),
)
/** Mon A, Tue B, Thu C, Fri D — index 0 = Monday */
export const SCHEDULE: (DayKey | null)[] = ['A', 'B', null, 'C', 'D', null, null]
export const SCHEDULE_NOTE: string = starter.schedule
export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const SEED_RECIPES = recipesFile.recipes as unknown as Record<string, Recipe>

export const SEED_TASKS = [
  { id: 'seed-grocery', title: 'Grocery shopping', due: '2026-10-02', priority: 'med' as const },
  { id: 'seed-celpip', title: 'Book CELPIP General test (for Nov/early Dec 2026)', due: '2026-10-07', priority: 'high' as const },
  { id: 'seed-french', title: 'Learn French by January 2027', due: '2027-01-31', priority: 'med' as const },
  { id: 'seed-gdrive', title: 'Book G road test via DriveTest (eligible Jan 2027, book ~December)', due: '2026-12-01', priority: 'low' as const },
]
