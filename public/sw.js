// public/sw.js — service worker for offline play.
// Strategy:
//   - Network-first for navigation requests (HTML).
//   - Cache-first for built assets (anything under /assets/, /models/, /sounds/).
//   - Stale-while-revalidate for everything else.

const CACHE_VERSION = 'srbs-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`

const APP_SHELL = [
  '/',
  '/index.html',
  '/sw.js',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((n) => n !== STATIC_CACHE && n !== RUNTIME_CACHE)
          .map((n) => caches.delete(n))
      )
      await self.clients.claim()
    })()
  )
})

function isAssetRequest(url) {
  return /\/(assets|models|sounds)\//.test(url.pathname)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Navigation → network-first.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match('/index.html').then((r) => r || new Response('Offline', { status: 503 })))
    )
    return
  }

  // Built assets → cache-first.
  if (isAssetRequest(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
      })
    )
    return
  }

  // Other same-origin requests → stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {})
        }
        return res
      }).catch(() => cached)
      return cached || fetched
    })
  )
})