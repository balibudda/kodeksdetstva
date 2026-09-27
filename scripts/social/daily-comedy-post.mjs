// Вечерний автопилот комедийного формата (14.09.2026) — зеркало
// kodeksdeneg/scripts/social/daily-comedy-post.mjs, тот же принцип, своя
// очередь тем и трекер (posted-comedy.json), не пересекается с утренним
// daily-youtube-post.mjs (тема может быть опубликована в обоих форматах
// независимо).
//
// Логика:
//  1. Если scripts/social/comedy-script.json существует (написан
//     предыдущим шагом workflow — агентом Claude по
//     instructions/comedy-script-prompt.md) — рендерим и постим его,
//     затем удаляем файл (одноразовый, в git не попадает).
//  2. Иначе — берём PILOT из generate-comedy-short.mjs (первый прогон,
//     когда очередь ещё пуста — тот самый ролик про финансовые ловушки,
//     одобренный Ником).
//
// Использование: node scripts/social/daily-comedy-post.mjs [--dry-run]
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderComedyVideo, PILOT } from './generate-comedy-short.mjs'
import { postToFacebook } from './post-facebook.mjs'
import { postToYoutube } from './post-youtube.mjs'
import { postToTiktok } from './post-tiktok.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const STATE_PATH = path.join(__dirname, 'posted-comedy.json')
const SCRIPT_PATH = path.join(__dirname, 'comedy-script.json')

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

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true] }))
  const posted = await loadPosted()

  let scriptData = PILOT
  let usedGeneratedScript = false
  if (existsSync(SCRIPT_PATH)) {
    scriptData = JSON.parse(await readFile(SCRIPT_PATH, 'utf8'))
    usedGeneratedScript = true
    console.log(`Использую сгенерированный сценарий для темы: ${scriptData.slug}`)
  } else {
    console.log(`comedy-script.json не найден — использую пилотный сценарий (${PILOT.slug})`)
  }

  if (posted.includes(scriptData.slug)) {
    console.log(`Тема «${scriptData.slug}» уже была опубликована в этом формате — ничего не делаю.`)
    return
  }

  const outDir = path.join(ROOT, 'dist-social-comedy')
  await mkdir(outDir, { recursive: true })

  console.log(`Рендерю ролик: ${scriptData.slug}…`)
  const rendered = await renderComedyVideo(scriptData, outDir)
  console.log(`Готово: ${rendered.video} (${rendered.duration.toFixed(1)}с, ${rendered.scenes} сцен)`)

  if (args['dry-run']) {
    console.log('--dry-run: публикацию и запись трекера пропускаю.')
    return
  }

  let ytResult = null
  if (process.env.YT_CLIENT_ID && process.env.YT_CLIENT_SECRET && process.env.YT_REFRESH_TOKEN) {
    try {
      ytResult = await postToYoutube(rendered)
    } catch (e) {
      console.warn('YouTube: публикация не удалась —', e.message)
    }
  } else {
    console.log('YouTube: YT_* секреты не заданы — пропускаю.')
  }

  let fbResult = null
  if (process.env.FB_PAGE_ID && process.env.FB_PAGE_TOKEN) {
    try {
      fbResult = await postToFacebook(rendered)
    } catch (e) {
      console.warn('Facebook: публикация не удалась —', e.message)
    }
  } else {
    console.log('Facebook: FB_PAGE_ID/FB_PAGE_TOKEN не заданы — пропускаю.')
  }

  // Общий на оба проекта TikTok-аккаунт @kodeksrazuma (15.09.2026, по
  // просьбе Ника — не заводить отдельный аккаунт на каждый сайт).
  let tiktokResult = null
  if (process.env.TIKTOK_ENABLED === '1' && process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_REFRESH_TOKEN) {
    try {
      tiktokResult = await postToTiktok(rendered)
    } catch (e) {
      console.warn('TikTok: публикация не удалась —', e.message)
    }
  } else {
    console.log('TikTok: отключён (TIKTOK_ENABLED не равен 1) или секреты не заданы — пропускаю.')
  }

  posted.push(scriptData.slug)
  await savePosted(posted)

  if (usedGeneratedScript) {
    await rm(SCRIPT_PATH, { force: true }) // одноразовый файл, не коммитим его в git
  }

  console.log('\n' + JSON.stringify({ slug: scriptData.slug, youtube: ytResult, facebook: fbResult, tiktok: tiktokResult }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
