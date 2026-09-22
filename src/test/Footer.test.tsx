import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Footer from '../components/Footer'

describe('Footer', () => {
  it('renders the app name', () => {
    render(<Footer />)
    expect(screen.getByText('KISS Workout Tracker')).toBeInTheDocument()
  })

  it('renders the copyright line with the current year', () => {
    render(<Footer />)
    expect(
      screen.getByText(`© ${new Date().getFullYear()} KISS Workout Tracker`)
    ).toBeInTheDocument()
  })

  it('renders a link to the GitHub repository', () => {
    render(<Footer />)
    const link = screen.getByRole('link', { name: 'GitHub' })
    expect(link).toHaveAttribute('href', 'https://github.com/dummey/kiss-workout')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
