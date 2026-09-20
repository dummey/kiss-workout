import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import SessionStats from '../components/SessionStats'
import type { Session } from '../types'

describe('SessionStats', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const createSession = (date: string, elapsedTime: number, exercises: Array<{weight?: string; reps?: string; sets?: number | null}> = []): Session => ({
    date,
    workoutName: 'Test Workout',
    elapsedTime,
    notes: '',
    exercises: exercises.map(ex => ({
      id: Math.random().toString(),
      name: 'Test Exercise',
      muscles: [],
      setup: '',
      tier: 'T1',
      superset: '',
      weight: ex.weight || '',
      reps: ex.reps || '',
      sets: ex.sets ?? null
    }))
  })

  it('renders zero stats for empty sessions', () => {
    render(<SessionStats sessions={[]} />)
    expect(screen.getByText('Total Hours')).toBeInTheDocument()
    expect(screen.getByText('0.0h')).toBeInTheDocument()
    expect(screen.getByText('0 lbs')).toBeInTheDocument()
  })

  it('renders total hours from elapsed time', () => {
    const sessions = [
      createSession('2026-01-01', 3600), // 1 hour
      createSession('2026-01-02', 5400), // 1.5 hours
    ]
    render(<SessionStats sessions={sessions} />)
    expect(screen.getByText('2.5h')).toBeInTheDocument()
  })

  it('renders total volume (weight × reps × sets)', () => {
    const sessions = [
      createSession('2026-01-01', 0, [{ weight: '225', reps: '5', sets: 3 }]),
      createSession('2026-01-02', 0, [{ weight: '185', reps: '10', sets: 3 }]),
    ]
    render(<SessionStats sessions={sessions} />)
    const expected = (225 * 5 * 3) + (185 * 10 * 3)
    expect(screen.getByText(`${expected.toLocaleString()} lbs`)).toBeInTheDocument()
  })

  it('skips non-numeric weights like BW, Heavy', () => {
    const sessions = [
      createSession('2026-01-01', 0, [
        { weight: 'BW', reps: '10', sets: 3 },
        { weight: 'Heavy', reps: '5', sets: 3 },
      ]),
    ]
    render(<SessionStats sessions={sessions} />)
    expect(screen.getByText('0 lbs')).toBeInTheDocument()
  })

  it('renders average duration', () => {
    const sessions = [
      createSession('2026-01-01', 3600), // 60 min
      createSession('2026-01-02', 7200), // 120 min
    ]
    render(<SessionStats sessions={sessions} />)
    expect(screen.getByText('90 min')).toBeInTheDocument()
  })

  it('counts consecutive weeks with sessions for current streak', () => {
    // Freeze time to Monday Sep 21, 2026 — current week is [Sep 20, Sep 27)
    vi.setSystemTime(new Date('2026-09-21T12:00:00'))

    const sessions = [
      createSession('2026-09-21', 3600), // current week [Sep 20, Sep 27)
      createSession('2026-09-20', 3600), // current week (same week, should not double-count)
      createSession('2026-09-15', 3600), // previous week [Sep 13, Sep 20)
    ]
    render(<SessionStats sessions={sessions} />)
    expect(screen.getByText('2 weeks')).toBeInTheDocument()
  })
})
