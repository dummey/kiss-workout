import { useMemo } from 'react'

const QUOTES: string[] = [
  "The only bad workout is the one that didn't happen.",
  "Sweat is just fat crying.",
  "Pain is weakness leaving the body.",
  "The body achieves what the mind believes.",
  "No pain, no gain.",
  "Strength does not come from the body. It comes from the will.",
  "You don't have to be extreme, just consistent.",
  "It never gets easier. You just get stronger.",
  "Your body can stand almost anything. It's your mind you have to convince.",
  "Stop when you're done, not when you're tired.",
  "Progress, not perfection.",
  "The gym is my therapy.",
  "Don't stop when you're tired. Stop when you're done.",
  "Wake up with determination. Go to bed with satisfaction.",
  "A one-hour workout is 4% of your day. No excuses.",
]

function getQuoteForDate(date: Date): string {
  if (QUOTES.length === 0) return ''
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const dayIndex = Math.floor(utc / 86_400_000) % QUOTES.length
  return QUOTES[dayIndex]
}

export default function QuoteOfDay() {
  const quote = useMemo(() => getQuoteForDate(new Date()), [])

  if (!quote) return null

  return (
    <div
      data-testid="quote-of-day"
      style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 20,
      }}
    >
      <span aria-hidden style={{ fontSize: '1rem', lineHeight: '1.4' }}>💪</span>
      <p
        style={{
          margin: 0,
          color: 'var(--text)',
          fontSize: '0.88rem',
          lineHeight: 1.45,
          fontStyle: 'italic',
        }}
      >
        {quote}
      </p>
    </div>
  )
}
