// Интеграция с Telegram Mini Apps. Активируется только внутри Telegram —
// в обычном браузере ничего не делает. Тот же dist/ работает и как сайт,
// и как мини-приложение; обновляется автоматически при каждом деплое.
(function () {
  var tg = window.Telegram && window.Telegram.WebApp
  if (!tg) return // скрипт telegram-web-app.js не подгружен — точно не в Telegram

  // ВАЖНО: не проверяем tg.initData как признак «мы в Telegram» — Telegram
  // кладёт метку tgWebApp* в адрес только на самой первой открытой странице
  // и сам же подчищает её оттуда при инициализации; после нажатия «Обновить»
  // (location.reload()) initData на этот раз пустое, хотя мы всё ещё внутри
  // Telegram. Раньше это тихо пропускало tg.ready()/expand()/
  // disableVerticalSwipes() при каждом обновлении страницы — Telegram
  // возвращал свои жесты (сворачивание/pull-to-refresh) поверх страницы,
  // из-за чего меню переставало реагировать на нажатия. Используем тот же
  // sessionStorage-флаг, что и build.mjs при решении, грузить ли сам скрипт.
  var inTg = /tgWebApp/.test(location.hash) || /tgWebApp/.test(location.search)
  try {
    if (inTg) sessionStorage.setItem('kd_tg', '1')
    else inTg = sessionStorage.getItem('kd_tg') === '1'
  } catch (e) {}
  if (!inTg) return

  document.documentElement.setAttribute('data-tg', '1')

  try { tg.ready() } catch (e) {}
  try { tg.expand() } catch (e) {}
  try { tg.disableVerticalSwipes && tg.disableVerticalSwipes() } catch (e) {}

  // ── тема Telegram → наши CSS-переменные ──
  function applyTheme() {
    var p = tg.themeParams || {}
    var root = document.documentElement.style
    var map = {
      '--bg': p.secondary_bg_color || p.bg_color,
      '--surface': p.bg_color,
      '--surface-2': p.secondary_bg_color,
      '--ink': p.text_color,
      '--ink-soft': p.hint_color,
      '--accent': p.link_color || p.button_color,
      '--accent-ink': p.button_text_color,
      '--line': p.section_separator_color || p.hint_color,
    }
    for (var k in map) if (map[k]) root.setProperty(k, map[k])
    try { tg.setHeaderColor && tg.setHeaderColor('secondary_bg_color') } catch (e) {}
    try { tg.setBackgroundColor && tg.setBackgroundColor(p.secondary_bg_color || p.bg_color) } catch (e) {}
  }
  applyTheme()
  try { tg.onEvent('themeChanged', applyTheme) } catch (e) {}

  // ── кнопка «Назад» Telegram ──
  var bb = tg.BackButton
  if (bb) {
    if (location.pathname !== '/') { try { bb.show() } catch (e) {} }
    try {
      bb.onClick(function () {
        if (history.length > 1) history.back()
        else location.href = '/'
      })
    } catch (e) {}
  }

  // ── deep-link: t.me/<bot>/<app>?startapp=psihika__suicidalnye-signaly ──
  // start_param приходит с «/» заменёнными на «__» (в startapp «/» нельзя)
  try {
    var sp = tg.initDataUnsafe && tg.initDataUnsafe.start_param
    if (sp && sp !== 'start') {
      var target = '/' + sp.replace(/__/g, '/').replace(/^\/+/, '')
      if (!/\/$/.test(target)) target += '/'
      if (target !== location.pathname) location.replace(target)
    }
  } catch (e) {}

  // ── внешние ссылки (tel:, mailto:, http внешние) через Telegram ──
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]')
    if (!a) return
    var href = a.getAttribute('href') || ''
    if (/^(tel:|mailto:)/i.test(href)) return // Telegram-webview открывает сам
    if (/^https?:\/\//i.test(href) && a.host !== location.host) {
      e.preventDefault()
      try { tg.openLink(href) } catch (err) { window.open(href, '_blank') }
    }
  })

  // haptic на нажатия по основным кнопкам
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.btn, .ta-btn, .sec-chip, .topic-card a, .tebe-cards a')) {
      try { tg.HapticFeedback && tg.HapticFeedback.impactOccurred('light') } catch (err) {}
    }
  })
})()
