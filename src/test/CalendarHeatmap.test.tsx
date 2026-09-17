import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CalendarHeatmap from '../components/CalendarHeatmap'
import type { Session } from '../types'

const mockSessions: Session[] = [
  {
    date: '2026-09-01',
    workoutName: 'Squat Workout',
    elapsedTime: 3000,
    notes: '',
    exercises: [
      { id: 'squat', name: 'Squat', muscles: [], setup: '', tier: 'T1', superset: '', weight: '225', reps: '5', sets: 3 },
      { id: 'bench', name: 'Bench', muscles: [], setup: '', tier: 'T2', superset: '', weight: '185', reps: '8', sets: 3 },
      { id: 'dl', name: 'DL', muscles: [], setup: '', tier: 'T1', superset: '', weight: '', reps: '', sets: null }
    ]
  },
  {
    date: '2026-09-03',
    workoutName: 'Bench Workout',
    elapsedTime: 2800,
    notes: '',
    exercises: [
      { id: 'bench', name: 'Bench', muscles: [], setup: '', tier: 'T1', superset: '', weight: '185', reps: '5', sets: 5 },
      { id: 'squat', name: 'Squat', muscles: [], setup: '', tier: 'T2', superset: '', weight: '155', reps: '10', sets: 3 }
    ]
  }
]

describe('CalendarHeatmap', () => {
  it('renders without crashing', () => {
    render(<CalendarHeatmap sessions={[]} />)
    expect(screen.getByText('Training Activity')).toBeInTheDocument()
  })

  it('renders legend with intensity levels', () => {
    render(<CalendarHeatmap sessions={[]} />)
    expect(screen.getByText('Less')).toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()
  })

  it('renders month labels', () => {
    render(<CalendarHeatmap sessions={mockSessions} />)
    // Should show at least one month label
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const found = months.some(m => screen.queryByText(m))
    expect(found).toBe(true)
  })

  it('renders cells for each day', () => {
    render(<CalendarHeatmap sessions={mockSessions} />)
    const dayCells = document.querySelectorAll('[style*="cursor: pointer"]')
    // Should have at least 2 days with sessions
    expect(dayCells.length).toBeGreaterThanOrEqual(2)
  })

  it('renders with sessions', () => {
    render(<CalendarHeatmap sessions={mockSessions} />)
    expect(screen.getByText('Training Activity')).toBeInTheDocument()
    // Should have multiple cells (6 months × ~30 days)
    const dayCells = document.querySelectorAll('[style*="cursor: pointer"]')
    expect(dayCells.length).toBeGreaterThan(10)
  })
})
