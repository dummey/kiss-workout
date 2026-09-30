import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { TrackerProvider } from '../context'
import { BackupProvider } from '../context/BackupContext'
import { ModalProvider } from '../components/ModalProvider'
import SessionsPage from '../pages/SessionsPage'
import CalendarHeatmap from '../components/CalendarHeatmap'
import { deleteStore, setStore } from '../db'
import type { SessionExercise, Session, TrackerData } from '../types'

// `failed` is a first-class state: a logged attempt that hit failure is still a
// logged attempt. The calendar and the sessions list disagreed with
// getPreviousPerformances in context.tsx, which counts `failed`, so a Session
// whose only work was a failed set read as 0% complete — "0 / 1 exercises
// logged" and an untouched heatmap cell for a day that was actually trained.

const FAILED_DATE = '2026-11-02'
const MIXED_DATE = '2026-11-01'

function makeSessionExercise(over: Partial<SessionExercise> & { id: string; name: string }): SessionExercise {
  return {
    muscles: ['Chest'],
    setup: 'Barbell',
    tier: 'T1',
    superset: '',
    weight: '',
    reps: '',
    sets: null,
    ...over,
  }
}

function makeSession(date: string, exercises: SessionExercise[]): Session {
  return { date, workoutName: 'Test Workout', elapsedTime: 300, notes: '', exercises }
}

/** No weight, no reps — only the failed marker. Still a logged attempt. */
const FAILED_ONLY = makeSessionExercise({ id: 'bench', name: 'Bench Press', failed: true })
const FULLY_LOGGED = makeSessionExercise({ id: 'squat', name: 'Back Squat', weight: '315', reps: '5', sets: 3 })
const TOUCHED_NOTHING = makeSessionExercise({ id: 'dl', name: 'Deadlift' })

function makeData(): TrackerData {
  return {
    meta: { method: 'GZCL', created: '2026-01-01T00:00:00.000Z' },
    exercises: [],
    workouts: [{ name: 'Test Workout', exercises: ['bench', 'squat', 'dl'] }],
    sessions: [
      makeSession(FAILED_DATE, [FAILED_ONLY]),
      makeSession(MIXED_DATE, [FULLY_LOGGED, TOUCHED_NOTHING]),
    ],
  }
}

/** The UTC day string, which is how the heatmap formats its own dates. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Heatmap day cells, oldest first. Padding cells are not clickable. */
function dayCells(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('div'))
    .filter(d => d.style.cursor === 'pointer')
}

function hoverTodayCell(): string {
  const date = todayUtc()
  const cells = dayCells()
  expect(cells.length).toBeGreaterThan(0)
  // `today` is the last day in the heatmap's window, so the last clickable cell
  // is today. The tooltip renders the same logged/total count as the sessions
  // list, so it is the observable half of the heatmap defect.
  fireEvent.mouseOver(cells[cells.length - 1])
  return date
}

describe('failed-only session completion count', () => {
  beforeEach(async () => {
    await deleteStore('tracker')
    await deleteStore('backup-meta')
    await setStore('tracker', makeData())
  })

  function renderSessionsPage() {
    return render(
      <MemoryRouter initialEntries={['/sessions']}>
        <BackupProvider>
          <TrackerProvider>
            <ModalProvider>
              <Routes>
                <Route path="/sessions" element={<SessionsPage />} />
              </Routes>
            </ModalProvider>
          </TrackerProvider>
        </BackupProvider>
      </MemoryRouter>
    )
  }

  it('counts a failed-only session as fully logged in the sessions list', async () => {
    renderSessionsPage()

    // THE REGRESSION: the failed-only Session read "0 / 1 exercises logged" —
    // the one day that was actually trained looked untouched. Regex because
    // elapsedTime appends "• Nm Ss" to the same line.
    expect(await screen.findByText(/^1 \/ 1 exercises logged/)).toBeInTheDocument()
    // The mixed Session must read 1 of 2: counting `failed` must not degenerate
    // into "every exercise counts as logged".
    expect(screen.getByText(/^1 \/ 2 exercises logged/)).toBeInTheDocument()
  })

  it('counts a failed-only session as logged in the calendar heatmap tooltip', () => {
    render(<CalendarHeatmap sessions={[makeSession(todayUtc(), [FAILED_ONLY])]} />)

    const date = hoverTodayCell()

    // The tooltip's <strong> holds the date; its parent holds the whole line.
    const tooltip = screen.getByText(date).parentElement as HTMLElement
    expect(tooltip).toHaveTextContent('— Test Workout (1/1)')
  })

  it('still reads 0/1 for a session where nothing was recorded at all', () => {
    render(<CalendarHeatmap sessions={[makeSession(todayUtc(), [TOUCHED_NOTHING])]} />)

    const date = hoverTodayCell()

    const tooltip = screen.getByText(date).parentElement as HTMLElement
    expect(tooltip).toHaveTextContent('— Test Workout (0/1)')
  })
})
