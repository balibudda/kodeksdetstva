import type { Section } from '../data/sections.ts'
import { CARDS } from '../data/sections.ts'

export function SectionScreen({ section }: { section: Section }) {
  const cards = CARDS.filter((c) => c.sectionId === section.id)
  return (
    <section className="screen">
      <h1>{section.title}</h1>
      <p className="frame">{section.frame}</p>

      <div className="card-list">
        {cards.map((c) => (
          <a key={c.id} className="topic-card" href={`#/c/${c.id}`}>
            <span className="topic-card__title">{c.title}</span>
            <span className="topic-card__more">Разобрать →</span>
          </a>
        ))}
        {cards.length === 0 && (
          <p className="disclaimer">Материалы этого раздела скоро появятся.</p>
        )}
      </div>
    </section>
  )
}
