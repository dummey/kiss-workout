import React, { useState } from 'react'

const quotes = [
  `The only bad workout is the one that didn't happen.`,
  `Strength does not come from physical capacity. It comes from an indomitable will.`,
  `The pain you feel today will be the strength you feel tomorrow.`,
  `Success is the sum of small efforts, repeated day in and day out.`,
  `Your body can stand almost anything. It is your mind you have to convince.`,
  `The difference between try and triumph is a little umph.`,
  `What seems impossible today will one day become your warm-up.`,
  `The only limits you have are the limits you believe.`,
  `Don't stop when you're tired. Stop when you're done.`,
  `Champions keep playing until they get it right.`
]

export default function QuoteOfDay() {
  const [quote] = useState(() => {
    const index = Math.floor(Math.random() * quotes.length)
    return quotes[index]
  })

  return (
    <div style={{
      textAlign: 'center',
      fontStyle: 'italic',
      color: 'var(--muted)',
      fontSize: '0.85rem',
      padding: '8px 0',
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
      width: '100%'
    }}>
      {quote}
    </div>
  )
}
