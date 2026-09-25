import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { BodyState } from 'body-muscles'
import BodyMusclesChart from '../components/BodyMusclesChart'

const { bodyChartUpdates } = vi.hoisted(() => ({
  bodyChartUpdates: [] as BodyState[],
}))

vi.mock('body-muscles', () => {
  return {
    BodyChart: vi.fn(function (this: { update: (options: { bodyState?: BodyState }) => void }) {
      this.destroy = vi.fn()
      this.update = vi.fn(({ bodyState }: { bodyState?: BodyState }) => {
        if (bodyState) bodyChartUpdates.push(bodyState)
      })
    }),
    ViewSide: { FRONT: 'front', BACK: 'back' },
  }
})

describe('BodyMusclesChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    bodyChartUpdates.length = 0
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

  it('keeps workout muscle intensity visible without selecting anything initially', () => {
    render(<BodyMusclesChart muscles={[]} allMuscles={['Chest', 'Quads']} />)

    const state = bodyChartUpdates.at(-1)
    expect(state?.['chest-upper-left']).toEqual({ intensity: 1, selected: false })
    expect(state?.['quads-left']).toEqual({ intensity: 1, selected: false })
  })

  it('selects only highlighted muscles and restores the base state when cleared', () => {
    const { rerender } = render(
      <BodyMusclesChart muscles={[]} allMuscles={['Chest', 'Quads']} />
    )

    rerender(<BodyMusclesChart muscles={['Chest']} allMuscles={['Chest', 'Quads']} />)
    let state = bodyChartUpdates.at(-1)
    expect(state?.['chest-upper-left']).toEqual({ intensity: 1, selected: true })
    expect(state?.['quads-left']).toEqual({ intensity: 1, selected: false })

    rerender(<BodyMusclesChart muscles={[]} allMuscles={['Chest', 'Quads']} />)
    state = bodyChartUpdates.at(-1)
    expect(state?.['chest-upper-left']).toEqual({ intensity: 1, selected: false })
    expect(state?.['quads-left']).toEqual({ intensity: 1, selected: false })
  })

  it('moves the selection when another exercise is highlighted', () => {
    const { rerender } = render(
      <BodyMusclesChart muscles={['Chest']} allMuscles={['Chest', 'Quads']} />
    )

    rerender(<BodyMusclesChart muscles={['Quads']} allMuscles={['Chest', 'Quads']} />)
    const state = bodyChartUpdates.at(-1)
    expect(state?.['chest-upper-left']).toEqual({ intensity: 1, selected: false })
    expect(state?.['quads-left']).toEqual({ intensity: 1, selected: true })
  })

  it('keeps shared anatomy selected when any highlighted muscle targets it', () => {
    render(
      <BodyMusclesChart
        muscles={['Core']}
        allMuscles={['Rectus Abdominis', 'Obliques']}
      />
    )

    const state = bodyChartUpdates.at(-1)
    expect(state?.['abs-upper-left']).toEqual({ intensity: 1, selected: true })
    expect(state?.['obliques-left']).toEqual({ intensity: 1, selected: true })
  })
})
