// 星曆 service worker. scripts/pwa.ts fills in CACHE and PRECACHE at build
// time: every file of the build, so the whole app works offline once loaded.
/* global self, caches, fetch, URL, Response */
const CACHE = '__CACHE__'
const PRECACHE = __PRECACHE__

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE)),
  )
})

// Wait for existing controlled pages to close before activation. Their lazy
// imports still reference the previous build and need its cache until then.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('chroniq-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

/** Network, but give up after `ms` so a bad connection falls back to the cache quickly. */
const fetchWithin = (request, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    fetch(request).then(
      (response) => {
        clearTimeout(timer)
        resolve(response)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  // Serve the HTML installed with this worker, never mix it with a newer build.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) =>
        (await cache.match('./')) || fetchWithin(request, 4000),
      ),
    )
    return
  }

  // Built files have content hashes in their names, so a cached copy is always right.
  event.respondWith(
    // These are same-origin static files. Precache requests and module/font
    // requests can carry different Origin headers under Vary: Origin.
    caches.match(request, { ignoreSearch: true, ignoreVary: true }).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)))
          }
          return response
        }),
    ),
  )
})
