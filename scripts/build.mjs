// Генератор статического многостраничного сайта «Дитя Бога».
// Одна тема — одна HTML-страница с точным URL. Всё офлайн, без бэкенда.
// Результат в dist/ — его же потом бандлит Capacitor в APK/iOS.

import { mkdir, writeFile, rm, cp, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  SECTIONS,
  SECTIONS_BY_ID,
  CONTACTS,
  CONTACTS_BY_ID,
  TOPICS,
  TOPICS_BY_SLUG,
  topicUrl,
  sectionUrl,
  topicsOfSection,
  validateContent,
} from '../content/index.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

const SITE = {
  origin: 'https://childofgod.ru',
  name: 'Дитя Бога',
  tagline: 'Родителям о правах и безопасности ребёнка',
  description:
    'Справочник для родителей: права ребёнка простым языком, защита от насилия и травли, безопасность, психика, здоровье и закон. Одна проблема — одна страница, всё работает офлайн.',
}

const RU_MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]
const _now = new Date()
const BUILD_MONTH = `${RU_MONTHS[_now.getMonth()]} ${_now.getFullYear()} г.`
const BUILD_ID = String(Date.now())
// версия для строки запроса статики — гарантированно сбрасывает и HTTP-кэш
// браузера, и кэш service worker при каждом деплое
const V = `?v=${BUILD_ID}`

// ─── утилиты ────────────────────────────────────────────────────
const esc = (s = '') =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const attr = (s = '') => esc(s).replaceAll("'", '&#39;')

function telHref(tel) {
  return 'tel:' + String(tel).replace(/[^\d+]/g, '')
}

// ─── контакт → HTML ─────────────────────────────────────────────
function renderContact(id) {
  const c = CONTACTS_BY_ID[id]
  if (!c) return ''
  const actions = []
  if (c.tel)
    actions.push(
      `<a class="c-act c-tel" href="${attr(telHref(c.tel))}">☎ Позвонить: ${esc(c.telDisplay || c.tel)}</a>`,
    )
  if (c.email)
    actions.push(
      `<a class="c-act c-mail" href="mailto:${attr(c.email)}">✉ Написать: ${esc(c.email)}</a>`,
    )
  if (c.url)
    actions.push(
      `<a class="c-act c-site" href="${attr(c.url)}" target="_blank" rel="noopener noreferrer">🔗 Сайт: ${esc(
        c.urlDisplay || c.url,
      )}</a>`,
    )
  return `<li class="contact">
    <div class="contact-name">${esc(c.name)}</div>
    ${c.responsibility ? `<div class="contact-resp"><b>За что отвечает:</b> ${esc(c.responsibility)}</div>` : ''}
    <div class="contact-when"><b>Когда обращаться:</b> ${esc(c.when)}</div>
    ${c.hours ? `<div class="contact-hours"><b>Режим:</b> ${esc(c.hours)}</div>` : ''}
    ${c.operator ? `<div class="contact-op"><b>Оператор:</b> ${esc(c.operator)}</div>` : ''}
    ${actions.length ? `<div class="contact-actions">${actions.join('')}</div>` : '<div class="contact-note">Контакт ищется по месту жительства (см. описание выше).</div>'}
    ${c.verify ? `<div class="contact-verify">⚠️ Номер/адрес нужно сверить с официальным сайтом перед использованием.</div>` : ''}
  </li>`
}

// ─── блок-список ────────────────────────────────────────────────
function block(icon, title, items, { ordered = false, cls = '' } = {}) {
  if (!items || !items.length) return ''
  const tag = ordered ? 'ol' : 'ul'
  const lis = items.map((x) => `<li>${esc(x)}</li>`).join('')
  return `<section class="tblock ${cls}">
    <h2>${icon ? `<span class="ic" aria-hidden="true">${icon}</span> ` : ''}${esc(title)}</h2>
    <${tag}>${lis}</${tag}>
  </section>`
}

// ─── layout ────────────────────────────────────────────────────
function layout({ title, description, canonicalPath, bodyClass = '', jsonLd = [], main, noindex = false }) {
  const canonical = SITE.origin + canonicalPath
  const ld = jsonLd
    .map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`)
    .join('\n')
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${attr(canonical)}">
${noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${attr(SITE.name)}">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${attr(canonical)}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#3a6b5f">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${attr(SITE.name)}">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/styles.css${V}">
${ld}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">К содержанию</a>
<header class="site-head">
  <div class="head-inner">
    <a class="logo" href="/"><img class="logo-mark" src="/favicon.svg" alt="" width="24" height="24"><span>${esc(SITE.name)}</span></a>
    <div class="head-actions">
      <button type="button" class="reload-btn" data-reload aria-label="Обновить страницу и сбросить кэш" title="Обновить: сбросить кэш и перезагрузить эту страницу">↻</button>
      <a class="help-btn" href="/pomoshch/">🆘 Помощь сейчас</a>
    </div>
  </div>
</header>
<main id="main">
${main}
</main>
<footer class="site-foot">
  <nav class="foot-nav">
    <a href="/">Главная</a>
    <a href="/pomoshch/">Помощь сейчас</a>
    <a href="/kontakty/">Все контакты</a>
    <a href="/poisk/">Поиск</a>
    <a href="/o-proekte/">О проекте</a>
  </nav>
  <p class="foot-disclaimer">Материалы носят справочный характер и не заменяют консультацию юриста, врача или психолога.
  Ссылки на нормы даны для ориентира и требуют проверки на актуальность. В острой ситуации сразу обращайтесь за живой помощью.</p>
</footer>
<script src="/assets/nav.js${V}" defer></script>
</body>
</html>`
}

function breadcrumbs(items) {
  // items: [{name, url}] последний — текущая страница без ссылки
  const parts = items
    .map((it, i) =>
      it.url && i < items.length - 1
        ? `<a href="${attr(it.url)}">${esc(it.name)}</a>`
        : `<span aria-current="page">${esc(it.name)}</span>`,
    )
    .join('<span class="sep">/</span>')
  return `<nav class="crumbs" aria-label="Хлебные крошки">${parts}</nav>`
}

function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: SITE.origin + (it.url || ''),
    })),
  }
}

// ─── страницы ──────────────────────────────────────────────────
function renderHome() {
  const sectionsHtml = SECTIONS.map(
    (s) => `<li class="sec-card">
      <a href="${sectionUrl(s)}"><span class="sec-title">${esc(s.title)}</span>
      <span class="sec-lead">${esc(s.lead)}</span></a>
      <ul class="sec-topics">${topicsOfSection(s.id)
        .slice(0, 6)
        .map((t) => `<li><a href="${topicUrl(t)}">${esc(t.title)}</a>${t.urgent ? ' <b class="u">срочное</b>' : ''}</li>`)
        .join('')}</ul>
    </li>`,
  ).join('')

  const main = `
<section class="hero">
  <h1>${esc(SITE.name)} — ${esc(SITE.tagline)}</h1>
  <p class="hero-lead">Родителям, которые хотят, чтобы дети росли в любви и заботе, а не в страхе.
  Конкретно: что происходит, что говорит закон, что делать по шагам и куда обратиться. По каждой трудной теме — отдельная страница.</p>
  <div class="hero-cta">
    <a class="btn btn-danger" href="/pomoshch/">🆘 Нужна помощь прямо сейчас</a>
    <a class="btn" href="/poisk/">🔎 Найти свою ситуацию</a>
  </div>
  <p class="hero-flag"><span class="ic">🚩</span> Внутри тем помечены <b>красные флаги</b> — сигналы, при которых нельзя ждать: дальше может быть очень плохо.</p>
</section>
<nav class="sec-nav" aria-label="Быстрый переход по разделам">
  ${SECTIONS.map(
    (s) => `<a class="sec-chip" href="${sectionUrl(s)}"><span>${esc(s.title)}</span><span class="sec-chip-n">${topicsOfSection(s.id).length}</span></a>`,
  ).join('')}
</nav>
<form class="search-form home-search" role="search" onsubmit="return false">
  <input type="search" id="q" name="q" placeholder="Опишите, что случилось: «травят в школе», «не хочет жить»…" autocomplete="off">
</form>
<ul id="results" class="search-results" aria-live="polite"></ul>
<h2 class="sec-h">Разделы — подробно</h2>
<ul class="sec-list">${sectionsHtml}</ul>
<script src="/assets/search.js${V}" defer></script>
<section class="resp-note">
  <h2>Кто за что отвечает</h2>
  <p>Безопасность и счастье ребёнка — прежде всего зона ответственности родителя. Государство и его органы помогают в своих пределах: полиция и Следственный комитет — по преступлениям, опека и КДН — по защите детей, надзорные органы — по нарушениям учреждений. Ниже — <a href="/kontakty/">полный справочник служб</a> с кликабельными телефонами и ссылками.</p>
</section>`

  return layout({
    title: `${SITE.name} — родителям о правах и безопасности ребёнка`,
    description: SITE.description,
    canonicalPath: '/',
    bodyClass: 'page-home',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE.name,
        url: SITE.origin + '/',
        inLanguage: 'ru-RU',
        potentialAction: {
          '@type': 'SearchAction',
          target: SITE.origin + '/poisk/?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
    ],
    main,
  })
}

function renderSection(s) {
  const topics = topicsOfSection(s.id)
  const list = topics
    .map(
      (t) => `<li class="topic-card${t.urgent ? ' is-urgent' : ''}">
      <a href="${topicUrl(t)}">
        <span class="tc-title">${esc(t.title)}</span>
        <span class="tc-desc">${esc(t.seoDescription)}</span>
        <span class="tc-meta">${t.urgent ? '<b class="u">срочная тема</b> · ' : ''}${
        t.status === 'planned' ? 'кратко, дополняется' : 'полный разбор'
      }</span>
      </a>
    </li>`,
    )
    .join('')

  const crumbs = [
    { name: 'Главная', url: '/' },
    { name: s.title, url: sectionUrl(s) },
  ]

  const main = `
${breadcrumbs(crumbs)}
<h1>${esc(s.title)}</h1>
<p class="frame">${esc(s.frame)}</p>
<ul class="topic-list">${list}</ul>`

  return layout({
    title: `${s.title} — ${SITE.name}`,
    description: `${s.lead} ${s.frame}`.slice(0, 300),
    canonicalPath: sectionUrl(s),
    bodyClass: 'page-section',
    jsonLd: [breadcrumbLd(crumbs)],
    main,
  })
}

function renderTopic(t) {
  const s = SECTIONS_BY_ID[t.sectionId]
  const crumbs = [
    { name: 'Главная', url: '/' },
    { name: s.title, url: sectionUrl(s) },
    { name: t.title, url: topicUrl(t) },
  ]

  const redFlags = t.redFlags && t.redFlags.length
    ? `<section class="tblock redflags" id="krasnye-flagi">
        <h2><span class="ic" aria-hidden="true">🚩</span> Красные флаги — не ждите, если это есть</h2>
        <p class="rf-note">Любой пункт ниже — повод действовать сегодня, а не «посмотреть, как будет». Дальше может быть очень плохо.</p>
        <ul>${t.redFlags.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </section>`
    : ''

  const sut = t.sut && t.sut.length
    ? `<section class="tblock sut"><h2>Что происходит</h2>${t.sut.map((p) => `<p>${esc(p)}</p>`).join('')}</section>`
    : ''

  const lawQuotes = t.lawQuotes && t.lawQuotes.length
    ? `<section class="tblock lawquotes">
        <h2><span class="ic" aria-hidden="true">📖</span> Цитаты из закона — можно сослаться и показать</h2>
        ${t.lawQuotes
          .map(
            (q) => `<figure class="quote"><blockquote>${esc(q.text)}</blockquote><figcaption>${esc(q.ref)}</figcaption></figure>`,
          )
          .join('')}
      </section>`
    : ''

  const templates = t.templates && t.templates.length
    ? `<section class="tblock templates" id="dokumenty">
        <h2><span class="ic" aria-hidden="true">📄</span> Готовые документы</h2>
        <p class="tpl-lead">Кнопки — сразу под названием: <b>⬇️ скачать файл</b> (откроется в Word) или <b>📋 скопировать текст</b>. Заполните поля в квадратных скобках, поставьте дату и подпись. Актуально на <b>${esc(BUILD_MONTH)}</b> — требования меняются, сверяйте с сайтом ведомства.</p>
        ${t.templates
          .map(
            (tpl, i) => `<article class="tpl">
            <h3 class="tpl-title"><span aria-hidden="true">📄</span> ${esc(tpl.title)}</h3>
            <div class="tpl-actions">
              <button class="btn btn-doc" type="button" data-doc data-name="${attr(t.slug + '-dok-' + (i + 1) + '.doc')}" data-doctitle="${attr(tpl.title)}">⬇️ Скачать .doc</button>
              <button class="btn btn-copy" type="button" data-copy>📋 Скопировать текст</button>
            </div>
            ${tpl.to ? `<p class="tpl-meta"><b>Кому:</b> ${esc(tpl.to)}</p>` : ''}
            ${tpl.where ? `<p class="tpl-meta"><b>Куда подать или принести:</b> ${esc(tpl.where)}</p>` : ''}
            <pre class="tpl-body">${esc(tpl.body)}</pre>
            ${tpl.example ? `<details class="tpl-example"><summary><span aria-hidden="true">👀</span> Показать пример заполнения</summary><pre class="tpl-body tpl-body--example">${esc(tpl.example)}</pre></details>` : ''}
          </article>`,
          )
          .join('')}
      </section>`
    : ''

  const ages = t.ages && t.ages.length
    ? `<section class="tblock ages">
        <h2><span class="ic" aria-hidden="true">👧</span> По возрастам</h2>
        <dl>${t.ages.map((a) => `<dt>${esc(a.range)}</dt><dd>${esc(a.text)}</dd>`).join('')}</dl>
      </section>`
    : ''

  const contacts = t.contacts && t.contacts.length
    ? `<section class="tblock contacts" id="kuda-obratitsya">
        <h2><span class="ic" aria-hidden="true">📞</span> Куда обратиться</h2>
        <ul class="contact-list">${t.contacts.map(renderContact).join('')}</ul>
      </section>`
    : ''

  const related = (t.related || [])
    .map((slug) => TOPICS_BY_SLUG[slug])
    .filter(Boolean)
  const relatedHtml = related.length
    ? `<section class="tblock related"><h2>Смежные темы</h2><ul>${related
        .map((r) => `<li><a href="${topicUrl(r)}">${esc(r.title)}</a></li>`)
        .join('')}</ul></section>`
    : ''

  const sources = t.sources && t.sources.length
    ? `<section class="tblock sources"><h2><span class="ic" aria-hidden="true">📚</span> На чём основано</h2><ul>${t.sources
        .map((x) => `<li>${esc(x)}</li>`)
        .join('')}</ul></section>`
    : ''

  const main = `
${breadcrumbs(crumbs)}
<article class="topic">
  <header class="topic-head">
    ${t.urgent ? '<p class="urgent-badge">Срочная тема — если это про вас, действуйте не откладывая</p>' : ''}
    <h1>${esc(t.title)}</h1>
    ${t.status === 'planned' ? '<p class="planned-note">Краткий разбор. Тема дополняется — формулировки о законе проходят проверку.</p>' : ''}
  </header>
  ${redFlags}
  ${sut}
  ${block('📌', 'Что сделать в первую очередь', t.first, { cls: 'first' })}
  ${block('⚖️', 'Что говорит закон', t.law, { cls: 'law' })}
  ${lawQuotes}
  ${block('✅', 'Что делать: по шагам', t.steps, { ordered: true, cls: 'steps' })}
  ${block('🗣', 'Что можно сказать', t.say, { cls: 'say' })}
  ${block('⛔', 'Чего не говорить и не делать', t.dont, { cls: 'dont' })}
  ${ages}
  ${templates}
  ${contacts}
  ${sources}
  ${relatedHtml}
</article>`

  return layout({
    title: `${t.seoTitle || t.title} — ${SITE.name}`,
    description: t.seoDescription,
    canonicalPath: topicUrl(t),
    bodyClass: 'page-topic',
    jsonLd: [
      breadcrumbLd(crumbs),
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: t.title,
        description: t.seoDescription,
        inLanguage: 'ru-RU',
        dateModified: t.updated,
        mainEntityOfPage: SITE.origin + topicUrl(t),
        about: s.title,
        keywords: (t.keywords || []).join(', '),
        publisher: { '@type': 'Organization', name: SITE.name },
      },
    ],
    main,
  })
}

function renderPomoshch() {
  const emergency = CONTACTS.filter((c) => c.emergency)
  const main = `
${breadcrumbs([{ name: 'Главная', url: '/' }, { name: 'Помощь сейчас', url: '/pomoshch/' }])}
<h1>🆘 Помощь сейчас</h1>
<section class="tblock redflags">
  <h2>Если жизни или здоровью ребёнка угрожает опасность прямо сейчас</h2>
  <p class="rf-note">Звоните <a href="tel:112">112</a> или в скорую — немедленно, не дочитывая страницу.</p>
</section>
<section class="tblock contacts">
  <h2>Экстренные линии</h2>
  <ul class="contact-list">${emergency.map((c) => renderContact(c.id)).join('')}</ul>
</section>
<section class="tblock">
  <h2>Частые срочные ситуации</h2>
  <ul class="quick-links">
    ${['suicidalnye-signaly', 'sextortion', 'rebenok-poteryalsya', 'verbovka-legkie-dengi', 'dopros-nesovershennoletnego', 'pervaya-lyubov-otverzhenie']
      .map((slug) => TOPICS_BY_SLUG[slug])
      .filter(Boolean)
      .map((t) => `<li><a href="${topicUrl(t)}">${esc(t.title)}</a></li>`)
      .join('')}
  </ul>
</section>
<p class="foot-disclaimer">Полный справочник служб с телефонами и ссылками — на странице <a href="/kontakty/">«Все контакты»</a>.</p>`

  return layout({
    title: `Помощь сейчас — экстренные телефоны — ${SITE.name}`,
    description:
      'Экстренные телефоны помощи ребёнку и родителю: 112, детский телефон доверия 8 800 2000 122, линия «Ребёнок в опасности», поиск пропавших детей. Кликабельные номера.',
    canonicalPath: '/pomoshch/',
    bodyClass: 'page-help',
    jsonLd: [breadcrumbLd([{ name: 'Главная', url: '/' }, { name: 'Помощь сейчас', url: '/pomoshch/' }])],
    main,
  })
}

function renderKontakty() {
  const groups = [
    ['emergency', 'Экстренные службы'],
    ['hotline', 'Горячие линии'],
    ['agency', 'Государственные органы: кто за что отвечает'],
    ['ngo', 'Некоммерческие организации'],
    ['service', 'Сервисы и специалисты'],
  ]
  const sections = groups
    .map(([kind, title]) => {
      const items = CONTACTS.filter((c) => c.kind === kind)
      if (!items.length) return ''
      return `<section class="tblock contacts"><h2>${esc(title)}</h2>
        <ul class="contact-list">${items.map((c) => renderContact(c.id)).join('')}</ul></section>`
    })
    .join('')

  const main = `
${breadcrumbs([{ name: 'Главная', url: '/' }, { name: 'Все контакты', url: '/kontakty/' }])}
<h1>Все контакты: куда звонить, писать и обращаться</h1>
<p class="frame">Телефоны кликабельны — нажмите, чтобы позвонить. Адреса почты открываются в почтовом приложении, сайты — в новой вкладке.
Часть номеров помечена значком ⚠️ — их нужно сверить с официальным сайтом перед использованием.</p>
${sections}`

  return layout({
    title: `Все контакты помощи детям и родителям — ${SITE.name}`,
    description:
      'Справочник служб: экстренные телефоны, горячие линии, государственные органы (МВД, СК, ФСБ, прокуратура, Роскомнадзор, Роспотребнадзор, уполномоченный по правам ребёнка), НКО. Кликабельные телефоны и ссылки.',
    canonicalPath: '/kontakty/',
    bodyClass: 'page-contacts',
    jsonLd: [breadcrumbLd([{ name: 'Главная', url: '/' }, { name: 'Все контакты', url: '/kontakty/' }])],
    main,
  })
}

function renderAbout() {
  const main = `
${breadcrumbs([{ name: 'Главная', url: '/' }, { name: 'О проекте', url: '/o-proekte/' }])}
<h1>О проекте</h1>
<p class="frame">Ребёнок — не собственность родителя и не его продолжение. Это отдельный человек с собственным достоинством,
данный родителю под опеку, а не во владение. На дитя не кричат, не поднимают руку, не ломают его волю «для его же блага».</p>
<p>«${esc(SITE.name)}» — справочник для родителей, которые хотят растить детей в любви и уважении, но не всегда знают,
как правильно поступить: когда школа отмахивается от травли, когда в семье срываются на крик, когда врач не объясняет,
когда подросток отдаляется и рискует собой.</p>
<h2>Как устроена каждая страница</h2>
<ul>
  <li><b>🚩 Красные флаги</b> — сигналы, при которых нельзя ждать;</li>
  <li><b>Что происходит</b> — суть простыми словами;</li>
  <li><b>📌 Что сделать в первую очередь</b> — конкретные действия;</li>
  <li><b>⚖️ Что говорит закон</b> и <b>📖 цитаты из закона</b> — чтобы сослаться и показать;</li>
  <li><b>✅ По шагам</b>, <b>🗣 что сказать</b> и <b>⛔ чего не делать</b>;</li>
  <li><b>📄 Готовые документы</b> — тексты заявлений и жалоб;</li>
  <li><b>📞 Куда обратиться</b> — с кликабельными телефонами и ссылками.</li>
</ul>
<h2>Ответственность</h2>
<p>Безопасность и счастье ребёнка — прежде всего дело семьи. Родитель обязан научить ребёнка, как себя вести и с кем говорить,
и быть тем взрослым, к которому можно прийти без страха. Государство помогает в своих пределах — но не заменяет родителя.</p>
<h2>Важно</h2>
<p>Приложение не заменяет юриста, врача или психолога и не ставит диагнозов. Ссылки на нормы даны для ориентира и требуют
проверки на актуальность. В острой ситуации — сразу живая помощь, телефоны на странице <a href="/pomoshch/">«Помощь сейчас»</a>.</p>`

  return layout({
    title: `О проекте — ${SITE.name}`,
    description:
      'Зачем нужен справочник «Дитя Бога», как устроена каждая страница и почему ответственность за безопасность ребёнка — прежде всего на семье.',
    canonicalPath: '/o-proekte/',
    bodyClass: 'page-about',
    jsonLd: [breadcrumbLd([{ name: 'Главная', url: '/' }, { name: 'О проекте', url: '/o-proekte/' }])],
    main,
  })
}

function renderSearch() {
  const main = `
${breadcrumbs([{ name: 'Главная', url: '/' }, { name: 'Поиск', url: '/poisk/' }])}
<h1>Поиск по ситуации</h1>
<p class="frame">Опишите, что случилось, простыми словами: «травят в школе», «ребёнок не хочет жить», «забрал второй родитель», «шантажируют фото», «отказ от прививок». Поиск идёт по заголовкам, описаниям, ключевым словам и тексту.</p>
<form class="search-form" role="search" onsubmit="return false">
  <input type="search" id="q" name="q" placeholder="Что случилось?" autocomplete="off" autofocus>
</form>
<ul id="results" class="search-results" aria-live="polite"></ul>
<script src="/assets/search.js${V}" defer></script>`

  return layout({
    title: `Поиск по ситуации — ${SITE.name}`,
    description: 'Найдите свою ситуацию: травля, насилие в семье, безопасность, психика, здоровье, закон.',
    canonicalPath: '/poisk/',
    bodyClass: 'page-search',
    noindex: true,
    main,
  })
}

function render404() {
  const main = `
<h1>Страница не найдена</h1>
<p>Возможно, ссылка устарела. Начните с <a href="/">главной</a>, воспользуйтесь <a href="/poisk/">поиском</a>
или откройте <a href="/pomoshch/">«Помощь сейчас»</a>.</p>`
  return layout({
    title: `Страница не найдена — ${SITE.name}`,
    description: 'Страница не найдена.',
    canonicalPath: '/404.html',
    noindex: true,
    main,
  })
}

// ─── поисковый индекс ──────────────────────────────────────────
function buildSearchIndex() {
  return TOPICS.map((t) => {
    const s = SECTIONS_BY_ID[t.sectionId]
    const text = [
      ...(t.sut || []),
      ...(t.first || []),
      ...(t.redFlags || []),
      ...(t.steps || []),
    ]
      .join(' ')
      .slice(0, 900)
    return {
      t: t.title,
      u: topicUrl(t),
      s: s.title,
      d: t.seoDescription,
      k: (t.keywords || []).join(' '),
      x: text,
      urgent: !!t.urgent,
    }
  })
}

// ─── прочие артефакты ──────────────────────────────────────────
function buildSitemap(urls) {
  const today = new Date().toISOString().slice(0, 10)
  const body = urls
    .map((u) => `  <url><loc>${SITE.origin}${u}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

const ROBOTS = `User-agent: *
Allow: /
Disallow: /poisk/

Sitemap: ${SITE.origin}/sitemap.xml
`

const MANIFEST = JSON.stringify({
  name: 'Дитя Бога — родителям о правах ребёнка',
  short_name: 'Дитя Бога',
  description: SITE.description,
  lang: 'ru',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#faf7f0',
  theme_color: '#3a6b5f',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
})

// ─── сборка ────────────────────────────────────────────────────
async function writePage(routePath, html) {
  // routePath: '/', '/pomoshch/', '/lichnost/mnenie-rebenka/'
  const rel = routePath === '/' ? 'index.html' : path.join(routePath.replace(/^\/|\/$/g, ''), 'index.html')
  const full = path.join(DIST, rel)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, html, 'utf8')
  return routePath
}

async function main() {
  const errors = validateContent()
  if (errors.length) {
    console.error('Ошибки в контенте:\n' + errors.map((e) => '  • ' + e).join('\n'))
    process.exit(1)
  }

  await rm(DIST, { recursive: true, force: true })
  await mkdir(DIST, { recursive: true })

  const routes = []
  routes.push(await writePage('/', renderHome()))
  routes.push(await writePage('/pomoshch/', renderPomoshch()))
  routes.push(await writePage('/kontakty/', renderKontakty()))
  routes.push(await writePage('/o-proekte/', renderAbout()))
  routes.push(await writePage('/poisk/', renderSearch()))

  for (const s of SECTIONS) routes.push(await writePage(sectionUrl(s), renderSection(s)))
  for (const t of TOPICS) routes.push(await writePage(topicUrl(t), renderTopic(t)))

  await writeFile(path.join(DIST, '404.html'), render404(), 'utf8')

  // индекс поиска, sitemap, robots, manifest
  await writeFile(path.join(DIST, 'search-index.json'), JSON.stringify(buildSearchIndex()), 'utf8')
  const indexable = routes.filter((r) => r !== '/poisk/')
  await writeFile(path.join(DIST, 'sitemap.xml'), buildSitemap(indexable), 'utf8')
  await writeFile(path.join(DIST, 'robots.txt'), ROBOTS, 'utf8')
  await writeFile(path.join(DIST, 'manifest.webmanifest'), MANIFEST, 'utf8')

  // статика
  await cp(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true })
  if (existsSync(path.join(ROOT, 'public')))
    await cp(path.join(ROOT, 'public'), DIST, { recursive: true })

  // service worker с актуальным списком precache
  const swSrc = await readFile(path.join(ROOT, 'assets', 'sw.js'), 'utf8')
  const precache = [
    ...routes,
    '/assets/styles.css' + V,
    '/assets/search.js' + V,
    '/assets/nav.js' + V,
    '/search-index.json',
    '/favicon.svg',
    '/manifest.webmanifest',
    '/404.html',
  ]
  const sw = swSrc
    .replace('/*__PRECACHE__*/', JSON.stringify(precache))
    .replace('/*__BUILD__*/', BUILD_ID)
  await writeFile(path.join(DIST, 'sw.js'), sw, 'utf8')

  console.log(`Готово: ${routes.length} страниц, ${TOPICS.length} тем в ${SECTIONS.length} разделах, ${CONTACTS.length} контактов.`)
  console.log(`Полных тем: ${TOPICS.filter((t) => t.status === 'full').length}, черновиков: ${TOPICS.filter((t) => t.status === 'planned').length}.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
