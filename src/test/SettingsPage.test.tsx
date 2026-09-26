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
    const mockCreateObjectURL = vi.fn(() => 'blob:mock')
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
