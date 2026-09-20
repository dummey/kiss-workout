import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import BodyMusclesChart from '../components/BodyMusclesChart'

vi.mock('body-muscles', () => {
  return {
    BodyChart: vi.fn(function () {
      this.destroy = vi.fn()
      this.update = vi.fn()
    }),
    ViewSide: { FRONT: 'front', BACK: 'back' },
  }
})

describe('BodyMusclesChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders chart container', () => {
    const { container } = render(<BodyMusclesChart muscles={[]} allMuscles={[]} />)
    const chartContainers = container.querySelectorAll('[style*="min-width: 160px"]')
    expect(chartContainers.length).toBeGreaterThanOrEqual(2)
  })

  it('renders front and back labels', () => {
    render(<BodyMusclesChart muscles={[]} allMuscles={[]} />)
    expect(screen.getByText('Anterior (Front)')).toBeInTheDocument()
    expect(screen.getByText('Posterior (Back)')).toBeInTheDocument()
  })

  it('renders with no muscles provided', () => {
    render(<BodyMusclesChart />)
    expect(screen.getByText('Anterior (Front)')).toBeInTheDocument()
    expect(screen.getByText('Posterior (Back)')).toBeInTheDocument()
  })

  it('renders with muscles provided', () => {
    render(<BodyMusclesChart muscles={['Chest', 'Biceps']} allMuscles={['Chest', 'Biceps']} />)
    expect(screen.getByText('Anterior (Front)')).toBeInTheDocument()
    expect(screen.getByText('Posterior (Back)')).toBeInTheDocument()
  })
})
