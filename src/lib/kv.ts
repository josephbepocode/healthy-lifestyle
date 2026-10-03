import { useSyncExternalStore } from 'react'

/** Tiny persisted store: one localStorage key, JSON, subscribe/get/set/use. Never writes until first set(). */
export function makeStore<T extends object>(key: string, init: () => T) {
  const load = (): T => {
    try {
      const r = localStorage.getItem(key)
      if (r) return { ...init(), ...(JSON.parse(r) as Partial<T>) }
    } catch {
      /* corrupt → fresh */
    }
    return init()
  }
  let state = load()
  const subs = new Set<() => void>()
  const emit = () => subs.forEach((f) => f())
  const get = () => state
  const sub = (f: () => void) => {
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  }
  const set = (fn: (s: T) => T) => {
    state = fn(state)
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      /* storage full/blocked: keep in memory */
    }
    emit()
  }
  if (typeof window !== 'undefined')
    addEventListener('storage', (e) => {
      if (e.key === key) {
        state = load()
        emit()
      }
    })
  return { key, get, set, sub, use: () => useSyncExternalStore(sub, get, get) }
}
