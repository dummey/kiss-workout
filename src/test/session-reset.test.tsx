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
import type { TrackerData } from '../types'

vi.stubGlobal('alert', vi.fn())

let uniqueDateCounter = 0

function getUniqueDate(): string {
  uniqueDateCounter++
  const day = 1 + uniqueDateCounter
  return `2026-11-${day.toString().padStart(2, '0')}`
}

async function loadSeed(user: ReturnType<typeof userEvent.setup>) {
  const loadSeedButtons = screen.getAllByText('Load Seed')
  await user.click(loadSeedButtons[0])
  await waitFor(() => {
    expect(screen.getByText('This will replace all current data with fresh seed data. Continue?')).toBeInTheDocument()
  })
  const modalButtons = screen.getAllByRole('button', { name: 'Load Seed' })
  await user.click(modalButtons[modalButtons.length - 1])
}

async function createSession(user: ReturnType<typeof userEvent.setup>): Promise<string> {
  await user.click(screen.getAllByText('Sessions')[0])
  await screen.findByText(/\d+ sessions logged/i)

  await user.click(screen.getByText('+ Add Session'))
  const uniqueDate = getUniqueDate()
  const dateInput = screen.getByLabelText('Date')
  await user.clear(dateInput)
  await user.type(dateInput, uniqueDate)
  await user.click(screen.getByText('Start Session'))

  await screen.findByText('Time')
  return uniqueDate
}

// The header Reset button is the first one in DOM order
function getHeaderResetBtn(): HTMLElement {
  return screen.getAllByRole('button', { name: 'Reset' })[0]
}

function getModalResetBtn(): HTMLElement {
  const btns = screen.getAllByRole('button', { name: 'Reset' })
  return btns[btns.length - 1]
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

describe('Session reset', () => {
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

  it('shows Reset button in header next to Export and Delete', async () => {
    const user = userEvent.setup()
    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })
    await loadSeed(user)
    await waitFor(() => expect(screen.getByText('26')).toBeInTheDocument())

    await createSession(user)

    // First Reset button is in the header (between Export and Delete)
    const resetBtn = getHeaderResetBtn()
    expect(resetBtn).toBeInTheDocument()
  })

  it('shows confirmation modal when Reset is clicked', async () => {
    const user = userEvent.setup()
    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })
    await loadSeed(user)
    await waitFor(() => expect(screen.getByText('26')).toBeInTheDocument())

    await createSession(user)

    await user.click(getHeaderResetBtn())

    // Modal appears with destructive message
    expect(screen.getByText('Reset Session')).toBeInTheDocument()
    expect(screen.getByText(/This will clear all weight, reps, and sets data/)).toBeInTheDocument()

    // Cancel button dismisses modal
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    expect(cancelBtn).toBeInTheDocument()
  })

  it('cancels the reset when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })
    await loadSeed(user)
    await waitFor(() => expect(screen.getByText('26')).toBeInTheDocument())

    await createSession(user)

    // Fill in some data first
    const weightInputs = screen.getAllByPlaceholderText('Weight')
    await user.type(weightInputs[0], '225')

    await new Promise(resolve => setTimeout(resolve, 600))

    // Verify data exists
    const storedBefore = await getStore('tracker') as TrackerData | null
    expect(storedBefore?.sessions[0]?.exercises[0]?.weight).toBe('225')

    // Click Reset, then Cancel
    await user.click(getHeaderResetBtn())
    await screen.findByText('Reset Session')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    // Modal dismissed, data still present
    expect(screen.queryByText('Reset Session')).not.toBeInTheDocument()
    const storedAfter = await getStore('tracker') as TrackerData | null
    expect(storedAfter?.sessions[0]?.exercises[0]?.weight).toBe('225')
  })

  it('clears all exercise data and resets timer when confirmed', async () => {
    const user = userEvent.setup()
    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })
    await loadSeed(user)
    await waitFor(() => expect(screen.getByText('26')).toBeInTheDocument())

    await createSession(user)

    // Fill in data across exercises
    const weightInputs = screen.getAllByPlaceholderText('Weight')
    const repsInputs = screen.getAllByPlaceholderText('Reps')
    const setsInputs = screen.getAllByPlaceholderText('Sets')

    await user.type(weightInputs[0], '225')
    await user.type(repsInputs[0], '5')
    await user.type(setsInputs[0], '3')
    await user.type(weightInputs[1], '185')
    await user.type(repsInputs[1], '10')
    await user.type(setsInputs[1], '3')

    // Add notes
    const notesTextarea = screen.getByPlaceholderText('Add any notes about this session...')
    await user.type(notesTextarea, 'Test session notes')

    await new Promise(resolve => setTimeout(resolve, 600))

    // Verify data is stored
    const storedBefore = await getStore('tracker') as TrackerData | null
    expect(storedBefore?.sessions[0]?.exercises[0]?.weight).toBe('225')
    expect(storedBefore?.sessions[0]?.exercises[0]?.reps).toBe('5')
    expect(storedBefore?.sessions[0]?.exercises[0]?.sets).toBe(3)
    expect(storedBefore?.sessions[0]?.notes).toBe('Test session notes')

    // Click Reset in header
    await user.click(getHeaderResetBtn())
    await screen.findByText('Reset Session')

    // Click Reset (danger) in modal
    await user.click(getModalResetBtn())

    // Modal dismissed
    await waitFor(() => {
      expect(screen.queryByText('Reset Session')).not.toBeInTheDocument()
    })

    // Verify data is cleared in IndexedDB
    const storedAfter = await getStore('tracker') as TrackerData | null
    const session = storedAfter?.sessions[0]
    expect(session).toBeDefined()
    expect(session!.exercises[0].weight).toBe('')
    expect(session!.exercises[0].reps).toBe('')
    expect(session!.exercises[0].sets).toBeNull()
    expect(session!.exercises[1].weight).toBe('')
    expect(session!.exercises[1].reps).toBe('')
    expect(session!.exercises[1].sets).toBeNull()
    expect(session!.notes).toBe('')
    expect(session!.elapsedTime).toBe(0)
  })

  it('resets the timer display to show Start after confirmation', async () => {
    const user = userEvent.setup()
    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })
    await loadSeed(user)
    await waitFor(() => expect(screen.getByText('26')).toBeInTheDocument())

    await createSession(user)

    // Start the timer
    await user.click(screen.getByText('Start'))

    // Let it run briefly
    await new Promise(resolve => setTimeout(resolve, 2500))

    // Pause it so we can verify state
    await user.click(screen.getByText('Pause'))

    // Header Reset button should work while timer is running/paused
    await user.click(getHeaderResetBtn())
    await screen.findByText('Reset Session')

    await user.click(getModalResetBtn())

    // Modal dismissed
    await waitFor(() => {
      expect(screen.queryByText('Reset Session')).not.toBeInTheDocument()
    })

    // After reset, timer is paused and elapsed is 0
    // For a non-today date with elapsedTime=0, button shows "Start"
    expect(screen.getByText('Start')).toBeInTheDocument()
  })
})
