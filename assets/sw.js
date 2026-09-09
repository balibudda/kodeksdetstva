// Service worker: полностью офлайн-доступ ко всему сайту.
// Список precache подставляется при сборке (scripts/build.mjs).
//
// Стратегия — cache-first ВЕЗДЕ, включая переходы между страницами: в стрессовой
// ситуации и при плохой связи приложение обязано открыться мгновенно и никогда
// не «висеть» в ожидании сети. Сеть используется только для фонового обновления
// и как запасной вариант, если страницы нет в кэше.
var CACHE = 'childofgod-' + '/*__BUILD__*/'
var PRECACHE = /*__PRECACHE__*/ []

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // cache: 'reload' — тянем из сети мимо HTTP-кэша браузера, чтобы новый
      // service worker не закешировал устаревшие файлы
      return Promise.all(
        PRECACHE.map(function (u) {
          return fetch(new Request(u, { cache: 'reload' }))
            .then(function (r) { if (r && r.ok) return c.put(u, r) })
            .catch(function () {})
        }),
      )
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

function bgUpdate(req) {
  // тихо обновляем кэш из сети (мимо HTTP-кэша), не блокируя ответ
  fetch(new Request(req.url, { cache: 'reload' }))
    .then(function (res) {
      if (res && res.ok) {
        var copy = res.clone()
        caches.open(CACHE).then(function (c) { c.put(req, copy) })
      }
    })
    .catch(function () {})
}

self.addEventListener('fetch', function (e) {
  var req = e.request
  if (req.method !== 'GET') return
  var url = new URL(req.url)
  if (url.origin !== location.origin) return

  e.respondWith(
    caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(function (cached) {
      if (cached) {
        bgUpdate(req)
        return cached
      }
      return fetch(req)
        .then(function (res) {
          if (res && res.ok) {
            var copy = res.clone()
            caches.open(CACHE).then(function (c) { c.put(req, copy) })
          }
          return res
        })
        .catch(function () {
          if (req.mode === 'navigate') {
            return caches.match('/').then(function (home) {
              return home || caches.match('/404.html')
            })
          }
          return new Response('', { status: 504, statusText: 'offline' })
        })
    }),
  )
})
