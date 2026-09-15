// Временный публичный хостинг файлов через GitHub Releases — единственный
// способ дать стороннему API (Meta Graph API — Facebook/Instagram/Threads)
// ссылку на файл для скачивания, когда своего облачного хранилища с
// публичными URL нет. По образцу nikolablajen-app/scripts/social/
// github-asset-host.mjs.
//
// Хранится в отдельном публичном репозитории balibudda/kodeksdetstva-assets
// (без исходного кода — только файлы в одном "плавающем" Release
// "social-temp"). Каждая загрузка удаляется сразу после использования.
import { readFile } from 'node:fs/promises'

const REPO = 'balibudda/kodeksdetstva-assets'
const TAG = 'social-temp'
const API = 'https://api.github.com'

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
}

function getToken() {
  const token = process.env.GH_ASSETS_TOKEN
  if (!token) throw new Error('no GitHub token available for asset upload (GH_ASSETS_TOKEN)')
  return token
}

async function getOrCreateRelease(token) {
  let res = await fetch(`${API}/repos/${REPO}/releases/tags/${TAG}`, { headers: authHeaders(token) })
  if (res.ok) return res.json()
  res = await fetch(`${API}/repos/${REPO}/releases`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_name: TAG,
      name: 'Temporary social media assets',
      body: 'Временные файлы, чтобы дать сторонним API (Meta и т.п.) публичную ссылку при публикации. Каждая загрузка удаляется сразу после использования — если что-то тут задержалось, значит очистка не сработала, можно смело удалить руками.',
      prerelease: true,
    }),
  })
  if (!res.ok) throw new Error(`could not create release: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function uploadTempAsset(buf, name, contentType = 'application/octet-stream') {
  const token = getToken()
  const release = await getOrCreateRelease(token)
  const res = await fetch(
    `https://uploads.github.com/repos/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`,
    { method: 'POST', headers: { ...authHeaders(token), 'Content-Type': contentType }, body: buf }
  )
  if (!res.ok) throw new Error(`asset upload failed: ${res.status} ${await res.text()}`)
  const asset = await res.json()
  return { url: `https://github.com/${REPO}/releases/download/${TAG}/${name}`, assetId: asset.id }
}

export async function uploadTempAssetFile(filePath, name, contentType) {
  return uploadTempAsset(await readFile(filePath), name, contentType)
}

export async function deleteTempAsset(assetId) {
  if (!assetId) return
  try {
    const token = getToken()
    await fetch(`${API}/repos/${REPO}/releases/assets/${assetId}`, { method: 'DELETE', headers: authHeaders(token) })
  } catch (e) {
    console.warn(`deleteTempAsset(${assetId}) failed:`, e.message)
  }
}
