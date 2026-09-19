import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { TrackerProvider } from '../context'
import { BackupProvider } from '../context/BackupContext'
import { ModalProvider } from '../components/ModalProvider'
import SettingsPage from '../pages/SettingsPage'
import { getStore, deleteStore } from '../db'
import type { TrackerData } from '../types'

vi.stubGlobal('alert', vi.fn())

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

    // Verify backup-meta was cleared
    const backupMeta = await getStore('backup-meta')
    expect(backupMeta).toBeNull()
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
