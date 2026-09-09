// Клиентский поиск по situations. Индекс — /search-index.json (генерируется при сборке).
// Простой, но толковый: нормализация, синонимы, взвешивание по полю совпадения.
(function () {
  var input = document.getElementById('q')
  var out = document.getElementById('results')
  if (!input || !out) return

  var INDEX = []
  var ready = false

  // разговорные синонимы → к словам из контента
  var SYN = {
    'бьёт': 'насилие наказание побои',
    'бьет': 'насилие наказание побои',
    'орёт': 'крик эмоциональное насилие',
    'орет': 'крик эмоциональное насилие',
    'кричит': 'крик эмоциональное насилие',
    'суицид': 'суицидальные не хочу жить покончить',
    'вскрыл': 'самоповреждение селфхарм порезы',
    'режет': 'самоповреждение селфхарм порезы',
    'булли': 'травля буллинг',
    'буллинг': 'травля',
    'травят': 'травля буллинг',
    'нюдсы': 'интимные фото шантаж sextortion',
    'фотки': 'интимные фото шантаж',
    'закладки': 'вещества наркотики сбыт вербовка',
    'вейп': 'вейпы никотин',
    'снюс': 'никотин вещества',
    'прививки': 'прививок вакцинация отказ информированное согласие',
    'прививка': 'прививок вакцинация отказ',
    'манту': 'прививок иммунодиагностика фтизиатр',
    'слежка': 'контроль геолокация прослушка приватность',
    'следят': 'контроль геолокация приватность',
    'развод': 'родители порознь место жительства',
    'забрал': 'родительское похищение вывоз',
    'похитили': 'похищение пропал',
    'пропал': 'потерялся пропал розыск',
    'потерялся': 'пропал розыск',
    'полиция': 'допрос задержание несовершеннолетнего',
    'допрос': 'допрос несовершеннолетнего полиция',
    'депрессия': 'депрессия апатия ничего не хочет',
    'первая любовь': 'первая любовь отвержение расставание',
    'любовь': 'первая любовь отвержение',
  }

  function norm(s) {
    return (s || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9 ]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function expand(q) {
    var base = norm(q)
    var extra = []
    Object.keys(SYN).forEach(function (k) {
      if (base.indexOf(norm(k)) !== -1) extra.push(norm(SYN[k]))
    })
    return (base + ' ' + extra.join(' ')).trim()
  }

  function score(item, terms) {
    var hay = {
      t: norm(item.t),
      d: norm(item.d),
      k: norm(item.k),
      s: norm(item.s),
      x: norm(item.x),
    }
    var sc = 0
    terms.forEach(function (term) {
      if (!term) return
      if (hay.t.indexOf(term) !== -1) sc += 10
      if (hay.k.indexOf(term) !== -1) sc += 6
      if (hay.d.indexOf(term) !== -1) sc += 4
      if (hay.s.indexOf(term) !== -1) sc += 2
      if (hay.x.indexOf(term) !== -1) sc += 1
    })
    if (sc > 0 && item.urgent) sc += 1.5
    return sc
  }

  function run() {
    var q = input.value.trim()
    if (!ready) {
      out.innerHTML = '<li class="search-empty">Загрузка…</li>'
      return
    }
    if (q.length < 2) {
      out.innerHTML = ''
      return
    }
    var terms = expand(q).split(' ').filter(function (x) { return x.length > 1 })
    var ranked = INDEX.map(function (it) { return { it: it, sc: score(it, terms) } })
      .filter(function (r) { return r.sc > 0 })
      .sort(function (a, b) { return b.sc - a.sc })
      .slice(0, 20)

    if (!ranked.length) {
      out.innerHTML =
        '<li class="search-empty">Ничего не нашлось. Попробуйте другими словами или откройте <a href="/">разделы</a>. Если это срочно — <a href="/pomoshch/">Помощь сейчас</a>.</li>'
      return
    }
    out.innerHTML = ranked
      .map(function (r) {
        var it = r.it
        return (
          '<li><a href="' + it.u + '">' +
          '<span class="r-title">' + escapeHtml(it.t) + (it.urgent ? ' — срочное' : '') + '</span>' +
          '<span class="r-sec">' + escapeHtml(it.s) + '</span>' +
          '<span class="r-desc">' + escapeHtml(it.d) + '</span>' +
          '</a></li>'
        )
      })
      .join('')
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    })
  }

  fetch('/search-index.json')
    .then(function (r) { return r.json() })
    .then(function (data) {
      INDEX = data
      ready = true
      run()
    })
    .catch(function () {
      out.innerHTML = '<li class="search-empty">Не удалось загрузить поиск. Откройте <a href="/">разделы</a>.</li>'
    })

  var t
  input.addEventListener('input', function () {
    clearTimeout(t)
    t = setTimeout(run, 120)
  })

  // ?q= из адресной строки
  var pre = new URLSearchParams(location.search).get('q')
  if (pre) {
    input.value = pre
    run()
  }
})()
