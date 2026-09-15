// Генерация PNG-иконок приложения без внешних зависимостей.
// Рисуем простую фигуру (голова + плечи) на скруглённом фоне, растрируем с
// 4-кратным сглаживанием и кодируем в PNG через zlib из стандартной библиотеки.

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(OUT, { recursive: true })

const BG = [0x3a, 0x6b, 0x5f] // акцент
const FG = [0xfa, 0xf7, 0xf0] // кремовый

// ─── PNG-кодек ────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td), 0)
  return Buffer.concat([len, td, crc])
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type RGBA
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ─── рисование ────────────────────────────────────────────────
// value(x,y) в координатах 0..1 → цвет [r,g,b] или null (прозрачно)
function iconField(maskable) {
  const pad = maskable ? 0.16 : 0.0 // безопасная зона для maskable
  const s = 1 - pad * 2
  const R = maskable ? 0.5 : 0.22 // радиус скругления фона (относительно стороны)

  function inRoundedRect(x, y) {
    const x0 = pad, y0 = pad, x1 = 1 - pad, y1 = 1 - pad
    if (x < x0 || x > x1 || y < y0 || y > y1) return false
    const r = R * s
    const cx = Math.min(Math.max(x, x0 + r), x1 - r)
    const cy = Math.min(Math.max(y, y0 + r), y1 - r)
    const dx = x - cx, dy = y - cy
    return dx * dx + dy * dy <= r * r || (x >= x0 + r && x <= x1 - r) || (y >= y0 + r && y <= y1 - r)
  }

  // фигура: голова (круг) + плечи (усечённый купол)
  const headR = 0.13 * s
  const headCx = 0.5
  const headCy = pad + 0.34 * s
  const shTop = headCy + headR * 0.7
  const shBottom = pad + 0.82 * s
  const shHalfTop = 0.16 * s
  const shHalfBottom = 0.30 * s

  function inFigure(x, y) {
    const dx = x - headCx, dy = y - headCy
    if (dx * dx + dy * dy <= headR * headR) return true
    if (y >= shTop && y <= shBottom) {
      const tt = (y - shTop) / (shBottom - shTop)
      const half = shHalfTop + (shHalfBottom - shHalfTop) * Math.sqrt(tt)
      // скругляем верхние углы плеч
      const topRound = 0.06 * s
      if (y < shTop + topRound) {
        const k = (shTop + topRound - y) / topRound
        if (Math.abs(x - headCx) > half - topRound * k) return false
      }
      return Math.abs(x - headCx) <= half
    }
    return false
  }

  return function (x, y) {
    if (!inRoundedRect(x, y)) return null
    if (inFigure(x, y)) return FG
    return BG
  }
}

function render(size, maskable) {
  const SS = 4 // суперсэмплинг
  const field = iconField(maskable)
  const out = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size
          const y = (py + (sy + 0.5) / SS) / size
          const c = field(x, y)
          if (c) {
            r += c[0]; g += c[1]; b += c[2]; a += 255
          }
        }
      }
      const n = SS * SS
      const i = (py * size + px) * 4
      out[i] = Math.round(r / n)
      out[i + 1] = Math.round(g / n)
      out[i + 2] = Math.round(b / n)
      out[i + 3] = Math.round(a / n)
    }
  }
  return encodePNG(size, size, out)
}

const jobs = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
]
for (const [name, size, maskable] of jobs) {
  writeFileSync(path.join(OUT, name), render(size, maskable))
}

// ─── favicon.ico ──────────────────────────────────────────────
// Классический .ico в корне сайта — часть поисковиков (в т. ч. Яндекс) и
// старые краулеры проверяют его отдельно от <link rel="icon">. Формат ICO
// с Windows Vista умеет хранить кадры прямо как PNG (не только BMP/DIB) —
// этим и пользуемся, тот же PNG-кодек выше, без новой зависимости.
const favSizes = [32, 16]
const favPngs = favSizes.map((s) => render(s, false))
// проставляем реальный размер в байты width/height каждой записи
const icoHeader = Buffer.alloc(6)
icoHeader.writeUInt16LE(0, 0)
icoHeader.writeUInt16LE(1, 2)
icoHeader.writeUInt16LE(favPngs.length, 4)
let favOffset = 6 + 16 * favPngs.length
const favEntries = favPngs.map((png, i) => {
  const entry = Buffer.alloc(16)
  entry[0] = favSizes[i] % 256
  entry[1] = favSizes[i] % 256
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(favOffset, 12)
  favOffset += png.length
  return entry
})
const favicoBuf = Buffer.concat([icoHeader, ...favEntries, ...favPngs])
writeFileSync(path.join(OUT, '..', 'favicon.ico'), favicoBuf)

console.log('Иконки: ' + jobs.map((j) => j[0]).join(', ') + ', favicon.ico')
