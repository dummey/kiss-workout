import React, { useEffect } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { TrackerProvider, useTracker } from '../context'
import { BackupProvider } from '../context/BackupContext'
import { ModalProvider } from '../components/ModalProvider'
import SessionsPage from '../pages/SessionsPage'
import ExercisesPage from '../pages/ExercisesPage'
import { setStore, deleteStore } from '../db'
import { SEED_DATA } from '../data'
import type { Session, TrackerData } from '../types'

vi.stubGlobal('alert', vi.fn())

/**
 * The heat map sizes itself from `SVGElement.clientWidth`, which jsdom reports
 * as 0 for everything. It renders zero day cells in that state, which is fine
 * for these tests — they assert on the session list, not the grid.
 */

/**
 * Deliberately NOT in date order. The default view sorts descending, so an
 * ascending fixture would be reordered by the first render — but the toggle test
 * then sorts it back and would match the stored order by coincidence. With a
 * shuffled fixture neither sort direction can coincide with it, so any in-place
 * sort is caught.
 */
const SESSIONS: Session[] = [
  { date: '2026-01-12', workoutName: 'Squat Day', elapsedTime: 3600, notes: '', exercises: [] },
  { date: '2026-01-05', workoutName: 'Bench Day', elapsedTime: 3600, notes: '', exercises: [] },
  { date: '2026-01-19', workoutName: 'Deadlift Day', elapsedTime: 3600, notes: '', exercises: [] },
]

/** The order as stored — which a render must leave untouched. */
const STORED_ORDER = SESSIONS.map(s => s.date)
const DESCENDING_ORDER = [...STORED_ORDER].sort((a, b) => b.localeCompare(a))
const ASCENDING_ORDER = [...STORED_ORDER].sort((a, b) => a.localeCompare(b))

/**
 * Captures the live `sessions` ARRAY REFERENCE held by the context. Reading
 * `getStore('tracker')` back cannot detect the mutation: an in-place `sort()`
 * rewrites the array React holds, and IndexedDB only ever saw the structured
 * clone written at load time. Holding the reference is what makes the assertion
 * real. Captured in an effect rather than during render, so the probe itself
 * stays a pure function of the tree.
 */
let liveSessions: Session[] | null = null

function StoreProbe() {
  const { data } = useTracker()
  useEffect(() => {
    if (data) liveSessions = data.sessions
  }, [data])
  return null
}

function renderSessionsPage() {
  return render(
    <MemoryRouter initialEntries={['/sessions']}>
      <BackupProvider>
        <TrackerProvider>
          <ModalProvider>
            <StoreProbe />
            <Routes>
              <Route path="/sessions" element={<SessionsPage />} />
            </Routes>
          </ModalProvider>
        </TrackerProvider>
      </BackupProvider>
    </MemoryRouter>
  )
}

function renderExercisesPage() {
  return render(
    <MemoryRouter initialEntries={['/exercises']}>
      <BackupProvider>
        <TrackerProvider>
          <ModalProvider>
            <Routes>
              <Route path="/exercises" element={<ExercisesPage />} />
            </Routes>
          </ModalProvider>
        </TrackerProvider>
      </BackupProvider>
    </MemoryRouter>
  )
}

async function clearStore() {
  try {
    await deleteStore('tracker')
    await deleteStore('backup-meta')
  } catch {
    // ignore — the first run has nothing to clear
  }
}

async function seedWithSessions() {
  const withSessions: TrackerData = { ...SEED_DATA, sessions: SESSIONS }
  await setStore('tracker', withSessions)
}

describe('SessionsPage — null data (fresh install)', () => {
  beforeEach(async () => {
    cleanup()
    liveSessions = null
    await clearStore()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows the no-data message instead of rendering the page', async () => {
    renderSessionsPage()
    expect(await screen.findByText(/No data available/)).toBeInTheDocument()
  })

  it('does not offer a dead "+ Add Session" button that throws when clicked', async () => {
    // The crash was `TypeError: Cannot read properties of null (reading 'workouts')`
    // thrown from AddSessionForm on the first click — the app's primary action,
    // dead until Settings → Load Seed had been used.
    renderSessionsPage()
    await screen.findByText(/No data available/)

    expect(screen.queryByRole('button', { name: '+ Add Session' })).toBeNull()
  })
})

describe('ExercisesPage — null data (fresh install)', () => {
  beforeEach(async () => {
    cleanup()
    await clearStore()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows the no-data message rather than dereferencing null', async () => {
    renderExercisesPage()
    expect(await screen.findByText(/No data available/)).toBeInTheDocument()
  })

  it('does not offer a dead "+ Add Exercise" button', async () => {
    renderExercisesPage()
    await screen.findByText(/No data available/)

    // There is no workout to attach an exercise to, so the action is not offered
    // rather than offered and throwing.
    expect(screen.queryByRole('button', { name: '+ Add Exercise' })).toBeNull()
  })
})

describe('SessionsPage — sort does not mutate the store', () => {
  beforeEach(async () => {
    cleanup()
    liveSessions = null
    await clearStore()
    await seedWithSessions()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders newest-first while leaving the stored order alone', async () => {
    renderSessionsPage()
    await screen.findByText('Deadlift Day')

    // The page shows descending order...
    const cards = () => Array.from(document.querySelectorAll('.card strong')).map(el => el.textContent)
    expect(cards()).toEqual(DESCENDING_ORDER)

    // ...but the array the context holds is untouched. The probe records in an
    // effect, which React schedules after paint, so the recorded value is awaited
    // rather than assumed present by the time the text query resolved.
    await waitFor(() => expect(liveSessions).not.toBeNull())
    expect(liveSessions!.map(s => s.date)).toEqual(STORED_ORDER)
  })

  it('does not reorder the store when the sort direction is toggled', async () => {
    const user = userEvent.setup()
    renderSessionsPage()
    await screen.findByText('Deadlift Day')

    await user.click(screen.getByRole('button', { name: /Newest/ }))

    await waitFor(() => {
      const cards = Array.from(document.querySelectorAll('.card strong')).map(el => el.textContent)
      expect(cards).toEqual(ASCENDING_ORDER)
    })
    await waitFor(() => expect(liveSessions).not.toBeNull())
    expect(liveSessions!.map(s => s.date)).toEqual(STORED_ORDER)
  })
})
