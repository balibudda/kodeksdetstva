// Ежемесячный бесплатный аудит контента — без ИИ, без сторонних платных сервисов.
// Проверяет только то, что можно проверить детерминированно:
//   1. темы, у которых поле `updated` старше STALE_MONTHS
//   2. живость ссылок на официальные источники (contacts[].url, regions[].site)
// Ничего не правит и не коммитит сам — только формирует отчёт.
// Запуск вручную:  node scripts/content-audit.mjs
// В расписании:    .github/workflows/monthly-content-audit.yml (раз в месяц),
//                   открывает результат отдельным GitHub Issue.

import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TOPICS, CONTACTS, REGIONS } from '../content/index.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const STALE_MONTHS = 6
const CONCURRENCY = 8
const TIMEOUT_MS = 8000

const now = new Date()

function monthsSince(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}

const staleTopics = TOPICS.map((t) => ({ t, months: monthsSince(t.updated) }))
  .filter((x) => x.months === null || x.months >= STALE_MONTHS)
  .sort((a, b) => (b.months ?? 999) - (a.months ?? 999))

// ── сбор ссылок на официальные источники ───────────────────────
const urlLabels = new Map() // url -> [метки, где встречается]
function addUrl(url, label) {
  if (!url || !/^https?:\/\//.test(url)) return
  if (!urlLabels.has(url)) urlLabels.set(url, [])
  urlLabels.get(url).push(label)
}
for (const c of CONTACTS) addUrl(c.url, `contacts: ${c.id}`)
for (const r of REGIONS) for (const c of r.contacts || []) addUrl(c.site, `regions: ${r.id} / ${c.name}`)

async function checkUrl(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const opts = {
    redirect: 'follow',
    signal: controller.signal,
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; KodeksDetstvaAudit/1.0; +https://kodeksdetstva.ru)' },
  }
  try {
    let res = await fetch(url, { ...opts, method: 'HEAD' })
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await fetch(url, { ...opts, method: 'GET' })
    }
    return { ok: res.status < 400, status: res.status }
  } catch (e) {
    return { ok: false, status: 'ERR', error: e.name === 'AbortError' ? 'timeout' : e.message }
  } finally {
    clearTimeout(timer)
  }
}

async function checkAll(entries) {
  const results = []
  let i = 0
  async function worker() {
    while (i < entries.length) {
      const idx = i++
      const [url, labels] = entries[idx]
      const r = await checkUrl(url)
      results[idx] = { url, labels, ...r }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, worker))
  return results
}

const urlEntries = [...urlLabels.entries()]
const results = await checkAll(urlEntries)
// Разделяем: реальный HTTP-ответ с ошибкой (сайт точно что-то сказал) и сетевую
// ошибку/таймаут (сайт мог просто не ответить нам — многие ru-домены блокируют
// ботов и запросы не из России; это не доказательство того, что ссылка мертва
// для живого посетителя). 403 тоже часто про блокировку бота, а не про реальную
// недоступность — держим её в «неподтверждённых», а не в «точно сломано».
const httpErrors = results.filter((r) => !r.ok && typeof r.status === 'number' && r.status !== 403 && r.status !== 429)
const unverified = results.filter((r) => !r.ok && (r.status === 'ERR' || r.status === 403 || r.status === 429))

// ── отчёт ────────────────────────────────────────────────────
const monthTitle = now.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' })

const lines = []
lines.push(`Автоматическая проверка без ИИ: даты обновления тем и живость ссылок на официальные источники. Ничего не правит само — только список того, на что стоит взглянуть. Чтобы обновить контент по этому списку, напишите в чат с Claude «сверь чек-лист аудита» и пришлите ссылку на этот Issue.`)
lines.push('')
lines.push(`## 📅 Темы без обновления ${STALE_MONTHS}+ месяцев (${staleTopics.length} из ${TOPICS.length})`)
lines.push('')
if (staleTopics.length) {
  for (const { t, months } of staleTopics.slice(0, 80)) {
    lines.push(`- [ ] \`${t.slug}\` — ${t.title} (обновлено ${t.updated || 'никогда'}${months !== null ? `, ${months} мес. назад` : ''})`)
  }
  if (staleTopics.length > 80) lines.push(`- … и ещё ${staleTopics.length - 80}`)
} else {
  lines.push('Нет тем старше порога — всё свежее.')
}
lines.push('')
lines.push(`## 🔗 Ссылки с явной HTTP-ошибкой (${httpErrors.length} из ${results.length}) — стоит проверить в первую очередь`)
lines.push('')
if (httpErrors.length) {
  for (const b of httpErrors) {
    lines.push(`- [ ] ${b.url} — статус \`${b.status}\`; используется в: ${b.labels.join(', ')}`)
  }
} else {
  lines.push('Нет ссылок с явной ошибкой сервера (404/500 и т. п.).')
}
lines.push('')
lines.push(`## ⚠️ Не удалось подтвердить автоматически (${unverified.length} из ${results.length})`)
lines.push('')
lines.push('Таймаут, сетевая ошибка или 403 — многие `.gov.ru`/ведомственные сайты блокируют ботов и запросы не из России, так что это **не доказательство**, что ссылка мертва. Стоит открыть вручную в браузере, а не чинить вслепую.')
lines.push('')
if (unverified.length) {
  for (const b of unverified) {
    lines.push(`- [ ] ${b.url} — \`${b.status}\`${b.error ? ` (${b.error})` : ''}; используется в: ${b.labels.join(', ')}`)
  }
} else {
  lines.push('Таких нет.')
}
lines.push('')
lines.push('---')
lines.push(`<sub>Порог «устарело» — ${STALE_MONTHS} мес.; проверено ${results.length} ссылок с таймаутом ${TIMEOUT_MS / 1000} с.</sub>`)

const report = lines.join('\n')
console.log(report)

await writeFile(path.join(ROOT, 'audit-report.md'), report, 'utf8')
await writeFile(path.join(ROOT, 'audit-title.txt'), `Аудит контента — ${monthTitle}`, 'utf8')
