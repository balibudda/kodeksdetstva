// Мелкие улучшения: копирование и скачивание шаблонов документов + service worker.
(function () {
  function tplBody(btn) {
    var box = btn.closest('.tpl')
    return box ? box.querySelector('.tpl-body') : null
  }

  // 📋 Копировать текст шаблона
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]')
    if (!btn) return
    var pre = tplBody(btn)
    if (!pre) return
    var text = pre.innerText
    var label = btn.textContent
    var done = function () {
      btn.textContent = 'Скопировано ✓'
      btn.classList.add('done')
      setTimeout(function () {
        btn.textContent = label
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

  // ⬇️ Скачать шаблон как .doc (HTML-обёртка, открывается в Word). Работает офлайн.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-doc]')
    if (!btn) return
    var pre = tplBody(btn)
    if (!pre) return
    var title = btn.getAttribute('data-doctitle') || 'Документ'
    var name = btn.getAttribute('data-name') || 'zayavlenie.doc'
    var body = pre.innerText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    var html =
      "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>" +
      "<head><meta charset='utf-8'><title>" + title + "</title></head><body>" +
      "<pre style=\"font-family:'Times New Roman',serif;font-size:14pt;white-space:pre-wrap;line-height:1.4\">" +
      body + '</pre></body></html>'
    try {
      var blob = new Blob(['﻿', html], { type: 'application/msword' })
      var url = URL.createObjectURL(blob)
      var a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      setTimeout(function () {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 1000)
    } catch (err) {}
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
