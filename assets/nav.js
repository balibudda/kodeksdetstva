// Мелкие улучшения: меню, копирование и скачивание шаблонов, service worker.
(function () {
  // Меню разделов: закрывать по клику вне и по Esc
  var menu = document.getElementById('menu')
  if (menu) {
    document.addEventListener('click', function (e) {
      if (menu.open && !menu.contains(e.target)) menu.open = false
    })
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) menu.open = false
    })
  }

  function tplBody(btn) {
    var box = btn.closest('.tpl')
    return box ? box.querySelector('.tpl-body') : null
  }

  // Текст шаблона для копирования/скачивания: заполненный, если онлайн-форма
  // активна и в неё что-то ввели, иначе — исходный с полями в скобках.
  function tplText(btn) {
    var box = btn.closest('.tpl')
    if (!box) return ''
    var preview = box.querySelector('.tpl-preview')
    var panel = box.querySelector('[data-fill-panel]')
    if (preview && panel && !panel.hidden && box.querySelector('.tpl-fill input')) {
      var any = false
      var inputs = box.querySelectorAll('.tpl-fill input')
      for (var i = 0; i < inputs.length; i++) { if (inputs[i].value.trim()) { any = true; break } }
      if (any) return preview.innerText
    }
    var body = box.querySelector('.tpl-body')
    return body ? body.innerText : ''
  }

  // ✏️ Заполнить онлайн: строим поля по «[...]» из текста шаблона,
  // подставляем введённое в живой предпросмотр. Всё офлайн, ничего не отправляется.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-fill]')
    if (!btn) return
    var box = btn.closest('.tpl')
    if (!box) return
    var panel = box.querySelector('[data-fill-panel]')
    var srcPre = box.querySelector('.tpl-body')
    if (!panel || !srcPre) return

    if (!panel.hidden) {
      panel.hidden = true
      btn.setAttribute('aria-expanded', 'false')
      btn.textContent = '✏️ Заполнить онлайн'
      return
    }

    if (!panel.dataset.built) {
      var src = srcPre.innerText
      var seen = {}
      var fields = []
      src.replace(/\[[^\]\n]{2,120}\]/g, function (m) {
        if (!seen[m]) { seen[m] = true; fields.push(m) }
        return m
      })
      if (!fields.length) {
        panel.innerHTML = '<p class="tpl-fill-note">В этом шаблоне нет полей для подстановки — просто скачайте или скопируйте текст.</p>'
        panel.dataset.built = '1'
      } else {
        var rows = fields.map(function (f, i) {
          var label = f.replace(/^\[|\]$/g, '')
          return '<label class="tpl-fld"><span>' + escHtml(label) + '</span>' +
            '<input type="text" data-ph="' + escAttr(f) + '" autocomplete="off"></label>'
        }).join('')
        panel.innerHTML =
          '<p class="tpl-fill-note">Заполните поля — текст ниже обновится сам. Данные остаются только в этом браузере.</p>' +
          '<div class="tpl-flds">' + rows + '</div>' +
          '<p class="tpl-fill-note">Предпросмотр:</p>' +
          '<pre class="tpl-preview"></pre>'
        panel.dataset.built = '1'
        var preview = panel.querySelector('.tpl-preview')
        var srcText = src
        var inputs = panel.querySelectorAll('input[data-ph]')
        var repaint = function () {
          var out = srcText
          for (var i = 0; i < inputs.length; i++) {
            var ph = inputs[i].getAttribute('data-ph')
            var val = inputs[i].value.trim()
            if (val) out = out.split(ph).join(val)
          }
          preview.textContent = out
        }
        for (var i = 0; i < inputs.length; i++) inputs[i].addEventListener('input', repaint)
        repaint()
      }
    }

    panel.hidden = false
    btn.setAttribute('aria-expanded', 'true')
    btn.textContent = '✏️ Свернуть форму'
  })

  function escHtml(s) {
    return (s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    })
  }
  function escAttr(s) { return escHtml(s).replace(/'/g, '&#39;') }

  // 📋 Копировать текст шаблона
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]')
    if (!btn) return
    var pre = tplBody(btn)
    if (!pre) return
    var text = tplText(btn)
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
      var ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'absolute'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        done()
      } catch (err) {}
      document.body.removeChild(ta)
    }
  })

  // ── Регион: выбор вручную или подсказка по IP (через /api/geo) ──
  var regionBox = document.getElementById('region-box')
  if (regionBox) {
    var R_KEY = 'cog_region'
    var nameEl = document.getElementById('region-name')
    var listEl = document.getElementById('region-contacts')
    var pickerEl = document.getElementById('region-picker')
    var changeBtn = document.getElementById('region-change')
    var REGIONS = []
    var current = null

    function esc2(s) {
      return (s || '').replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
      })
    }
    function telHref2(t) { return 'tel:' + String(t).replace(/[^\d+]/g, '') }

    function renderContacts(r) {
      if (!r) {
        listEl.innerHTML =
          '<p class="foot-disclaimer">Регион не выбран — показаны только федеральные линии выше. Нажмите «сменить», чтобы выбрать регион и увидеть местные контакты.</p>'
        return
      }
      var items = (r.contacts || []).map(function (c) {
        var acts = []
        if (c.tel) acts.push('<a class="c-act c-tel" href="' + telHref2(c.tel) + '">☎ ' + esc2(c.telDisplay || c.tel) + '</a>')
        if (c.email) acts.push('<a class="c-act c-mail" href="mailto:' + esc2(c.email) + '">✉ ' + esc2(c.email) + '</a>')
        if (c.site) acts.push('<a class="c-act c-site" href="' + esc2(c.site) + '" target="_blank" rel="noopener noreferrer">🔗 ' + esc2(c.siteDisplay || c.site) + '</a>')
        return '<li class="contact"><div class="contact-name">' + esc2(c.name) + '</div>' +
          '<div class="contact-when"><b>Когда обращаться:</b> ' + esc2(c.when) + '</div>' +
          (acts.length ? '<div class="contact-actions">' + acts.join('') + '</div>' : '') +
          (c.verify ? '<div class="contact-verify">⚠️ Контакт нужно сверить с официальным сайтом.</div>' : '') +
          '</li>'
      })
      listEl.innerHTML =
        '<p class="rf-note">Детский телефон доверия <a href="tel:+78002000122">8&nbsp;800&nbsp;2000&nbsp;122</a> работает и здесь.</p>' +
        '<ul class="contact-list">' + items.join('') + '</ul>'
    }

    function paint() {
      nameEl.textContent = current ? current.name : 'не выбран (только федеральные)'
      renderContacts(current)
    }

    function setRegion(id) {
      try { id ? localStorage.setItem(R_KEY, id) : localStorage.removeItem(R_KEY) } catch (e) {}
      current = REGIONS.filter(function (r) { return r.id === id })[0] || null
      paint()
      pickerEl.hidden = true
    }

    function buildPicker() {
      pickerEl.innerHTML =
        '<button type="button" class="sec-chip" data-region="">Вся Россия (только федеральные)</button>' +
        REGIONS.map(function (r) {
          return '<button type="button" class="sec-chip" data-region="' + r.id + '">' + esc2(r.tag) + '</button>'
        }).join('')
      pickerEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-region]')
        if (b) setRegion(b.getAttribute('data-region'))
      })
    }

    changeBtn.addEventListener('click', function () { pickerEl.hidden = !pickerEl.hidden })

    fetch('/regions.json')
      .then(function (r) { return r.json() })
      .then(function (data) {
        REGIONS = data
        buildPicker()
        var stored = null
        try { stored = localStorage.getItem(R_KEY) } catch (e) {}
        if (stored !== null) {
          current = REGIONS.filter(function (r) { return r.id === stored })[0] || null
          paint()
          return
        }
        // подсказка по IP — не чаще одного раза на браузер, тихо при ошибке
        paint()
        var geoDone = false
        try { geoDone = localStorage.getItem('cog_geo_done') === '1' } catch (e) {}
        if (geoDone) return
        try { localStorage.setItem('cog_geo_done', '1') } catch (e) {}
        fetch('/api/geo')
          .then(function (r) { return r.ok ? r.json() : null })
          .then(function (g) {
            if (!g || g.country !== 'RU') return
            var byCode = REGIONS.filter(function (r) { return r.id === g.region })[0]
            var city = (g.city || '').toLowerCase()
            var byCity = byCode || REGIONS.filter(function (r) {
              return (r.cities || []).some(function (c) { return city && (c === city || city.indexOf(c) !== -1) })
            })[0]
            if (byCity) { setRegion(byCity.id) }
          })
          .catch(function () {})
      })
      .catch(function () {
        nameEl.textContent = 'не удалось загрузить'
      })
  }

  // ── Закладки, история просмотров, «поделиться» — всё локально (localStorage) ──
  var BM_KEY = 'cog_bm'
  var HIST_KEY = 'cog_hist'
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch (e) { return [] } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }

  var page = document.body.dataset || {}
  var pageEntry = page.topicTitle
    ? { u: location.pathname, t: page.topicTitle, s: page.topicSection || '', ts: Date.now() }
    : null

  // история: только страницы тем, до 40, свежие сверху, без дублей
  if (pageEntry) {
    var hist = lsGet(HIST_KEY).filter(function (x) { return x.u !== pageEntry.u })
    hist.unshift(pageEntry)
    lsSet(HIST_KEY, hist.slice(0, 40))
  }

  function isBookmarked(u) {
    return lsGet(BM_KEY).some(function (x) { return x.u === u })
  }
  function paintBookmarkBtn(btn) {
    var on = isBookmarked(location.pathname)
    btn.classList.toggle('on', on)
    btn.textContent = on ? '★ В закладках' : '☆ В закладки'
  }
  var bmBtn = document.querySelector('[data-bookmark]')
  if (bmBtn && pageEntry) {
    paintBookmarkBtn(bmBtn)
    bmBtn.addEventListener('click', function () {
      var bm = lsGet(BM_KEY)
      if (isBookmarked(pageEntry.u)) {
        bm = bm.filter(function (x) { return x.u !== pageEntry.u })
      } else {
        bm.unshift({ u: pageEntry.u, t: pageEntry.t, s: pageEntry.s, ts: Date.now() })
      }
      lsSet(BM_KEY, bm)
      paintBookmarkBtn(bmBtn)
    })
  } else if (bmBtn) {
    bmBtn.hidden = true
  }

  var shBtn = document.querySelector('[data-share]')
  if (shBtn) {
    shBtn.addEventListener('click', function () {
      var data = { title: document.title, url: location.href }
      if (navigator.share) {
        navigator.share(data).catch(function () {})
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(location.href).then(function () {
          var old = shBtn.textContent
          shBtn.textContent = 'Ссылка скопирована ✓'
          setTimeout(function () { shBtn.textContent = old }, 2500)
        })
      }
    })
  }

  // страница «Моё» — рендер закладок и истории
  var moeBm = document.getElementById('moe-bm')
  var moeHist = document.getElementById('moe-hist')
  if (moeBm || moeHist) {
    function row(x) {
      return '<li><a href="' + x.u + '"><span class="moe-t">' +
        (x.t || x.u).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) +
        '</span>' + (x.s ? '<span class="moe-s">' + x.s + '</span>' : '') + '</a></li>'
    }
    if (moeBm) {
      var bm = lsGet(BM_KEY)
      moeBm.innerHTML = bm.length
        ? bm.map(row).join('')
        : '<li class="moe-empty">Пока пусто. На странице любой темы нажмите «☆ В закладки».</li>'
    }
    if (moeHist) {
      var h = lsGet(HIST_KEY)
      moeHist.innerHTML = h.length
        ? h.map(row).join('')
        : '<li class="moe-empty">История появится, когда вы откроете несколько тем.</li>'
      var clr = document.getElementById('moe-clear')
      if (clr) clr.addEventListener('click', function () {
        lsSet(HIST_KEY, [])
        moeHist.innerHTML = '<li class="moe-empty">История очищена.</li>'
      })
    }
  }

  // ⬇️ Скачать шаблон как .doc (HTML-обёртка, открывается в Word). Работает офлайн.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-doc]')
    if (!btn) return
    var text = tplText(btn)
    if (!text) return
    var title = btn.getAttribute('data-doctitle') || 'Документ'
    var name = btn.getAttribute('data-name') || 'zayavlenie.doc'
    var body = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
    var hadController = !!navigator.serviceWorker.controller
    var reloadedForSW = false
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      // новый service worker взял управление после обновления — один раз
      // перезагружаем страницу, чтобы подхватить свежие файлы.
      // На первой установке (контроллера ещё не было) не перезагружаем.
      if (!hadController || reloadedForSW) return
      reloadedForSW = true
      location.reload()
    })
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').then(function (reg) {
        if (reg && reg.update) reg.update()
      }).catch(function () {})
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

  // Размер текста A-/A+: множитель --fs на <html>, шаг 0.1 в пределах 0.8–1.4.
  // Запоминается в localStorage и применяется сразу при заходе на любую
  // страницу (см. ранний инлайн-скрипт в <head> в scripts/build.mjs —
  // он же не даёт «скачка» размера до появления этого файла).
  var FS_KEY = 'kd_font_scale'
  var FS_MIN = 0.8
  var FS_MAX = 1.4
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-fs-step]')
    if (!btn) return
    var step = parseFloat(btn.getAttribute('data-fs-step'))
    var cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs')) || 1
    var next = Math.min(FS_MAX, Math.max(FS_MIN, Math.round((cur + step) * 10) / 10))
    document.documentElement.style.setProperty('--fs', next)
    try { localStorage.setItem(FS_KEY, next) } catch (err) {}
  })
})()
