import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TrackerProvider } from '../context'
import { BackupProvider } from '../context/BackupContext'
import { ModalProvider } from '../components/ModalProvider'
import Layout from '../components/Layout'
import SessionsPage from '../pages/SessionsPage'
import SessionDetailPage from '../pages/SessionDetailPage'
import SettingsPage from '../pages/SettingsPage'
import { getStore, deleteStore } from '../db'

vi.stubGlobal('alert', vi.fn())

let uniqueDateCounter = 0

function getUniqueDate(): string {
  uniqueDateCounter++
  const day = 1 + uniqueDateCounter
  return `2026-11-${day.toString().padStart(2, '0')}`
}

async function loadSeed(user: ReturnType<typeof userEvent.setup>) {
  // Click the "Load Seed" button on the page (the first one)
  const loadSeedButtons = screen.getAllByText('Load Seed')
  await user.click(loadSeedButtons[0])
  // Wait for the modal to appear
  await waitFor(() => {
    expect(screen.getByText('This will replace all current data with fresh seed data. Continue?')).toBeInTheDocument()
  })
  // Click "Load Seed" in the modal (the last one, which is the modal button)
  const modalButtons = screen.getAllByRole('button', { name: 'Load Seed' })
  await user.click(modalButtons[modalButtons.length - 1])
}

function TestApp() {
  return (
    <MemoryRouter initialEntries={['/settings']}>
      <BackupProvider>
        <TrackerProvider>
          <ModalProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/settings" replace />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="sessions" element={<SessionsPage />} />
                <Route path="sessions/:date" element={<SessionDetailPage />} />
              </Route>
            </Routes>
          </ModalProvider>
        </TrackerProvider>
      </BackupProvider>
    </MemoryRouter>
  )
}

async function getBackupMeta() {
  return await getStore('backup-meta') as { lastBackupDate: string | null; sessionsSinceBackup: number } | null
}

describe('Backup counter E2E (incrementBackupCounter on session creation)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    uniqueDateCounter = 0
    try {
      await deleteStore('tracker')
      await deleteStore('backup-meta')
    } catch {
      // ignore
    }
  })

  it('POSITIVE: increments the backup counter when a session is created', async () => {
    const user = userEvent.setup()
    render(<TestApp />)

    await screen.findByRole('heading', { name: 'Settings' })
    await loadSeed(user)
    await waitFor(() => expect(screen.getByText('26')).toBeInTheDocument())

    // Navigate to sessions
    await user.click(screen.getAllByText('Sessions')[0])
    await screen.findByText(/\d+ sessions logged/i)

    // Create a new session via the form
    await user.click(screen.getByText('+ Add Session'))
    await screen.findByText('Add Session')

    const date = getUniqueDate()
    const dateInput = screen.getByLabelText('Date')
    await user.clear(dateInput)
    await user.type(dateInput, date)
    await user.click(screen.getByText('Start Session'))

    // Wait for navigation to session detail (successful create)
    await screen.findByText('Time')

    // Verify counter incremented
    await waitFor(async () => {
      const meta = await getBackupMeta()
      expect(meta).not.toBeNull()
      expect(meta!.sessionsSinceBackup).toBe(1)
    })
  })

  it('POSITIVE: counter reaches 10 and triggers the reminder banner', async () => {
    const user = userEvent.setup()
    render(<TestApp />)

    await screen.findByRole('heading', { name: 'Settings' })
    await loadSeed(user)
    await waitFor(() => expect(screen.getByText('26')).toBeInTheDocument())

    await user.click(screen.getAllByText('Sessions')[0])
    await screen.findByText(/\d+ sessions logged/i)

    // Create 10 sessions via the UI
    for (let i = 0; i < 10; i++) {
      await user.click(screen.getByText('+ Add Session'))
      await screen.findByText('Add Session')

      const date = `2026-12-${String(i + 1).padStart(2, '0')}`
      const dateInput = screen.getByLabelText('Date')
      await user.clear(dateInput)
      await user.type(dateInput, date)
      await user.click(screen.getByText('Start Session'))
      await screen.findByText('Time')

      if (i < 9) {
        await user.click(screen.getAllByText('Sessions')[0])
        await screen.findByText(/\d+ sessions logged/i)
      }
    }

    // Verify counter is at 10
    await waitFor(async () => {
      const meta = await getBackupMeta()
      expect(meta!.sessionsSinceBackup).toBe(10)
    }, { timeout: 15000 })

    // Navigate back to the sessions list — BackupReminderBanner is rendered there
    await user.click(screen.getAllByText('Sessions')[0])
    await screen.findByText(/\d+ sessions logged/i)

    // Reminder banner shows "10 sessions without a backup"
    await waitFor(() => {
      expect(screen.getByText(/10 sessions without a backup/i)).toBeInTheDocument()
    }, { timeout: 30000 })
  }, 60000)

  it('NEGATIVE: duplicate date does NOT increment the backup counter', async () => {
    const user = userEvent.setup()
    render(<TestApp />)

    await screen.findByRole('heading', { name: 'Settings' })
    await loadSeed(user)
    await waitFor(() => expect(screen.getByText('26')).toBeInTheDocument())

    await user.click(screen.getAllByText('Sessions')[0])
    await screen.findByText(/\d+ sessions logged/i)

    const date = getUniqueDate()

    // First: create a session
    await user.click(screen.getByText('+ Add Session'))
    await screen.findByText('Add Session')
    const dateInput = screen.getByLabelText('Date')
    await user.clear(dateInput)
    await user.type(dateInput, date)
    await user.click(screen.getByText('Start Session'))
    await screen.findByText('Time')

    // Verify counter = 1
    await waitFor(async () => {
      const meta = await getBackupMeta()
      expect(meta!.sessionsSinceBackup).toBe(1)
    })

    // Second: try to create the same date again
    await user.click(screen.getAllByText('Sessions')[0])
    await screen.findByText(/\d+ sessions logged/i)

    await user.click(screen.getByText('+ Add Session'))
    await screen.findByText('Add Session')
    const dupDateInput = screen.getByLabelText('Date')
    await user.clear(dupDateInput)
    await user.type(dupDateInput, date)
    await user.click(screen.getByText('Start Session'))

    // Counter should still be 1 (duplicate rejected, no increment)
    await new Promise(resolve => setTimeout(resolve, 500))
    const meta = await getBackupMeta()
    expect(meta!.sessionsSinceBackup).toBe(1)
  })
})
