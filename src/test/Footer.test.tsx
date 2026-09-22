import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Footer from '../components/Footer'

describe('Footer', () => {
  it('renders the app name', () => {
    render(<Footer />)
    expect(screen.getByText('KISS Workout Tracker', { selector: '.footer-brand' })).toBeInTheDocument()
  })

  it('renders the copyright line with the current year', () => {
    render(<Footer />)
    const year = new Date().getFullYear()
    expect(screen.getByText(`© ${year} KISS Workout Tracker`)).toBeInTheDocument()
  })

  it('renders a link to the GitHub repo', () => {
    render(<Footer />)
    const link = screen.getByRole('link', { name: 'GitHub' }) as HTMLAnchorElement
    expect(link.href).toBe('https://github.com/dummey/kiss-workout')
  })

  it('opens the repo link in a new tab safely', () => {
    render(<Footer />)
    const link = screen.getByRole('link', { name: 'GitHub' })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
