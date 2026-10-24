// 星曆 service worker. scripts/pwa.ts fills in CACHE and PRECACHE at build
// time: every file of the build, so the whole app works offline once loaded.
/* global self, caches, fetch, URL, Response */
const CACHE = '__CACHE__'
const PRECACHE = __PRECACHE__

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

// A new version takes over at once (pages are fetched network-first, so an
// open page is already on the new HTML), and older caches are dropped.
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

  // Pages: the latest from the network, else the cached app shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetchWithin(request, 4000)
        .then((response) => {
          if (response.ok) caches.open(CACHE).then((cache) => cache.put('./', response.clone()))
          return response
        })
        .catch(() => caches.match('./').then((cached) => cached || Response.error())),
    )
    return
  }

  // Built files have content hashes in their names, so a cached copy is always right.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
