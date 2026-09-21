import React from 'react'

export default function Footer() {
  return (
    <footer
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        padding: '16px 32px',
        textAlign: 'center',
      }}
    >
      <a
        href="https://github.com/dummey/kiss-workout/issues"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: 'var(--muted)',
          fontSize: '0.8rem',
          textDecoration: 'none',
        }}
      >
        Report an issue
      </a>
    </footer>
  )
}
