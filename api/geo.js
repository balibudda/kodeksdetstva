// Определение региона по IP — через служебные заголовки Vercel.
// Никаких внешних запросов, ничего не логируем и не храним: просто отдаём то,
// что Vercel уже знает о запросе. Клиент сам решает, показывать ли подсказку.
export default function handler(req, res) {
  const h = req.headers || {}
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
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
