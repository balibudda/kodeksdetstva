// Публикует уже готовый ролик (video/caption/meta от generate-video-topic.mjs)
// на Facebook-страницу через Graph API. Нужны FB_PAGE_ID / FB_PAGE_TOKEN
// (постоянный Page Access Token) + GH_ASSETS_TOKEN (временный хостинг видео
// для Facebook — см. github-asset-host.mjs).
import { readFile } from 'node:fs/promises'
import { uploadTempAsset, deleteTempAsset } from './github-asset-host.mjs'

const API_VERSION = 'v21.0'

// { video, caption, meta } — пути к файлам от renderTopicVideo().
export async function postToFacebook({ video, caption, meta }) {
  const pageId = process.env.FB_PAGE_ID
  const token = process.env.FB_PAGE_TOKEN
  if (!pageId || !token) throw new Error('FB_PAGE_ID / FB_PAGE_TOKEN not set')
  if (!process.env.GH_ASSETS_TOKEN) throw new Error('GH_ASSETS_TOKEN not set — cannot host the video for Facebook to fetch')

  let captionText = await readFile(caption, 'utf8')
  const metaJson = JSON.parse(await readFile(meta, 'utf8'))
  if (metaJson.moreUrl && !captionText.includes(metaJson.moreUrl)) {
    captionText = `${captionText.trimEnd()}\n\n🔗 ${metaJson.moreUrl}`
  }

  const videoBuf = await readFile(video)
  console.log('Facebook: загружаю видео на временный хостинг…')
  const { url: videoUrl, assetId } = await uploadTempAsset(videoBuf, `fb-${metaJson.slug}-${Date.now()}.mp4`, 'video/mp4')

  try {
    console.log('Facebook: публикую…')
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${pageId}/videos`, {
      method: 'POST',
      body: new URLSearchParams({ file_url: videoUrl, description: captionText, access_token: token }),
    })
    const body = await res.json()
    if (!body.id) throw new Error(`Facebook post failed: ${JSON.stringify(body)}`)
    console.log('Опубликовано:', JSON.stringify(body))
    return { id: body.id }
  } finally {
    await deleteTempAsset(assetId)
  }
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true] }))
  if (!args.video || !args.caption || !args.meta) {
    console.error('Использование: node post-facebook.mjs --video=<path> --caption=<path> --meta=<path>')
    process.exit(1)
  }
  await postToFacebook({ video: args.video, caption: args.caption, meta: args.meta })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
