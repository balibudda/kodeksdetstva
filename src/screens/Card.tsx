import type { Card } from '../data/sections.ts'

export function CardScreen({ card }: { card: Card }) {
  return (
    <article className="screen card-detail">
      <h1>{card.title}</h1>

      <h2>Что происходит</h2>
      <p>{card.sut}</p>

      <h2>Что говорит закон</h2>
      <ul>
        {card.law.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>

      <h2>Что делать</h2>
      <ol>
        {card.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

      <h2>Куда обратиться</h2>
      <ul className="help-list">
        {card.help.map((h, i) => (
          <li key={i}>
            <strong>{h.title}</strong>
            <br />
            {h.detail}
          </li>
        ))}
      </ul>

      <p className="disclaimer">
        Это справочная информация, а не юридическая или медицинская консультация.
        Нормы приведены для ориентира и могут меняться.
      </p>
    </article>
  )
}
