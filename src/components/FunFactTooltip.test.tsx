import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FunFactTooltip from '../components/FunFactTooltip'

describe('FunFactTooltip', () => {
  it('renders children', () => {
    render(<FunFactTooltip>Squat</FunFactTooltip>)
    expect(screen.getByText('Squat')).toBeInTheDocument()
  })

  it('sets a non-empty title attribute on the wrapper', () => {
    render(<FunFactTooltip>Squat</FunFactTooltip>)
    const wrapper = screen.getByText('Squat').closest('.fun-fact-tooltip')
    expect(wrapper).not.toBeNull()
    expect(wrapper!.getAttribute('title')).toBeTruthy()
  })

  it('renders a fun-fact bubble with non-empty text', () => {
    render(<FunFactTooltip>Squat</FunFactTooltip>)
    const bubble = document.querySelector('.fun-fact-tooltip__bubble')
    expect(bubble).not.toBeNull()
    expect(bubble!.textContent).toBeTruthy()
  })

  it('changes fact on re-render', () => {
    const facts = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const { unmount } = render(<FunFactTooltip>Squat</FunFactTooltip>)
      const title = screen.getByText('Squat').closest('.fun-fact-tooltip')!.getAttribute('title')!
      facts.add(title)
      unmount()
    }
    // With 50 re-renders and 10 facts, we should see multiple unique facts
    expect(facts.size).toBeGreaterThan(1)
  })
})
