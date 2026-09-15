// Приём заявок с формы «Советник» (/sovetnik/) — личная консультация с
// Ником по ситуации с ребёнком. Без оплаты и без базы данных: просто
// уведомление по email, Ник отвечает сам, если реально может помочь.
const NOTIFY_EMAIL = 'nchechelnitskiy@gmail.com'
// Основной домен kodeksdetstva.ru отдаётся статикой через GitHub Pages
// (Cloudflare) — эта функция реально доступна только через поддомен
// bot.kodeksdetstva.ru (остаётся на Vercel). Страница /sovetnik/ шлёт
// запрос именно туда — кросс-доменный запрос, нужен CORS.
const ALLOWED_ORIGIN = 'https://kodeksdetstva.ru'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }
  const b = req.body || {}
  if (b.company) { res.status(200).json({ ok: true }); return } // honeypot

  const contact = String(b.contact || '').trim()
  const question = String(b.question || '').trim()
  if (contact.length < 3 || question.length < 15) {
    res.status(400).json({ error: 'missing_fields' })
    return
  }
  const name = String(b.name || '').trim().slice(0, 120) || null
  const channel = ['telegram', 'whatsapp', 'email'].includes(b.channel) ? b.channel : null

  const apiKey = process.env.RESEND_API_KEY
  if (apiKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from: 'Кодекс детства <app@nikolablajen.ru>',
          to: NOTIFY_EMAIL,
          subject: 'Заявка на «Советник» — Кодекс детства',
          html: `
            <div style="font-family: -apple-system, sans-serif; padding: 24px;">
              <h2>Новая заявка на «Советник» (kodeksdetstva.ru)</h2>
              <p><b>Имя:</b> ${(name || '—').replace(/</g, '&lt;')}<br/>
              <b>Контакт:</b> ${contact.replace(/</g, '&lt;')} (${channel || 'канал не указан'})</p>
              <p style="margin:16px 0; padding:14px; background:#f0ede4; border-radius:8px; white-space:pre-wrap;">${question.slice(0, 3000).replace(/</g, '&lt;')}</p>
            </div>
          `,
        }),
      })
    } catch (e) {
      console.error('sovetnik-request email failed', e)
    }
  }
  res.status(200).json({ ok: true })
}
