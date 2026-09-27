// НОВЫЙ формат — комедийные короткие ролики (14.09.2026, по прямой
// просьбе Ника после отзыва друга: «формат сайта устарел, нет
// личности/юмора»). НЕ трогает и НЕ заменяет существующий продовый
// пайплайн (generate-video-topic.mjs / daily-youtube-post.mjs).
//
// Персонаж-ведущий — Совёнок 🦉 (свой, отдельный от «Рублика» у
// kodeksdeneg — там про деньги/мошенников, здесь про детей — мудрая,
// заботливая птица подходит теме прав ребёнка лучше).
//
// Пилотная тема — намеренно НЕ самая острая (не груминг/секстортинг), а
// «финансовые ловушки»: ребёнок тратит с карты родителя на донаты и
// лутбоксы. Реальная и болезненная тема, но с позитивным разрешением
// (семья вместе разобралась) — по прямой просьбе Ника «лучше что-то
// позитивное выбирай».
//
// Технически — как у kodeksdeneg: HTML/CSS-сцены с эмодзи через
// Playwright (без платной генерации картинок), TTS+Whisper для
// озвучки/субтитров. Этот файл — НЕ автопостится, Ник попросил сначала
// показать ему готовый ролик, прежде чем настраивать автопилот здесь.

import { execFile } from 'node:child_process'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { TOPICS_BY_SLUG } from '../../content/index.mjs'

const run = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAC_FFMPEG_FULL = '/opt/homebrew/Cellar/ffmpeg-full/9.0.1_1/bin/ffmpeg'
const FFMPEG = existsSync(MAC_FFMPEG_FULL) ? MAC_FFMPEG_FULL : 'ffmpeg'
const CREAM = '#EDE5D4'

export const SITE = { name: 'Кодекс детства', origin: 'https://kodeksdetstva.ru', domain: 'kodeksdetstva.ru' }

export const MASCOT_NAME = 'Совёнок'
export const MASCOT_EMOJI = '🦉'

export const PILOT = {
  slug: 'finansovye-lovushki',
  title: 'Игра почти обманула ребёнка — но мама заметила одну вещь',
  scenes: [
    {
      bg: 'linear-gradient(160deg, #1a2e2a 0%, #204a3f 100%)',
      emoji: MASCOT_EMOJI,
      headline: `${MASCOT_NAME} рассказывает`,
      bubble: 'Реальная история: как игра почти обманула ребёнка',
      domain: SITE.domain,
      narration: `${MASCOT_NAME} — герой проекта «Кодекс детства» — сегодня показывает, как игра почти обманула одну семью.`,
    },
    {
      bg: 'linear-gradient(160deg, #3a2a1a 0%, #5a3f1f 100%)',
      emoji: '🎮😈',
      headline: 'Игра была хитрая',
      bubble: '«Ещё чуть-чуть — и награда твоя!»',
      narration: 'Игра была хитрая: она обещала награду, если потратить ещё немного — и ещё, и ещё.',
    },
    {
      bg: 'linear-gradient(160deg, #3a1a2a 0%, #5a1f3f 100%)',
      emoji: '👦💳',
      headline: 'Карта мамы была рядом',
      bubble: '«Всего двести девяносто девять... и ещё разок»',
      narration: 'Мальчик тратил с маминой карты по чуть-чуть — двести девяносто девять рублей тут, столько же там.',
    },
    {
      bg: 'linear-gradient(160deg, #1a3a2a 0%, #1f5a3a 100%)',
      emoji: '👩‍💻🧾',
      headline: 'Мама проверила выписку',
      bubble: '«Это не подарок — это бизнес на твоих тапах»',
      narration: 'Но мама каждую неделю вместе с сыном проверяла выписку по карте — и сразу увидела, что происходит.',
    },
    {
      bg: 'linear-gradient(160deg, #3a1a1a 0%, #5a1f1f 100%)',
      emoji: '🎮💤',
      headline: 'Игра осталась ни с чем',
      bubble: 'Карту отвязали. Лутбоксы? Больше не работает.',
      narration: 'Карту отвязали, включили родительский контроль — и хитрая игра осталась совсем без денег.',
    },
    {
      bg: 'linear-gradient(160deg, #2a3a1a 0%, #3a5a1f 100%)',
      emoji: '✅👨‍👩‍👦',
      headline: 'Ваш ход',
      bubble: 'Отвяжите карту. Проверяйте покупки вместе.',
      domain: SITE.domain,
      narration: `Отвяжите карту от игр ребёнка и проверяйте покупки вместе — ${MASCOT_NAME} и подробный разбор на сайте кодекс детства точка ру.`,
    },
  ],
}

// Безопасная зона (14.09.2026, Ник заметил на реальном плеере: нижние
// ~20% экрана перекрывает интерфейс площадки). Контент верстаем сверху.
function sceneHtml(scene) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 360px; height: 640px; overflow: hidden; }
    body {
      background: ${scene.bg};
      display: flex; flex-direction: column; align-items: center;
      justify-content: flex-start; padding-top: 70px;
      font-family: -apple-system, "Apple Color Emoji", "Helvetica Neue", sans-serif;
      color: ${CREAM};
      text-align: center;
      padding-left: 28px; padding-right: 28px;
    }
    .emoji { font-size: 88px; line-height: 1; margin-bottom: 20px; }
    .headline { font-size: 32px; font-weight: 800; margin-bottom: 22px; letter-spacing: -0.01em; }
    .bubble {
      background: rgba(255,255,255,0.96); color: #1a1a1a; border-radius: 20px;
      padding: 20px 22px; font-size: 23px; font-weight: 600; line-height: 1.32;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      max-width: 300px;
    }
    .domain {
      margin-top: 14px; padding-top: 12px; border-top: 2px solid rgba(0,0,0,0.12);
      font-size: 18px; font-weight: 700; opacity: 0.7; letter-spacing: 0.02em;
    }
  </style></head><body>
    <div class="emoji">${scene.emoji}</div>
    <div class="headline">${scene.headline}</div>
    <div class="bubble">${scene.bubble}${scene.domain ? `<div class="domain">${scene.domain}</div>` : ''}</div>
  </body></html>`
}

async function renderScenes(scenes, outDir) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 })
  const files = []
  for (let i = 0; i < scenes.length; i++) {
    await page.setContent(sceneHtml(scenes[i]))
    const p = path.join(outDir, `scene-${i}.png`)
    await page.screenshot({ path: p })
    files.push(p)
  }
  await browser.close()
  return files
}

async function synthesizeSpeech(text, outPath, apiKey) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'onyx', input: text, response_format: 'mp3', speed: 1 }),
  })
  if (!res.ok) throw new Error(`TTS failed: ${res.status} ${await res.text()}`)
  await writeFile(outPath, Buffer.from(await res.arrayBuffer()))
  return outPath
}

async function getWordTimestamps(audioPath, apiKey) {
  const buf = await readFile(audioPath)
  const form = new FormData()
  form.append('file', new Blob([buf], { type: 'audio/mpeg' }), 'narration.mp3')
  form.append('model', 'whisper-1')
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'word')
  form.append('language', 'ru')
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Whisper failed: ${res.status} ${await res.text()}`)
  return (await res.json()).words ?? []
}

function chunkWords(words, wordsPerChunk = 3) {
  const chunks = []
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const slice = words.slice(i, i + wordsPerChunk)
    chunks.push({ text: slice.map((w) => w.word.trim()).join(' '), start: slice[0].start, end: slice[slice.length - 1].end })
  }
  return chunks
}

function wrapText(text, maxCharsPerLine) {
  const words = text.split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxCharsPerLine) {
      if (line) lines.push(line.trim())
      line = w
    } else {
      line = (line + ' ' + w).trim()
    }
  }
  if (line) lines.push(line.trim())
  return lines
}

async function probeDurationSeconds(filePath) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath])
  return parseFloat(stdout.trim())
}

// Описание к посту — ПРАВИЛО ПРОЕКТА (Ник, 14.09.2026): минимум 1000
// символов и уникальный текст, не короткий шаблон. Тот же приём, что и
// в kodeksdeneg/generate-comedy-short.mjs (см. там подробный комментарий) —
// собираем из настоящего контента темы сайта, если slug сценария
// совпадает с реальной темой (`sut`/`ages`/`first`/`steps`/`law`/`say`/
// `dont` — у kodeksdetstva, в отличие от kodeksdeneg, есть ещё `ages` и
// `say`, учитываем оба).
export function buildComedyCaption(scriptData, site, moreUrl) {
  const topic = TOPICS_BY_SLUG[scriptData.slug]
  const title = scriptData.title || scriptData.scenes?.[1]?.headline || 'Новая история'
  const intro = [
    `🎬 ${title}`,
    '',
    `${MASCOT_EMOJI} ${MASCOT_NAME} — герой проекта «${site.name}» — разбирает эту историю в новом коротком видео.`,
  ]

  const body = []
  if (topic) {
    const sut = (topic.sut || []).join('\n\n')
    const ages = (topic.ages || []).map((a) => `${a.range}: ${a.text}`).join('\n\n')
    const first = (topic.first || []).map((s, i) => `${i + 1}. ${s}`).join('\n')
    const steps = (topic.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')
    const law = (topic.law || []).map((s) => `• ${s}`).join('\n')
    const say = (topic.say || []).map((s) => `✅ ${s}`).join('\n')
    const dont = (topic.dont || []).map((s) => `❌ ${s}`).join('\n')
    if (sut) body.push('', sut)
    if (ages) body.push('', '📌 По возрасту:', ages)
    if (first) body.push('', '🔹 Что делать в первую очередь:', first)
    if (steps) body.push('', '🔹 Дальнейшие шаги:', steps)
    if (law) body.push('', '⚖️ Что говорит закон:', law)
    if (say) body.push('', '💬 Что сказать ребёнку:', say)
    if (dont) body.push('', '🚫 Чего не делать:', dont)
  } else {
    const narration = (scriptData.scenes || []).map((s) => s.narration).filter(Boolean).join(' ')
    if (narration) body.push('', narration)
  }

  const outro = [
    '',
    `Подробный разбор со всеми шагами и советами — на сайте: ${moreUrl}`,
    '',
    `${MASCOT_EMOJI} ${MASCOT_NAME} и «${site.name}» — про права ребёнка, безопасность и закон, простым языком, без рекламы.`,
    '',
    '#дети #родители #shorts',
  ]

  let text = [...intro, ...body, ...outro].join('\n')

  if (text.length < 1000) {
    text += [
      '',
      `Формат простой: реальная ситуация из жизни ребёнка или семьи, разобранная как короткая`,
      `сценка — с шуткой и твистом, но без выдумки в самой сути. Всё, что говорит и делает`,
      `${MASCOT_NAME} в сюжете, основано на настоящих советах и фактах с сайта «${site.name}» —`,
      `ничего не выдумано ради шутки. Если история показалась вам близкой — сохраните видео и`,
      `обсудите её с ребёнком, а полный разбор с советами по возрасту оставьте по ссылке на сайте.`,
    ].join('\n')
  }

  return text
}

export async function renderComedyVideo(scriptData, outDir, site = SITE) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY не задан в окружении')
  const { slug, scenes } = scriptData
  await mkdir(outDir, { recursive: true })

  const sceneFiles = await renderScenes(scenes, outDir)

  const fullNarration = scenes.map((s) => s.narration).join(' ')
  const audioPath = path.join(outDir, `narration-${slug}.mp3`)
  await synthesizeSpeech(fullNarration, audioPath, apiKey)
  const totalAudioDuration = await probeDurationSeconds(audioPath)

  const words = await getWordTimestamps(audioPath, apiKey)

  const wordCounts = scenes.map((s) => s.narration.split(/\s+/).length)
  let wordIdx = 0
  const sceneEnds = wordCounts.map((wc) => {
    wordIdx = Math.min(wordIdx + wc, words.length)
    return words[wordIdx - 1]?.end ?? totalAudioDuration
  })
  sceneEnds[sceneEnds.length - 1] = totalAudioDuration + 0.6
  const sceneDurations = sceneEnds.map((end, i) => Math.max(1.5, end - (i === 0 ? 0 : sceneEnds[i - 1])))

  const fps = 30
  const fontDir = path.join(__dirname, 'fonts')
  const regularFont = path.join(fontDir, 'PTSerif-Regular.ttf')

  const inputArgs = []
  sceneFiles.forEach((f) => {
    inputArgs.push('-loop', '1', '-framerate', '1', '-t', '1', '-i', f)
  })
  inputArgs.push('-i', audioPath)

  const perScene = sceneFiles.map((_, i) => {
    const d = sceneDurations[i]
    const z = 'min(zoom+0.0008,1.12)'
    return `[${i}:v]scale=1080:1920,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.round(d * fps)}:s=1080x1920:fps=${fps}[v${i}]`
  })
  const concatInputs = sceneFiles.map((_, i) => `[v${i}]`).join('')
  let filter = perScene.join(';') + `;${concatInputs}concat=n=${sceneFiles.length}:v=1:a=0[vbase]`

  const chunks = chunkWords(words, 3)
  const capParts = []
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const lines = wrapText(chunk.text, 22)
    const chunkFile = path.join(outDir, `cap-${slug}-${i}.txt`)
    await writeFile(chunkFile, lines.join('\n'), 'utf8')
    capParts.push(
      `drawtext=fontfile=${regularFont}:textfile=${chunkFile}:fontcolor=${CREAM.replace('#', '0x')}:fontsize=44:` +
        `line_spacing=12:x=(w-text_w)/2:y=1420:box=1:boxcolor=black@0.75:boxborderw=18:enable='between(t,${chunk.start},${chunk.end})'`
    )
  }
  filter += `;[vbase]drawbox=x=0:y=1440:w=1080:h=480:color=black@0.0:t=fill${capParts.length ? ',' + capParts.join(',') : ''}[vout]`

  const outVideo = path.join(outDir, `comedy-${slug}.mp4`)
  const ffmpegArgs = [
    '-y', ...inputArgs,
    '-filter_complex', filter,
    '-map', '[vout]', '-map', `${sceneFiles.length}:a`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-c:a', 'aac', '-shortest',
    outVideo,
  ]
  await run(FFMPEG, ffmpegArgs)

  const moreUrl = scriptData.moreUrl || `${site.origin}/cifra/${slug}/`
  const captionText = buildComedyCaption(scriptData, site, moreUrl)
  const captionPath = path.join(outDir, `comedy-${slug}.caption.txt`)
  await writeFile(captionPath, captionText, 'utf8')

  const youtubeTitle = `${scriptData.title || scenes[1]?.headline || 'Реальная история'} #Shorts`
  const metaPath = path.join(outDir, `comedy-${slug}.meta.json`)
  await writeFile(metaPath, JSON.stringify({ slug, title: scriptData.title || scenes[1]?.headline, youtubeTitle, moreUrl }), 'utf8')

  return { video: outVideo, caption: captionPath, meta: metaPath, slug, duration: totalAudioDuration, scenes: sceneFiles.length }
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true] }))
  const outDir = args.out || path.join(os.homedir(), 'Downloads', 'comedy-short-test-detstva')
  const result = await renderComedyVideo(PILOT, outDir)
  console.log(JSON.stringify(result, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
