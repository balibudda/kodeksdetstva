// Разовая авторизация YouTube OAuth — даёт права на загрузку видео
// (youtube.upload) + чтение аналитики (youtube.readonly, yt-analytics.readonly).
// Тот же паттерн, что уже работает на nikolablajen-app.
//
// OAuth-клиент должен быть типа "Desktop app" в Google Cloud Console — для
// таких клиентов redirect `http://localhost` разрешён без какой-либо
// дополнительной настройки в консоли. Google перенаправит браузер на
// http://localhost/?code=... — страница не откроется («не удаётся получить
// доступ к сайту»), но код будет прямо в адресной строке.
//
// Перед запуском: в Google Cloud Console включить YouTube Data API v3
// (и YouTube Analytics API, если нужна аналитика) на том же проекте.
//
// Шаг 1 (без --code): печатает ссылку для авторизации. Открыть, выбрать
//   канал, разрешить. Скопировать значение code=... из адресной строки.
// Шаг 2 (--code=<код>): обменивает код на refresh_token (печатается).
//   Сохранить как секрет YT_REFRESH_TOKEN в GitHub.
const REDIRECT_URI = 'http://localhost'
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
].join(' ')

function arg(name) {
  const hit = process.argv.slice(2).find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (!hit) return undefined
  return hit.includes('=') ? hit.split('=').slice(1).join('=') : true
}

async function main() {
  const clientId = process.env.YT_CLIENT_ID
  const clientSecret = process.env.YT_CLIENT_SECRET
  if (!clientId) {
    console.error('YT_CLIENT_ID not set')
    process.exit(1)
  }

  const code = arg('code')
  if (!code) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent', // force a fresh refresh_token
    })
    console.log(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
    return
  }

  if (!clientSecret) {
    console.error('YT_CLIENT_SECRET not set (needed for the code exchange)')
    process.exit(1)
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: String(code),
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  })
  const data = await res.json()
  if (!data.refresh_token) {
    throw new Error(`token exchange failed (no refresh_token): ${JSON.stringify(data)}`)
  }
  console.log(`refresh_token: ${data.refresh_token}`)
  console.log(`scope: ${data.scope}`)
  console.log('Save the refresh_token above as the YT_REFRESH_TOKEN repo secret.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
