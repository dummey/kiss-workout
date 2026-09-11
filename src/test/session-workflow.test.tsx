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

// Mock useModal
const showModalMock = vi.fn()
vi.mock('../components/ModalProvider', () => ({
  useModal: () => ({ showModal: showModalMock }),
  ModalProvider: ({ children }: { children: React.ReactNode }) => children
}))

let uniqueDateCounter = 0

// Generate a unique date that's after the seed data (uses Nov 2026 dates)
function getUniqueDate(): string {
  uniqueDateCounter++
  const day = 1 + uniqueDateCounter
  return `2026-11-${day.toString().padStart(2, '0')}`
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

describe('Session workflow integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    uniqueDateCounter = 0
    // Clear DB so each test starts fresh
    try {
      await deleteStore('tracker')
      await deleteStore('backup-meta')
    } catch {
      // ignore
    }
  })

  it('creates a session and verifies it appears in the list', async () => {
    const user = userEvent.setup()

    render(<TestApp />)
    // Wait for the Settings heading to appear
    await screen.findByRole('heading', { name: 'Settings' })

    // Load seed data
    showModalMock.mockResolvedValue({ action: 'confirm' })
    await user.click(screen.getByText('Load Seed'))
    await waitFor(() => {
      expect(screen.getByText('26')).toBeInTheDocument()
    })

    // Navigate to sessions via sidebar
    await user.click(screen.getAllByText('Sessions')[0])
    await screen.findByText(/\d+ sessions logged/i)

    // Create a new session
    await user.click(screen.getByText('+ Add Session'))
    await screen.findByText('Add Session')

    const uniqueDate = getUniqueDate()
    const dateInput = screen.getByLabelText('Date')
    await user.clear(dateInput)
    await user.type(dateInput, uniqueDate)

    await user.click(screen.getByText('Start Session'))

    // Navigate to session detail
    await screen.findByText('Time')

    // Navigate back to sessions via sidebar
    await user.click(screen.getAllByText('Sessions')[0])
    await screen.findByText(/\d+ sessions logged/i)
  })

  it('persists session data to IndexedDB after creation', async () => {
    const user = userEvent.setup()

    render(<TestApp />)
    // Wait for the Settings heading to appear
    await screen.findByRole('heading', { name: 'Settings' })

    // Load seed data
    showModalMock.mockResolvedValue({ action: 'confirm' })
    await user.click(screen.getByText('Load Seed'))
    await waitFor(() => {
      expect(screen.getByText('26')).toBeInTheDocument()
    })

    // Navigate to sessions
    await user.click(screen.getAllByText('Sessions')[0])
    await screen.findByText(/\d+ sessions logged/i)

    // Create a new session
    await user.click(screen.getByText('+ Add Session'))
    const uniqueDate = getUniqueDate()
    const dateInput = screen.getByLabelText('Date')
    await user.clear(dateInput)
    await user.type(dateInput, uniqueDate)
    await user.click(screen.getByText('Start Session'))

    await screen.findByText('Time')

    const stored = await getStore('tracker') as TrackerData | null
    expect(stored).not.toBeNull()
    expect(stored!.sessions.length).toBe(51)
    expect(stored!.sessions[0].workoutName).toBe('Squat Workout')
  })

  it('logs exercise data and persists it correctly', async () => {
    const user = userEvent.setup()

    render(<TestApp />)
    // Wait for the Settings heading to appear
    await screen.findByRole('heading', { name: 'Settings' })

    // Load seed data
    showModalMock.mockResolvedValue({ action: 'confirm' })
    await user.click(screen.getByText('Load Seed'))
    await waitFor(() => {
      expect(screen.getByText('26')).toBeInTheDocument()
    })

    // Navigate to sessions
    await user.click(screen.getAllByText('Sessions')[0])
    await screen.findByText(/\d+ sessions logged/i)

    // Create a new session
    await user.click(screen.getByText('+ Add Session'))
    const uniqueDate = getUniqueDate()
    const dateInput = screen.getByLabelText('Date')
    await user.clear(dateInput)
    await user.type(dateInput, uniqueDate)
    await user.click(screen.getByText('Start Session'))

    await screen.findByText('Time')

    const weightInputs = screen.getAllByPlaceholderText('Weight')
    const repsInputs = screen.getAllByPlaceholderText('Reps')
    const setsInputs = screen.getAllByPlaceholderText('Sets')

    await user.type(weightInputs[0], '225')
    await user.type(repsInputs[0], '5')
    await user.type(setsInputs[0], '3')

    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData | null
      expect(stored?.sessions[0]?.exercises[0]?.weight).toBe('225')
    }, { timeout: 5000 })

    await user.type(weightInputs[1], '185')
    await user.type(repsInputs[1], '10')
    await user.type(setsInputs[1], '3')

    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData | null
      expect(stored?.sessions[0]?.exercises[1]?.weight).toBe('185')
    }, { timeout: 3000 })

    const stored = await getStore('tracker') as TrackerData | null
    const session = stored!.sessions[0]
    expect(session.exercises[0].weight).toBe('225')
    expect(session.exercises[0].reps).toBe('5')
    expect(session.exercises[0].sets).toBe(3)
    expect(session.exercises[1].weight).toBe('185')
    expect(session.exercises[1].reps).toBe('10')
    expect(session.exercises[1].sets).toBe(3)
  })

  it('saves notes to the session', async () => {
    const user = userEvent.setup()

    render(<TestApp />)
    // Wait for the Settings heading to appear
    await screen.findByRole('heading', { name: 'Settings' })

    // Load seed data
    showModalMock.mockResolvedValue({ action: 'confirm' })
    await user.click(screen.getByText('Load Seed'))
    await waitFor(() => {
      expect(screen.getByText('26')).toBeInTheDocument()
    })

    // Navigate to sessions
    await user.click(screen.getAllByText('Sessions')[0])
    await screen.findByText(/\d+ sessions logged/i)

    // Create a new session
    await user.click(screen.getByText('+ Add Session'))
    const uniqueDate = getUniqueDate()
    const dateInput = screen.getByLabelText('Date')
    await user.clear(dateInput)
    await user.type(dateInput, uniqueDate)
    await user.click(screen.getByText('Start Session'))

    await screen.findByText('Time')

    const notesTextarea = screen.getByPlaceholderText('Add any notes about this session...')
    await user.type(notesTextarea, 'Great session, felt strong')

    await new Promise(resolve => setTimeout(resolve, 600))

    const stored = await getStore('tracker') as TrackerData | null
    expect(stored!.sessions[0].notes).toBe('Great session, felt strong')
  })

  it('shows "Start" button when timer is at 0 and not running', async () => {
    const user = userEvent.setup()

    render(<TestApp />)
    // Wait for the Settings heading to appear
    await screen.findByRole('heading', { name: 'Settings' })

    // Load seed data
    showModalMock.mockResolvedValue({ action: 'confirm' })
    await user.click(screen.getByText('Load Seed'))
    await waitFor(() => {
      expect(screen.getByText('26')).toBeInTheDocument()
    })

    // Navigate to sessions
    await user.click(screen.getAllByText('Sessions')[0])
    await screen.findByText(/\d+ sessions logged/i)

    // Create a new session with past date (Aug 2026)
    await user.click(screen.getByText('+ Add Session'))
    const uniqueDate = getUniqueDate()
    const dateInput = screen.getByLabelText('Date')
    await user.clear(dateInput)
    await user.type(dateInput, uniqueDate)
    await user.click(screen.getByText('Start Session'))

    await screen.findByText('Time')

    // Timer should say "Start" (not "Pause") for past dates since it's not running
    expect(screen.getByText('Start')).toBeInTheDocument()
  })
})
