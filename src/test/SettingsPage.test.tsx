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

// Mock useModal
const showModalMock = vi.fn()
vi.mock('../components/ModalProvider', () => ({
  useModal: () => ({ showModal: showModalMock }),
  ModalProvider: ({ children }: { children: React.ReactNode }) => children
}))

function TestApp() {
  return (
    <MemoryRouter initialEntries={['/settings']}>
      <BackupProvider>
        <TrackerProvider>
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </TrackerProvider>
      </BackupProvider>
    </MemoryRouter>
  )
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
    showModalMock.mockResolvedValue({ action: 'confirm' })
    const user = userEvent.setup()

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    await user.click(screen.getByText('Load Seed'))

    await waitFor(() => {
      expect(showModalMock).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByText('26')).toBeInTheDocument()
    })

    const stored = await getStore('tracker') as TrackerData | null
    expect(stored).not.toBeNull()
    expect(stored!.sessions.length).toBe(50)
  })

  it('cancels load seed when not confirmed', async () => {
    showModalMock.mockResolvedValue({ action: null })
    const user = userEvent.setup()

    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })

    await user.click(screen.getByText('Load Seed'))

    await waitFor(() => {
      expect(showModalMock).toHaveBeenCalled()
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
