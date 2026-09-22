import React from 'react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <span>KISS Workout Tracker</span>
      <span className="footer-dot">·</span>
      <span>&copy; {currentYear} KISS Workout Tracker</span>
      <span className="footer-dot">·</span>
      <a
        href="https://github.com/dummey/kiss-workout"
        target="_blank"
        rel="noopener noreferrer"
      >
        GitHub
      </a>
    </footer>
  )
}
