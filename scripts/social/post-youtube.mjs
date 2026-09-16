// Публикует готовый ролик (video/caption/meta от generate-video-topic.mjs)
// на YouTube как Shorts. Нужны YT_CLIENT_ID / YT_CLIENT_SECRET /
// YT_REFRESH_TOKEN (Desktop OAuth client, канал @kodeksdetstva).
//
// Flow: обновить access token -> resumable upload (snippet+status) -> PUT
// байтов видео -> ролик публикуется публично.
import { readFile } from 'node:fs/promises'

async function accessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YT_CLIENT_ID,
      client_secret: process.env.YT_CLIENT_SECRET,
      refresh_token: process.env.YT_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const json = await res.json()
  if (!json.access_token) throw new Error(`YouTube token refresh failed: ${JSON.stringify(json)}`)
  return json.access_token
}

// { video, caption, meta } — пути к файлам от renderTopicVideo(). Возвращает
// { id, url }.
export async function postToYoutube({ video, caption, meta }) {
  if (!process.env.YT_CLIENT_ID || !process.env.YT_CLIENT_SECRET || !process.env.YT_REFRESH_TOKEN) {
    throw new Error('YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN not set')
  }

  const [videoBuf, captionText, metaRaw] = await Promise.all([
    readFile(video),
    readFile(caption, 'utf8'),
    readFile(meta, 'utf8'),
  ])
  const metaJson = JSON.parse(metaRaw)

  let title = metaJson.youtubeTitle || `${metaJson.title} #Shorts`
  if (title.length > 100) title = title.slice(0, 96) + '…'

  const linkLine = metaJson.moreUrl && !captionText.includes(metaJson.moreUrl) ? `\n\nСтатья на сайте: ${metaJson.moreUrl}` : ''
  const shortsTag = /#shorts/i.test(captionText + linkLine) ? '' : '\n\n#Shorts'
  const suffix = linkLine + shortsTag
  // YouTube отклоняет описание длиннее 5000 символов (invalidDescription) —
  // раньше не резалось вообще; нашли 16.09.2026 на теме с особенно длинным
  // содержанием (реальные 5041 симв. упали с 400). Режем середину текста,
  // всегда сохраняя ссылку/тег в конце.
  const YT_DESCRIPTION_LIMIT = 5000
  let descBody = captionText
  if (descBody.length + suffix.length > YT_DESCRIPTION_LIMIT) {
    const budget = YT_DESCRIPTION_LIMIT - suffix.length - 1
    descBody = descBody.slice(0, budget)
    const lastBreak = descBody.lastIndexOf('\n\n')
    if (lastBreak > budget * 0.5) descBody = descBody.slice(0, lastBreak)
    descBody = descBody.trimEnd() + '…'
  }
  const description = descBody + suffix

  const token = await accessToken()

  console.log('YouTube: starting resumable upload…')
  const init = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': String(videoBuf.length),
      },
      body: JSON.stringify({
        snippet: { title, description, categoryId: '27' }, // 27 = Education
        status: { privacyStatus: 'public', selfDeclaredMadeForKids: false, madeForKids: false },
      }),
    }
  )
  if (!init.ok) throw new Error(`YouTube init failed: ${init.status} ${await init.text()}`)
  const uploadUrl = init.headers.get('location')
  if (!uploadUrl) throw new Error('YouTube init: no resumable upload URL returned')

  console.log('YouTube: uploading file…')
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(videoBuf.length) },
    body: videoBuf,
  })
  const body = await put.json()
  if (!put.ok || !body.id) throw new Error(`YouTube upload failed: ${put.status} ${JSON.stringify(body)}`)

  const url = `https://youtube.com/shorts/${body.id}`
  console.log(`Posted: ${url} (status: ${body.status?.uploadStatus})`)
  return { id: body.id, url }
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true] }))
  if (!args.video || !args.caption || !args.meta) {
    console.error('Использование: node post-youtube.mjs --video=<path> --caption=<path> --meta=<path>')
    process.exit(1)
  }
  await postToYoutube({ video: args.video, caption: args.caption, meta: args.meta })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
