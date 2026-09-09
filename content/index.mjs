// Точка сборки всего контента.

import { SECTIONS, SECTIONS_BY_ID } from './sections.mjs'
import { CONTACTS, CONTACTS_BY_ID } from './contacts.mjs'

import { TOPICS_LICHNOST } from './topics/lichnost.mjs'
import { TOPICS_SEMYA } from './topics/semya.mjs'
import { TOPICS_RAZVOD } from './topics/razvod.mjs'
import { TOPICS_BEZOPASNOST } from './topics/bezopasnost.mjs'
import { TOPICS_CIFRA } from './topics/cifra.mjs'
import { TOPICS_TRAVLYA } from './topics/travlya.mjs'
import { TOPICS_PRAVA_SHKOLA } from './topics/prava-shkola.mjs'
import { TOPICS_PODROSTOK_ZAKON } from './topics/podrostok-i-zakon.mjs'
import { TOPICS_PSIHIKA } from './topics/psihika.mjs'
import { TOPICS_ZDOROVIE } from './topics/zdorovie.mjs'
import { TOPICS_PERVAYA_LYUBOV } from './topics/pervaya-lyubov.mjs'

/** @type {import('./topics/lichnost.mjs').Topic[]} */
export const TOPICS = [
  ...TOPICS_LICHNOST,
  ...TOPICS_SEMYA,
  ...TOPICS_RAZVOD,
  ...TOPICS_BEZOPASNOST,
  ...TOPICS_CIFRA,
  ...TOPICS_TRAVLYA,
  ...TOPICS_PRAVA_SHKOLA,
  ...TOPICS_PODROSTOK_ZAKON,
  ...TOPICS_PSIHIKA,
  ...TOPICS_ZDOROVIE,
  ...TOPICS_PERVAYA_LYUBOV,
]

export const TOPICS_BY_SLUG = Object.fromEntries(TOPICS.map((t) => [t.slug, t]))

export function topicUrl(topic) {
  const section = SECTIONS_BY_ID[topic.sectionId]
  return `/${section.slug}/${topic.slug}/`
}

export function sectionUrl(section) {
  return `/${section.slug}/`
}

export function topicsOfSection(sectionId) {
  return TOPICS.filter((t) => t.sectionId === sectionId)
}

// Проверки целостности контента — падаем на сборке, если что-то не сходится.
export function validateContent() {
  const errors = []
  const slugs = new Set()
  for (const t of TOPICS) {
    if (!SECTIONS_BY_ID[t.sectionId]) errors.push(`Тема "${t.slug}": неизвестный sectionId "${t.sectionId}"`)
    if (slugs.has(t.slug)) errors.push(`Дублирующийся slug темы: "${t.slug}"`)
    slugs.add(t.slug)
    for (const c of t.contacts || []) {
      if (!CONTACTS_BY_ID[c]) errors.push(`Тема "${t.slug}": неизвестный контакт "${c}"`)
    }
  }
  return errors
}

export { SECTIONS, SECTIONS_BY_ID, CONTACTS, CONTACTS_BY_ID }
