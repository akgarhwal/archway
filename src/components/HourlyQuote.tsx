import { quoteForHour } from '../data/quotes';

export function HourlyQuote() {
  const q = quoteForHour();
  return (
    <figure className="hourly-quote">
      <span className="kicker">This hour</span>
      <blockquote>“{q.text}”</blockquote>
      <figcaption>
        — {q.author}
        {q.note ? <em> · {q.note}</em> : null}
      </figcaption>
    </figure>
  );
}
