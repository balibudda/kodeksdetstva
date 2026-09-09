// Телеграм-бот «Кодекс детства» — лаунчер мини-приложения.
// Вебхук: POST https://kodeksdetstva.ru/api/tg
// Секреты — только в переменных окружения Vercel:
//   TELEGRAM_BOT_TOKEN       — токен бота от @BotFather
//   TELEGRAM_WEBHOOK_SECRET  — произвольная строка, сверяется с заголовком
//                              X-Telegram-Bot-Api-Secret-Token

const SITE = 'https://kodeksdetstva.ru'
const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

async function tg(method, payload) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return r.json()
}

// payload из deep-link: «psihika__suicidalnye-signaly» → «/psihika/suicidalnye-signaly/»
function deepUrl(param) {
  if (!param || param === 'start') return SITE
  const path = String(param)
    .replace(/[^a-z0-9_-]/gi, '')
    .replace(/__/g, '/')
    .replace(/^\/+|\/+$/g, '')
  if (!path) return SITE
  return `${SITE}/${path}/`
}

function startKeyboard(url) {
  return {
    inline_keyboard: [
      [{ text: '🛡 Открыть «Кодекс детства»', web_app: { url } }],
      [{ text: '🆘 Помощь сейчас', web_app: { url: `${SITE}/pomoshch/` } }],
      [{ text: '🧒 Тебе (подростку)', web_app: { url: `${SITE}/tebe/` } }],
    ],
  }
}

const GREETING =
  'Это «Кодекс детства» — справочник для родителей и подростков: права ребёнка, ' +
  'защита от насилия и травли, безопасность, психика, здоровье, закон.\n\n' +
  'Нажми кнопку ниже, чтобы открыть приложение. Оно работает и без интернета, ' +
  'а разделы можно сохранять в закладки.\n\n' +
  '⚠️ Если ребёнку сейчас угрожает опасность — звони 112. Детский телефон ' +
  'доверия: 8 800 2000 122 (круглосуточно, бесплатно, анонимно).'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true, hint: 'Telegram webhook endpoint' })
    return
  }
  if (!TOKEN) {
    res.status(500).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not set' })
    return
  }
  if (SECRET && req.headers['x-telegram-bot-api-secret-token'] !== SECRET) {
    res.status(401).json({ ok: false })
    return
  }

  const update = req.body || {}
  const msg = update.message || update.edited_message
  const chatId = msg && msg.chat && msg.chat.id

  try {
    if (chatId && typeof msg.text === 'string') {
      const text = msg.text.trim()
      if (text.startsWith('/start')) {
        const param = text.split(/\s+/)[1] || ''
        await tg('sendMessage', {
          chat_id: chatId,
          text: GREETING,
          reply_markup: startKeyboard(deepUrl(param)),
        })
      } else if (text.startsWith('/help')) {
        await tg('sendMessage', {
          chat_id: chatId,
          text: GREETING,
          reply_markup: startKeyboard(SITE),
        })
      } else {
        await tg('sendMessage', {
          chat_id: chatId,
          text:
            'Открой приложение кнопкой ниже и найди свою ситуацию через поиск ' +
            'внутри. Команды: /start, /help.',
          reply_markup: startKeyboard(SITE),
        })
      }
    }
  } catch (e) {
    // не роняем вебхук — Telegram иначе будет повторять доставку
  }

  res.status(200).json({ ok: true })
}
