// Генератор статического многостраничного сайта «Кодекс детства».
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
  REGIONS,
  TOPICS,
  TOPICS_BY_SLUG,
  topicUrl,
  sectionUrl,
  topicsOfSection,
  validateContent,
} from '../content/index.mjs'
import { NEWS } from '../content/news.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

const SITE = {
  origin: 'https://kodeksdetstva.ru',
  name: 'Кодекс детства',
  tagline: 'родителям и подросткам о правах, безопасности и помощи',
  description:
    'Справочник для родителей и подростков: права ребёнка простым языком, защита от насилия и травли, безопасность, психика, здоровье, закон. По каждой ситуации — что делать по шагам, что говорит закон и куда обратиться.',
  ogImage: '/og-cover.png',
  ogImageW: 1200,
  ogImageH: 630,
  logo: '/icons/icon-512.png',
}

// Организация-издатель — общий узел для JSON-LD (нужен Google для rich results)
function orgNode() {
  return {
    '@type': 'Organization',
    name: SITE.name,
    url: SITE.origin + '/',
    logo: {
      '@type': 'ImageObject',
      url: SITE.origin + SITE.logo,
      width: 512,
      height: 512,
    },
  }
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

const xmlEsc = (s = '') =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

function telHref(tel) {
  return 'tel:' + String(tel).replace(/[^\d+]/g, '')
}

// ─── транслитерация для авто-слагов новостей (когда бот не задал свой) ──
const TRANSLIT_MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}
function slugify(s) {
  return String(s)
    .toLowerCase()
    .split('')
    .map((ch) => (ch in TRANSLIT_MAP ? TRANSLIT_MAP[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
function newsItemSlug(item) {
  return item.slug || `${item.date}-${slugify(item.title)}`
}
function newsItemUrl(item) {
  return `/novosti/${newsItemSlug(item)}/`
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
function layout({ title, description, canonicalPath, bodyClass = '', jsonLd = [], main, noindex = false, accent = '', data = {}, image = SITE.ogImage, ogType = 'website', modifiedTime = '' }) {
  const dataAttrs = Object.entries(data)
    .map(([k, v]) => ` data-${k}="${attr(v)}"`)
    .join('')
  const canonical = SITE.origin + canonicalPath
  const ogImg = SITE.origin + (image || SITE.ogImage)
  const ld = jsonLd
    .map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`)
    .join('\n')
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<!-- Yandex.Metrika counter (загружается только после согласия на cookies) -->
<script type="text/javascript">
  window.kdLoadMetrika = function () {
    if (window.__kdMetrikaLoaded) return;
    window.__kdMetrikaLoaded = true;
    (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
    })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=112437788', 'ym');
    ym(112437788, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
  };
  try { if (localStorage.getItem('kd_cookie_consent') === '1') window.kdLoadMetrika(); } catch (e) {}
</script>
<!-- /Yandex.Metrika counter -->
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${attr(canonical)}">
${noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${attr(SITE.name)}">${ogType === 'article' && modifiedTime ? `\n<meta property="article:modified_time" content="${attr(modifiedTime)}">\n<meta property="article:published_time" content="${attr(modifiedTime)}">` : ''}
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${attr(canonical)}">
<meta property="og:image" content="${attr(ogImg)}">
<meta property="og:image:secure_url" content="${attr(ogImg)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="${SITE.ogImageW}">
<meta property="og:image:height" content="${SITE.ogImageH}">
<meta property="og:image:alt" content="${attr(SITE.name + ' — справочник о правах и безопасности ребёнка')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(description)}">
<meta name="twitter:image" content="${attr(ogImg)}">
<meta name="theme-color" content="#3a6b5f">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${attr(SITE.name)}">
<link rel="alternate" type="application/rss+xml" title="${attr(SITE.name)} — новости" href="/novosti/rss.xml">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/styles.css${V}">
<script async src="https://telegram.org/js/telegram-web-app.js"></script>
${ld}
</head>
<body class="${bodyClass}"${accent ? ` style="--sec:${accent}"` : ''}${dataAttrs}>
<a class="skip" href="#main">К содержанию</a>
<header class="site-head">
  <div class="head-inner">
    <details class="menu" id="menu">
      <summary class="menu-btn" aria-label="Меню разделов">☰</summary>
      <nav class="menu-panel" aria-label="Разделы">
        <a class="menu-home" href="/">На главную</a>
        <p class="menu-h">Разделы</p>
        <ul>
          ${SECTIONS.map(
            (s) =>
              `<li><a href="${sectionUrl(s)}" style="--sec:${s.accent}"><span class="menu-i" aria-hidden="true">${s.icon}</span> ${esc(s.title)} <b>${topicsOfSection(s.id).length}</b></a></li>`,
          ).join('')}
        </ul>
        <p class="menu-h">Ещё</p>
        <ul>
          <li><a href="/pomoshch/">🆘 Помощь сейчас</a></li>
          <li><a href="/tebe/">🧒 Тебе (подростку)</a></li>
          <li><a href="/kontakty/">📞 Все контакты</a></li>
          <li><a href="/poisk/">🔎 Поиск по ситуации</a></li>
          <li><a href="/regiony/">📍 Регионы</a></li>
          <li><a href="/novosti/">📰 Новости</a></li>
          <li><a href="/moe/">⭐ Моё (закладки и история)</a></li>
          <li><a href="/o-proekte/">О проекте</a></li>
          <li><a href="/politika/">Политика обработки данных</a></li>
        </ul>
      </nav>
    </details>
    <a class="logo" href="/"><img class="logo-mark" src="/favicon.svg" alt="" width="24" height="24"><span>${esc(SITE.name)}</span></a>
    <div class="head-actions">
      <button type="button" class="reload-btn" data-reload aria-label="Обновить страницу и сбросить кэш" title="Обновить: сбросить кэш и перезагрузить эту страницу">↻</button>
      <a class="help-btn" href="/pomoshch/" aria-label="Помощь сейчас"><span class="help-btn-i" aria-hidden="true">🆘</span><span class="help-btn-t">Помощь сейчас</span></a>
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
    <a href="/tebe/">Тебе</a>
    <a href="/kontakty/">Все контакты</a>
    <a href="/poisk/">Поиск</a>
    <a href="/moe/">Моё</a>
    <a href="/regiony/">Регионы</a>
    <a href="/novosti/">Новости</a>
    <a href="/o-proekte/">О проекте</a>
  </nav>
  <div class="foot-contacts">
    <p class="foot-c-title">Связаться с нами</p>
    <p><a href="mailto:info@kodeksdetstva.ru">info@kodeksdetstva.ru</a> — вопросы, предложения, неточности в материалах.</p>
    <p><a href="https://t.me/Reborn_Lab" target="_blank" rel="noopener noreferrer">Telegram: @Reborn_Lab</a> — если письмо не дойдёт, можно написать сюда.</p>
    <p class="foot-tg"><a href="https://t.me/kodeksdetstva_bot/kdbot" target="_blank" rel="noopener noreferrer">📱 Открыть в Telegram</a> — та же справка в виде мини-приложения.</p>
    <p class="foot-tg"><a href="https://max.ru/se14282409_bot" target="_blank" rel="noopener noreferrer">💬 Открыть в MAX</a> — та же справка в виде бота с поиском по темам.</p>
    <p class="foot-c-help">Срочная помощь ребёнку: <a href="tel:112">112</a> · детский телефон доверия <a href="tel:+78002000122">8&nbsp;800&nbsp;2000&nbsp;122</a> (круглосуточно, бесплатно). Больше — на странице <a href="/pomoshch/">«Помощь сейчас»</a>.</p>
  </div>
  <p class="foot-disclaimer"><span class="age-mark">18+</span> Справочно-просветительские материалы для родителей и подростков; не пропаганда и не инструктаж.
  Предоставляются «как есть», без гарантий, и не заменяют консультацию юриста, врача или психолога. Ссылки на нормы даны для ориентира и требуют проверки на актуальность.
  Нашли ошибку — напишите на <a href="mailto:info@kodeksdetstva.ru">info@kodeksdetstva.ru</a>. Правовой статус и маркировка — на странице <a href="/o-proekte/">«О проекте»</a>. В острой ситуации сразу обращайтесь за живой помощью.</p>
  <p class="foot-disclaimer">Независимый проект. Не является государственным ресурсом и не связан с органами власти или с законодательной инициативой о «Кодексе детства».
  <a href="/politika/">Политика обработки персональных данных</a>.</p>
</footer>
<div class="cookie-bar" id="cookie-bar" hidden>
  <p>Мы хотим подключить cookies и сервис Яндекс.Метрика, чтобы видеть, как люди пользуются справочником, и делать его удобнее. <b>«Принять»</b> — разрешить аналитику; <b>«Отклонить»</b> — не включать её, сайт будет работать так же. Подробнее — в <a href="/politika/">Политике обработки персональных данных</a>.</p>
  <div class="cookie-actions">
    <button type="button" id="cookie-accept" class="btn">Принять</button>
    <button type="button" id="cookie-decline" class="btn btn-ghost">Отклонить</button>
  </div>
</div>
<script>
(function () {
  var KEY = 'kd_cookie_consent';
  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) {}
  var bar = document.getElementById('cookie-bar');
  if (!bar) return;
  if (stored === '1' || stored === '0') { bar.hidden = true; return; }
  bar.hidden = false;
  function decide(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
    bar.hidden = true;
    if (v === '1' && typeof window.kdLoadMetrika === 'function') window.kdLoadMetrika();
  }
  var a = document.getElementById('cookie-accept');
  var d = document.getElementById('cookie-decline');
  if (a) a.addEventListener('click', function () { decide('1'); });
  if (d) d.addEventListener('click', function () { decide('0'); });
})();
</script>
<script src="/assets/nav.js${V}" defer></script>
<script src="/assets/tg.js${V}" defer></script>
</body>
</html>`
}

function breadcrumbs(items) {
  // items: [{name, url, icon?}] последний — текущая страница без ссылки
  const parts = items
    .map((it, i) => {
      const label = (it.icon ? `<span aria-hidden="true">${it.icon}</span> ` : '') + esc(it.name)
      return it.url && i < items.length - 1
        ? `<a href="${attr(it.url)}">${label}</a>`
        : `<span aria-current="page">${label}</span>`
    })
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
    (s) => `<li class="sec-card" style="--sec:${s.accent}">
      <a class="sec-card-head" href="${sectionUrl(s)}">
        <span class="sec-card-txt">
          <span class="sec-title"><span class="sec-emoji" aria-hidden="true">${s.icon}</span> ${esc(s.title)}</span>
          <span class="sec-lead">${esc(s.lead)}</span>
          <span class="sec-open">Все темы раздела (${topicsOfSection(s.id).length}) →</span>
        </span>
        <span class="tc-go" aria-hidden="true">›</span>
      </a>
      <ul class="sec-topics">${topicsOfSection(s.id)
        .slice(0, 6)
        .map((t) => `<li><a href="${topicUrl(t)}">${esc(t.title)}</a>${t.urgent ? ' <b class="u">срочное</b>' : ''}</li>`)
        .join('')}</ul>
    </li>`,
  ).join('')

  const main = `
<section class="hero">
  <h1>${esc(SITE.name)} — ${esc(SITE.tagline)}</h1>
  <p class="hero-lead">Понятные разборы трудных ситуаций — и для родителей, и для самих подростков.
  Что происходит, что говорит закон, что делать по шагам и куда обратиться. По каждой теме — отдельная страница со своим адресом, её можно сохранить в закладки и переслать.</p>
  <p class="hero-lead hero-lead2">Родителям — как защитить ребёнка и не сломать его «из лучших побуждений». Подросткам — что делать, если тяжело, страшно или несправедливо, и к кому пойти.</p>
  <p class="hero-lead hero-lead3">И не только о тревогах: отдельный раздел — про <a href="/radost-detstva/">радость, развитие и будущее ребёнка</a> 🌻.</p>
  <div class="hero-cta">
    <a class="btn btn-danger" href="/pomoshch/">🆘 Нужна помощь прямо сейчас</a>
    <a class="btn" href="/poisk/">🔎 Найти свою ситуацию</a>
    <a class="btn" href="/tebe/">🧒 Ты подросток? Тебе сюда</a>
  </div>
  <p class="hero-flag"><span class="ic">🚩</span> Внутри тем помечены <b>красные флаги</b> — сигналы, при которых нельзя ждать: дальше может быть очень плохо.</p>
</section>
<section class="home-search-box" aria-label="Поиск по ситуации">
  <h2>🔎 Найдите свою ситуацию</h2>
  <p>Опишите простыми словами, что случилось — поиск подберёт подходящие темы.</p>
  <form class="search-form home-search" role="search" onsubmit="return false">
    <input type="search" id="q" name="q" placeholder="«травят в школе», «не хочет жить», «забрал второй родитель»…" autocomplete="off">
  </form>
  <ul id="results" class="search-results" aria-live="polite"></ul>
</section>
<h2 class="sec-h">Разделы</h2>
<nav class="sec-nav" aria-label="Быстрый переход по разделам">
  ${SECTIONS.map(
    (s) => `<a class="sec-chip" href="${sectionUrl(s)}" style="--sec:${s.accent}"><span class="sec-chip-i" aria-hidden="true">${s.icon}</span><span>${esc(s.title)}</span><span class="sec-chip-n">${topicsOfSection(s.id).length}</span></a>`,
  ).join('')}
</nav>
<h2 class="sec-h">Разделы — подробно</h2>
<ul class="sec-list">${sectionsHtml}</ul>
<script src="/assets/search.js${V}" defer></script>
<section class="resp-note">
  <h2>Кто за что отвечает</h2>
  <p>Безопасность и счастье ребёнка — прежде всего зона ответственности родителя. Государство и его органы помогают в своих пределах: полиция и Следственный комитет — по преступлениям, опека и КДН — по защите детей, надзорные органы — по нарушениям учреждений. Ниже — <a href="/kontakty/">полный справочник служб</a> с кликабельными телефонами и ссылками.</p>
</section>`

  return layout({
    title: `${SITE.name} — родителям и подросткам о правах и безопасности ребёнка`,
    description: SITE.description,
    canonicalPath: '/',
    bodyClass: 'page-home',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE.name,
        alternateName: 'kodeksdetstva.ru',
        url: SITE.origin + '/',
        inLanguage: 'ru-RU',
        description: SITE.description,
        publisher: orgNode(),
        potentialAction: {
          '@type': 'SearchAction',
          target: SITE.origin + '/poisk/?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@context': 'https://schema.org',
        ...orgNode(),
        description: SITE.description,
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
        <span class="tc-body">
          <span class="tc-title">${esc(t.title)}</span>
          <span class="tc-desc">${esc(t.seoDescription)}</span>
          <span class="tc-meta">${t.urgent ? '<b class="u">срочная тема</b> · ' : ''}${
        t.status === 'planned' ? 'кратко, дополняется' : 'полный разбор'
      } · <span class="tc-open">открыть →</span></span>
        </span>
        <span class="tc-go" aria-hidden="true">›</span>
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
<h1><span class="sec-emoji" aria-hidden="true">${s.icon}</span> ${esc(s.title)}</h1>
<p class="frame">${esc(s.frame)}</p>
<ul class="topic-list">${list}</ul>`

  return layout({
    title: `${s.title} — ${SITE.name}`,
    description: `${s.lead} ${s.frame}`.slice(0, 300),
    canonicalPath: sectionUrl(s),
    bodyClass: 'page-section',
    accent: s.accent,
    jsonLd: [breadcrumbLd(crumbs)],
    main,
  })
}

function renderTopic(t) {
  const s = SECTIONS_BY_ID[t.sectionId]
  const crumbs = [
    { name: 'Главная', url: '/' },
    { name: s.title, url: sectionUrl(s), icon: s.icon },
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
        <p class="tpl-lead">Кнопки — сразу под названием: <b>✏️ заполнить онлайн</b> (подставит ваши данные в текст прямо здесь), затем <b>⬇️ скачать файл</b> (откроется в Word) или <b>📋 скопировать текст</b>. Можно и просто заполнить поля в квадратных скобках вручную. Актуально на <b>${esc(BUILD_MONTH)}</b> — требования меняются, сверяйте с сайтом ведомства.</p>
        ${t.templates
          .map(
            (tpl, i) => `<article class="tpl">
            <h3 class="tpl-title"><span aria-hidden="true">📄</span> ${esc(tpl.title)}</h3>
            <div class="tpl-actions">
              <button class="btn btn-fill" type="button" data-fill aria-expanded="false">✏️ Заполнить онлайн</button>
              <button class="btn btn-doc" type="button" data-doc data-name="${attr(t.slug + '-dok-' + (i + 1) + '.doc')}" data-doctitle="${attr(tpl.title)}">⬇️ Скачать .doc</button>
              <button class="btn btn-copy" type="button" data-copy>📋 Скопировать текст</button>
            </div>
            ${tpl.to ? `<p class="tpl-meta"><b>Кому:</b> ${esc(tpl.to)}</p>` : ''}
            ${tpl.where ? `<p class="tpl-meta"><b>Куда подать или принести:</b> ${esc(tpl.where)}</p>` : ''}
            <div class="tpl-fill" data-fill-panel hidden></div>
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
    <div class="topic-actions">
      <button type="button" class="ta-btn" data-bookmark>☆ В закладки</button>
      <button type="button" class="ta-btn" data-share>↗ Поделиться</button>
    </div>
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
    accent: s.accent,
    ogType: 'article',
    modifiedTime: t.updated || '',
    data: { 'topic-title': t.title, 'topic-section': s.title },
    jsonLd: [
      breadcrumbLd(crumbs),
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: t.title,
        description: t.seoDescription,
        inLanguage: 'ru-RU',
        ...(t.updated ? { datePublished: t.updated, dateModified: t.updated } : {}),
        mainEntityOfPage: SITE.origin + topicUrl(t),
        image: [SITE.origin + SITE.ogImage],
        articleSection: s.title,
        about: s.title,
        keywords: (t.keywords || []).join(', '),
        isAccessibleForFree: true,
        author: orgNode(),
        publisher: orgNode(),
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
<section class="teen-box" id="podrostku">
  <h2>🧒 Если ты подросток и тебе нужна помощь</h2>
  <p>Тебе тяжело, страшно, дома бьют, травят, шантажируют, не хочется жить? Это не твоя вина, и тебе есть к кому обратиться.</p>
  <a class="big-tel" href="tel:+78002000122">☎ 8 800 2000 122</a>
  <p>Детский телефон доверия — бесплатно, анонимно, круглосуточно. Можно просто рассказать, что происходит, и спросить, что делать.</p>
  <div class="teen-links">
    ${['rebenku-doma-nebezopasno', 'suicidalnye-signaly', 'travlya-rebenok-molchit', 'sextortion', 'dopros-nesovershennoletnego', 'pervaya-lyubov-otverzhenie']
      .map((slug) => TOPICS_BY_SLUG[slug])
      .filter(Boolean)
      .map((t) => `<a href="${topicUrl(t)}">${esc(t.title)}</a>`)
      .join('')}
  </div>
  <p><a class="btn" href="/tebe/">🧒 Открыть страницу «Тебе» — все ситуации по разделам</a></p>
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

function renderTebe() {
  const groups = [
    ['Дома', 'Бьют, унижают, пьют, не замечают, дома невыносимо.', [
      'rebenku-doma-nebezopasno', 'kak-vybratsya-iz-tyazheloy-semyi', 'zavisimosti-roditeley', 'nasilie-mezhdu-roditelyami', 'uhod-iz-doma',
    ]],
    ['В школе', 'Травят, придирается учитель, невыносимая нагрузка.', [
      'travlya-rebenok-molchit', 'kiberbulling', 'travlya-uchitel', 'shkolnyy-stress', 'ekzameny-oge-ege', 'pobory-v-shkole',
    ]],
    ['В сети', 'Пишет взрослый, требуют фото, зовут на «лёгкие деньги».', [
      'gruming-onlayn', 'sextortion', 'verbovka-legkie-dengi', 'destruktivnye-soobshchestva', 'finansovye-lovushki', 'privatnost-cifrovoy-sled',
    ]],
    ['Внутри тебя', 'Не хочется жить, срывы, режешь себя, еда, пустота, злость.', [
      'suicidalnye-signaly', 'selfharm', 'depressiya-podrostka', 'rpp', 'strahi-i-trevozhnost', 'odinochestvo', 'mest-i-obida', 'gore-i-poterya',
    ]],
    ['Любовь, тело, отношения', 'Отвергли, в отношениях плохо, залёт, вопросы про тело.', [
      'pervaya-lyubov-otverzhenie', 'toksichnye-otnosheniya', 'rannie-otnosheniya-i-zakon', 'podrostkovaya-kontratseptsiya', 'rannyaya-beremennost', 'telo-ves-vneshnost',
    ]],
    ['Полиция и закон', 'За что судят, задержали, вызвали на допрос, КДН, комендантский час, повестка.', [
      'ugolovnaya-otvetstvennost-podrostka', 'dopros-nesovershennoletnego', 'zaderzhanie-dosmotr', 'uchet-kdn', 'komendantskiy-chas', 'zakladki-veshchestva', 'prizyv-i-voenkomat',
    ]],
    ['Вещества и зависимости', 'Вейп, алкоголь в компании, ставки и игры затянули.', [
      'veypy-nikotin', 'alkogol-i-kompanii', 'zavisimost-ot-igr-i-stavok', 'pochemu-tyanet-na-zapretnoe',
    ]],
    ['Если ты из детского дома', 'Скоро выпуск, документы, жильё, поиск родных, права в учреждении.', [
      'vypusknik-detskogo-doma', 'rebenok-v-detskom-dome-prava', 'poisk-biologicheskih-roditeley',
    ]],
  ]

  const groupsHtml = groups
    .map(([title, lead, slugs]) => {
      const cards = slugs
        .map((slug) => TOPICS_BY_SLUG[slug])
        .filter(Boolean)
        .map((t) => `<li><a href="${topicUrl(t)}"><span class="tebe-c-t">${esc(t.title)}</span><span class="tc-go" aria-hidden="true">›</span></a></li>`)
        .join('')
      if (!cards) return ''
      return `<section class="tebe-group">
        <h3>${esc(title)}</h3>
        <p class="tebe-g-lead">${esc(lead)}</p>
        <ul class="tebe-cards">${cards}</ul>
      </section>`
    })
    .join('')

  const main = `
${breadcrumbs([{ name: 'Главная', url: '/' }, { name: 'Тебе', url: '/tebe/' }])}
<h1>Тебе — если тяжело, страшно или несправедливо</h1>
<p class="frame">Эта страница для тебя, подросток. Без нотаций и «сам виноват». Здесь коротко: что происходит, какие у тебя права и что можно сделать. Здесь открыто говорят о тяжёлых вещах, но нигде нет описания того, как причинить себе вред, — только как распознать беду и куда обратиться.</p>

<section class="teen-box tebe-now">
  <h2>Если прямо сейчас опасно</h2>
  <p>Тебя бьют, душат, угрожают, ты ранен или не можешь оставаться там, где ты есть — звони:</p>
  <a class="big-tel" href="tel:112">☎ 112</a>
  <p>Не опасно прямо сейчас, но тяжело, страшно, не с кем поговорить:</p>
  <a class="big-tel" href="tel:+78002000122">☎ 8 800 2000 122</a>
  <p>Детский телефон доверия — <b>бесплатно, анонимно, круглосуточно</b>. Тебя не «сдадут»: можно просто рассказать и спросить, что делать. Звонок не видно в детализации у родителей.</p>
</section>

<h2 class="sec-h">Выбери, что происходит</h2>
${groupsHtml}

<section class="tblock">
  <p>Не нашёл свою ситуацию? Попробуй <a href="/poisk/">поиск по сайту</a> или загляни в <a href="/kontakty/">список всех контактов</a>. Если решаешь, кому доверять из взрослых, — начни с того, кто тебя обычно не высмеивает: классный руководитель, школьный психолог, тренер, родитель друга, родственник.</p>
</section>`

  return layout({
    title: `Тебе, подростку: что делать, если тяжело — ${SITE.name}`,
    description:
      'Страница для подростков: что делать, если бьют дома, травят в школе, шантажируют в сети, не хочется жить, проблемы с полицией или в отношениях. Права и телефоны помощи. Анонимно.',
    canonicalPath: '/tebe/',
    bodyClass: 'page-tebe',
    jsonLd: [breadcrumbLd([{ name: 'Главная', url: '/' }, { name: 'Тебе', url: '/tebe/' }])],
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
Федеральные линии сверены; часть региональных контактов помечена значком ⚠️ — их стоит перепроверить на официальном сайте.</p>

<section class="region-box" id="region-box">
  <div class="region-bar">
    <span class="region-label">Ваш регион: <b id="region-name">определяем…</b></span>
    <button type="button" class="ta-btn" id="region-change">сменить</button>
  </div>
  <div id="region-picker" class="region-picker" hidden></div>
  <div id="region-contacts"></div>
  <p class="foot-disclaimer">Кроме федеральных линий, у регионов есть свои: уполномоченный по правам ребёнка, кризисные центры, выплаты. Полный список регионов — на странице <a href="/regiony/">«Регионы»</a>. Регион можно определить по IP или выбрать вручную; выбор хранится только в этом браузере.</p>
</section>

${sections}
<script src="/assets/nav.js${V}" defer></script>`

  return layout({
    title: `Все контакты помощи детям и родителям — ${SITE.name}`,
    description:
      'Справочник служб: экстренные телефоны, горячие линии, государственные органы (МВД, СК, ФСБ, прокуратура, Роскомнадзор, Роспотребнадзор, уполномоченный по правам ребёнка), НКО, региональные контакты. Кликабельные телефоны и ссылки.',
    canonicalPath: '/kontakty/',
    bodyClass: 'page-contacts',
    jsonLd: [breadcrumbLd([{ name: 'Главная', url: '/' }, { name: 'Все контакты', url: '/kontakty/' }])],
    main,
  })
}

function regionContactHtml(c) {
  const acts = []
  if (c.tel) acts.push(`<a class="c-act c-tel" href="${attr(telHref(c.tel))}">☎ ${esc(c.telDisplay || c.tel)}</a>`)
  if (c.email) acts.push(`<a class="c-act c-mail" href="mailto:${attr(c.email)}">✉ ${esc(c.email)}</a>`)
  if (c.site) acts.push(`<a class="c-act c-site" href="${attr(c.site)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(c.siteDisplay || c.site)}</a>`)
  return `<li class="contact">
    <div class="contact-name">${esc(c.name)}</div>
    <div class="contact-when"><b>Когда обращаться:</b> ${esc(c.when)}</div>
    ${acts.length ? `<div class="contact-actions">${acts.join('')}</div>` : ''}
    ${c.verify ? '<div class="contact-verify">⚠️ Контакт нужно сверить с официальным сайтом.</div>' : ''}
  </li>`
}

function renderRegiony() {
  const list = REGIONS.map(
    (r) => `<section class="tblock contacts" id="reg-${r.id}">
      <h2>${esc(r.name)}</h2>
      ${r.note ? `<p class="frame">${esc(r.note)}</p>` : ''}
      <p class="rf-note">Детский телефон доверия <a href="tel:+78002000122">8&nbsp;800&nbsp;2000&nbsp;122</a> работает и здесь — круглосуточно, бесплатно, анонимно.</p>
      <ul class="contact-list">${r.contacts.map(regionContactHtml).join('')}</ul>
    </section>`,
  ).join('')

  const main = `
${breadcrumbs([{ name: 'Главная', url: '/' }, { name: 'Регионы', url: '/regiony/' }])}
<h1>Региональные контакты: города-миллионники, Москва и Московская область</h1>
<p class="frame">Кроме федеральных линий и фондов, у каждого региона есть свой уполномоченный по правам ребёнка, комиссии, кризисные центры и меры поддержки семей. Ниже — как их найти по вашему региону. Данные наполняются постепенно; помеченные ⚠️ контакты сверяйте с официальными сайтами.</p>
<nav class="sec-nav">${REGIONS.map((r) => `<a class="sec-chip" href="#reg-${r.id}">${esc(r.tag)}</a>`).join('')}</nav>
${list}`

  return layout({
    title: `Региональные контакты помощи детям — уполномоченные, кризисные центры — ${SITE.name}`,
    description:
      'Куда обращаться в вашем регионе: уполномоченный по правам ребёнка, КДН и опека, кризисные центры, региональные меры поддержки семей. Москва, Московская область, Санкт-Петербург и города-миллионники.',
    canonicalPath: '/regiony/',
    bodyClass: 'page-regiony',
    jsonLd: [breadcrumbLd([{ name: 'Главная', url: '/' }, { name: 'Регионы', url: '/regiony/' }])],
    main,
  })
}

function newsRelatedHtml(n) {
  const rel = (n.relatedTopics || [])
    .map((slug) => TOPICS_BY_SLUG[slug])
    .filter(Boolean)
    .map((t) => `<a href="${topicUrl(t)}">${esc(t.title)}</a>`)
    .join(', ')
  return rel ? `<p class="news-related">Читать по теме: ${rel}</p>` : ''
}

function renderNovosti() {
  const sorted = NEWS.slice().sort((a, b) => (a.date < b.date ? 1 : -1))
  const list = sorted
    .map(
      (n) => `<li class="news-item">
        <a href="${newsItemUrl(n)}">
          <p class="news-date">${esc(n.date)}</p>
          <h2>${esc(n.title)}</h2>
          <p>${esc(n.summary)}</p>
          <span class="news-open">Читать целиком →</span>
        </a>
      </li>`,
    )
    .join('')

  const main = `
${breadcrumbs([{ name: 'Главная', url: '/' }, { name: 'Новости', url: '/novosti/' }])}
<h1>Новости: законы и государственные инициативы о детях</h1>
<p class="frame">Только законодательство — новые законы, поправки, официальные инициативы профильных ведомств и Госдумы, касающиеся детей. Без криминальной хроники и трагедий: этого на сайте сознательно нет. У каждой новости — прямая ссылка на первоисточник, проверяйте актуальность там же.</p>
<p class="news-subscribe"><a class="btn btn-ghost" href="/novosti/rss.xml">📶 Подписаться (RSS)</a> — добавьте ссылку в любой RSS-читалку (Inoreader, Feedly и т. п.), новые записи будут приходить туда автоматически.</p>
${sorted.length ? `<ul class="news-list">${list}</ul>` : '<p class="news-empty">Пока новостей нет — раздел новый, наполняется по мере появления значимых изменений в законодательстве.</p>'}`

  return layout({
    title: `Новости: законы и инициативы о детях — ${SITE.name}`,
    description: 'Новые законы, поправки и государственные инициативы, касающиеся детей и семьи в России. Без криминальной хроники — только законодательство, со ссылками на первоисточники.',
    canonicalPath: '/novosti/',
    bodyClass: 'page-novosti',
    jsonLd: [breadcrumbLd([{ name: 'Главная', url: '/' }, { name: 'Новости', url: '/novosti/' }])],
    main,
  })
}

function renderNewsItem(n) {
  const main = `
${breadcrumbs([{ name: 'Главная', url: '/' }, { name: 'Новости', url: '/novosti/' }, { name: n.title, url: newsItemUrl(n) }])}
<article>
  <p class="news-date">${esc(n.date)}</p>
  <h1>${esc(n.title)}</h1>
  <p>${esc(n.summary)}</p>
  <p class="news-source">Источник: <a href="${attr(n.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(n.sourceName)}</a></p>
  ${newsRelatedHtml(n)}
</article>
<p><a href="/novosti/">← Все новости</a></p>`

  return layout({
    title: `${n.title} — Новости — ${SITE.name}`,
    description: n.summary.slice(0, 170),
    canonicalPath: newsItemUrl(n),
    bodyClass: 'page-news-item',
    jsonLd: [
      breadcrumbLd([{ name: 'Главная', url: '/' }, { name: 'Новости', url: '/novosti/' }, { name: n.title, url: newsItemUrl(n) }]),
      {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: n.title,
        description: n.summary,
        datePublished: n.date,
        inLanguage: 'ru-RU',
        mainEntityOfPage: SITE.origin + newsItemUrl(n),
        publisher: orgNode(),
        isAccessibleForFree: true,
      },
    ],
    main,
  })
}

function buildNewsRss() {
  const sorted = NEWS.slice().sort((a, b) => (a.date < b.date ? 1 : -1))
  const items = sorted
    .map((n) => {
      const url = SITE.origin + newsItemUrl(n)
      const pubDate = new Date(n.date + 'T09:00:00Z').toUTCString()
      return `  <item>
    <title>${xmlEsc(n.title)}</title>
    <link>${xmlEsc(url)}</link>
    <guid isPermaLink="true">${xmlEsc(url)}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${xmlEsc(n.summary)}</description>
  </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${xmlEsc(SITE.name)} — новости о законах и детях</title>
  <link>${xmlEsc(SITE.origin + '/novosti/')}</link>
  <description>Новые законы, поправки и государственные инициативы, касающиеся детей и семьи в России. Без криминальной хроники — только законодательство.</description>
  <language>ru</language>
${items}
</channel>
</rss>
`
}

function renderAbout() {
  const main = `
${breadcrumbs([{ name: 'Главная', url: '/' }, { name: 'О проекте', url: '/o-proekte/' }])}
<h1>О проекте</h1>
<p class="frame">Ребёнок — не собственность родителя и не его продолжение. Это отдельный человек с собственным достоинством,
данный родителю под опеку, а не во владение. На дитя не кричат, не поднимают руку, не ломают его волю «для его же блага».</p>
<p>«${esc(SITE.name)}» — справочник и для родителей, и для самих подростков. Родителям — чтобы растить детей в любви и
уважении и знать, как поступить, когда школа отмахивается от травли, в семье срываются на крик, врач не объясняет,
подросток отдаляется и рискует собой. Подросткам — чтобы понимать свои права и знать, что делать и к кому пойти,
если дома тяжело, в школе травят, страшно или несправедливо.</p>
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
<h2>Как готовятся материалы и почему им можно доверять — с оговорками</h2>
<p>Тексты сайта пишутся с помощью ИИ (Claude), который сверяется с текстами законов и официальными источниками
(«Консультант Плюс», «Гарант», сайты профильных ведомств) и старается приводить формулировки норм дословно, со ссылкой
на статью. Это не «пересказ по памяти из интернета» и не выдумка — но и не гарантия отсутствия ошибок: ИИ может
устареть в знаниях, законы меняются, а формулировка нормы — тонкая вещь, где легко ошибиться в нюансе.</p>
<p><b>Поэтому прямо и без обтекаемости:</b> материалы сайта предоставляются «как есть», носят справочно-просветительский
характер, не являются юридической, медицинской или психологической консультацией и не создают никаких обязательств
между вами и Оператором сайта. Перед тем как принимать решение или совершать действия по мотивам прочитанного —
сверьте норму с актуальной редакцией закона (например, на <a href="https://www.consultant.ru/" target="_blank" rel="noopener noreferrer">consultant.ru</a>)
и, если ситуация серьёзная, проконсультируйтесь с живым юристом, врачом или психологом. Оператор не несёт
ответственности за решения, принятые исключительно на основании материалов сайта без такой проверки.</p>
<p>Сайт некоммерческий и бесплатный: мы не оказываем платных услуг и не заключаем с посетителем никакого договора,
из которого мог бы возникнуть иск потребителя. Если вы нашли неточность, устаревшую норму или ошибку — это самый
ценный сигнал, который вы можете нам дать: напишите на <a href="mailto:info@kodeksdetstva.ru">info@kodeksdetstva.ru</a>,
и мы проверим и поправим, обычно в течение нескольких дней. Раз в месяц мы дополнительно сверяем даты последнего
обновления тем и работоспособность ссылок на источники — это не отменяет ручную проверку, но снижает число «протухших»
данных.</p>
<h2>Важно</h2>
<p>Приложение не заменяет юриста, врача или психолога и не ставит диагнозов. Ссылки на нормы даны для ориентира и требуют
проверки на актуальность. В острой ситуации — сразу живая помощь, телефоны на странице <a href="/pomoshch/">«Помощь сейчас»</a>.</p>
<h2>Правовой статус материалов и возрастная маркировка <span class="age-mark">18+</span></h2>
<p>Материалы носят справочно-просветительский характер. Их цель — профилактика насилия и вреда и помощь ребёнку и родителю,
а не пропаганда или инструктаж. Значительная часть — это тексты и разъяснения нормативных актов и информация о работе
государственных органов; такая информация маркировке не подлежит (ст. 1 ч. 2, ст. 11 Федерального закона от 29.12.2010
№ 436-ФЗ «О защите детей от информации, причиняющей вред их здоровью и развитию»).</p>
<p>Тяжёлые темы (суицид и самоповреждение, вещества, сексуализированное насилие, прерывание беременности) разбираются
только с точки зрения распознавания, права и обращения за помощью. Здесь нет описания способов причинения себе вреда,
изготовления или употребления запрещённых веществ, нет призывов и одобрения — это прямо запрещено законом, и мы это
не делаем.</p>
<p>Знак <b>18+</b> поставлен как предупреждение о том, что здесь открыто обсуждаются взрослые и болезненные темы. Это не
запрет для подростков: если тебе сейчас тяжело или страшно, ты можешь пользоваться этими материалами и телефонами помощи
независимо от маркировки — начни со страницы <a href="/tebe/">«Тебе»</a> или позвони на детский телефон доверия
<a href="tel:+78002000122">8&nbsp;800&nbsp;2000&nbsp;122</a>.</p>
<p>Если материал показался вам нарушающим закон или содержащим неточность — напишите на
<a href="mailto:info@kodeksdetstva.ru">info@kodeksdetstva.ru</a>, мы разберёмся и поправим.</p>
<h2>Независимость</h2>
<p>«${esc(SITE.name)}» — независимый общественный проект. Он не является государственным ресурсом, не связан с органами
власти и не имеет отношения к обсуждаемой в Госдуме законодательной инициативе о «Кодексе детства». Совпадение названия
не означает никакой связи. Материалы готовятся на основе открытых источников и действующего законодательства.</p>
<h2>Данные и приватность</h2>
<p>Сайт использует cookies и сервис веб-аналитики Яндекс.Метрика, чтобы понимать, как посетители пользуются справочником.
Аналитика подключается только после вашего согласия (кнопка в нижней плашке). Что именно собирается и зачем —
в <a href="/politika/">Политике обработки персональных данных</a>. Формы заявлений заполняются прямо в браузере и
никуда не отправляются; закладки и история хранятся только в вашем устройстве.</p>`

  return layout({
    title: `О проекте — ${SITE.name}`,
    description:
      'Зачем нужен справочник «Кодекс детства», как устроена каждая страница и почему ответственность за безопасность ребёнка — прежде всего на семье.',
    canonicalPath: '/o-proekte/',
    bodyClass: 'page-about',
    jsonLd: [breadcrumbLd([{ name: 'Главная', url: '/' }, { name: 'О проекте', url: '/o-proekte/' }])],
    main,
  })
}

function renderPolitika() {
  const main = `
${breadcrumbs([{ name: 'Главная', url: '/' }, { name: 'Политика обработки персональных данных', url: '/politika/' }])}
<h1>Политика в отношении обработки персональных данных</h1>
<p class="frame">Действует для сайта <b>kodeksdetstva.ru</b> и его версии в виде Telegram-мини-приложения (<a href="https://t.me/kodeksdetstva_bot/kdbot" target="_blank" rel="noopener noreferrer">t.me/kodeksdetstva_bot/kdbot</a>). Последнее обновление: ${esc(BUILD_MONTH)}</p>

<h2>1. Общие положения</h2>
<p>Настоящая Политика определяет порядок обработки персональных данных и меры по обеспечению их безопасности на сайте
kodeksdetstva.ru (далее — Сайт) в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных».
Оператором обработки данных является владелец Сайта (далее — Оператор). Связь с Оператором:
<a href="mailto:info@kodeksdetstva.ru">info@kodeksdetstva.ru</a>.</p>
<p>Используя Сайт, посетитель подтверждает согласие с настоящей Политикой. При несогласии использование Сайта следует прекратить.</p>

<h2>2. Какие данные обрабатываются</h2>
<p>Оператор не собирает данные, позволяющие прямо идентифицировать личность, и не запрашивает у посетителей имя, телефон,
адрес и иные подобные сведения. Обрабатываются обезличенные технические данные, которые автоматически передаёт браузер:</p>
<ul>
  <li>IP-адрес, тип и версия браузера и операционной системы, язык, разрешение экрана;</li>
  <li>адрес страницы Сайта и адрес страницы-источника перехода (referrer);</li>
  <li>дата и время визита, действия на страницах (клики, прокрутка, переходы), в том числе запись сессии средствами Яндекс.Метрики (Вебвизор);</li>
  <li>файлы cookie и идентификаторы, которые сервис веб-аналитики использует для различения визитов.</li>
</ul>
<p>Данные, которые посетитель вводит в формы заявлений на Сайте, обрабатываются исключительно в браузере посетителя,
на сервер Оператора не передаются и Оператору недоступны. Закладки и история просмотров хранятся только в браузере
посетителя (localStorage) и никуда не отправляются.</p>

<h2>3. Цели обработки</h2>
<ul>
  <li>анализ посещаемости и поведения посетителей для улучшения содержания и удобства Сайта;</li>
  <li>выявление технических ошибок и проблем отображения;</li>
  <li>обеспечение работоспособности и безопасности Сайта (в том числе защита от автоматизированных запросов).</li>
</ul>

<h2>4. Правовые основания</h2>
<p>Обработка ведётся на основании согласия посетителя, выражаемого путём нажатия кнопки «Принять» в информационной
плашке о cookie, а также на основании законных интересов Оператора по обеспечению работы Сайта. До получения согласия
сервис веб-аналитики не загружается.</p>

<h2>5. Использование cookie и веб-аналитики</h2>
<p>Сайт использует сервис <b>Яндекс.Метрика</b>, предоставляемый ООО «ЯНДЕКС». Сервис использует cookie и технологию
Вебвизор (запись действий на странице в обезличенном виде). Условия обработки данных Яндекс.Метрикой —
на сайте Яндекса (<a href="https://yandex.ru/legal/metrica_agreement/" target="_blank" rel="noopener noreferrer">yandex.ru/legal/metrica_agreement</a>).
Отключить сбор можно, нажав «Отклонить» в плашке, либо запретив cookie и включив режим «Не отслеживать» в браузере,
либо установив блокировщик Яндекс.Метрики.</p>

<h2>6. Передача данных третьим лицам</h2>
<p>Оператор не продаёт и не передаёт собранные данные третьим лицам, кроме передачи обезличенных данных сервису
Яндекс.Метрика как обработчику в описанных выше целях. Данные могут быть предоставлены государственным органам
по законному требованию.</p>

<h2>7. Сроки хранения</h2>
<p>Обезличенные данные веб-аналитики хранятся в течение срока, установленного сервисом Яндекс.Метрика. Значения в
localStorage (согласие, закладки, история, выбранный регион) хранятся в браузере посетителя до их удаления посетителем.</p>

<h2>8. Права посетителя</h2>
<p>Посетитель вправе отозвать согласие на обработку (нажав «Отклонить» или очистив данные сайта в браузере),
получить информацию об обработке своих данных и обратиться с жалобой в Роскомнадзор. Вопросы и обращения —
на <a href="mailto:info@kodeksdetstva.ru">info@kodeksdetstva.ru</a>.</p>

<h2>9. Дети</h2>
<p>Сайт носит справочно-просветительский характер и адресован в том числе несовершеннолетним. Оператор не собирает у
посетителей сведений, позволяющих их идентифицировать, и не ведёт профилей пользователей. Возрастная маркировка и
правовой статус материалов — на странице <a href="/o-proekte/">«О проекте»</a>.</p>

<h2>10. Изменения</h2>
<p>Оператор вправе изменять настоящую Политику. Актуальная редакция всегда доступна по адресу kodeksdetstva.ru/politika/.
Дата последнего обновления указана в начале страницы.</p>`

  return layout({
    title: `Политика обработки персональных данных — ${SITE.name}`,
    description:
      'Как сайт «Кодекс детства» обрабатывает данные: cookie и Яндекс.Метрика только после согласия, никакой идентификации личности, формы заполняются в браузере.',
    canonicalPath: '/politika/',
    bodyClass: 'page-politika',
    jsonLd: [breadcrumbLd([{ name: 'Главная', url: '/' }, { name: 'Политика обработки персональных данных', url: '/politika/' }])],
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

function renderMoe() {
  const main = `
${breadcrumbs([{ name: 'Главная', url: '/' }, { name: 'Моё', url: '/moe/' }])}
<h1>⭐ Моё: закладки и история</h1>
<p class="frame">Сохранённые темы и то, что вы недавно открывали, чтобы быстро вернуться. Хранится только в этом браузере, никуда не отправляется.</p>
<h2>Закладки</h2>
<ul id="moe-bm" class="moe-list"></ul>
<h2>Недавно открывали <button type="button" id="moe-clear" class="ta-btn">очистить</button></h2>
<ul id="moe-hist" class="moe-list"></ul>
<script src="/assets/nav.js${V}" defer></script>`

  return layout({
    title: `Моё: закладки и история — ${SITE.name}`,
    description: 'Сохранённые темы и история просмотров, чтобы быстро вернуться к нужному вопросу.',
    canonicalPath: '/moe/',
    bodyClass: 'page-moe',
    noindex: true,
    main,
  })
}

function render404() {
  const main = `
<h1>Страница не найдена</h1>
<p>Возможно, ссылка устарела. Начните с <a href="/">главной</a>, воспользуйтесь <a href="/poisk/">поиском</a>
или откройте <a href="/pomoshch/">«Помощь сейчас»</a>.</p>
<div class="ask-question"><p><b>Не нашли ответ на свой вопрос?</b> Задайте его — мы постараемся сформулировать ответ и добавить тему на сайт.</p>
<a class="btn btn-ghost" href="mailto:info@kodeksdetstva.ru?subject=${encodeURIComponent('Вопрос с сайта')}">✉️ Задать вопрос</a></div>`
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
Disallow: /moe/
Disallow: /api/

Sitemap: ${SITE.origin}/sitemap.xml
`

const MANIFEST = JSON.stringify({
  name: 'Кодекс детства — права и безопасность ребёнка',
  short_name: 'Кодекс детства',
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
  routes.push(await writePage('/tebe/', renderTebe()))
  routes.push(await writePage('/kontakty/', renderKontakty()))
  routes.push(await writePage('/o-proekte/', renderAbout()))
  routes.push(await writePage('/politika/', renderPolitika()))
  routes.push(await writePage('/poisk/', renderSearch()))
  routes.push(await writePage('/moe/', renderMoe()))
  routes.push(await writePage('/regiony/', renderRegiony()))
  routes.push(await writePage('/novosti/', renderNovosti()))
  for (const n of NEWS) routes.push(await writePage(newsItemUrl(n), renderNewsItem(n)))
  await writeFile(path.join(DIST, 'novosti', 'rss.xml'), buildNewsRss(), 'utf8')
  for (const s of SECTIONS) routes.push(await writePage(sectionUrl(s), renderSection(s)))
  for (const t of TOPICS) routes.push(await writePage(topicUrl(t), renderTopic(t)))

  await writeFile(path.join(DIST, '404.html'), render404(), 'utf8')

  // индекс поиска, регионы, sitemap, robots, manifest
  await writeFile(path.join(DIST, 'search-index.json'), JSON.stringify(buildSearchIndex()), 'utf8')
  await writeFile(
    path.join(DIST, 'regions.json'),
    JSON.stringify(REGIONS.map((r) => ({ id: r.id, name: r.name, tag: r.tag, cities: r.cities, contacts: r.contacts }))),
    'utf8',
  )
  const indexable = routes.filter((r) => r !== "/poisk/" && r !== "/moe/")
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
    '/assets/tg.js' + V,
    '/search-index.json',
    '/regions.json',
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
