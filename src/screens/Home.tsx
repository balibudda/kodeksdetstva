import { SECTIONS } from '../data/sections.ts'

export function Home() {
  return (
    <section className="screen">
      <p className="lede">
        Родителям, которые хотят, чтобы их дети росли в любви и заботе, а не в
        страхе. Права ребёнка простым языком, защита от насилия и травли,
        осознанные решения о здоровье, помощь в кризисах — с опорой на закон и на
        уважение к ребёнку как к личности.
      </p>

      <nav className="section-list">
        {SECTIONS.map((s) => (
          <a key={s.id} className="section-card" href={`#/s/${s.id}`}>
            <span className="section-card__title">{s.title}</span>
            <span className="section-card__lead">{s.lead}</span>
          </a>
        ))}
      </nav>

      <div className="home-links">
        <a href="#/about">О проекте</a>
        <a href="#/help">Куда обратиться за помощью</a>
      </div>

      <p className="disclaimer">
        Материалы носят справочный характер и не заменяют консультацию юриста,
        врача или психолога. В острой ситуации сразу обращайтесь за живой помощью.
      </p>
    </section>
  )
}
