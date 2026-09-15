// Публикует уже отрендеренный комедийный ролик черновиком во входящие
// TikTok (Content Posting API, scope video.upload — не полноценная
// публикация, Ник открывает приложение и сам жмёт «Опубликовать»).
// 15.09.2026, по прямой просьбе Ника: общий на ОБА проекта TikTok-аккаунт
// (`@kodeksrazuma`), чтобы не заводить/поддерживать по отдельному
// аккаунту на каждый сайт — тот же приём, что уже используется для
// Facebook Meta-приложения (одно приложение, переиспользуется).
//
// TikTok Developer-приложение то же самое, что уже одобрено и работает у
// nikolablajen-app (TIKTOK_CLIENT_KEY/_SECRET скопированы оттуда
// одноразовым workflow, см. историю в CLAUDE.md) — новое приложение и
// повторное ревью не нужны, TikTok разрешает одному приложению
// авторизовывать сколько угодно аккаунтов.
//
// ВАЖНО — общий аккаунт на ДВА репозитория: TikTok меняет (ротирует)
// refresh_token при каждом использовании, старый после этого перестаёт
// работать. Если бы каждый репозиторий хранил свою отдельную копию
// секрета, тот проект, который постит вторым, получил бы уже
// протухший токен. Поэтому после каждого успешного обновления токена
// этот скрипт записывает новый refresh_token СРАЗУ В ОБА репозитория
// (REPOS ниже) — какой бы проект ни постил следующим, у него уже будет
// актуальный токен. Идентичная копия этого файла лежит в kodeksdetstva.
//
// Использование: node scripts/social/post-tiktok.mjs --video=<path> --caption=<path> --meta=<path>
import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const API = 'https://open.tiktokapis.com/v2'
const REPOS = ['balibudda/kodeksdeneg', 'balibudda/kodeksdetstva']
const TIKTOK_CAPTION_LIMIT = 2200

async function refreshAccessToken() {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: process.env.TIKTOK_REFRESH_TOKEN,
  })
  const res = await fetch(`${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`TikTok: обновление токена не удалось: ${JSON.stringify(data)}`)

  if (data.refresh_token) {
    for (const repo of REPOS) {
      try {
        await run('gh', ['secret', 'set', 'TIKTOK_REFRESH_TOKEN', '--repo', repo, '--body', data.refresh_token])
      } catch (e) {
        console.error(`TikTok: не удалось сохранить обновлённый токен в ${repo} —`, e.message)
      }
    }
  }
  return data.access_token
}

async function uploadToInbox(accessToken, buf) {
  const size = buf.length
  const initRes = await fetch(`${API}/post/publish/inbox/video/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: size, total_chunk_count: 1 },
    }),
  })
  const init = await initRes.json()
  if (init.error?.code !== 'ok') throw new Error(`TikTok init не удался: ${JSON.stringify(init)}`)
  const { publish_id: publishId, upload_url: uploadUrl } = init.data

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(size),
      'Content-Range': `bytes 0-${size - 1}/${size}`,
    },
    body: buf,
  })
  if (!putRes.ok) throw new Error(`TikTok PUT не удался: ${putRes.status} ${await putRes.text()}`)
  return publishId
}

// { video, caption, meta } — пути к файлам от renderComedyVideo().
export async function postToTiktok({ video, caption }) {
  const pageMissing = ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REFRESH_TOKEN'].filter((v) => !process.env[v])
  if (pageMissing.length) throw new Error(`не заданы: ${pageMissing.join(', ')}`)

  const buf = await readFile(video)
  const accessToken = await refreshAccessToken()
  const publishId = await uploadToInbox(accessToken, buf)
  console.log(`TikTok: загружено черновиком, publish_id=${publishId}`)

  // У inbox/draft-эндпоинта вообще нет поля подписи — печатаем готовый
  // текст здесь же в лог, чтобы Ник мог скопировать его в приложение при
  // публикации, не спрашивая отдельно каждый раз.
  try {
    const captionText = await readFile(caption, 'utf8')
    const trimmed = captionText.length > TIKTOK_CAPTION_LIMIT ? captionText.slice(0, TIKTOK_CAPTION_LIMIT - 1) + '…' : captionText
    console.log(`\n--- текст для вставки в приложении TikTok ---\n${trimmed}\n---`)
  } catch {
    console.log('(файл с подписью не найден рядом с видео)')
  }

  return { publishId }
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true] }))
  if (!args.video || !args.caption) {
    console.error('Использование: node post-tiktok.mjs --video=<path> --caption=<path>')
    process.exit(1)
  }
  await postToTiktok({ video: args.video, caption: args.caption })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
