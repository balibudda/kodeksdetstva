// Бот «Кодекс детства» в мессенджере MAX — лаунчер мини-приложения + поиск по темам.
// Зеркалит логику api/tg.js (Telegram), адаптировано под MAX Bot API.
//
// Вебхук: POST https://kodeksdetstva.ru/api/max
// Секреты — только в переменных окружения Vercel:
//   MAX_BOT_TOKEN       — токен бота (личный кабинет MAX для партнёров)
//   MAX_WEBHOOK_SECRET  — произвольная строка, передаётся в POST /subscriptions
//                          и сверяется с заголовком x-max-bot-api-secret
//
// ВАЖНО: сама подписка (POST /subscriptions на platform-api2.max.ru) — отдельный
// одноразовый шаг после деплоя, см. scripts/max-set-webhook.mjs. Встроенный
// bot.webhookCallback() из SDK здесь не используем: он сверяет req.url с путём,
// который сам же и генерирует (по умолчанию — хеш от токена), а в serverless-
// окружении Vercel это ненадёжно. Вместо этого разбираем апдейт вручную и
// напрямую вызываем bot.handleUpdate() — тот же метод, что дергает сам SDK.

import { Bot, Keyboard } from '@maxhub/max-bot-api'

const SITE = 'https://kodeksdetstva.ru'
const TOKEN = process.env.MAX_BOT_TOKEN
const SECRET = process.env.MAX_WEBHOOK_SECRET

// ── поисковый индекс сайта: /search-index.json, кэш в памяти функции ──
let _idx = null
let _idxAt = 0
async function loadIndex() {
  if (_idx && Date.now() - _idxAt < 10 * 60 * 1000) return _idx
  try {
    const r = await fetch(`${SITE}/search-index.json`, { headers: { 'cache-control': 'no-cache' } })
    if (r.ok) {
      _idx = await r.json()
      _idxAt = Date.now()
    }
  } catch (e) {}
  return _idx || []
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е')
}

function search(list, query, limit = 5) {
  const words = norm(query).split(/[^a-zа-я0-9]+/).filter((w) => w.length >= 2)
  if (!words.length) return []
  const scored = []
  for (const e of list) {
    const t = norm(e.t), k = norm(e.k), s = norm(e.s), d = norm(e.d), x = norm(e.x)
    let score = 0
    for (const w of words) {
      if (t.includes(w)) score += 5
      if (k.includes(w)) score += 3
      if (s.includes(w)) score += 2
      if (d.includes(w)) score += 1
      if (x.includes(w)) score += 0.5
    }
    if (norm(e.t).includes(norm(query))) score += 4
    if (score > 0) scored.push({ e, score: score + (e.urgent ? 0.3 : 0) })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((x) => x.e)
}

// payload из deep-link: «psihika__suicidalnye-signaly» → «/psihika/suicidalnye-signaly/»
function deepUrl(param) {
  if (!param) return SITE
  const path = String(param)
    .replace(/[^a-z0-9_-]/gi, '')
    .replace(/__/g, '/')
    .replace(/^\/+|\/+$/g, '')
  if (!path) return SITE
  return `${SITE}/${path}/`
}

function startKeyboard(url) {
  return Keyboard.inlineKeyboard([
    [Keyboard.button.openApp('🛡 Открыть «Кодекс детства»', url)],
    [Keyboard.button.openApp('🆘 Помощь сейчас', `${SITE}/pomoshch/`)],
    [Keyboard.button.openApp('🧒 Тебе (подростку)', `${SITE}/tebe/`)],
  ])
}

const GREETING =
  'Это «Кодекс детства» — справочник для родителей и подростков: права ребёнка, ' +
  'защита от насилия и травли, безопасность, психика, здоровье, закон.\n\n' +
  'Нажми кнопку ниже, чтобы открыть приложение, — там разделы и поиск, можно ' +
  'сохранять темы в закладки.\n\n' +
  'Или просто напиши мне любой запрос словами — например «травля» или ' +
  '«не хочет жить» — я подберу подходящие темы.\n\n' +
  '⚠️ Если ребёнку сейчас угрожает опасность — звони 112. Детский телефон ' +
  'доверия: 8 800 2000 122 (круглосуточно, бесплатно, анонимно).'

const bot = new Bot(TOKEN)

// SDK-обработчик по умолчанию логирует только апдейт, без текста самой ошибки —
// подставляем свой, чтобы в логах Vercel было видно реальную причину сбоя.
bot.catch((err, ctx) => {
  console.error('MAX bot handler error:', err && err.stack ? err.stack : err, 'update_type:', ctx?.update?.update_type)
})

bot.on('bot_started', async (ctx) => {
  const payload = ctx.startPayload || ''
  await ctx.reply(GREETING, { attachments: [startKeyboard(deepUrl(payload))] })
})

bot.command('start', async (ctx) => {
  await ctx.reply(GREETING, { attachments: [startKeyboard(SITE)] })
})

bot.command('help', async (ctx) => {
  await ctx.reply(GREETING, { attachments: [startKeyboard(SITE)] })
})

bot.on('message_created', async (ctx) => {
  const text = (ctx.message?.body?.text || '').trim()
  if (!text || text.startsWith('/')) return
  const list = await loadIndex()
  const hits = search(list, text, 5)
  if (hits.length) {
    const lines = hits.map((e) => `• ${e.t}\n  ${SITE}${e.u}`).join('\n\n')
    await ctx.reply(`Похоже, вам подойдут эти темы:\n\n${lines}\n\nИли откройте приложение целиком:`, {
      attachments: [startKeyboard(SITE)],
    })
  } else {
    await ctx.reply(
      'Не нашёл подходящей темы по этим словам. Откройте приложение и воспользуйтесь поиском внутри, или напишите /start.',
      { attachments: [startKeyboard(SITE)] },
    )
  }
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true, hint: 'MAX webhook endpoint' })
    return
  }
  if (!TOKEN) {
    res.status(500).json({ ok: false, error: 'MAX_BOT_TOKEN not set' })
    return
  }
  if (SECRET && req.headers['x-max-bot-api-secret'] !== SECRET) {
    res.status(401).json({ ok: false })
    return
  }

  try {
    await bot.handleUpdate(req.body || {})
  } catch (e) {
    // не роняем вебхук — MAX иначе будет повторять доставку
  }

  res.status(200).json({ ok: true })
}
