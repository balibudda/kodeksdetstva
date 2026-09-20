// One-off: delete a video by id via the Data API (needs a scope broader
// than youtube.upload to actually succeed — kept for cleanup use).
const id = process.argv[2]
if (!id) {
  console.error('Usage: node yt-delete-video.mjs <videoId>')
  process.exit(1)
}

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
  if (!json.access_token) throw new Error(`token refresh failed: ${JSON.stringify(json)}`)
  return json.access_token
}

const token = await accessToken()
const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${id}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}` },
})
console.log(res.status)
console.log(await res.text())
