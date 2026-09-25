import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BackupProvider } from '../context/BackupContext'
import { ModalProvider } from '../components/ModalProvider'
import { TrackerProvider } from '../context'
import ExerciseDetailPage from '../pages/ExerciseDetailPage'
import ExercisesPage from '../pages/ExercisesPage'
import WorkoutsPage from '../pages/WorkoutsPage'
import SessionDetailPage from '../pages/SessionDetailPage'
import { BodyChart } from 'body-muscles'
import { deleteStore, setStore } from '../db'
import type { SessionExercise, TrackerData } from '../types'

vi.mock('body-muscles', () => ({
  BodyChart: vi.fn(function () {
    this.destroy = vi.fn()
    this.update = vi.fn()
  }),
  ViewSide: { FRONT: 'front', BACK: 'back' }
}))

function record(overrides: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: 'bench',
    name: 'Bench Press',
    muscles: ['Chest'],
    setup: 'Barbell',
    tier: 'T1',
    superset: '',
    weight: '225',
    reps: '5',
    sets: 3,
    ...overrides
  }
}

function makeData(): TrackerData {
  const sessions = [
    {
      date: '2026-02-13',
      workoutName: 'Push',
      elapsedTime: 60,
      notes: '',
      exercises: [record({ id: 'bench-copy', originalId: 'bench', name: 'Bench Press (2)', weight: '215', failed: true }), record()]
    },
    ...Array.from({ length: 12 }, (_, index) => ({
      date: `2026-02-${String(index + 1).padStart(2, '0')}`,
      workoutName: 'Push',
      elapsedTime: 60,
      notes: '',
      exercises: [record({ weight: String(200 + index) })]
    }))
  ]

  return {
    meta: { method: 'GZCL', created: '2026-01-01T00:00:00.000Z' },
    exercises: [{
      id: 'bench',
      name: 'Bench Press',
      muscles: ['Chest', 'Future Muscle'],
      setup: 'Barbell',
      superset: 'SS1',
      tier: 'T1'
    }],
    workouts: [
      { name: 'Push', exercises: ['bench'] },
      { name: 'Strength', exercises: ['bench'] }
    ],
    sessions
  }
}

function Providers({ children }: { children: React.ReactNode }) {
  return <BackupProvider><TrackerProvider>{children}</TrackerProvider></BackupProvider>
}

function renderPage(entry = '/exercises/bench') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Providers>
        <ModalProvider>
          <Routes>
            <Route path="/exercises/:id" element={<ExerciseDetailPage />} />
            <Route path="/exercises" element={<ExercisesPage />} />
            <Route path="/workouts" element={<WorkoutsPage />} />
            <Route path="/sessions/:date" element={<SessionDetailPage />} />
          </Routes>
        </ModalProvider>
      </Providers>
    </MemoryRouter>
  )
}

describe('ExerciseDetailPage', () => {
  beforeEach(async () => {
    vi.mocked(BodyChart).mockClear()
    await deleteStore('tracker')
    await deleteStore('backup-meta')
    await setStore('tracker', makeData())
  })

  it('renders current details, workout membership, and only this exercise on the muscle map', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Bench Press', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Barbell')).toBeInTheDocument()
    expect(screen.getByText('SS1')).toBeInTheDocument()
    expect(screen.getByText('Future Muscle')).toBeInTheDocument()
    expect(screen.getByText('Push')).toBeInTheDocument()
    expect(screen.getByText('Strength')).toBeInTheDocument()
    const chartOptions = vi.mocked(BodyChart).mock.calls.map(call => call[1].bodyState)
    expect(chartOptions).toHaveLength(2)
    expect(chartOptions[0]['chest-upper-left']).toEqual({ intensity: 8, selected: true })
    expect(Object.keys(chartOptions[0])).toHaveLength(4)
  })

  it('limits history to the latest 12 records, newest first, and preserves duplicates and originalId', async () => {
    renderPage()

    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(12)
    expect(rows[0]).toHaveTextContent('2026-02-13')
    expect(within(rows[0]).getAllByText('Failed')).toHaveLength(1)
    expect(rows[1]).toHaveTextContent('2026-02-13')
    expect(rows[1]).toHaveTextContent('225')
    expect(rows[2]).toHaveTextContent('2026-02-12')
  })

  it('formats failed and legacy blank values without changing missing failed to true', async () => {
    const data = makeData()
    data.sessions = [{
      date: '2026-03-01',
      workoutName: 'Push',
      elapsedTime: 60,
      notes: '',
      exercises: [record({ weight: '', reps: '', sets: null })]
    }]
    await setStore('tracker', data)
    renderPage()

    const table = await screen.findByRole('table')
    const row = within(table).getAllByRole('row')[1]
    expect(within(row).getAllByText('—')).toHaveLength(4)
    expect(within(row).queryByText('Failed')).not.toBeInTheDocument()
  })

  it('searches all displayed columns and Failed while preserving row order', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByRole('searchbox', { name: 'Search history' }), 'failed')
    const failedRows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)
    expect(failedRows).toHaveLength(1)
    expect(failedRows[0]).toHaveTextContent('2026-02-13')
    expect(failedRows[0]).toHaveTextContent('Failed')

    await user.clear(screen.getByRole('searchbox', { name: 'Search history' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search history' }), '215')
    const duplicateRows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(duplicateRows).toHaveLength(1)
    expect(duplicateRows[0]).toHaveTextContent('2026-02-13')
  })

  it('renders a clear not-found state for a deleted exercise', async () => {
    renderPage('/exercises/deleted')
    expect(await screen.findByRole('heading', { name: 'Exercise not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Exercises' })).toHaveAttribute('href', '/exercises')
  })
})

describe('exercise details navigation', () => {
  beforeEach(async () => {
    await deleteStore('tracker')
    await deleteStore('backup-meta')
    await setStore('tracker', makeData())
  })

  it('navigates from Exercises without intercepting Edit or Delete', async () => {
    const user = userEvent.setup()
    renderPage('/exercises')
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Bench Press' }))
    expect(await screen.findByRole('heading', { name: 'Bench Press', level: 1 })).toBeInTheDocument()
  })

  it('navigates from Workouts without intercepting Show, Remove, or reorder', async () => {
    const user = userEvent.setup()
    renderPage('/workouts')
    expect(await screen.findByRole('button', { name: 'Show' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move Bench Press up' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Bench Press' }))
    expect(await screen.findByRole('heading', { name: 'Bench Press', level: 1 })).toBeInTheDocument()
  })

  it('navigates from Session details without intercepting add/export/delete or performance controls', async () => {
    const user = userEvent.setup()
    renderPage('/sessions/2026-02-01')
    expect(await screen.findByRole('button', { name: '+ Add Exercise' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Weight')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Bench Press' }))
    expect(await screen.findByRole('heading', { name: 'Bench Press', level: 1 })).toBeInTheDocument()
  })
})
