import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { TrackerProvider } from '../context'
import { BackupProvider } from '../context/BackupContext'
import { ModalProvider } from '../components/ModalProvider'
import SessionDetailPage from '../pages/SessionDetailPage'
import { deleteStore, setStore } from '../db'
import type { SessionExercise, Session, TrackerData } from '../types'

vi.stubGlobal('alert', vi.fn())

const CURRENT_DATE = '2026-11-02'
const LEGACY_DATE = '2026-11-01'

const BENCH_DEF = {
  id: 'bench',
  name: 'Bench Press',
  muscles: ['Chest'],
  setup: 'Barbell',
  superset: '',
  tier: 'T1' as const,
  equipment: 'barbell' as const,
}

const SQUAT_DEF = {
  id: 'squat',
  name: 'Back Squat',
  muscles: ['Legs'],
  setup: 'Barbell',
  superset: '',
  tier: 'T1' as const,
  equipment: 'barbell' as const,
}

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

function legacySession(): Session {
  return {
    date: LEGACY_DATE,
    workoutName: 'Test Workout',
    elapsedTime: 200,
    notes: '',
    exercises: [makeSessionExercise({ id: 'bench', name: 'Bench Press', weight: '225', reps: '5', sets: 3 })],
  }
}

function makeData(
  exercises: SessionExercise[],
  earlier: Session[] = [legacySession()]
): TrackerData {
  return {
    meta: { method: 'GZCL', created: '2026-01-01T00:00:00.000Z' },
    exercises: [BENCH_DEF, SQUAT_DEF],
    workouts: [{ name: 'Test Workout', exercises: ['bench'] }],
    sessions: [
      { date: CURRENT_DATE, workoutName: 'Test Workout', elapsedTime: 100, notes: '', exercises },
      ...earlier,
    ],
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/sessions/${CURRENT_DATE}`]}>
      <BackupProvider>
        <TrackerProvider>
          <ModalProvider>
            <Routes>
              <Route path="/sessions/:date" element={<SessionDetailPage />} />
            </Routes>
          </ModalProvider>
        </TrackerProvider>
      </BackupProvider>
    </MemoryRouter>
  )
}

/** The `.progression-info` block inside the card for `name`, or null. */
function progressionIn(name: string): HTMLElement | null {
  const card = screen.getByText(name).closest('.card')
  return card ? card.querySelector('.progression-info') : null
}

describe('record identity on the session detail card', () => {
  beforeEach(async () => {
    await deleteStore('tracker')
    await deleteStore('backup-meta')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('alert', vi.fn())
  })

  // THE REGRESSION. `duplicateExerciseInSession` gives the copy a synthetic id
  // (`bench-copy-<uuid>`) and points `originalId` back at `bench`. A lookup keyed
  // on `ex.id` therefore matches nothing in any earlier Session and the copy's
  // card renders with no "Last time" at all, while the original card directly
  // above it shows the history — the app contradicting itself one row apart.
  it('shows Last time on a duplicated exercise', async () => {
    const user = userEvent.setup()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('duplicated-0000-0000-0000-000000000000')
    await setStore('tracker', makeData([
      makeSessionExercise({ id: 'bench', name: 'Bench Press', equipment: 'barbell' }),
    ]))

    renderPage()

    // The original already resolves — that half never broke.
    await waitFor(() => expect(progressionIn('Bench Press')).toHaveTextContent('Last time: 225 x 5 (3)'))

    await user.click(screen.getByTitle('Duplicate exercise'))

    // The copy's own id is synthetic and matches no historical record; the
    // lookup has to resolve through `originalId`.
    await waitFor(() => expect(progressionIn('Bench Press (2)')).toHaveTextContent('Last time: 225 x 5 (3)'))
  })

  // The same id-vs-originalId rule on the add-exercise modal. The only Session
  // state that isolates it: the original T1 record has been removed, so the copy
  // is the sole record and its id is synthetic while its `originalId` is the
  // library id. Filtering on `se.id === ex.id` alone leaves the library entry
  // visible, the user clicks it, `addExerciseToSession` rejects it in silence,
  // and the modal closes as if something had been added — nothing changes.
  it('hides a library exercise from the add modal once only its copy remains', async () => {
    const user = userEvent.setup()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('duplicated-0000-0000-0000-000000000000')
    await setStore('tracker', makeData([
      makeSessionExercise({ id: 'bench', name: 'Bench Press', equipment: 'barbell' }),
    ]))

    renderPage()

    await user.click(await screen.findByRole('button', { name: '+ Add Exercise' }))
    const modal = () => document.querySelector('.modal-overlay.show .modal') as HTMLElement
    // With the original present the entry is legitimately hidden — its id matches.
    expect(within(modal()).queryByText('Bench Press')).toBeNull()
    expect(within(modal()).getByText('Back Squat')).toBeInTheDocument()
    await user.click(within(modal()).getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByTitle('Duplicate exercise'))
    await screen.findByText('Bench Press (2)')

    // Remove the original. Two T1 records means removal is permitted.
    const originalCard = screen.getByText('Bench Press').closest('.card') as HTMLElement
    await user.click(within(originalCard).getByTitle('Remove exercise'))
    // Scoped to the confirm modal so the "+ Add Exercise" modal's own Cancel
    // button can never be the one clicked.
    const heading = await screen.findByRole('heading', { name: 'Remove Exercise' })
    const confirmModal = heading.closest('.modal') as HTMLElement
    await user.click(within(confirmModal).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(screen.queryByText('Bench Press')).toBeNull())
    // Exactly one record left, and it is the copy.
    expect(screen.getByText('Bench Press (2)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+ Add Exercise' }))
    // Only the copy's `originalId: 'bench'` identifies the library exercise as
    // already in this Session, so the entry must stay hidden.
    expect(within(modal()).queryByText('Bench Press')).toBeNull()
    // The filter must not over-reach: an exercise that is not in the Session at
    // all is still offered.
    expect(within(modal()).getByText('Back Squat')).toBeInTheDocument()
  })

  // Guard on the fix itself: a copy whose `originalId` has no history to find
  // must render no progression block rather than throw or render an empty one.
  it('renders no Last time for a copy with no earlier session', async () => {
    await setStore('tracker', makeData([
      makeSessionExercise({ id: 'bench', name: 'Bench Press', equipment: 'barbell' }),
      makeSessionExercise({
        id: 'bench-copy-orphan',
        originalId: 'bench',
        name: 'Bench Press (2)',
        equipment: 'barbell',
      }),
    ], []))

    renderPage()

    await screen.findByText('Bench Press (2)')
    // getPreviousPerformances only looks at Sessions earlier than this one, and
    // there are none, so there is no progression context for either card.
    expect(progressionIn('Bench Press (2)')).toBeNull()
    expect(progressionIn('Bench Press')).toBeNull()
  })
})
