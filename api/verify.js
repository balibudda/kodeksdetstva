// Файлы верификации Google Search Console / Яндекс.Вебмастера.
//
// Не лежат в public/ как статика: Vercel cleanUrls:true режет .html-расширение
// на уровне файловой системы ДО того, как применяются rewrites (см. vercel.json
// и штатное поведение Vercel — редиректу подвергается любой статический файл
// с расширением .html, независимо от rewrites/redirects в конфиге). Верификаторам
// нужен ровно исходный /<file>.html с кодом 200, без редиректа — поэтому отдаём
// их через функцию по rewrite-правилу (function-роут не проходит через ту же
// cleanUrls-нормализацию, что статический файл).
const FILES = {
  google: 'google-site-verification: google99be8f2cbe30fe89.html',
  yandex:
    '<html>\n    <head>\n        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">\n    </head>\n    <body>Verification: 455271a3f17f26a4</body>\n</html>',
}

export default function handler(req, res) {
  const which = String(req.query?.which || '')
  const body = FILES[which]
  if (!body) {
    res.status(404).send('')
    return
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(200).send(body)
}
