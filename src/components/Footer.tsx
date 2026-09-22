import React from 'react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <p className="footer-app-name">KISS Workout Tracker</p>
      <p className="footer-copy">&copy; {currentYear} KISS Workout Tracker</p>
      <a
        className="footer-link"
        href="https://github.com/dummey/kiss-workout"
        target="_blank"
        rel="noopener noreferrer"
      >
        GitHub
      </a>
    </footer>
  )
}
