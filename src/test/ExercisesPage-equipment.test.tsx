import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { TrackerProvider } from '../context'
import { BackupProvider } from '../context/BackupContext'
import { ModalProvider } from '../components/ModalProvider'
import ExercisesPage from '../pages/ExercisesPage'
import { getStore, setStore, deleteStore } from '../db'
import { SEED_DATA } from '../data'
import type { TrackerData } from '../types'

vi.stubGlobal('alert', vi.fn())

const BARBELL_ID = 'barbell-back-squat'
const CABLE_ID = 'lat-pulldown'

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

/** Opens the inline edit form for one exercise card and returns that card. */
async function openEditForm(user: ReturnType<typeof userEvent.setup>, name: string) {
  const card = screen.getByText(name).closest('.card') as HTMLElement
  const editButton = Array.from(card.querySelectorAll('button')).find(b => b.textContent === 'Edit')!
  await user.click(editButton)
  const select = await within(card).findByLabelText('Equipment')
  return { card, select: select as HTMLSelectElement }
}

describe('ExercisesPage — equipment dropdown', () => {
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

  it('offers exactly None and Barbell in the edit form, pre-selected from the definition', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Barbell Back Squat')

    const { select } = await openEditForm(user, 'Barbell Back Squat')
    expect(Array.from(select.options).map(o => [o.value, o.textContent])).toEqual([
      ['', 'None'],
      ['barbell', 'Barbell']
    ])
    expect(select.value).toBe('barbell')
  })

  it('shows None selected for an exercise the seed leaves unset', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Lat Pulldown')

    const { select } = await openEditForm(user, 'Lat Pulldown')
    expect(select.value).toBe('')
  })

  it('persists an equipment change made in the edit form', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Lat Pulldown')

    const { card, select } = await openEditForm(user, 'Lat Pulldown')
    await user.selectOptions(select, 'barbell')
    await user.click(within(card).getByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      expect(stored.exercises.find(e => e.id === CABLE_ID)?.equipment).toBe('barbell')
    })
    // The other fields must survive the save.
    const stored = await getStore('tracker') as TrackerData
    expect(stored.exercises.find(e => e.id === CABLE_ID)?.name).toBe('Lat Pulldown')
    expect(stored.exercises.find(e => e.id === CABLE_ID)?.tier).toBe('T3')
  })

  it('carries the new-exercise form Equipment selection into the saved definition', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Barbell Back Squat')

    await user.click(screen.getByRole('button', { name: '+ Add Exercise' }))
    await screen.findByRole('heading', { name: 'Add Exercise' })

    // Short name on purpose: userEvent.type is per-character, and this file's tests
    // already run under a 5s budget shared with the rest of the suite.
    await user.type(screen.getByPlaceholderText('e.g. Barbell Back Squat'), 'Zercher Squat')
    await user.selectOptions(screen.getByLabelText('Equipment'), 'barbell')
    await user.click(screen.getByRole('button', { name: 'Add Exercise' }))

    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      const created = stored.exercises.find(e => e.name === 'Zercher Squat')
      expect(created).toBeDefined()
      expect(created!.equipment).toBe('barbell')
    })
  })

  it('defaults a new exercise to no equipment when the dropdown is left alone', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Barbell Back Squat')

    await user.click(screen.getByRole('button', { name: '+ Add Exercise' }))
    await screen.findByRole('heading', { name: 'Add Exercise' })

    await user.type(screen.getByPlaceholderText('e.g. Barbell Back Squat'), 'Good Morning')
    await user.click(screen.getByRole('button', { name: 'Add Exercise' }))

    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      const created = stored.exercises.find(e => e.name === 'Good Morning')
      expect(created).toBeDefined()
      expect(created!.equipment).toBe('')
    })
  })

  it('renders an Equipment pill on the card for a barbell exercise', async () => {
    renderPage()
    await screen.findByText('Barbell Back Squat')

    const card = screen.getByText('Barbell Back Squat').closest('.card') as HTMLElement
    const pill = card.querySelector('.tag.equipment')
    expect(pill).not.toBeNull()
    expect(pill!.textContent).toBe('Barbell')
  })

  it('renders no Equipment pill when equipment is empty', async () => {
    renderPage()
    await screen.findByText('Lat Pulldown')

    const card = screen.getByText('Lat Pulldown').closest('.card') as HTMLElement
    // '' means nothing was declared — no pill, and no "None" placeholder.
    expect(card.querySelector('.tag.equipment')).toBeNull()
    expect(card.textContent).not.toContain('None')
  })

  it('orders the Equipment pill after tier and before setup', async () => {
    renderPage()
    await screen.findByText('Barbell Back Squat')

    const card = screen.getByText('Barbell Back Squat').closest('.card') as HTMLElement
    const text = card.textContent ?? ''
    const tierAt = text.indexOf('T1')
    const equipmentAt = text.indexOf('Barbell', text.indexOf('Barbell Back Squat') + 'Barbell Back Squat'.length)
    const setupAt = text.indexOf('Spotter at 18/2')

    expect(tierAt).toBeGreaterThanOrEqual(0)
    expect(equipmentAt).toBeGreaterThan(tierAt)
    expect(setupAt).toBeGreaterThan(equipmentAt)
  })

  it('renders Equipment before Setup in the edit form', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Lat Pulldown')

    const { card } = await openEditForm(user, 'Lat Pulldown')
    const labels = Array.from(card.querySelectorAll('label')).map(l => l.textContent)
    const equipmentIndex = labels.indexOf('Equipment')
    const setupIndex = labels.indexOf('Setup')
    expect(equipmentIndex).toBeGreaterThanOrEqual(0)
    expect(equipmentIndex).toBeLessThan(setupIndex)
  })

  it('leaves the four seeded barbell definitions untouched by merely rendering', async () => {
    renderPage()
    await screen.findByText('Barbell Back Squat')

    const stored = await getStore('tracker') as TrackerData
    const barbell = stored.exercises.filter(e => e.equipment === 'barbell').map(e => e.id)
    expect(barbell).toEqual([BARBELL_ID, 'barbell-bench', 'deadlift', 'bent-over-rows'])
  })
})
