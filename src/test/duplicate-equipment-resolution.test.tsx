import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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
const BAR = 35
const SEED_PLATES = [
  { count: 2, weight: 45 },
  { count: 2, weight: 25 },
  { count: 4, weight: 10 },
  { count: 2, weight: 5 },
  { count: 2, weight: 2.5 },
]

/** The one definition in the library, and the one barbell lift. */
const BARBELL_DEF = {
  id: 'bench',
  name: 'Bench Press',
  muscles: ['Chest'],
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
    reps: '5',
    sets: 3,
    ...over,
  }
}

function makeData(exercises: SessionExercise[]): TrackerData {
  return {
    meta: {
      method: 'GZCL',
      created: '2026-01-01T00:00:00.000Z',
      barbellWeight: BAR,
      plates: SEED_PLATES,
    },
    exercises: [BARBELL_DEF],
    workouts: [{ name: 'Test Workout', exercises: ['bench'] }],
    sessions: [
      {
        date: CURRENT_DATE,
        workoutName: 'Test Workout',
        elapsedTime: 100,
        notes: '',
        exercises,
      } satisfies Session,
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

/** The card element wrapping the exercise named `name`. */
async function cardFor(name: string): Promise<HTMLElement> {
  const el = await screen.findByText(name)
  const card = el.closest('.card')
  expect(card).not.toBeNull()
  return card as HTMLElement
}

function weightInput(card: HTMLElement): HTMLInputElement {
  return within(card).getByPlaceholderText('Weight') as HTMLInputElement
}

function breakdownIn(card: HTMLElement): HTMLElement | null {
  return within(card).queryByTestId('plate-breakdown')
}

describe('duplicating an exercise within a session', () => {
  beforeEach(async () => {
    await deleteStore('tracker')
    await deleteStore('backup-meta')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('alert', vi.fn())
  })

  // THE REGRESSION. `equipment` is snapshotted onto a session exercise when the
  // session is created, so records predating that field carry no such key — 439
  // of them in the owner's real data. The copy of such a record gets a
  // synthetic id that matches no definition, so the definition's
  // `equipment: 'barbell'` never reaches the merge and the plate breakdown
  // silently disappears. Duplicating from a MODERN session works, which is
  // exactly why this shipped: the tests only ever covered a record that
  // already had the key.
  it('shows plates on a copy of a pre-equipment barbell record once a weight is entered', async () => {
    const user = userEvent.setup()
    // A record as it exists on disk today: no `equipment` key at all.
    // 125 lb is exactly one 45 per side, so the original's breakdown is
    // unambiguous and distinct from the copy's.
    const data = makeData([
      makeSessionExercise({ id: 'bench', name: 'Bench Press', weight: '125' }),
    ])
    expect(data.sessions[0].exercises[0]).not.toHaveProperty('equipment')
    await setStore('tracker', data)

    renderPage()

    // The ORIGINAL resolves to barbell through the definition, so it shows
    // plates. This is the half that already worked, and the reason the bug
    // reads as "the copy lost something the original has".
    const originalCard = await cardFor('Bench Press')
    await waitFor(() => expect(breakdownIn(originalCard)).toHaveTextContent('45 per side'))

    await user.click(screen.getByTitle('Duplicate exercise'))

    // The copy starts empty — a fresh set must not inherit a stale weight.
    const copyCard = await cardFor('Bench Press (2)')
    expect(weightInput(copyCard).value).toBe('')

    await user.type(weightInput(copyCard), '137')

    // 137 is not loadable; 135 is, as 45 + 5 per side.
    await waitFor(() =>
      expect(breakdownIn(copyCard)).toHaveTextContent('45 + 5 per side')
    )
    expect(breakdownIn(copyCard)).toHaveTextContent('135 (2)')
  })

  // The mirror of the case above, and the reason the owner did not catch it:
  // a modern record already carries `equipment`, so its copy renders plates
  // and the defect is invisible.
  it('keeps showing plates on a copy of a modern barbell record', async () => {
    const user = userEvent.setup()
    await setStore('tracker', makeData([
      makeSessionExercise({ id: 'bench', name: 'Bench Press', equipment: 'barbell', weight: '135' }),
    ]))

    renderPage()

    await cardFor('Bench Press')
    await user.click(screen.getByTitle('Duplicate exercise'))

    const copyCard = await cardFor('Bench Press (2)')
    await user.type(weightInput(copyCard), '137')
    await waitFor(() =>
      expect(breakdownIn(copyCard)).toHaveTextContent('45 + 5 per side')
    )
  })

  // A copy must still honour an explicitly recorded "None", even if the
  // definition has since been reclassified as a barbell lift. The session
  // records what was actually done that day.
  it('does not invent plates for a copy of a record explicitly marked as not barbell', async () => {
    const user = userEvent.setup()
    await setStore('tracker', makeData([
      makeSessionExercise({ id: 'bench', name: 'Bench Press', equipment: '', weight: '135' }),
    ]))

    renderPage()

    const originalCard = await cardFor('Bench Press')
    expect(breakdownIn(originalCard)).toBeNull()

    await user.click(screen.getByTitle('Duplicate exercise'))
    const copyCard = await cardFor('Bench Press (2)')
    await user.type(weightInput(copyCard), '137')

    await waitFor(() => expect(weightInput(copyCard).value).toBe('137'))
    expect(breakdownIn(copyCard)).toBeNull()
  })

  // An exercise id that matches no definition at all (a deleted exercise, or a
  // synthetic id with no originalId to fall back through) must stay silent
  // rather than throwing or rendering empty space.
  it('stays silent for a copy whose original definition no longer exists', async () => {
    const user = userEvent.setup()
    const data = makeData([
      makeSessionExercise({ id: 'deleted-exercise', name: 'Deleted Exercise', weight: '135' }),
    ])
    await setStore('tracker', data)

    renderPage()

    const originalCard = await cardFor('Deleted Exercise')
    expect(breakdownIn(originalCard)).toBeNull()

    await user.click(screen.getByTitle('Duplicate exercise'))
    const copyCard = await cardFor('Deleted Exercise (2)')
    await user.type(weightInput(copyCard), '137')

    await waitFor(() => expect(weightInput(copyCard).value).toBe('137'))
    expect(breakdownIn(copyCard)).toBeNull()
  })
})
