// Определение региона по IP — через служебные заголовки Vercel.
// Никаких внешних запросов, ничего не логируем и не храним.
//
// Защита от «скликивания»/ботов:
//  • простой лимит на IP в памяти тёплого инстанса (Vercel держит инстанс
//    горячим под нагрузкой — этого хватает против одного источника-долбилки);
//  • очевидные боты и краулеры получают пустой ответ без работы;
//  • ответ помечен приватным кэшем на 30 минут — обычный браузер не дёргает
//    эндпоинт повторно;
//  • дополнительно на проекте можно включить Vercel Firewall / Attack
//    Challenge Mode в дашборде (это уже вне кода).

const WINDOW_MS = 10 * 60 * 1000 // окно 10 минут
const MAX_HITS = 20 // не больше 20 запросов с одного IP за окно
const hits = new Map() // ip -> number[] (таймстемпы)

function tooMany(ip) {
  const now = Date.now()
  let arr = hits.get(ip)
  if (!arr) {
    arr = []
    hits.set(ip, arr)
  }
  // чистим старое
  while (arr.length && now - arr[0] > WINDOW_MS) arr.shift()
  arr.push(now)
  // не даём Map разрастаться
  if (hits.size > 5000) {
    for (const k of hits.keys()) {
      hits.delete(k)
      if (hits.size <= 4000) break
    }
  }
  return arr.length > MAX_HITS
}

const BOT_RE = /(bot|crawler|spider|crawl|slurp|curl|wget|python-requests|httpclient|scrapy|headless|phantom|puppeteer|axios|go-http|libwww|okhttp|java\/)/i

export default function handler(req, res) {
  const h = req.headers || {}
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  // приватный короткий кэш: реальный браузер не будет дёргать повторно
  res.setHeader('Cache-Control', 'private, max-age=1800')
  res.setHeader('X-Robots-Tag', 'noindex')

  const ua = String(h['user-agent'] || '')
  if (!ua || BOT_RE.test(ua)) {
    res.status(200).end('{}')
    return
  }

  const ip =
    String(h['x-real-ip'] || '') ||
    String(h['x-forwarded-for'] || '').split(',')[0].trim() ||
    'unknown'

  if (tooMany(ip)) {
    res.setHeader('Retry-After', '600')
    res.status(429).end('{"error":"rate_limited"}')
    return
  }

  res.status(200).end(
    JSON.stringify({
      country: h['x-vercel-ip-country'] || '',
      region: h['x-vercel-ip-country-region'] || '',
      city: safeDecode(h['x-vercel-ip-city'] || ''),
    }),
  )
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s)
  } catch (e) {
    return s
  }
}
