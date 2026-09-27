// Мини-сервер для локального просмотра dist/. Без зависимостей.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const PORT = process.env.PORT || 4321

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

async function resolve(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0])
  if (p.endsWith('/')) p += 'index.html'
  let full = path.join(DIST, p)
  try {
    const s = await stat(full)
    if (s.isDirectory()) full = path.join(full, 'index.html')
    return full
  } catch {
    return null
  }
}

createServer(async (req, res) => {
  let file = await resolve(req.url)
  if (!file) {
    file = path.join(DIST, '404.html')
    res.statusCode = 404
  }
  try {
    const buf = await readFile(file)
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream')
    res.end(buf)
  } catch {
    res.statusCode = 500
    res.end('500')
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`))
