// Ежедневный автопилот: берёт следующие ещё не опубликованные темы сайта
// (по порядку TOPICS, без повторов — см. posted-youtube.json), рендерит
// ролик по каждой и публикует на YouTube + Facebook + TikTok. По
// умолчанию 3 темы за прогон (Ник, 13.09.2026: «каждый день три
// новости»).
//
// 16.09.2026, по просьбе Ника: из этих 3 тем — 2 теперь в комедийном
// формате Совёнка (тот же движок, что и вечером), третья — как раньше,
// обычным форматом (реальный скриншот страницы + начитка сути). Какие
// именно 2 темы — решает не этот скрипт, а предыдущий шаг workflow
// (агент по instructions/morning-comedy-script-prompt.md пишет для них
// сценарии в scripts/social/morning-comedy-scripts.json); этот скрипт
// просто смотрит, есть ли для темы готовый сценарий — если да, рендерит
// комедийно, если нет — обычным форматом.
//
// Обновляет posted-youtube.json — коммитит и пушит уже сам workflow
// (.github/workflows/daily-youtube-post.yml), не этот скрипт.
//
// Использование: node scripts/social/daily-youtube-post.mjs [--slug=<slug>] [--count=3] [--dry-run]
// --slug=<slug> — принудительно взять конкретную тему вместо очереди (тогда
//   --count игнорируется, публикуется только она).
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TOPICS } from '../../content/index.mjs'
import { renderTopicVideo } from './generate-video-topic.mjs'
import { renderComedyVideo, SITE as COMEDY_SITE } from './generate-comedy-short.mjs'
import { postToYoutube } from './post-youtube.mjs'
import { postToFacebook } from './post-facebook.mjs'
import { postToTiktok } from './post-tiktok.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const STATE_PATH = path.join(__dirname, 'posted-youtube.json')
const MORNING_COMEDY_PATH = path.join(__dirname, 'morning-comedy-scripts.json')

async function loadPosted() {
  try {
    return JSON.parse(await readFile(STATE_PATH, 'utf8'))
  } catch {
    return []
  }
}

async function savePosted(list) {
  await writeFile(STATE_PATH, JSON.stringify(list, null, 2) + '\n', 'utf8')
}

async function postOneTopic(topic, { dryRun, outDir, comedyScript }) {
  console.log(`\n=== Тема: ${topic.slug} — «${topic.title}» ===`)
  const rendered = comedyScript
    ? await renderComedyVideo(comedyScript, outDir, COMEDY_SITE)
    : await renderTopicVideo(topic.slug, outDir)
  console.log(`Ролик готов (${comedyScript ? 'комедийный формат' : 'обычный формат'}): ${rendered.video} (${rendered.duration}с)`)

  if (dryRun) {
    console.log('--dry-run: публикацию пропускаю.')
    return { slug: topic.slug, youtube: null, facebook: null, tiktok: null }
  }

  const ytResult = await postToYoutube(rendered)

  // Facebook — необязательный шаг: если вдруг отвалится, не роняем весь
  // прогон — YouTube к этому моменту уже опубликован.
  let fbResult = null
  if (process.env.FB_PAGE_ID && process.env.FB_PAGE_TOKEN) {
    try {
      fbResult = await postToFacebook(rendered)
    } catch (e) {
      console.warn('Facebook: публикация не удалась, YouTube уже опубликован —', e.message)
    }
  } else {
    console.log('Facebook: FB_PAGE_ID/FB_PAGE_TOKEN не заданы — пропускаю.')
  }

  // TikTok тоже (15.09.2026, Ник: «посмотрим что смотреть будут больше») —
  // общий аккаунт @kodeksrazuma, черновиком, тот же принцип, что уже
  // подключён к вечернему комедийному формату.
  let tiktokResult = null
  if (process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_REFRESH_TOKEN) {
    try {
      tiktokResult = await postToTiktok(rendered)
    } catch (e) {
      console.warn('TikTok: публикация не удалась —', e.message)
    }
  } else {
    console.log('TikTok: TIKTOK_* секреты не заданы — пропускаю.')
  }

  return { slug: topic.slug, youtube: ytResult, facebook: fbResult, tiktok: tiktokResult }
}

async function loadComedyScripts() {
  if (!existsSync(MORNING_COMEDY_PATH)) return []
  try {
    const data = JSON.parse(await readFile(MORNING_COMEDY_PATH, 'utf8'))
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.warn('morning-comedy-scripts.json не читается —', e.message)
    return []
  }
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true] }))
  const posted = await loadPosted()
  const outDir = path.join(ROOT, 'dist-social')
  await mkdir(outDir, { recursive: true })
  const comedyScripts = await loadComedyScripts()
  if (comedyScripts.length) {
    console.log(`Комедийных сценариев на сегодня: ${comedyScripts.length} (${comedyScripts.map((s) => s.slug).join(', ')})`)
  }
  const results = []

  if (args.slug) {
    const topic = TOPICS.find((t) => t.slug === args.slug)
    if (!topic) throw new Error(`тема не найдена: ${args.slug}`)
    const comedyScript = comedyScripts.find((s) => s.slug === topic.slug)
    const result = await postOneTopic(topic, { dryRun: args['dry-run'], outDir, comedyScript })
    results.push(result)
    if (!args['dry-run'] && !posted.includes(topic.slug)) {
      posted.push(topic.slug)
      await savePosted(posted)
    }
  } else {
    const count = args.count ? Number(args.count) : 3
    for (let i = 0; i < count; i++) {
      const topic = TOPICS.find((t) => !posted.includes(t.slug))
      if (!topic) {
        console.log(`Все ${TOPICS.length} тем уже опубликованы на YouTube — новых нет.`)
        break
      }
      const comedyScript = comedyScripts.find((s) => s.slug === topic.slug)
      const result = await postOneTopic(topic, { dryRun: args['dry-run'], outDir, comedyScript })
      results.push(result)
      if (!args['dry-run']) {
        posted.push(topic.slug)
        await savePosted(posted) // после каждой темы — если прогон упадёт на 2-й из 3, 1-я не потеряется
      }
    }
  }

  if (!args['dry-run']) {
    await rm(MORNING_COMEDY_PATH, { force: true }) // одноразовый файл на день, не коммитим его в git
  }

  console.log('\n' + JSON.stringify(results, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
