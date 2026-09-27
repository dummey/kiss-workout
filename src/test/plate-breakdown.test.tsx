import React from 'react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

function makeSessionExercise(over: Partial<SessionExercise> & { id: string; name: string }): SessionExercise {
  return {
    muscles: ['Chest'],
    setup: '',
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
    exercises: [
      {
        id: 'bench',
        name: 'Bench Press',
        muscles: ['Chest'],
        setup: 'Barbell',
        superset: '',
        tier: 'T1',
        equipment: 'barbell',
      },
    ],
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

function breakdown() {
  return screen.queryByTestId('plate-breakdown')
}

describe('plate breakdown on session cards', () => {
  beforeEach(async () => {
    await deleteStore('tracker')
    await deleteStore('backup-meta')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('alert', vi.fn())
  })

  it('renders the per-side breakdown and leftover for a barbell exercise', async () => {
    await setStore('tracker', makeData([
      makeSessionExercise({ id: 'bench', name: 'Bench Press', equipment: 'barbell', weight: '137' }),
    ]))

    renderPage()

    // 137 is not loadable; 135 is, as 45 + 5 per side.
    const el = await waitFor(() => {
      const found = breakdown()
      expect(found).not.toBeNull()
      return found!
    })
    expect(el).toHaveTextContent('45 + 5 per side')
    expect(el).toHaveTextContent('135 (2)')
  })

  it('renders nothing at all for a non-barbell exercise', async () => {
    await setStore('tracker', makeData([
      // Same numeric weight, but no bar — the breakdown must not appear.
      makeSessionExercise({ id: 'farmer', name: 'Farmer Carry', equipment: '', weight: '137' }),
    ]))

    renderPage()

    await screen.findByText('Farmer Carry')
    expect(breakdown()).toBeNull()
  })

  it('renders nothing for a historical session exercise with no equipment key', async () => {
    await setStore('tracker', makeData([
      // `equipment` is optional on records predating the field; absent must
      // read as "not barbell" rather than throwing.
      makeSessionExercise({ id: 'legacy', name: 'Legacy Lift', weight: '137' }),
    ]))

    renderPage()

    await screen.findByText('Legacy Lift')
    expect(breakdown()).toBeNull()
  })

  // "BW" appears across historical seed records, as do empty strings. Neither
  // may produce an error, a placeholder, or empty space.
  it.each([
    ['BW', 'bodyweight marker'],
    ['', 'empty weight'],
    ['abc', 'non-numeric text'],
  ])('stays silent for a non-numeric weight (%s, %s)', async weight => {
    await setStore('tracker', makeData([
      makeSessionExercise({ id: 'bench', name: 'Bench Press', equipment: 'barbell', weight }),
    ]))

    renderPage()

    await screen.findByText('Bench Press')
    expect(breakdown()).toBeNull()
  })

  it('updates live as the weight is typed, and leaves the input text untouched', async () => {
    const user = userEvent.setup()
    await setStore('tracker', makeData([
      makeSessionExercise({ id: 'bench', name: 'Bench Press', equipment: 'barbell', weight: '135' }),
    ]))

    renderPage()

    const input = await waitFor(() => {
      const el = screen.getByPlaceholderText('Weight') as HTMLInputElement
      expect(el).toBeInTheDocument()
      return el
    })
    await waitFor(() => expect(breakdown()).toHaveTextContent('45 + 5 per side'))

    await user.clear(input)
    await user.type(input, '137')

    await waitFor(() => expect(breakdown()).toHaveTextContent('135 (2)'))
    // The input keeps exactly what the user typed — no reformatting.
    expect((input as HTMLInputElement).value).toBe('137')
  })

  it('drops the breakdown again when the weight is cleared', async () => {
    const user = userEvent.setup()
    await setStore('tracker', makeData([
      makeSessionExercise({ id: 'bench', name: 'Bench Press', equipment: 'barbell', weight: '135' }),
    ]))

    renderPage()

    const input = await screen.findByPlaceholderText('Weight')
    await waitFor(() => expect(breakdown()).not.toBeNull())

    await user.clear(input)
    await waitFor(() => expect(breakdown()).toBeNull())
  })

  it('reflects a changed bar weight from settings', async () => {
    const data = makeData([
      makeSessionExercise({ id: 'bench', name: 'Bench Press', equipment: 'barbell', weight: '137' }),
    ])
    // A 45 lb bar leaves 46 per side under a 137 target, so a single 45 loads.
    data.meta.barbellWeight = 45
    await setStore('tracker', data)

    renderPage()

    await waitFor(() => {
      expect(breakdown()).toHaveTextContent('135 (2)')
    })
    expect(breakdown()).toHaveTextContent('45 per side')
  })
})
