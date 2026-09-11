import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProgressionInfo from '../components/ProgressionInfo'
import type { PreviousPerformance } from '../types'

describe('ProgressionInfo', () => {
  it('renders nothing when prevInfo is empty array', () => {
    const { container } = render(<ProgressionInfo prevInfo={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders previous performance data with T1 tier', () => {
    const prevInfo: PreviousPerformance[] = [{
      weight: '225',
      reps: '5',
      sets: 3,
      date: '2026-08-25'
    }]

    render(<ProgressionInfo tier="T1" prevInfo={prevInfo} />)

    expect(screen.getByText('Last time: 225 x 5 (3)')).toBeInTheDocument()
    expect(screen.getByText('Try 225 x 6 (3) or add weight')).toBeInTheDocument()
  })

  it('renders T2 progression guidance', () => {
    const prevInfo: PreviousPerformance[] = [{
      weight: '100',
      reps: '10',
      sets: 3,
      date: '2026-09-01'
    }]

    render(<ProgressionInfo tier="T2" prevInfo={prevInfo} />)

    expect(screen.getByText('Last time: 100 x 10 (3)')).toBeInTheDocument()
    expect(screen.getByText('Add weight, drop to 8 reps')).toBeInTheDocument()
  })

  it('renders default guidance for unknown tier', () => {
    const prevInfo: PreviousPerformance[] = [{
      weight: '—',
      reps: '—',
      sets: '—',
      date: ''
    }]

    render(<ProgressionInfo prevInfo={prevInfo} />)

    expect(screen.getByText('Last time: — x — (—)')).toBeInTheDocument()
    expect(screen.getByText('Fill in your target weight, reps, and sets')).toBeInTheDocument()
  })

  it('applies correct CSS classes', () => {
    const prevInfo: PreviousPerformance[] = [{
      weight: '135',
      reps: '8',
      sets: 3,
      date: '2026-09-01'
    }]

    render(<ProgressionInfo tier="T3" prevInfo={prevInfo} />)

    expect(screen.getByText('Last time: 135 x 8 (3)').className).toBe('last-time')
    expect(screen.getByText('Target: 10-15+ reps @ ≤65%').className).toBe('next-step')
  })

  it('shows default T1 guidance when no previous data', () => {
    render(<ProgressionInfo tier="T1" prevInfo={[]} />)
    expect(document.querySelector('.progression-info')).toBeNull()
  })

  it('renders comma-separated list when multiple performances on same date', () => {
    const prevInfo: PreviousPerformance[] = [
      { weight: '225', reps: '5', sets: 3, date: '2026-09-01' },
      { weight: '230', reps: '3', sets: 3, date: '2026-09-01' },
      { weight: '235', reps: '1', sets: 3, date: '2026-09-01' }
    ]

    render(<ProgressionInfo tier="T1" prevInfo={prevInfo} />)

    expect(screen.getByText('Last time: 225 x 5 (3), 230 x 3 (3), 235 x 1 (3)')).toBeInTheDocument()
  })
})
