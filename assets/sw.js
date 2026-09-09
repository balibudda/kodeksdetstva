// Service worker: офлайн-доступ ко всему сайту.
// Список precache подставляется при сборке (scripts/build.mjs).
var CACHE = 'childofgod-v1'
var PRECACHE = /*__PRECACHE__*/ []

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(PRECACHE).catch(function () {})
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE }).map(function (k) { return caches.delete(k) }),
      )
    }),
  )
  self.clients.claim()
})

self.addEventListener('fetch', function (e) {
  var req = e.request
  if (req.method !== 'GET') return
  var url = new URL(req.url)
  if (url.origin !== location.origin) return

  // навигация: сначала сеть, при офлайне — кэш, затем офлайн-страница
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone()
          caches.open(CACHE).then(function (c) { c.put(req, copy) })
          return res
        })
        .catch(function () {
          return caches.match(req).then(function (m) {
            return m || caches.match('/404.html') || caches.match('/')
          })
        }),
    )
    return
  }

  // остальное: сначала кэш, затем сеть
  e.respondWith(
    caches.match(req).then(function (m) {
      return (
        m ||
        fetch(req).then(function (res) {
          var copy = res.clone()
          caches.open(CACHE).then(function (c) { c.put(req, copy) })
          return res
        })
      )
    }),
  )
})
