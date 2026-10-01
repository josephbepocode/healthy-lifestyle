export type MealKind = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type DayKey = 'A' | 'B' | 'C' | 'D'
export type Priority = 'high' | 'med' | 'low'

export interface Profile {
  weightKg: number
  heightCm: number
  goalKg: number
  kcalTarget: number
  proteinTarget: number
  carbsTarget: number
  fatTarget: number
}
export interface Food {
  id: string
  name: string
  serving: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  prepMinutes?: number
}
export interface MealEntry {
  id: string
  date: string
  meal: MealKind
  foodId: string
  servings: number
  /** snapshot of the food, stored if the food is later deleted so history stays intact */
  snap?: Omit<Food, 'id'>
}
export interface WeighIn {
  date: string
  kg: number
}
export interface Exercise {
  id: string
  name: string
  muscleGroup: string
}
export interface SetEntry {
  exerciseId: string
  reps: number
  kg: number
}
export interface WorkoutLog {
  date: string
  day: DayKey
  sets: SetEntry[]
}
export interface Task {
  id: string
  title: string
  due?: string
  priority: Priority
  done: boolean
  createdAt: string
}
export interface TimeEntry {
  id: string
  date: string
  label: string
  category: string
  seconds: number
  startedAt?: string
}
export interface ActiveTimer {
  label: string
  category: string
  startedAt: number
}
export interface RecipeStep {
  text: string
  timerSeconds?: number
}
export interface Recipe {
  totalMinutes: number
  servings: number
  ingredients: { item: string; amount: string }[]
  steps: RecipeStep[]
  tips?: string[]
}
export interface AppState {
  v: 1
  profile: Profile
  foods: Food[]
  mealLog: MealEntry[]
  weighIns: WeighIn[]
  exercises: Exercise[]
  workoutLog: WorkoutLog[]
  tasks: Task[]
  timeEntries: TimeEntry[]
  activeTimer: ActiveTimer | null
  customRecipes: Record<string, Recipe>
  meta: { seededFoodIds: string[]; seededExerciseIds: string[]; tasksSeeded: boolean; weighInSeeded: boolean }
}
