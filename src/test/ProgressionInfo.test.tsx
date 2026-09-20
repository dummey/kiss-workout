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

    expect(screen.getByText(/225 x 5 \(3\)/)).toBeInTheDocument()
    expect(screen.getByText(/Add 5lbs \(bench\) or 10lbs \(squat and deadlift\)/)).toBeInTheDocument()
  })

  it('renders T2 progression guidance', () => {
    const prevInfo: PreviousPerformance[] = [{
      weight: '100',
      reps: '10',
      sets: 3,
      date: '2026-09-01'
    }]

    render(<ProgressionInfo tier="T2" prevInfo={prevInfo} />)

    expect(screen.getByText(/100 x 10 \(3\)/)).toBeInTheDocument()
    expect(screen.getByText(/Add weight. If fail, 3x10 > 3x8 > 3x6 > restart, \+5-10lbs from last 3x10/)).toBeInTheDocument()
  })

  it('renders default guidance for unknown tier', () => {
    const prevInfo: PreviousPerformance[] = [{
      weight: '—',
      reps: '—',
      sets: '—',
      date: ''
    }]

    render(<ProgressionInfo prevInfo={prevInfo} />)

    expect(screen.getByText(/— x — \(—\)/)).toBeInTheDocument()
    expect(screen.getByText(/Fill in your target weight, reps, and sets/)).toBeInTheDocument()
  })

  it('applies correct CSS classes', () => {
    const prevInfo: PreviousPerformance[] = [{
      weight: '135',
      reps: '8',
      sets: 3,
      date: '2026-09-01'
    }]

    render(<ProgressionInfo tier="T3" prevInfo={prevInfo} />)

    expect(screen.getByText(/135 x 8 \(3\)/).className).toBe('last-time')
    expect(screen.getByText(/3x10-15, AMRAP on last set, add weight when >25 reps/).className).toBe('next-step')
  })

  it('shows default T1 guidance when no previous data', () => {
    render(<ProgressionInfo tier="T1" prevInfo={[]} />)
    expect(document.querySelector('.progression-info')).toBeNull()
  })

  it('T1 guidance renders with preserved newlines', () => {
    const prevInfo: PreviousPerformance[] = [{
      weight: '225',
      reps: '5',
      sets: 3,
      date: '2026-09-01'
    }]

    render(<ProgressionInfo tier="T1" prevInfo={prevInfo} />)
    const nextStep = document.querySelector('.next-step') as HTMLElement
    expect(nextStep).not.toBeNull()
    // The guidance string contains \n — verify it's preserved in textContent
    expect(nextStep.textContent).toContain('If fail, 5x3 > 6x2 > 10x1 > restart at 85% of 1rep.')
    expect(nextStep.textContent).toContain('Add 5lbs (bench) or 10lbs (squat and deadlift).')
    // Verify the newline character is present (white-space: pre-line will render it)
    expect(nextStep.textContent).toContain('\n')
  })

  it('renders comma-separated list when multiple performances on same date', () => {
    const prevInfo: PreviousPerformance[] = [
      { weight: '225', reps: '5', sets: 3, date: '2026-09-01' },
      { weight: '230', reps: '3', sets: 3, date: '2026-09-01' },
      { weight: '235', reps: '1', sets: 3, date: '2026-09-01' }
    ]

    render(<ProgressionInfo tier="T1" prevInfo={prevInfo} />)

    expect(screen.getByText(/225 x 5 \(3\), 230 x 3 \(3\), 235 x 1 \(3\)/)).toBeInTheDocument()
  })
})
