// Рендер вертикального (1080x1920) видео-поста по одной теме сайта: реальный
// скриншот страницы темы (мобильная раскладка) с Ken Burns-движением,
// синхронные подписи по словам (Whisper), озвучка сути темы (OpenAI TTS),
// водяной знак kodeksdetstva.ru. Формат подтверждён Ником 13.09.2026 — не
// менять без явного запроса (реальный скрин страницы, не сгенерированный
// фон; без дублирования заголовка текстом; непрозрачная плашка субтитров;
// длинный текст поста — вся суть/шаги/закон/что сказать, не тизер).
//
// Использование как модуля: import { renderTopicVideo } from './generate-video-topic.mjs'
// Использование из CLI: node scripts/social/generate-video-topic.mjs --slug=<slug> [--out=dir]
import { execFile } from 'node:child_process'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { chromium } from 'playwright'
import { TOPICS, TOPICS_BY_SLUG, topicUrl } from '../../content/index.mjs'

const run = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')

export const SITE = { name: 'Кодекс детства', origin: 'https://kodeksdetstva.ru' }
const CREAM = '0xEDE5D4'

async function screenshotTopicPage(url, outPath) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 })
  await page.addInitScript(() => { try { localStorage.setItem('kd_cookie_consent', '0') } catch (e) {} })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.screenshot({ path: outPath })
  await browser.close()
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

async function synthesizeSpeech(text, outPath, { voice = 'onyx', speed = 1 } = {}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('OPENAI_API_KEY not set — видео будет без озвучки.')
    return null
  }
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice, input: text, response_format: 'mp3', speed }),
  })
  if (!res.ok) {
    console.warn('TTS request failed:', res.status, await res.text())
    return null
  }
  await writeFile(outPath, Buffer.from(await res.arrayBuffer()))
  return outPath
}

async function getWordTimestamps(audioPath) {
  const apiKey = process.env.OPENAI_API_KEY
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
  if (!res.ok) {
    console.warn('Whisper transcription failed:', res.status, await res.text())
    return null
  }
  const data = await res.json()
  return data.words ?? null
}

function chunkWords(words, wordsPerChunk = 4) {
  const chunks = []
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const slice = words.slice(i, i + wordsPerChunk)
    chunks.push({ text: slice.map((w) => w.word.trim()).join(' '), start: slice[0].start, end: slice[slice.length - 1].end })
  }
  return chunks
}

async function probeDurationSeconds(filePath) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath])
  return parseFloat(stdout.trim())
}

// Полный, длинный пост — не короткий тизер (правило проекта: не сокращать
// текст вручную, заполнять реальный объём площадки; см. nikolablajen
// feedback_social_post_max_volume). Используем весь контент темы.
export function buildCaption(topic) {
  const url = SITE.origin + topicUrl(topic)
  const sut = (topic.sut || []).join('\n\n')
  const first = (topic.first || []).map((s, i) => `${i + 1}. ${s}`).join('\n')
  const steps = (topic.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')
  const law = (topic.law || []).map((s) => `• ${s}`).join('\n')
  const say = (topic.say || []).map((s) => `✅ ${s}`).join('\n')
  const dont = (topic.dont || []).map((s) => `❌ ${s}`).join('\n')
  const ages = (topic.ages || []).map((a) => `${a.range}: ${a.text}`).join('\n\n')

  return [
    `⚠️ ${topic.title}`,
    '',
    sut,
    ...(ages ? ['', '📌 По возрасту:', ages] : []),
    '',
    '🔹 Что делать в первую очередь:',
    first,
    ...(steps ? ['', '🔹 Дальнейшие шаги:', steps] : []),
    ...(law ? ['', '⚖️ Что говорит закон:', law] : []),
    ...(say ? ['', '💬 Что сказать ребёнку:', say] : []),
    ...(dont ? ['', '🚫 Чего не делать:', dont] : []),
    '',
    `Полный разбор со всеми контактами и ссылками на закон — на сайте: ${url}`,
    '',
    `🧭 ${SITE.name} — бесплатный справочник для родителей и подростков о правах ребёнка, безопасности и законе.`,
  ].join('\n')
}

// Рендерит ролик по теме в outDir, возвращает пути к готовым файлам.
// Используется и CLI-обёрткой ниже, и daily-youtube-post.mjs.
export async function renderTopicVideo(slug, outDir) {
  const topic = TOPICS_BY_SLUG[slug]
  if (!topic) throw new Error(`тема не найдена: ${slug}`)

  await mkdir(outDir, { recursive: true })

  const fontDir = path.join(__dirname, 'fonts')
  const regularFont = path.join(fontDir, 'PTSerif-Regular.ttf')

  const bgPath = path.join(outDir, `bg-${slug}.png`)
  const pageUrl = SITE.origin + topicUrl(topic)
  await screenshotTopicPage(pageUrl, bgPath)

  const sutText = (topic.sut || []).join(' ')
  const firstStep = (topic.first || [])[0] || ''
  const narrationText = `${topic.title}. ${sutText} ${firstStep} Полный разбор — на сайте кодекс детства точка ру.`

  const audioPath = path.join(outDir, `narration-${slug}.mp3`)
  const audioFile = await synthesizeSpeech(narrationText, audioPath)
  const audioDuration = audioFile ? await probeDurationSeconds(audioFile) : 0
  const words = audioFile ? await getWordTimestamps(audioFile) : null

  const fps = 30
  const duration = Math.max(12, Math.ceil(audioDuration + 1.5))
  const z = 'min(zoom+0.0006,1.15)'
  const x = 'iw/2-(iw/zoom/2)'
  const y = 'ih/2-(ih/zoom/2)'

  // Заголовок уже виден на самом скриншоте страницы — не дублируем его
  // текстом поверх. Только непрозрачная плашка субтитров снизу + водяной знак.
  const filterParts = [
    `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,` +
      `zoompan=z='${z}':x='${x}':y='${y}':d=${duration * fps}:s=1080x1920:fps=${fps}`,
    `drawbox=x=0:y=1440:w=1080:h=480:color=black@0.92:t=fill`,
  ]

  if (words && words.length) {
    const chunks = chunkWords(words, 4)
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const lines = wrapText(chunk.text, 26)
      const chunkFile = path.join(outDir, `cap-${slug}-${i}.txt`)
      await writeFile(chunkFile, lines.join('\n'), 'utf8')
      filterParts.push(
        `drawtext=fontfile=${regularFont}:textfile=${chunkFile}:fontcolor=${CREAM}:fontsize=50:` +
          `line_spacing=14:x=(w-text_w)/2:y=1490:box=0:enable='between(t,${chunk.start},${chunk.end})'`
      )
    }
  } else {
    const teaserLines = wrapText(sutText, 34)
    const teaserFile = path.join(outDir, `teaser-${slug}.txt`)
    await writeFile(teaserFile, teaserLines.join('\n'), 'utf8')
    filterParts.push(`drawtext=fontfile=${regularFont}:textfile=${teaserFile}:fontcolor=${CREAM}:fontsize=38:line_spacing=12:x=(w-text_w)/2:y=1490:box=0`)
  }

  filterParts.push(`drawtext=fontfile=${regularFont}:text='kodeksdetstva.ru':fontcolor=0x8A806E:fontsize=30:x=(w-text_w)/2:y=h-60:box=0`)
  const filter = filterParts.join(',')

  const outVideo = path.join(outDir, `${slug}.mp4`)
  const ffmpegArgs = ['-y', '-loop', '1', '-i', bgPath]
  if (audioFile) ffmpegArgs.push('-i', audioFile)
  ffmpegArgs.push('-t', String(duration), '-vf', filter, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(fps))
  if (audioFile) ffmpegArgs.push('-c:a', 'aac', '-shortest', '-map', '0:v', '-map', '1:a')
  ffmpegArgs.push(outVideo)

  await run('ffmpeg', ffmpegArgs)

  const captionPath = path.join(outDir, `${slug}.caption.txt`)
  await writeFile(captionPath, buildCaption(topic), 'utf8')

  const metaPath = path.join(outDir, `${slug}.meta.json`)
  const youtubeTitle = topic.title.length > 90 ? `${topic.title.slice(0, 86)}… #Shorts` : `${topic.title} #Shorts`
  await writeFile(metaPath, JSON.stringify({ slug, title: topic.title, youtubeTitle, moreUrl: SITE.origin + topicUrl(topic) }), 'utf8')

  return { video: outVideo, caption: captionPath, meta: metaPath, slug, narrated: Boolean(audioFile), duration }
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true] }))
  const slug = args.slug || 'travlya-rebenok-molchit'
  if (!TOPICS_BY_SLUG[slug]) throw new Error(`тема не найдена: ${slug}. Например: ${TOPICS.slice(0, 5).map((t) => t.slug).join(', ')}...`)
  const outDir = args.out || path.join(os.homedir(), 'Downloads')
  const result = await renderTopicVideo(slug, outDir)
  console.log(JSON.stringify(result, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
