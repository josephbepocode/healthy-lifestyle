/* Simple offline shell. Network-first so a new deploy is always picked up when online;
   falls back to the last cached copy when offline. Scope = the folder this file is served from
   (works under /healthy-lifestyle/). Bump CACHE to drop old entries. */
const CACHE = 'healthy-shell-v3'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req).then((r) => r || caches.match(self.registration.scope))),
  )
})

// Tapping a reminder notification opens (or focuses) the app on the right screen.
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL((e.notification.data && e.notification.data.url) || self.registration.scope, self.location.href).href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.navigate(url).then((w) => (w || c).focus()).catch(() => c.focus())
      return self.clients.openWindow(url)
    }),
  )
})
