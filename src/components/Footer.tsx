import React from 'react'

const REPO_URL = 'https://github.com/dummey/kiss-workout'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <span className="footer-brand">KISS Workout Tracker</span>
      <span>© {currentYear} KISS Workout Tracker</span>
      <a className="footer-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">
        GitHub
      </a>
    </footer>
  )
}
