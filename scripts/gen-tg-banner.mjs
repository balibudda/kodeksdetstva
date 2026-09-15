// Баннер 640×360 для Telegram Mini App (/newapp в @BotFather).
// Без зависимостей: свой PNG-кодек + растеризация с 3× сглаживанием.
// Запуск: node scripts/gen-tg-banner.mjs  → public/tg-app-banner.png

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'tg-app-banner.png')

const BG = [0x3a, 0x6b, 0x5f] // акцент
const FG = [0xfa, 0xf7, 0xf0] // кремовый

// ─── PNG-кодек ───────────────────────────────────────────────
const CRC = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
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
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = w * 4
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ─── композиция (координаты 0..1 по большей стороне-эквиваленту) ──
// x,y в пикселях; W,H — размер
const W = 640
const H = 360

// фигура «голова + плечи», центр по x = cx (доля ширины), по вертикали привязана к H
function inFigure(px, py) {
  const cx = 0.28 * W
  const headCy = 0.34 * H
  const headR = 0.17 * H
  const shTop = headCy + headR * 0.65
  const shBottom = 0.9 * H
  const shHalfTop = 0.17 * H
  const shHalfBottom = 0.34 * H
  const dx = px - cx
  const dy = py - headCy
  if (dx * dx + dy * dy <= headR * headR) return true
  if (py >= shTop && py <= shBottom) {
    const tt = (py - shTop) / (shBottom - shTop)
    const half = shHalfTop + (shHalfBottom - shHalfTop) * Math.sqrt(tt)
    return Math.abs(px - cx) <= half
  }
  return false
}

// «строки кодекса» справа от фигуры
function inLines(px, py) {
  const x0 = 0.52 * W
  const rows = [0.4, 0.5, 0.6, 0.7]
  const widths = [0.4, 0.38, 0.34, 0.22]
  const th = 0.028 * H
  for (let i = 0; i < rows.length; i++) {
    const cy = rows[i] * H
    if (Math.abs(py - cy) <= th / 2 && px >= x0 && px <= x0 + widths[i] * W) return true
  }
  return false
}

function color(px, py) {
  if (inFigure(px, py) || inLines(px, py)) return FG
  return BG
}

// рендер с 3× сглаживанием
const SS = 3
const out = Buffer.alloc(W * H * 4)
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const c = color(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)
        r += c[0]; g += c[1]; b += c[2]
      }
    }
    const n = SS * SS
    const i = (y * W + x) * 4
    out[i] = Math.round(r / n)
    out[i + 1] = Math.round(g / n)
    out[i + 2] = Math.round(b / n)
    out[i + 3] = 255
  }
}

writeFileSync(OUT, encodePNG(W, H, out))
console.log('Готово:', OUT)
