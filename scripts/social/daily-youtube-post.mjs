// Ежедневный автопилот: берёт следующие ещё не опубликованные темы сайта
// (по порядку TOPICS, без повторов — см. posted-youtube.json), рендерит
// ролик по каждой (generate-video-topic.mjs) и публикует на YouTube +
// Facebook. По умолчанию 3 темы за прогон (Ник, 13.09.2026: «каждый день
// три новости» — уточнил после того, как первая версия делала по одной).
// Обновляет posted-youtube.json — коммитит и пушит уже сам workflow
// (.github/workflows/daily-youtube-post.yml), не этот скрипт.
//
// Использование: node scripts/social/daily-youtube-post.mjs [--slug=<slug>] [--count=3] [--dry-run]
// --slug=<slug> — принудительно взять конкретную тему вместо очереди (тогда
//   --count игнорируется, публикуется только она).
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TOPICS } from '../../content/index.mjs'
import { renderTopicVideo } from './generate-video-topic.mjs'
import { postToYoutube } from './post-youtube.mjs'
import { postToFacebook } from './post-facebook.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const STATE_PATH = path.join(__dirname, 'posted-youtube.json')

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

async function postOneTopic(topic, { dryRun, outDir }) {
  console.log(`\n=== Тема: ${topic.slug} — «${topic.title}» ===`)
  const rendered = await renderTopicVideo(topic.slug, outDir)
  console.log(`Ролик готов: ${rendered.video} (${rendered.duration}с)`)

  if (dryRun) {
    console.log('--dry-run: публикацию пропускаю.')
    return { slug: topic.slug, youtube: null, facebook: null }
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

  return { slug: topic.slug, youtube: ytResult, facebook: fbResult }
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true] }))
  const posted = await loadPosted()
  const outDir = path.join(ROOT, 'dist-social')
  await mkdir(outDir, { recursive: true })
  const results = []

  if (args.slug) {
    const topic = TOPICS.find((t) => t.slug === args.slug)
    if (!topic) throw new Error(`тема не найдена: ${args.slug}`)
    const result = await postOneTopic(topic, { dryRun: args['dry-run'], outDir })
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
      const result = await postOneTopic(topic, { dryRun: args['dry-run'], outDir })
      results.push(result)
      if (!args['dry-run']) {
        posted.push(topic.slug)
        await savePosted(posted) // после каждой темы — если прогон упадёт на 2-й из 3, 1-я не потеряется
      }
    }
  }

  console.log('\n' + JSON.stringify(results, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
