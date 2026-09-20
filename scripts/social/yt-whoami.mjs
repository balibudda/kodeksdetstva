// One-off: print which channel a YT_REFRESH_TOKEN actually resolves to,
// via channels?mine=true. Use before trusting a freshly-issued token.
async function accessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YT_CLIENT_ID,
      client_secret: process.env.YT_CLIENT_SECRET,
      refresh_token: process.env.YT_REFRESH_TOKEN_CANDIDATE,
      grant_type: 'refresh_token',
    }),
  })
  const json = await res.json()
  if (!json.access_token) throw new Error(`token refresh failed: ${JSON.stringify(json)}`)
  return json.access_token
}

const token = await accessToken()
const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
  headers: { Authorization: `Bearer ${token}` },
})
const body = await res.json()
console.log(JSON.stringify(body, null, 2))
