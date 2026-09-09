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
})()
