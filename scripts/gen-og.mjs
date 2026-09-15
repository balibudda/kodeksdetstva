// OG-обложка 1200×630 для превью ссылок (Telegram, VK, Facebook, Google).
// Без зависимостей: свой PNG-кодек, штриховой шрифт из ломаных, 3× сглаживание.
// Эмблема повторяет фавикон («голова + плечи»), рядом — надпись «КОДЕКС ДЕТСТВА».
// Запуск: node scripts/gen-og.mjs  →  public/og-cover.png

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og-cover.png')

const BG = [0x35, 0x65, 0x5a] // акцент
const BASE = [0x2b, 0x50, 0x47] // тёмная полоса снизу
const FG = [0xfa, 0xf7, 0xf0] // кремовый

const W = 1200
const H = 630

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

// ─── эмблема: «голова + плечи» ───────────────────────────────
const CX = 268
const HEAD_CY = 258
const HEAD_R = 100
const TORSO_TOP = HEAD_CY + HEAD_R * 0.68
const TORSO_BOTTOM = 520
const TORSO_HALF_TOP = 104
const TORSO_HALF_BOTTOM = 214

function inFigure(px, py) {
  const dx = px - CX
  const dy = py - HEAD_CY
  if (dx * dx + dy * dy <= HEAD_R * HEAD_R) return true
  if (py >= TORSO_TOP && py <= TORSO_BOTTOM) {
    const tt = (py - TORSO_TOP) / (TORSO_BOTTOM - TORSO_TOP)
    const half = TORSO_HALF_TOP + (TORSO_HALF_BOTTOM - TORSO_HALF_TOP) * Math.sqrt(tt)
    return Math.abs(px - CX) <= half
  }
  return false
}

// ─── штриховой шрифт (ломаные в боксе 0..1, y вниз) ──────────
// каждая буква — массив путей, путь — массив точек [x,y]
const GLYPHS = {
  К: [
    [[0, 0], [0, 1]],
    [[0, 0.52], [0.92, 0]],
    [[0, 0.52], [0.92, 1]],
  ],
  О: [
    [[0.5, 0], [0.85, 0.12], [1, 0.5], [0.85, 0.88], [0.5, 1], [0.15, 0.88], [0, 0.5], [0.15, 0.12], [0.5, 0]],
  ],
  Д: [
    [[0.26, 0.06], [0.74, 0.06], [0.9, 0.84], [0.98, 0.84], [0.98, 1]],
    [[0.26, 0.06], [0.12, 0.84], [0.02, 0.84], [0.02, 1]],
    [[0.1, 0.84], [0.9, 0.84]],
  ],
  Е: [
    [[0.96, 0], [0, 0], [0, 1], [0.96, 1]],
    [[0, 0.5], [0.78, 0.5]],
  ],
  С: [
    [[1, 0.12], [0.55, 0], [0.16, 0.2], [0, 0.5], [0.16, 0.8], [0.55, 1], [1, 0.88]],
  ],
  Т: [
    [[0, 0], [1, 0]],
    [[0.5, 0], [0.5, 1]],
  ],
  В: [
    [[0, 0], [0, 1]],
    [[0, 0], [0.66, 0], [0.92, 0.14], [0.66, 0.48], [0, 0.48]],
    [[0, 0.48], [0.74, 0.48], [1, 0.74], [0.74, 1], [0, 1]],
  ],
  А: [
    [[0.5, 0], [0.04, 1]],
    [[0.5, 0], [0.96, 1]],
    [[0.2, 0.64], [0.8, 0.64]],
  ],
  ' ': [],
}

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

// нарисованные слова: {text, x, y, cell, gap, stroke}
const WORDS = [
  { text: 'КОДЕКС', x: 520, y: 165, cw: 90, ch: 122, gap: 15, stroke: 18 },
  { text: 'ДЕТСТВА', x: 520, y: 344, cw: 78, ch: 122, gap: 12, stroke: 18 },
]

// предрасчёт боксов букв
const PLACED = []
for (const wrd of WORDS) {
  let cx = wrd.x
  for (const ch of wrd.text) {
    if (ch !== ' ') PLACED.push({ ch, x: cx, y: wrd.y, w: wrd.cw, h: wrd.ch, s: wrd.stroke })
    cx += wrd.cw + wrd.gap
  }
}

function inText(px, py) {
  for (const g of PLACED) {
    if (px < g.x - g.s || px > g.x + g.w + g.s || py < g.y - g.s || py > g.y + g.h + g.s) continue
    const paths = GLYPHS[g.ch]
    if (!paths) continue
    const hs = g.s / 2
    for (const pathPts of paths) {
      for (let i = 0; i < pathPts.length - 1; i++) {
        const ax = g.x + pathPts[i][0] * g.w
        const ay = g.y + pathPts[i][1] * g.h
        const bx = g.x + pathPts[i + 1][0] * g.w
        const by = g.y + pathPts[i + 1][1] * g.h
        if (distToSeg(px, py, ax, ay, bx, by) <= hs) return true
      }
    }
  }
  return false
}

// тонкая линейка + тёмная полоса снизу
const RULE_Y = 556
const RULE_TH = 5
const BASE_Y = 568

function color(px, py) {
  if (Math.abs(py - RULE_Y) <= RULE_TH / 2 && px >= 80 && px <= W - 80) return FG
  if (inFigure(px, py) || inText(px, py)) return FG
  if (py >= BASE_Y) return BASE
  return BG
}

// рендер с 3× сглаживанием
const SS = 3
const out = Buffer.alloc(W * H * 4)
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let r = 0,
      g = 0,
      b = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const c = color(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)
        r += c[0]
        g += c[1]
        b += c[2]
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
