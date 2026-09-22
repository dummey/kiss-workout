import { describe, it, expect, vi, afterAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import QuoteOfDay from '../components/QuoteOfDay'

describe('QuoteOfDay', () => {
  afterAll(() => {
    vi.useRealTimers()
  })

  it('renders a quote', () => {
    render(<QuoteOfDay />)
    const el = screen.getByTestId('quote-of-day')
    expect(el).toBeInTheDocument()
    expect(el.querySelector('p')!.textContent!.length).toBeGreaterThan(0)
  })

  it('displays the same quote for the same day', () => {
    vi.setSystemTime(new Date('2026-09-15T08:00:00'))
    const { unmount } = render(<QuoteOfDay />)
    const morning = screen.getByTestId('quote-of-day').querySelector('p')!.textContent
    unmount()

    vi.setSystemTime(new Date('2026-09-15T22:00:00'))
    render(<QuoteOfDay />)
    const evening = screen.getByTestId('quote-of-day').querySelector('p')!.textContent

    expect(evening).toBe(morning)
  })

  it('changes quote on a different day', () => {
    vi.setSystemTime(new Date('2026-09-15T08:00:00'))
    const { unmount } = render(<QuoteOfDay />)
    const day1 = screen.getByTestId('quote-of-day').querySelector('p')!.textContent
    unmount()

    vi.setSystemTime(new Date('2026-09-16T08:00:00'))
    render(<QuoteOfDay />)
    const day2 = screen.getByTestId('quote-of-day').querySelector('p')!.textContent

    expect(day2).not.toBe(day1)
  })

  it('renders a quote from the built-in list', () => {
    render(<QuoteOfDay />)
    const text = screen.getByTestId('quote-of-day').querySelector('p')!.textContent
    expect(typeof text).toBe('string')
    expect(text!.length).toBeGreaterThan(5)
  })
})
