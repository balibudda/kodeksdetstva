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

import https from 'node:https'
import { Bot, Keyboard } from '@maxhub/max-bot-api'

const SITE = 'https://kodeksdetstva.ru'
const TOKEN = process.env.MAX_BOT_TOKEN

// ── доверенный сертификат для platform-api2.max.ru ──────────────────────
// Серверы MAX используют цепочку «Минцифры России» (Russian Trusted Root/Sub CA),
// которой нет в обычном системном хранилище доверия — ни на большинстве машин
// разработчиков, ни в рантайме функций Vercel. Без этого исходящие запросы
// падают с TypeError: fetch failed / unable to get local issuer certificate.
// NODE_EXTRA_CA_CERTS тут не подходит: Node читает эту переменную только при
// старте процесса, а не по ходу выполнения serverless-функции. Поэтому передаём
// сертификаты явно в HTTP-клиент через clientOptions.fetch (см. ниже).
// Источник: официальный портал Госуслуг, gosuslugi.ru/crt.
const RUSSIAN_TRUSTED_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIFwjCCA6qgAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwcDELMAkGA1UEBhMCUlUx
PzA9BgNVBAoMNlRoZSBNaW5pc3RyeSBvZiBEaWdpdGFsIERldmVsb3BtZW50IGFu
ZCBDb21tdW5pY2F0aW9uczEgMB4GA1UEAwwXUnVzc2lhbiBUcnVzdGVkIFJvb3Qg
Q0EwHhcNMjIwMzAxMjEwNDE1WhcNMzIwMjI3MjEwNDE1WjBwMQswCQYDVQQGEwJS
VTE/MD0GA1UECgw2VGhlIE1pbmlzdHJ5IG9mIERpZ2l0YWwgRGV2ZWxvcG1lbnQg
YW5kIENvbW11bmljYXRpb25zMSAwHgYDVQQDDBdSdXNzaWFuIFRydXN0ZWQgUm9v
dCBDQTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAMfFOZ8pUAL3+r2n
qqE0Zp52selXsKGFYoG0GM5bwz1bSFtCt+AZQMhkWQheI3poZAToYJu69pHLKS6Q
XBiwBC1cvzYmUYKMYZC7jE5YhEU2bSL0mX7NaMxMDmH2/NwuOVRj8OImVa5s1F4U
zn4Kv3PFlDBjjSjXKVY9kmjUBsXQrIHeaqmUIsPIlNWUnimXS0I0abExqkbdrXbX
YwCOXhOO2pDUx3ckmJlCMUGacUTnylyQW2VsJIyIGA8V0xzdaeUXg0VZ6ZmNUr5Y
Ber/EAOLPb8NYpsAhJe2mXjMB/J9HNsoFMBFJ0lLOT/+dQvjbdRZoOT8eqJpWnVD
U+QL/qEZnz57N88OWM3rabJkRNdU/Z7x5SFIM9FrqtN8xewsiBWBI0K6XFuOBOTD
4V08o4TzJ8+Ccq5XlCUW2L48pZNCYuBDfBh7FxkB7qDgGDiaftEkZZfApRg2E+M9
G8wkNKTPLDc4wH0FDTijhgxR3Y4PiS1HL2Zhw7bD3CbslmEGgfnnZojNkJtcLeBH
BLa52/dSwNU4WWLubaYSiAmA9IUMX1/RpfpxOxd4Ykmhz97oFbUaDJFipIggx5sX
ePAlkTdWnv+RWBxlJwMQ25oEHmRguNYf4Zr/Rxr9cS93Y+mdXIZaBEE0KS2iLRqa
OiWBki9IMQU4phqPOBAaG7A+eP8PAgMBAAGjZjBkMB0GA1UdDgQWBBTh0YHlzlpf
BKrS6badZrHF+qwshzAfBgNVHSMEGDAWgBTh0YHlzlpfBKrS6badZrHF+qwshzAS
BgNVHRMBAf8ECDAGAQH/AgEEMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsF
AAOCAgEAALIY1wkilt/urfEVM5vKzr6utOeDWCUczmWX/RX4ljpRdgF+5fAIS4vH
tmXkqpSCOVeWUrJV9QvZn6L227ZwuE15cWi8DCDal3Ue90WgAJJZMfTshN4OI8cq
W9E4EG9wglbEtMnObHlms8F3CHmrw3k6KmUkWGoa+/ENmcVl68u/cMRl1JbW2bM+
/3A+SAg2c6iPDlehczKx2oa95QW0SkPPWGuNA/CE8CpyANIhu9XFrj3RQ3EqeRcS
AQQod1RNuHpfETLU/A2gMmvn/w/sx7TB3W5BPs6rprOA37tutPq9u6FTZOcG1Oqj
C/B7yTqgI7rbyvox7DEXoX7rIiEqyNNUguTk/u3SZ4VXE2kmxdmSh3TQvybfbnXV
4JbCZVaqiZraqc7oZMnRoWrXRG3ztbnbes/9qhRGI7PqXqeKJBztxRTEVj8ONs1d
WN5szTwaPIvhkhO3CO5ErU2rVdUr89wKpNXbBODFKRtgxUT70YpmJ46VVaqdAhOZ
D9EUUn4YaeLaS8AjSF/h7UkjOibNc4qVDiPP+rkehFWM66PVnP1Msh93tc+taIfC
EYVMxjh8zNbFuoc7fzvvrFILLe7ifvEIUqSVIC/AzplM/Jxw7buXFeGP1qVCBEHq
391d/9RAfaZ12zkwFsl+IKwE/OZxW8AHa9i1p4GO0YSNuczzEm4=
-----END CERTIFICATE-----`

const RUSSIAN_TRUSTED_SUB_CA = `-----BEGIN CERTIFICATE-----
MIIHQjCCBSqgAwIBAgICEAIwDQYJKoZIhvcNAQELBQAwcDELMAkGA1UEBhMCUlUx
PzA9BgNVBAoMNlRoZSBNaW5pc3RyeSBvZiBEaWdpdGFsIERldmVsb3BtZW50IGFu
ZCBDb21tdW5pY2F0aW9uczEgMB4GA1UEAwwXUnVzc2lhbiBUcnVzdGVkIFJvb3Qg
Q0EwHhcNMjIwMzAyMTEyNTE5WhcNMjcwMzA2MTEyNTE5WjBvMQswCQYDVQQGEwJS
VTE/MD0GA1UECgw2VGhlIE1pbmlzdHJ5IG9mIERpZ2l0YWwgRGV2ZWxvcG1lbnQg
YW5kIENvbW11bmljYXRpb25zMR8wHQYDVQQDDBZSdXNzaWFuIFRydXN0ZWQgU3Vi
IENBMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA9YPqBKOk19NFymrE
wehzrhBEgT2atLezpduB24mQ7CiOa/HVpFCDRZzdxqlh8drku408/tTmWzlNH/br
HuQhZ/miWKOf35lpKzjyBd6TPM23uAfJvEOQ2/dnKGGJbsUo1/udKSvxQwVHpVv3
S80OlluKfhWPDEXQpgyFqIzPoxIQTLZ0deirZwMVHarZ5u8HqHetRuAtmO2ZDGQn
vVOJYAjls+Hiueq7Lj7Oce7CQsTwVZeP+XQx28PAaEZ3y6sQEt6rL06ddpSdoTMp
BnCqTbxW+eWMyjkIn6t9GBtUV45yB1EkHNnj2Ex4GwCiN9T84QQjKSr+8f0psGrZ
vPbCbQAwNFJjisLixnjlGPLKa5vOmNwIh/LAyUW5DjpkCx004LPDuqPpFsKXNKpa
L2Dm6uc0x4Jo5m+gUTVORB6hOSzWnWDj2GWfomLzzyjG81DRGFBpco/O93zecsIN
3SL2Ysjpq1zdoS01CMYxie//9zWvYwzI25/OZigtnpCIrcd2j1Y6dMUFQAzAtHE+
qsXflSL8HIS+IJEFIQobLlYhHkoE3avgNx5jlu+OLYe0dF0Ykx1PGNjbwqvTX37R
Cn32NMjlotW2QcGEZhDKj+3urZizp5xdTPZitA+aEjZM/Ni71VOdiOP0igbw6asZ
2fxdozZ1TnSSYNYvNATwthNmZysCAwEAAaOCAeUwggHhMBIGA1UdEwEB/wQIMAYB
Af8CAQAwDgYDVR0PAQH/BAQDAgGGMB0GA1UdDgQWBBTR4XENCy2BTm6KSo9MI7NM
XqtpCzAfBgNVHSMEGDAWgBTh0YHlzlpfBKrS6badZrHF+qwshzCBxwYIKwYBBQUH
AQEEgbowgbcwOwYIKwYBBQUHMAKGL2h0dHA6Ly9yb3N0ZWxlY29tLnJ1L2NkcC9y
b290Y2Ffc3NsX3JzYTIwMjIuY3J0MDsGCCsGAQUFBzAChi9odHRwOi8vY29tcGFu
eS5ydC5ydS9jZHAvcm9vdGNhX3NzbF9yc2EyMDIyLmNydDA7BggrBgEFBQcwAoYv
aHR0cDovL3JlZXN0ci1wa2kucnUvY2RwL3Jvb3RjYV9zc2xfcnNhMjAyMi5jcnQw
gbAGA1UdHwSBqDCBpTA1oDOgMYYvaHR0cDovL3Jvc3RlbGVjb20ucnUvY2RwL3Jv
b3RjYV9zc2xfcnNhMjAyMi5jcmwwNaAzoDGGL2h0dHA6Ly9jb21wYW55LnJ0LnJ1
L2NkcC9yb290Y2Ffc3NsX3JzYTIwMjIuY3JsMDWgM6Axhi9odHRwOi8vcmVlc3Ry
LXBraS5ydS9jZHAvcm9vdGNhX3NzbF9yc2EyMDIyLmNybDANBgkqhkiG9w0BAQsF
AAOCAgEARBVzZls79AdiSCpar15dA5Hr/rrT4WbrOfzlpI+xrLeRPrUG6eUWIW4v
Sui1yx3iqGLCjPcKb+HOTwoRMbI6ytP/ndp3TlYua2advYBEhSvjs+4vDZNwXr/D
anbwIWdurZmViQRBDFebpkvnIvru/RpWud/5r624Wp8voZMRtj/cm6aI9LtvBfT9
cfzhOaexI/99c14dyiuk1+6QhdwKaCRTc1mdfNQmnfWNRbfWhWBlK3h4GGE9JK33
Gk8ZS8DMrkdAh0xby4xAQ/mSWAfWrBmfzlOqGyoB1U47WTOeqNbWkkoAP2ys94+s
Jg4NTkiDVtXRF6nr6fYi0bSOvOFg0IQrMXO2Y8gyg9ARdPJwKtvWX8VPADCYMiWH
h4n8bZokIrImVKLDQKHY4jCsND2HHdJfnrdL2YJw1qFskNO4cSNmZydw0Wkgjv9k
F+KxqrDKlB8MZu2Hclph6v/CZ0fQ9YuE8/lsHZ0Qc2HyiSMnvjgK5fDc3TD4fa8F
E8gMNurM+kV8PT8LNIM+4Zs+LKEV8nqRWBaxkIVJGekkVKO8xDBOG/aN62AZKHOe
GcyIdu7yNMMRihGVZCYr8rYiJoKiOzDqOkPkLOPdhtVlgnhowzHDxMHND/E2WA5p
ZHuNM/m0TXt2wTTPL7JH2YC0gPz/BvvSzjksgzU5rLbRyUKQkgU=
-----END CERTIFICATE-----`

const MAX_CA = [RUSSIAN_TRUSTED_ROOT_CA, RUSSIAN_TRUSTED_SUB_CA]

// fetch-совместимая обёртка поверх node:https с явным списком доверенных CA —
// заменяет глобальный fetch только для клиента MAX Bot API (см. new Bot ниже).
function maxFetch(url, init = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: init.method || 'GET',
        headers: init.headers || {},
        ca: MAX_CA,
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const bodyText = Buffer.concat(chunks).toString('utf8')
          resolve({
            status: res.statusCode,
            headers: { get: (name) => res.headers[String(name).toLowerCase()] ?? null },
            json: async () => (bodyText ? JSON.parse(bodyText) : null),
            text: async () => bodyText,
          })
        })
      },
    )
    req.on('error', reject)
    if (init.body) req.write(init.body)
    req.end()
  })
}
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

// Кнопки-ссылки (открывают сайт как обычную страницу), а не openApp: последние
// требуют, чтобы URL был заранее зарегистрирован как мини-приложение бота на
// стороне MAX («Link not found» иначе), а это отдельный шаг в личном кабинете.
// Когда мини-приложение подключат — можно будет вернуть Keyboard.button.openApp.
function startKeyboard(url) {
  return Keyboard.inlineKeyboard([
    [Keyboard.button.link('🛡 Открыть «Кодекс детства»', url)],
    [Keyboard.button.link('🆘 Помощь сейчас', `${SITE}/pomoshch/`)],
    [Keyboard.button.link('🧒 Тебе (подростку)', `${SITE}/tebe/`)],
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

const bot = new Bot(TOKEN, { clientOptions: { fetch: maxFetch } })

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
  // fail closed: если секрет не настроен — отклоняем, а не пропускаем всех подряд
  if (!SECRET || req.headers['x-max-bot-api-secret'] !== SECRET) {
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
