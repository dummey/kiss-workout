import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { TrackerProvider } from '../context'
import { BackupProvider } from '../context/BackupContext'
import { ModalProvider } from '../components/ModalProvider'
import SessionsPage from '../pages/SessionsPage'
import TrainingHeatmap from '../components/TrainingHeatmap'
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

/**
 * Today as `YYYY-MM-DD`.
 *
 * Written in local calendar fields so the day is inside the grid's window
 * whatever the runner's timezone. The UTC-bucket question — whether a UTC
 * `Session.date` lands on its own cell — is covered by its own test in
 * `TrainingHeatmap.test.tsx`; this file guards only the `failed`-counts-as-
 * logged rule.
 */
function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * Find today's cell by its accessible name.
 *
 * That name is `YYYY-MM-DD — <workoutName> (logged/total)` — the same
 * logged/total the tooltip shows and the same one the sessions list shows — so
 * locating the cell is itself part of what these tests assert.
 */
function todayCell(count: string): HTMLElement {
  return screen.getByLabelText(`${today()} — Test Workout ${count}`)
}

describe('failed-only session completion count', () => {
  // The heatmap sizes its grid from the *measured* width of its `<svg>`, and jsdom
  // measures every element as 0 — so without this stub the grid renders zero day
  // cells and the assertions below would pass vacuously against an empty DOM.
  let widthSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    widthSpy = vi.spyOn(SVGElement.prototype, 'clientWidth', 'get').mockReturnValue(900)
    await deleteStore('tracker')
    await deleteStore('backup-meta')
    await setStore('tracker', makeData())
  })

  afterEach(() => {
    widthSpy.mockRestore()
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
    render(<TrainingHeatmap sessions={[makeSession(today(), [FAILED_ONLY])]} />)

    // THE REGRESSION: this day was actually trained, so the cell must not be
    // named as an empty one — and hovering it must report 1/1.
    fireEvent.mouseOver(todayCell('(1/1)'))

    // The tooltip's <strong> holds the date; its parent holds the whole line.
    const tooltip = screen.getByText(today()).parentElement as HTMLElement
    expect(tooltip).toHaveTextContent('— Test Workout (1/1)')
  })

  it('still reads 0/1 for a session where nothing was recorded at all', () => {
    render(<TrainingHeatmap sessions={[makeSession(today(), [TOUCHED_NOTHING])]} />)

    fireEvent.mouseOver(todayCell('(0/1)'))

    const tooltip = screen.getByText(today()).parentElement as HTMLElement
    expect(tooltip).toHaveTextContent('— Test Workout (0/1)')
  })
})
