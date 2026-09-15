// Пиктограммы на уровне тем — не 162 уникальные картинки (шумно и медленно
// рисовать/поддерживать), а компактная палитра переиспользуемых значков по
// смыслу, назначенная каждой теме. Та же техника, что и у SECTION_ICONS
// (icons.mjs): 24×24, stroke=currentColor, только простые примитивы.
// Часть значков — те же, что уже нарисованы для разделов (переиспользуем
// прямо оттуда), часть — новые, под темы, которых на уровне разделов нет.

import { SECTION_ICONS } from './icons.mjs'

export const TOPIC_ICONS = {
  // переиспользованные из палитры разделов
  pulse: SECTION_ICONS.psihika,
  heart: SECTION_ICONS['pervaya-lyubov'],
  'heart-pulse': SECTION_ICONS.zdorovie,
  house: SECTION_ICONS.semya,
  shield: SECTION_ICONS.bezopasnost,
  document: SECTION_ICONS['semeynye-dela'],
  scales: SECTION_ICONS.sryv,
  phone: SECTION_ICONS.cifra,
  speech: SECTION_ICONS.travlya,
  building: SECTION_ICONS['prava-shkola'],
  sun: SECTION_ICONS['radost-detstva'],
  sprout: SECTION_ICONS.lichnost,
  fork: SECTION_ICONS.razvod,
  nest: SECTION_ICONS.sirotstvo,
  trust: SECTION_ICONS.vospitanie,

  // новые, специально под темы
  money: '<circle cx="12" cy="12" r="8.5"/><path d="M10 8v8M10 8h2.8a2 2 0 0 1 0 4H10M10 12h4"/>',
  warning: '<path d="M12 3.5l9 16h-18z"/><path d="M12 10v4"/><path d="M12 17v.1"/>',
  book: '<path d="M12 6.5c-1.8-1.3-4.2-2-6.8-2-.6 0-1.2.4-1.2 1v11.5c0 .6.5 1 1.1 1 2.6 0 5 .7 6.9 2 1.9-1.3 4.3-2 6.9-2 .6 0 1.1-.4 1.1-1V5.5c0-.6-.6-1-1.2-1-2.6 0-5 .7-6.8 2z"/><path d="M12 6.5V19"/>',
  music: '<circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="15" r="2.5"/><path d="M9.5 17V6l10-2v11"/>',
  paw: '<circle cx="9" cy="8" r="1.7"/><circle cx="15" cy="8" r="1.7"/><circle cx="6" cy="12.5" r="1.6"/><circle cx="18" cy="12.5" r="1.6"/><path d="M12 12.5c-3 0-5 2-5 4.3 0 1.8 1.6 3 3.4 3 .9 0 1.2-.5 1.6-.5s.7.5 1.6.5c1.8 0 3.4-1.2 3.4-3 0-2.3-2-4.3-5-4.3z"/>',
  tree: '<circle cx="12" cy="9" r="6"/><path d="M12 15v6"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.8 2.3 2.8 15 0 17M12 3.5c-2.8 2.3-2.8 15 0 17M4.5 7.5h15M4.5 16.5h15"/>',
  road: '<path d="M9 3L4 21M15 3l5 18"/><path d="M12 3v4M12 10v4M12 17v4"/>',
  medical: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
  moon: '<path d="M16 4a9 9 0 1 0 4 12.5A8.5 8.5 0 0 1 16 4z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l4 2.5"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12v.1"/>',
  flag: '<path d="M6 21V4"/><path d="M6 4h11l-3 3.5L17 11H6"/>',
}

/** slug темы -> ключ иконки из TOPIC_ICONS */
export const TOPIC_ICON_MAP = {
  // Ребёнок — личность
  'mnenie-rebenka': 'speech',
  'granitsy-telo-privatnost': 'shield',
  'pravo-na-chuvstva': 'heart',
  'sravnenie-i-publichnyy-styd': 'pulse',
  'slezhka-i-kontrol': 'eye',
  'chto-takoe-dusha': 'sun',
  'religiya-i-prinuzhdenie': 'shield',
  'rebenok-kak-proekt-roditelya': 'target',
  'ispoved-i-svyashchennik': 'shield',
  'vybor-professii': 'target',
  'kodeks-detstva-iniciativa': 'document',
  'vneshnost-pirsing-tatu-plastika': 'sprout',

  // Счастливое детство
  'zhivotnye-i-rebenok': 'paw',
  'priroda-i-aktivnyy-otdyh': 'tree',
  'muzyka-tvorchestvo-emocii': 'music',
  'svobodnaya-igra': 'sun',
  'chtenie-i-voobrazhenie': 'book',
  'semeynye-ritualy-i-tradicii': 'house',
  'mnogoyazychie-i-rechevoe-razvitie': 'globe',
  'dobrota-i-empatiya': 'heart',
  'mechty-i-celi-rebenka': 'target',
  'blagodarnost-i-radost-melocham': 'sun',

  // Насилие в семье
  'fizicheskie-nakazaniya': 'warning',
  'emotsionalnoe-nasilie-krik': 'warning',
  'kak-ostanovit-sebya': 'pulse',
  'prenebrezhenie-neglect': 'house',
  'nasilie-mezhdu-roditelyami': 'house',
  'zavisimosti-roditeley': 'warning',
  giperopeka: 'heart',
  'kontaktnoe-nasilie-svoi': 'shield',
  'rebenku-doma-nebezopasno': 'house',
  'kak-vybratsya-iz-tyazheloy-semyi': 'shield',
  'izyatie-rebenka-iz-semyi': 'document',

  // Семья: документы, деньги, поддержка
  'materinskiy-kapital': 'money',
  'rebenok-poteryal-roditelya': 'house',
  'semya-v-nuzhde-mery-podderzhki': 'money',
  'vyplaty-pri-rozhdenii-rebenka': 'money',
  'mnogodetnaya-semya': 'house',
  'imushchestvo-i-nasledstvo-rebenka': 'document',
  'propiska-registraciya-rebenka': 'document',
  'dokumenty-rebenka': 'document',
  'roditel-v-sizo-ili-kolonii': 'scales',
  'rebenok-zhivet-u-rodstvennikov': 'house',
  'brak-s-inostrancem-rebenok': 'globe',
  'deti-rossiyan-za-granicey': 'globe',

  // Детдом, сироты, усыновление
  'priyomnyy-rebenok-adaptaciya': 'nest',
  'rebenok-v-detskom-dome-prava': 'document',
  'vypusknik-detskogo-doma': 'nest',
  'otkaz-ot-rebenka-i-podkidyshi': 'nest',
  'poisk-biologicheskih-roditeley': 'globe',
  'kak-usynovit-rebenka': 'document',
  'vozvrat-priyomnogo-rebenka': 'nest',
  'nedobrosovestnoe-usynovlenie-i-moshenniki': 'warning',
  'travma-deprivacii': 'pulse',

  // Развод и родители порознь
  'razvod-bez-travmy-rebenka': 'heart',
  'roditelskoe-pohishchenie': 'warning',
  'rebenok-instrument-v-razvode': 'fork',
  'otchuzhdenie-roditelya': 'fork',
  'mesto-zhitelstva-i-obshchenie': 'house',
  'alimenty-na-rebenka': 'money',
  'alimenty-s-roditelya-za-granicey': 'money',
  'alimenty-platit-ili-net': 'money',
  'razvod-poshagovo-s-detmi': 'document',
  'smena-imeni-ili-familii-rebenka': 'document',

  // Безопасность вне дома
  'pohishchenie-uroki-rebenku': 'shield',
  'rebenok-poteryalsya': 'shield',
  'smertelnye-chellendzhi': 'warning',
  'opasnye-subkultury': 'warning',
  'doroga-i-sim': 'road',
  'bytovaya-gibel-doma': 'house',
  'nasilie-v-lageryah': 'shield',
  'vyezd-za-granicu': 'globe',
  'travma-rebenka': 'medical',
  'sekty-i-kulty': 'warning',
  'torgovlya-lyudmi-ekspluataciya': 'shield',
  'nasilie-nyanya-repetitor-trener': 'shield',
  'detskiy-otdyh-i-besplatnye-putyovki': 'sun',
  'sobaka-pokusala-rebenka': 'medical',
  'rebenok-i-transport-prava': 'road',
  'legkie-dengi-vebkam-eskort-onlyfans': 'warning',
  'narkozavisimost-podrostka-pomoshch': 'warning',
  'bezopasnost-detskih-tovarov': 'shield',

  // Цифровая безопасность
  'gruming-onlayn': 'phone',
  sextortion: 'phone',
  'verbovka-legkie-dengi': 'warning',
  'destruktivnye-soobshchestva': 'warning',
  'finansovye-lovushki': 'money',
  'zavisimost-vnimanie': 'phone',
  'privatnost-cifrovoy-sled': 'eye',
  'ii-deepfake': 'phone',
  'zavisimost-ot-gadzhetov-i-igr': 'phone',
  'chto-v-telefone-u-podrostka': 'phone',

  // Травля в школе
  'travlya-rebenok-molchit': 'speech',
  'travlya-algoritm-shkola': 'speech',
  kiberbulling: 'phone',
  'travlya-uchitel': 'speech',
  'tvoy-rebenok-agressor': 'speech',

  // Права в школе и учреждениях
  'pobory-v-shkole': 'money',
  'personalnye-dannye-shkola': 'eye',
  'dosmotr-i-telefony': 'shield',
  'ekzameny-oge-ege': 'document',
  'ovz-inklyuziya': 'heart',
  'prinuzhdenie-k-vneurochke': 'building',
  'deti-migrantov-shkola': 'globe',
  'semeynoe-obrazovanie': 'book',
  'detskiy-sad-kak-popast': 'building',

  // Подросток и закон
  'dopros-nesovershennoletnego': 'scales',
  'risk-i-otnoshenie-k-zhizni': 'warning',
  'zakladki-veshchestva': 'warning',
  'uchet-kdn': 'scales',
  'komendantskiy-chas': 'clock',
  'zaderzhanie-dosmotr': 'scales',
  'uhod-iz-doma': 'house',
  'prizyv-i-voenkomat': 'flag',
  'ugolovnaya-otvetstvennost-podrostka': 'scales',
  'vred-prichinennyy-nesovershennoletnim': 'money',
  'podrostok-i-rabota': 'money',
  'rebenok-svidetel-ili-poterpevshiy': 'scales',

  // Воспитание, деньги, доверие
  'pochemu-tyanet-na-zapretnoe': 'warning',
  'alkogol-i-kompanii': 'warning',
  'pozdno-domoy-i-trevoga-roditelya': 'clock',
  'karmannye-dengi': 'money',
  'zavisimost-ot-igr-i-stavok': 'warning',
  'uspeh-schaste-i-dengi': 'money',
  'besplatnye-kruzhki-i-razvitie': 'sun',
  'rebenok-i-sport': 'sun',
  'separaciya-vzrosleyushchego-rebenka': 'sprout',
  'kak-govorit-s-rebenkom': 'speech',
  'rebenok-vryot-i-voruet': 'warning',
  'detskie-isteriki-i-neposlushanie': 'heart',

  // Психика и кризисы
  'suicidalnye-signaly': 'pulse',
  selfharm: 'pulse',
  'depressiya-podrostka': 'pulse',
  rpp: 'pulse',
  'skulshuting-signaly': 'warning',
  'gore-i-poterya': 'heart',
  odinochestvo: 'pulse',
  'mest-i-obida': 'pulse',
  'shkolnyy-stress': 'pulse',
  'strahi-i-trevozhnost': 'pulse',
  'podrostok-nichego-ne-hochet': 'pulse',

  // Здоровье и выбор
  'informirovannoe-soglasie': 'document',
  'otkaz-ot-privivok': 'medical',
  'davlenie-privivkami-v-shkole': 'medical',
  'veypy-nikotin': 'warning',
  'podrostkovaya-kontratseptsiya': 'heart-pulse',
  'rannyaya-beremennost': 'heart-pulse',
  'son-podrostka': 'moon',
  'psihiatriya-mify': 'pulse',
  obezbolivanie: 'medical',
  'telo-ves-vneshnost': 'heart-pulse',
  'dispanserizaciya-shkolnika': 'medical',
  'rebenok-boleet-prava': 'medical',
  'besplatnaya-medicina-detyam': 'medical',
  'privivki-kalendar-i-vybor': 'medical',
  'rebenok-s-invalidnostyu': 'heart',
  'vrachebnaya-oshibka-i-zhaloby': 'scales',
  'prikreplenie-k-poliklinike': 'medical',
  'stomatologiya-rebenku-po-oms': 'medical',

  // Первая любовь и боль
  'pervaya-lyubov-otverzhenie': 'heart',
  'toksichnye-otnosheniya': 'warning',
  'rannie-otnosheniya-i-zakon': 'scales',
}

/** Иконка темы по её slug. size — px. Молча возвращает '' для неизвестного slug. */
export function topicIconSvg(slug, size = 20) {
  const key = TOPIC_ICON_MAP[slug]
  const inner = key && TOPIC_ICONS[key]
  if (!inner) return ''
  return `<svg class="ic-svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
}
