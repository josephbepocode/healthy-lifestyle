/** Shows a system notification the way phones accept it.
 *  Android Chrome and iOS home-screen apps reject `new Notification()` ("Illegal constructor");
 *  they only show notifications through the service worker (`registration.showNotification`).
 *  Desktop browsers accept both, so we try the service worker first and fall back. */
export type NoticePermission = NotificationPermission | 'unsupported'

export const notifyPermission = (): NoticePermission =>
  typeof Notification === 'undefined' ? 'unsupported' : Notification.permission

/** True on iPhone/iPad when the app was opened from Safari instead of the Home Screen icon. */
export function iosNeedsHomeScreen(): boolean {
  if (typeof navigator === 'undefined') return false
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches
  return ios && !standalone
}

async function swRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined
  try {
    const existing = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
    if (existing) return existing
    // not registered yet (first visit, or dev): wait briefly for the one main.tsx registers
    return await Promise.race([navigator.serviceWorker.ready, new Promise<undefined>((r) => setTimeout(() => r(undefined), 3000))])
  } catch {
    return undefined
  }
}

export async function showNotice(title: string, body: string, opts: { tag?: string; go?: string } = {}): Promise<boolean> {
  if (notifyPermission() !== 'granted') return false
  const url = `${import.meta.env.BASE_URL}${opts.go ? '#' + opts.go : ''}`
  const icon = `${import.meta.env.BASE_URL}icons/icon-192.png`
  const reg = await swRegistration()
  if (reg) {
    try {
      await reg.showNotification(title, { body, tag: opts.tag, icon, badge: icon, data: { url } })
      return true
    } catch {
      /* fall through */
    }
  }
  try {
    const n = new Notification(title, { body, tag: opts.tag, icon })
    n.onclick = () => {
      focus()
      if (opts.go) location.hash = opts.go
    }
    return true
  } catch {
    return false
  }
}
