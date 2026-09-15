// Одноразовая регистрация вебхука бота MAX на platform-api2.max.ru.
// webhookCallback() в api/max.js только обрабатывает запросы — саму подписку
// нужно оформить отдельно, один раз (и заново — если меняется секрет или URL).
//
// Запуск: MAX_BOT_TOKEN=... MAX_WEBHOOK_SECRET=... node scripts/max-set-webhook.mjs

const TOKEN = process.env.MAX_BOT_TOKEN
const SECRET = process.env.MAX_WEBHOOK_SECRET
const URL_ = 'https://kodeksdetstva.ru/api/max'

if (!TOKEN) {
  console.error('Задайте MAX_BOT_TOKEN в окружении.')
  process.exit(1)
}

const r = await fetch('https://platform-api2.max.ru/subscriptions', {
  method: 'POST',
  headers: {
    Authorization: TOKEN,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    url: URL_,
    update_types: ['bot_started', 'message_created'],
    ...(SECRET ? { secret: SECRET } : {}),
  }),
})

const data = await r.json().catch(() => ({}))
console.log(r.status, JSON.stringify(data, null, 2))
