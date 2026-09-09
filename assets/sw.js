// Service worker: полностью офлайн-доступ ко всему сайту.
// Список precache подставляется при сборке (scripts/build.mjs).
//
// Стратегии:
//  • Переходы между страницами (navigate) — сеть с коротким тайм-аутом, при
//    неудаче мгновенно из кэша. Так контент свежий при связи и не «висит» без неё.
//  • Статика (CSS/JS/иконки) — cache-first: она версионируется (?v=<buildId>),
//    поэтому из кэша всегда свежая, а грузится мгновенно.
var CACHE = 'kodeksdetstva-' + '/*__BUILD__*/'
var PRECACHE = /*__PRECACHE__*/ []
var NET_TIMEOUT = 3000

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // cache: 'reload' — мимо HTTP-кэша браузера, чтобы не закешировать старое
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

function putInCache(req, res) {
  if (res && res.ok && res.type === 'basic') {
    var copy = res.clone()
    caches.open(CACHE).then(function (c) { c.put(req, copy) })
  }
  return res
}

self.addEventListener('fetch', function (e) {
  var req = e.request
  if (req.method !== 'GET') return
  var url = new URL(req.url)
  if (url.origin !== location.origin) return

  // ── Переходы между страницами: network-first с тайм-аутом ──
  if (req.mode === 'navigate') {
    e.respondWith(
      new Promise(function (resolve) {
        var done = false
        var timer = setTimeout(function () {
          if (done) return
          done = true
          caches.match(req, { ignoreSearch: true }).then(function (c) {
            resolve(c || caches.match('/') || caches.match('/404.html'))
          })
        }, NET_TIMEOUT)

        fetch(req)
          .then(function (res) {
            if (done) { putInCache(req, res); return }
            done = true
            clearTimeout(timer)
            putInCache(req, res.clone())
            resolve(res)
          })
          .catch(function () {
            if (done) return
            done = true
            clearTimeout(timer)
            caches.match(req, { ignoreSearch: true }).then(function (c) {
              resolve(c || caches.match('/') || caches.match('/404.html'))
            })
          })
      }),
    )
    return
  }

  // ── Всё остальное: cache-first ──
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached
      return fetch(req)
        .then(function (res) { return putInCache(req, res) })
        .catch(function () { return new Response('', { status: 504, statusText: 'offline' }) })
    }),
  )
})
