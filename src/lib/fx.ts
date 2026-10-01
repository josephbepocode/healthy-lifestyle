/** Tiny pub/sub for UI effects (toasts, confetti, modals) so non-React code can trigger them. */
type Fn<T> = (p: T) => void
function bus<T>() {
  const subs = new Set<Fn<T>>()
  return {
    on(f: Fn<T>) {
      subs.add(f)
      return () => {
        subs.delete(f)
      }
    },
    emit(p: T) {
      subs.forEach((f) => f(p))
    },
  }
}
export interface ToastMsg {
  text: string
  undo?: () => void
  tone?: 'ok' | 'warn' | 'win'
}
export const toastBus = bus<ToastMsg>()
export const confettiBus = bus<{ x?: number; y?: number; big?: boolean }>()
export const toast = (text: string, opts: Partial<ToastMsg> = {}) => toastBus.emit({ text, ...opts })
export const confetti = (o: { x?: number; y?: number; big?: boolean } = {}) => confettiBus.emit(o)

export type ModalReq =
  | { kind: 'recipe'; foodId: string }
  | { kind: 'cook'; foodId: string; servings: number }
  | { kind: 'ideas' }
  | { kind: 'foodPicker'; date: string; meal: string }
export const modalBus = bus<ModalReq>()
export const openRecipe = (foodId: string) => modalBus.emit({ kind: 'recipe', foodId })
export const openIdeas = () => modalBus.emit({ kind: 'ideas' })
