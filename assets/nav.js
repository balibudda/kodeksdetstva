// Мелкие улучшения: копирование шаблонов документов + регистрация service worker.
(function () {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]')
    if (!btn) return
    var pre = btn.parentElement.querySelector('.tpl-body')
    if (!pre) return
    var text = pre.innerText
    var done = function () {
      btn.textContent = 'Скопировано ✓'
      btn.classList.add('done')
      setTimeout(function () {
        btn.textContent = 'Скопировать текст'
        btn.classList.remove('done')
      }, 2500)
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback)
    } else {
      fallback()
    }
    function fallback() {
      var r = document.createRange()
      r.selectNodeContents(pre)
      var sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(r)
      try {
        document.execCommand('copy')
        done()
      } catch (err) {}
      sel.removeAllRanges()
    }
  })

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {})
    })
  }

  // Кнопка «Обновить» ↻: принудительно сбрасывает кэш и service worker и
  // перезагружает ТУ ЖЕ страницу (у каждой свой URL — reload сам вернёт сюда).
  // Если офлайн — кэш не трогаем (иначе страница не откроется), просто reload.
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (r) { setTimeout(function () { r() }, ms) })])
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-reload]')
    if (!btn) return
    btn.classList.add('spinning')
    var online = navigator.onLine !== false
    var jobs = Promise.resolve()
    if (online && 'caches' in window) {
      jobs = jobs.then(function () {
        return withTimeout(
          caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) { return caches.delete(k) }))
          }),
          2500,
        )
      })
    }
    if (online && 'serviceWorker' in navigator) {
      jobs = jobs.then(function () {
        return withTimeout(
          navigator.serviceWorker.getRegistrations().then(function (regs) {
            return Promise.all(regs.map(function (r) { return r.unregister() }))
          }),
          2500,
        )
      })
    }
    jobs.catch(function () {}).then(function () {
      location.reload()
    })
  })
})()
