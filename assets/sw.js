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

// ВАЖНО: везде ниже matching идёт через caches.open(CACHE).then(c => c.match(...)),
// а не через голый caches.match(...). caches.match() (без открытия конкретного
// кэша) ищет по ВСЕМ версиям кэша этого источника и может отдать запись из
// кэша прошлого деплоя, если activate ещё не успел его подчистить — то есть
// «залипшие» старые данные (например, устаревший regions.json или список тем
// в поиске) после деплоя могли показываться, пока пользователь не нажмёт
// «Обновить» вручную. Открытие именно текущего CACHE это исключает: если
// записи там нет — сразу идём в сеть, а не в чужую версию кэша.
function putInCache(req, res) {
  if (res && res.ok && res.type === 'basic') {
    var copy = res.clone()
    caches.open(CACHE).then(function (c) { c.put(req, copy) })
  }
  return res
}

function matchCurrent(req, opts) {
  return caches.open(CACHE).then(function (c) { return c.match(req, opts) })
}

// Файлы данных: даже при cache-first для статики их лучше обновлять «сетью
// вперёд», как переходы между страницами — от них зависит актуальность
// контента (регионы, поисковый индекс), а не только скорость отрисовки.
var NETWORK_FIRST_PATHS = ['/regions.json', '/search-index.json']

self.addEventListener('fetch', function (e) {
  var req = e.request
  if (req.method !== 'GET') return
  var url = new URL(req.url)
  if (url.origin !== location.origin) return

  var networkFirst = req.mode === 'navigate' || NETWORK_FIRST_PATHS.indexOf(url.pathname) !== -1

  // ── Переходы и файлы данных: сеть с тайм-аутом, при неудаче — кэш текущей версии ──
  if (networkFirst) {
    var isNavigate = req.mode === 'navigate'
    e.respondWith(
      new Promise(function (resolve) {
        var done = false
        var timer = setTimeout(function () {
          if (done) return
          done = true
          matchCurrent(req, { ignoreSearch: true }).then(function (c) {
            if (c) return resolve(c)
            if (isNavigate) {
              matchCurrent('/').then(function (h) { resolve(h || matchCurrent('/404.html')) })
            } else {
              resolve(new Response('', { status: 504, statusText: 'offline' }))
            }
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
            matchCurrent(req, { ignoreSearch: true }).then(function (c) {
              if (c) return resolve(c)
              if (isNavigate) {
                matchCurrent('/').then(function (h) { resolve(h || matchCurrent('/404.html')) })
              } else {
                resolve(new Response('', { status: 504, statusText: 'offline' }))
              }
            })
          })
      }),
    )
    return
  }

  // ── Статика (CSS/JS/иконки, версионированы ?v=<buildId>): cache-first ──
  e.respondWith(
    matchCurrent(req).then(function (cached) {
      if (cached) return cached
      return fetch(req)
        .then(function (res) { return putInCache(req, res) })
        .catch(function () { return new Response('', { status: 504, statusText: 'offline' }) })
    }),
  )
})
