import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { TrackerProvider } from '../context'
import { BackupProvider } from '../context/BackupContext'
import { ModalProvider } from '../components/ModalProvider'
import SettingsPage from '../pages/SettingsPage'
import { getStore, setStore, deleteStore } from '../db'
import type { TrackerData } from '../types'

vi.stubGlobal('alert', vi.fn())

const NAME_LABEL = 'What should we call you?'

function baseTracker(): TrackerData {
  return {
    meta: { method: 'GZCL', created: '2026-01-01T00:00:00.000Z' },
    exercises: [],
    workouts: [],
    sessions: []
  }
}

function trackerWithSession(): TrackerData {
  return {
    ...baseTracker(),
    sessions: [
      {
        date: '2026-02-01',
        workoutName: 'Upper A',
        elapsedTime: 0,
        notes: '',
        exercises: [
          { id: 'bench', name: 'Bench Press', muscles: ['Chest'], setup: '', tier: 'T1', superset: '', weight: '', reps: '', sets: null }
        ]
      }
    ]
  }
}

function TestApp() {
  return (
    <MemoryRouter initialEntries={['/settings']}>
      <BackupProvider>
        <TrackerProvider>
          <ModalProvider>
            <Routes>
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </ModalProvider>
        </TrackerProvider>
      </BackupProvider>
    </MemoryRouter>
  )
}

/** Uploads a JSON backup through the real Import input and confirms the modal. */
async function importBackup(user: ReturnType<typeof userEvent.setup>, json: string) {
  const file = new File([json], 'backup.json', { type: 'application/json' })
  const input = document.getElementById('import-input') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })

  await waitFor(() => {
    expect(screen.getByText('This will replace all existing data. Continue?')).toBeInTheDocument()
  })
  const importButtons = screen.getAllByRole('button', { name: 'Import' })
  await user.click(importButtons[importButtons.length - 1])

  await waitFor(() => {
    expect(screen.getByText('Import Successful')).toBeInTheDocument()
  })
}

async function loadSeed(user: ReturnType<typeof userEvent.setup>) {
  // Click the "Load Seed" button on the page
  await user.click(screen.getByText('Load Seed'))
  // Wait for the modal to appear
  await waitFor(() => {
    expect(screen.getByText('This will replace all current data with fresh seed data. Continue?')).toBeInTheDocument()
  })
  // Click "Load Seed" in the modal
  const modalButtons = screen.getAllByRole('button', { name: 'Load Seed' })
  await user.click(modalButtons[modalButtons.length - 1])
}

describe('SettingsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    try {
      await deleteStore('tracker')
      await deleteStore('backup-meta')
    } catch {
      // ignore
    }
  })

  it('renders with zero stats initially (no auto-load)', async () => {
    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    // No data initially — seed data is NOT auto-loaded
    expect(screen.getAllByText('0').length).toBe(3)
    expect(screen.getByText('Exercises')).toBeInTheDocument()
    expect(screen.getByText('Workouts')).toBeInTheDocument()
    expect(screen.getByText('Sessions')).toBeInTheDocument()
  })

  it('shows load seed data button', async () => {
    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    expect(screen.getByText('Load Seed')).toBeInTheDocument()
    expect(screen.getByText('Delete All')).toBeInTheDocument()
    expect(screen.getByText('Export')).toBeInTheDocument()
    expect(screen.getByText('Import')).toBeInTheDocument()
  })

  it('loads seed data when confirmed', async () => {
    const user = userEvent.setup()

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    await loadSeed(user)

    await waitFor(() => {
      expect(screen.getByText('26')).toBeInTheDocument()
    })

    const stored = await getStore('tracker') as TrackerData | null
    expect(stored).not.toBeNull()
    expect(stored!.sessions.length).toBe(51)
  })

  it('cancels load seed when not confirmed', async () => {
    const user = userEvent.setup()

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    // Click the "Load Seed" button on the page
    await user.click(screen.getByText('Load Seed'))

    // Wait for the modal to appear
    await waitFor(() => {
      expect(screen.getByText('This will replace all current data with fresh seed data. Continue?')).toBeInTheDocument()
    })

    // Click "Cancel"
    await user.click(screen.getByText('Cancel'))

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText('This will replace all current data with fresh seed data. Continue?')).not.toBeInTheDocument()
    })

    // Stats remain at 0
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
  })

  it('shows delete confirmation modal', async () => {
    const user = userEvent.setup()

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    await user.click(screen.getByText('Delete All'))
    expect(screen.getByText('Delete All Data?')).toBeInTheDocument()
  })

  it('deletes all data when confirmed in modal', async () => {
    const user = userEvent.setup()

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    await user.click(screen.getByText('Delete All'))
    await user.click(screen.getByText('Delete Everything'))

    await waitFor(() => {
      expect(screen.queryByText('Delete All Data?')).not.toBeInTheDocument()
    })
  })

  it('clears backup-meta when Delete All is confirmed', async () => {
    const user = userEvent.setup()

    // Pre-populate backup-meta with stale state
    const { setStore } = await import('../db')
    await setStore('backup-meta', { lastBackupDate: '2020-01-01', sessionsSinceBackup: 5 })

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    await user.click(screen.getByText('Delete All'))
    await user.click(screen.getByText('Delete Everything'))

    await waitFor(() => {
      expect(screen.queryByText('Delete All Data?')).not.toBeInTheDocument()
    })

    // Verify backup-meta was reset to defaults (not deleted)
    const backupMeta = await getStore('backup-meta')
    expect(backupMeta).toEqual({ lastBackupDate: null, sessionsSinceBackup: 0, dismissedAt: null })
  })

  it('cancels delete when clicking cancel in modal', async () => {
    const user = userEvent.setup()

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    await user.click(screen.getByText('Delete All'))
    expect(screen.getByText('Delete All Data?')).toBeInTheDocument()

    await user.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Delete All Data?')).not.toBeInTheDocument()
  })
})

describe('SettingsPage — Customization display name', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    try {
      await deleteStore('tracker')
      await deleteStore('backup-meta')
    } catch {
      // ignore
    }
  })

  afterEach(() => {
    cleanup()
    // restoreAllMocks() only undoes vi.spyOn; stubGlobal needs its own counterpart,
    // otherwise the export test's fake URL object leaks into every later test.
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the Customization section with the display name label', async () => {
    await setStore('tracker', baseTracker())

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    expect(screen.getByRole('heading', { name: 'Customization' })).toBeInTheDocument()
    expect(screen.getByLabelText(NAME_LABEL)).toBeInTheDocument()
    expect(screen.getByLabelText(NAME_LABEL)).toHaveValue('')
  })

  it('renders the display name input inside the shared .form-group convention', async () => {
    await setStore('tracker', baseTracker())

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    const input = screen.getByLabelText(NAME_LABEL)

    // Durable style contract: the field inherits the app-wide stylesheet rule via the
    // .form-group ancestor, exactly like the text fields in the Add Exercise modal.
    // Asserting computed px/hex would churn; asserting the shared hook cannot.
    expect(input.closest('.form-group')).not.toBeNull()
    expect(input.closest('.form-group')!.querySelector('input')).toBe(input)
  })

  it('keeps the display name accessible name and id wiring intact', async () => {
    await setStore('tracker', baseTracker())

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    const input = screen.getByLabelText(NAME_LABEL) as HTMLInputElement
    // The <label htmlFor> -> id association is what getByLabelText resolves; the restyle
    // must not have moved the input out from under its label.
    expect(input.id).toBe('display-name-input')
    expect(input.type).toBe('text')
    expect(input).toHaveAttribute('placeholder', 'Your name')
  })

  it('persists a typed name to the IndexedDB tracker key on blur', async () => {
    const user = userEvent.setup()
    await setStore('tracker', baseTracker())

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    const input = screen.getByLabelText(NAME_LABEL)
    await user.type(input, 'Ricky')
    await user.tab() // blur

    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      expect(stored.meta.name).toBe('Ricky')
    })

    // The rest of the tracker payload must survive the meta update.
    const stored = await getStore('tracker') as TrackerData
    expect(stored.meta.method).toBe('GZCL')
    expect(stored.sessions).toEqual([])
  })

  it('stores an empty string when the name is cleared, not undefined', async () => {
    const user = userEvent.setup()
    await setStore('tracker', { ...baseTracker(), meta: { ...baseTracker().meta, name: 'Ricky' } })

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    const input = screen.getByLabelText(NAME_LABEL)
    // The stored name is adopted only after the async tracker read resolves.
    await waitFor(() => {
      expect(input).toHaveValue('Ricky')
    })

    await user.clear(input)
    await user.tab() // blur

    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      expect(stored.meta.name).toBe('')
    })
  })

  it('writes the name into the exported backup JSON', async () => {
    const user = userEvent.setup()
    await setStore('tracker', { ...trackerWithSession(), meta: { ...trackerWithSession().meta, name: 'Ricky' } })

    // Capture the Blob handed to createObjectURL so we can read the real JSON bytes.
    const mockCreateObjectURL = vi.fn((_blob: Blob) => 'blob:mock')
    const mockRevokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL })
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName)
      if (tagName === 'a') el.click = vi.fn()
      return el
    })

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    await user.click(screen.getByRole('button', { name: 'Export' }))
    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    const blob = mockCreateObjectURL.mock.calls[0][0] as unknown as Blob
    const parsed = JSON.parse(await blob.text()) as TrackerData

    // The field must actually be present in the produced JSON, not merely assumed.
    expect(parsed.meta.name).toBe('Ricky')
    expect(parsed.sessions).toHaveLength(1)
  })

  it('round-trips a backup containing meta.name through import', async () => {
    const user = userEvent.setup()
    const backup = { ...trackerWithSession(), meta: { ...trackerWithSession().meta, name: 'Ricky' } }

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    await importBackup(user, JSON.stringify(backup))

    // Re-mount so the provider re-reads the freshly imported store.
    cleanup()
    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    await waitFor(() => {
      expect(screen.getByLabelText(NAME_LABEL)).toHaveValue('Ricky')
    })
    const stored = await getStore('tracker') as TrackerData
    expect(stored.meta.name).toBe('Ricky')
  })

  it('imports a backup without meta.name cleanly and shows an empty field', async () => {
    const user = userEvent.setup()
    const legacyBackup = baseTracker() // no name key at all — the pre-field format

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    await importBackup(user, JSON.stringify(legacyBackup))

    // Import must not have produced an "Invalid File" modal.
    expect(screen.queryByText('Invalid File')).not.toBeInTheDocument()

    cleanup()
    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    await waitFor(() => {
      expect(screen.getByLabelText(NAME_LABEL)).toHaveValue('')
    })
    const stored = await getStore('tracker') as TrackerData
    expect(stored.meta.name).toBeUndefined()
    expect(stored.meta.method).toBe('GZCL')
  })
})

describe('SettingsPage — barbell setup', () => {
  const BAR_LABEL = 'Barbell weight'

  beforeEach(async () => {
    vi.clearAllMocks()
    try {
      await deleteStore('tracker')
      await deleteStore('backup-meta')
    } catch {
      // ignore
    }
  })

  afterEach(() => {
    // The export test stubs URL; unstub so the leak cannot reach other files.
    vi.unstubAllGlobals()
    vi.stubGlobal('alert', vi.fn())
    cleanup()
  })

  it('falls back to the defaults when meta has neither barbell key', async () => {
    await setStore('tracker', baseTracker()) // pre-field backup shape

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    await waitFor(() => {
      expect(screen.getByLabelText(BAR_LABEL)).toHaveValue(45)
    })
    // The seed kit: 2x45, 2x25, 4x10, 2x5, 2x2.5.
    expect(screen.getByLabelText('Plate 1 count')).toHaveValue(2)
    expect(screen.getByLabelText('Plate 1 weight')).toHaveValue(45)
    expect(screen.getByLabelText('Plate 2 count')).toHaveValue(2)
    expect(screen.getByLabelText('Plate 2 weight')).toHaveValue(25)
    expect(screen.getByLabelText('Plate 3 count')).toHaveValue(4)
    expect(screen.getByLabelText('Plate 3 weight')).toHaveValue(10)
    expect(screen.getByLabelText('Plate 4 count')).toHaveValue(2)
    expect(screen.getByLabelText('Plate 4 weight')).toHaveValue(5)
    expect(screen.getByLabelText('Plate 5 count')).toHaveValue(2)
    expect(screen.getByLabelText('Plate 5 weight')).toHaveValue(2.5)
  })

  it('adopts stored barbell values when they are present', async () => {
    await setStore('tracker', {
      ...baseTracker(),
      meta: {
        ...baseTracker().meta,
        // Deliberately not the 45 default, so the wait below cannot pass
        // against the pre-load default state.
        barbellWeight: 35,
        plates: [{ count: 2, weight: 45 }],
      },
    })

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    await waitFor(() => {
      expect(screen.getByLabelText(BAR_LABEL)).toHaveValue(35)
    })
    expect(screen.getAllByLabelText(/^Plate \d+ count$/)).toHaveLength(1)
    expect(screen.queryByLabelText('Plate 2 weight')).not.toBeInTheDocument()
  })

  it('persists an edited bar weight to IndexedDB on blur', async () => {
    const user = userEvent.setup()
    await setStore('tracker', baseTracker())

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    const input = screen.getByLabelText(BAR_LABEL)
    await user.clear(input)
    await user.type(input, '45')
    await user.tab()

    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      expect(stored.meta.barbellWeight).toBe(45)
    })
  })

  it('persists an edited plate count on blur', async () => {
    const user = userEvent.setup()
    await setStore('tracker', baseTracker())

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    const input = screen.getByLabelText('Plate 1 count')
    await user.clear(input)
    await user.type(input, '6')
    await user.tab()

    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      expect(stored.meta.plates?.[0]).toEqual({ count: 6, weight: 45 })
    })
  })

  it('adds and removes plate rows, persisting both', async () => {
    const user = userEvent.setup()
    await setStore('tracker', baseTracker())

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    const before = screen.getAllByLabelText(/^Plate \d+ count$/).length

    await user.click(screen.getByRole('button', { name: 'Add Plate' }))
    await waitFor(() => {
      expect(screen.getAllByLabelText(/^Plate \d+ count$/).length).toBe(before + 1)
    })
    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      expect(stored.meta.plates).toHaveLength(before + 1)
    })

    await user.click(screen.getAllByRole('button', { name: /^Remove plate/ })[0])
    await waitFor(() => {
      expect(screen.getAllByLabelText(/^Plate \d+ count$/).length).toBe(before)
    })
    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      expect(stored.meta.plates).toHaveLength(before)
    })
  })

  it('does not overwrite a stored plate list when only the bar weight is edited', async () => {
    // The stored kit is deliberately a single plate, so it cannot be confused
    // with the default seed kit at any point in the test.
    const storedKit = [{ count: 2, weight: 45 }]
    const user = userEvent.setup()
    await setStore('tracker', {
      ...baseTracker(),
      meta: { ...baseTracker().meta, barbellWeight: 35, plates: storedKit },
    })

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })
    await waitFor(() => {
      expect(screen.getByLabelText(BAR_LABEL)).toHaveValue(35)
    })

    // Touch the bar weight and nothing else, then blur to flush.
    const input = screen.getByLabelText(BAR_LABEL)
    await user.clear(input)
    await user.type(input, '45')
    await user.tab()

    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      expect(stored.meta.barbellWeight).toBe(45)
    })
    // The flush also carries the plate list, so an out-of-sync ref here would
    // silently replace the user's kit with the defaults.
    const stored = await getStore('tracker') as TrackerData
    expect(stored.meta.plates).toEqual(storedKit)
  })

  it('renders the bar weight and every plate input inside the shared .form-group convention', async () => {
    await setStore('tracker', baseTracker())

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    // Durable style contract: these fields inherit the app-wide stylesheet rule via a
    // .form-group ancestor, exactly like the text fields in the Add Exercise modal.
    // Asserting computed px/hex would churn; asserting the shared hook cannot.
    const fields = [
      screen.getByLabelText(BAR_LABEL),
      ...screen.getAllByLabelText(/^Plate \d+ count$/),
      ...screen.getAllByLabelText(/^Plate \d+ weight$/),
    ]
    expect(fields.length).toBeGreaterThan(1)
    for (const field of fields) {
      const group = field.closest('.form-group')
      expect(group, `${field.getAttribute('aria-label') ?? field.id} is not inside a .form-group`).not.toBeNull()
      expect(group!.querySelector('input')).toBe(field)
    }
  })

  it('keeps the plate count/weight wiring on the right plate row and key', async () => {
    const user = userEvent.setup()
    await setStore('tracker', {
      ...baseTracker(),
      // A single-row kit, so index 0 is unambiguous and cannot pass by luck.
      meta: { ...baseTracker().meta, barbellWeight: 45, plates: [{ count: 2, weight: 45 }] },
    })

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })
    // Wait on the ROW COUNT, not the row's values: the default kit's first row is
    // also 2 x 45, so a value-based wait passes against the pre-adopt default state
    // and lets the flush write defaults over the stored kit. One row can only mean
    // the stored single-plate kit has actually been adopted.
    await waitFor(() => {
      expect(screen.getAllByLabelText(/^Plate \d+ count$/)).toHaveLength(1)
    })

    // The two fields of a row are siblings in the SAME .form-group row, i.e. they
    // must not have been cross-wired while being wrapped. A refactor that swapped
    // the count/weight wiring would still pass per-field style assertions.
    const count = screen.getByLabelText('Plate 1 count')
    const weight = screen.getByLabelText('Plate 1 weight')
    expect(count).toHaveValue(2)
    expect(weight).toHaveValue(45)
    expect(count.closest('div[style*="gap"]')).toBe(weight.closest('div[style*="gap"]'))

    // Edit weight only: the stored count must survive, and the row must not grow.
    await user.clear(weight)
    await user.type(weight, '35')
    await user.tab()

    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      expect(stored.meta.plates).toEqual([{ count: 2, weight: 35 }])
    })
    expect(screen.getAllByLabelText(/^Plate \d+ count$/)).toHaveLength(1)
  })

  it('imports a legacy backup with neither barbell key without an error', async () => {
    const user = userEvent.setup()

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    await importBackup(user, JSON.stringify(baseTracker()))

    expect(screen.queryByText('Invalid File')).not.toBeInTheDocument()
    const stored = await getStore('tracker') as TrackerData
    expect(stored.meta.barbellWeight).toBeUndefined()
    expect(stored.meta.plates).toBeUndefined()
  })
})
