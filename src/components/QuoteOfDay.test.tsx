import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import QuoteOfDay from '../components/QuoteOfDay'

describe('QuoteOfDay', () => {
  it('renders a non-empty quote on mount', () => {
    const { container } = render(<QuoteOfDay />)
    const el = container.firstChild as HTMLElement
    expect(el).toBeInstanceOf(HTMLDivElement)
    expect(el.textContent).toBeTruthy()
    expect((el.textContent ?? '').length).toBeGreaterThan(0)
  })

  it('renders the same quote across re-renders', () => {
    const { rerender } = render(<QuoteOfDay />)
    const el = document.querySelector('div') as HTMLElement
    const firstQuote = el.textContent
    rerender(<QuoteOfDay />)
    expect(el.textContent).toBe(firstQuote)
  })
})
