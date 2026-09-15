// Иконки разделов — простые линейные SVG (24×24, stroke=currentColor), не эмодзи.
// Эмодзи на разных ОС рендерится по-разному (Apple/Google/Windows) и выглядит
// «шаблонно»; свой набор — несколько КБ инлайн-текста, без внешних файлов и
// запросов, зато цвет наследуется от var(--sec) и выглядит как единая система.

export const SECTION_ICONS = {
  psihika: '<circle cx="12" cy="12" r="8"/><path d="M7 12h2l1.3-2.6L12 15l1.3-3H17"/>',
  'radost-detstva':
    '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.6M12 18.9v2.6M4.2 12H1.6M22.4 12h-2.6M5.9 5.9l1.8 1.8M16.3 16.3l1.8 1.8M18.1 5.9l-1.8 1.8M7.7 16.3l-1.8 1.8"/>',
  bezopasnost:
    '<path d="M12 2.5l7.5 3v5.7c0 5.3-3.6 8-7.5 9.8-3.9-1.8-7.5-4.5-7.5-9.8V5.5l7.5-3z"/>',
  semya: '<path d="M3.5 11.5L12 4.5l8.5 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5.5h4V20"/>',
  'semeynye-dela':
    '<rect x="5.5" y="3" width="13" height="18" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4.5"/>',
  travlya: '<path d="M4 5h16v11.5H9.5L5 20.5v-4H4V5z"/><path d="M12 8.5v4"/><path d="M12 15v.1"/>',
  cifra: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M10.5 18.7h3"/>',
  sryv:
    '<path d="M12 3v17"/><path d="M8 21h8"/><path d="M5 7h14"/><path d="M5 7l-2.6 5.2a2.8 2.8 0 0 0 5.2 0L5 7z"/><path d="M19 7l-2.6 5.2a2.8 2.8 0 0 0 5.2 0L19 7z"/>',
  razvod: '<path d="M12 3v5.5"/><path d="M12 8.5c0 3-4.5 3.3-4.5 7v5.5"/><path d="M12 8.5c0 3 4.5 3.3 4.5 7v5.5"/>',
  zdorovie:
    '<path d="M12 20.2s-7.2-4.4-7.2-10.1A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.2 3c0 5.7-7.2 10.1-7.2 10.1z"/><path d="M8.7 10.5h1.8l1-2 1.6 4 1-2h2.2"/>',
  'prava-shkola':
    '<path d="M3.5 9.5L12 4.5l8.5 5"/><path d="M5 9.5V20M19 9.5V20M3 20h18"/><path d="M8.5 20v-7M12 20v-7M15.5 20v-7"/>',
  sirotstvo:
    '<path d="M3.5 14.8c2.4-2 5.4-3 8.5-3s6.1 1 8.5 3"/><path d="M3.5 14.8c0 3.3 3.8 5.7 8.5 5.7s8.5-2.4 8.5-5.7"/><circle cx="12" cy="11.3" r="2"/>',
  'pervaya-lyubov':
    '<path d="M12 20.3s-7.8-5-7.8-10.8A4.5 4.5 0 0 1 12 6.2a4.5 4.5 0 0 1 7.8 3.3c0 5.8-7.8 10.8-7.8 10.8z"/>',
  lichnost:
    '<path d="M12 21v-9.5"/><path d="M12 11.5c0-4.2-3.2-6.5-7.2-6.5-.2 4.3 3 7.2 7.2 6.5z"/><path d="M12 14.3c0-3.6 2.6-5.7 6.2-5.7.2 3.6-2.6 5.9-6.2 5.7z"/>',
  vospitanie: '<circle cx="9" cy="12" r="5.2"/><circle cx="15.5" cy="12" r="5.2" opacity=".55"/>',
}

/** SVG-иконка раздела. Возвращает '' для неизвестного id (например, для эмодзи вне списка разделов). */
export function sectionIconSvg(id, size = 20) {
  const inner = SECTION_ICONS[id]
  if (!inner) return ''
  return `<svg class="ic-svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
}
