import React from 'react'

export default function Footer() {
  const currentYear = new Date().getFullYear()
  return (
    <footer className="footer">
      <div className="footer-content">
        <span>KISS Workout Tracker</span>
        <span>
          © {currentYear} KISS Workout Tracker ·{' '}
          <a href="https://github.com/dummey/kiss-workout" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </span>
      </div>
    </footer>
  )
}
