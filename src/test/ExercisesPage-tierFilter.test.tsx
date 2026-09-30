import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { TrackerProvider } from '../context'
import { BackupProvider } from '../context/BackupContext'
import { ModalProvider } from '../components/ModalProvider'
import ExercisesPage from '../pages/ExercisesPage'
import { setStore, deleteStore } from '../db'
import { SEED_DATA } from '../data'
import type { Exercise, TrackerData } from '../types'

vi.stubGlobal('alert', vi.fn())

/** Seed library tallies, asserted rather than hard-coded where it matters. */
const T1 = SEED_DATA.exercises.filter(e => e.tier === 'T1')
const T2 = SEED_DATA.exercises.filter(e => e.tier === 'T2')
const T3 = SEED_DATA.exercises.filter(e => e.tier === 'T3')
const UNTIERED_SEED = SEED_DATA.exercises.filter(e => e.tier === '')

const UNTIERED: Exercise = {
  id: 'custom-movement',
  name: 'Sled Drag',
  muscles: ['Quads'],
  setup: '',
  superset: '',
  tier: '',
  equipment: ''
}

function renderPage() {
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

/** The header's "N exercises in library" line — the filtered total. */
function headerCount(): string {
  return screen.getByText(/exercises in library/).textContent ?? ''
}

function tierPill(name: string | RegExp) {
  return screen.getByRole('button', { name })
}

function tierBadges(): string[] {
  return Array.from(document.querySelectorAll('.card .tier-badge')).map(b => b.textContent ?? '')
}

async function typeSearch(user: ReturnType<typeof userEvent.setup>, text: string) {
  const input = screen.getByPlaceholderText('Search by name, muscle, or setup...')
  await user.clear(input)
  if (text) await user.type(input, text)
}

describe('ExercisesPage — tier filter pills', () => {
  beforeEach(async () => {
    cleanup()
    vi.clearAllMocks()
    try {
      await deleteStore('tracker')
      await deleteStore('backup-meta')
    } catch {
      // ignore
    }
    await setStore('tracker', SEED_DATA)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('searching a tier string no longer matches by tier', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Barbell Back Squat')

    expect(T1.length).toBeGreaterThan(0)
    await typeSearch(user, 'T1')

    // The tier clause is gone from the predicate, so nothing matches a tier string.
    expect(headerCount()).toBe('0 exercises in library')
    expect(tierBadges()).toEqual([])
  })

  it('filters to only T1 exercises when the T1 pill is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Barbell Back Squat')

    await user.click(tierPill(/^T1,/))

    expect(headerCount()).toBe(`${T1.length} exercises in library`)
    expect(tierBadges()).toEqual(T1.map(() => 'T1'))
  })

  it('multi-selects tiers and excludes the rest', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Barbell Back Squat')

    await user.click(tierPill(/^T1,/))
    await user.click(tierPill(/^T2,/))

    expect(headerCount()).toBe(`${T1.length + T2.length} exercises in library`)
    const badges = tierBadges()
    expect(badges).toHaveLength(T1.length + T2.length)
    expect(badges.filter(t => t === 'T3')).toHaveLength(0)
    expect(badges.filter(t => t === 'T1')).toHaveLength(T1.length)
    expect(badges.filter(t => t === 'T2')).toHaveLength(T2.length)
  })

  it('deselects a pill on second click and restores the full list', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Barbell Back Squat')

    await user.click(tierPill(/^T1,/))
    expect(headerCount()).toBe(`${T1.length} exercises in library`)

    await user.click(tierPill(/^T1,/))
    expect(headerCount()).toBe(`${SEED_DATA.exercises.length} exercises in library`)
    expect(tierBadges()).toHaveLength(SEED_DATA.exercises.length)
  })

  it('marks the active pill pressed for assistive tech', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Barbell Back Squat')

    expect(tierPill(/^T1,/)).toHaveAttribute('aria-pressed', 'false')
    await user.click(tierPill(/^T1,/))
    expect(tierPill(/^T1,/)).toHaveAttribute('aria-pressed', 'true')
    expect(tierPill(/^T2,/)).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows library-wide tier counts that do not shift as the search narrows', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Barbell Back Squat')

    expect(tierPill(`T1, ${T1.length} exercises`)).toBeInTheDocument()
    expect(tierPill(`T2, ${T2.length} exercises`)).toBeInTheDocument()
    expect(tierPill(`T3, ${T3.length} exercises`)).toBeInTheDocument()

    await typeSearch(user, 'squat')
    // Counts come from the library, not the filtered list.
    expect(tierPill(`T1, ${T1.length} exercises`)).toBeInTheDocument()
  })

  it('composes the tier pill with the text search (AND)', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Barbell Back Squat')

    // "Alt: Belt Squat" is T2, "Barbell Back Squat" is T1.
    await typeSearch(user, 'squat')
    expect(screen.getByText('Alt: Belt Squat')).toBeInTheDocument()
    expect(screen.getByText('Barbell Back Squat')).toBeInTheDocument()

    await user.click(tierPill(/^T1,/))
    expect(screen.getByText('Barbell Back Squat')).toBeInTheDocument()
    expect(screen.queryByText('Alt: Belt Squat')).toBeNull()
  })

  it('shows an empty state when the filters exclude everything', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Barbell Back Squat')

    await typeSearch(user, 'zzzznotanexercise')
    expect(screen.getByText(/No exercises match/)).toBeInTheDocument()
  })

  it('no longer mentions tier in the search placeholder', async () => {
    renderPage()
    await screen.findByText('Barbell Back Squat')

    expect(screen.getByPlaceholderText('Search by name, muscle, or setup...')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/tier/)).toBeNull()
  })

  it('omits the None pill on a library with no untiered exercises', async () => {
    renderPage()
    await screen.findByText('Barbell Back Squat')

    expect(UNTIERED_SEED).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /^None,/ })).toBeNull()
  })

  it('shows a working None pill once an untiered exercise exists', async () => {
    const withUntiered: TrackerData = {
      ...SEED_DATA,
      exercises: [...SEED_DATA.exercises, UNTIERED]
    }
    await setStore('tracker', withUntiered)

    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Sled Drag')

    expect(tierPill('None, 1 exercise')).toBeInTheDocument()

    await user.click(tierPill(/^None,/))
    expect(headerCount()).toBe('1 exercises in library')
    expect(screen.getByText('Sled Drag')).toBeInTheDocument()
    // Untagged cards carry no tier badge, so the badge list is now empty.
    expect(tierBadges()).toEqual([])
  })
})
