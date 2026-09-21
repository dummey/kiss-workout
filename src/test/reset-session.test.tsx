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

describe('Session reset integration', () => {
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

  it('shows the Reset button on the session detail page', async () => {
    const user = userEvent.setup()
    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })
    await loadSeed(user)
    await waitFor(() => expect(screen.getByText('26')).toBeInTheDocument())
    await user.click(screen.getAllByText('Sessions')[0])
    await screen.findByText(/\d+ sessions logged/i)
    await user.click(screen.getByText('+ Add Session'))
    const uniqueDate = getUniqueDate()
    const dateInput = screen.getByLabelText('Date')
    await user.clear(dateInput)
    await user.type(dateInput, uniqueDate)
    await user.click(screen.getByText('Start Session'))
    await screen.findByText('Time')

    expect(screen.getByTestId('session-reset-btn')).toBeInTheDocument()
  })

  it('opens confirmation modal when Reset is clicked', async () => {
    const user = userEvent.setup()
    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })
    await loadSeed(user)
    await waitFor(() => expect(screen.getByText('26')).toBeInTheDocument())
    await user.click(screen.getAllByText('Sessions')[0])
    await screen.findByText(/\d+ sessions logged/i)
    await user.click(screen.getByText('+ Add Session'))
    const uniqueDate = getUniqueDate()
    const dateInput = screen.getByLabelText('Date')
    await user.clear(dateInput)
    await user.type(dateInput, uniqueDate)
    await user.click(screen.getByText('Start Session'))
    await screen.findByText('Time')

    await user.click(screen.getByTestId('session-reset-btn'))

    expect(screen.getByText('Reset Session')).toBeInTheDocument()
    expect(screen.getByText('Clear all weight, reps, sets, notes, and timer for this session?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
  })

  it('Cancel dismisses the modal without resetting data', async () => {
    const user = userEvent.setup()
    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })
    await loadSeed(user)
    await waitFor(() => expect(screen.getByText('26')).toBeInTheDocument())
    await user.click(screen.getAllByText('Sessions')[0])
    await screen.findByText(/\d+ sessions logged/i)
    await user.click(screen.getByText('+ Add Session'))
    const uniqueDate = getUniqueDate()
    const dateInput = screen.getByLabelText('Date')
    await user.clear(dateInput)
    await user.type(dateInput, uniqueDate)
    await user.click(screen.getByText('Start Session'))
    await screen.findByText('Time')

    // Enter some data first
    const weightInputs = screen.getAllByPlaceholderText('Weight')
    const repsInputs = screen.getAllByPlaceholderText('Reps')
    const setsInputs = screen.getAllByPlaceholderText('Sets')
    await user.type(weightInputs[0], '225')
    await user.type(repsInputs[0], '5')
    await user.type(setsInputs[0], '3')

    const notesTextarea = screen.getByPlaceholderText('Add any notes about this session...')
    await user.type(notesTextarea, 'Great session')

    await new Promise(resolve => setTimeout(resolve, 600))

    // Click Reset then Cancel
    await user.click(screen.getByTestId('session-reset-btn'))
    expect(screen.getByText('Reset Session')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    // Modal should be gone
    expect(screen.queryByText('Reset Session')).not.toBeInTheDocument()

    // Data should still be in IndexedDB
    const stored = await getStore('tracker') as TrackerData | null
    expect(stored!.sessions[0].exercises[0].weight).toBe('225')
    expect(stored!.sessions[0].exercises[0].reps).toBe('5')
    expect(stored!.sessions[0].exercises[0].sets).toBe(3)
    expect(stored!.sessions[0].notes).toBe('Great session')
  })

  it('Confirming resets all weight, reps, sets, notes, and timer', async () => {
    const user = userEvent.setup()
    render(<TestApp />)
    await screen.findByRole('heading', { name: 'Settings' })
    await loadSeed(user)
    await waitFor(() => expect(screen.getByText('26')).toBeInTheDocument())
    await user.click(screen.getAllByText('Sessions')[0])
    await screen.findByText(/\d+ sessions logged/i)
    await user.click(screen.getByText('+ Add Session'))
    const uniqueDate = getUniqueDate()
    const dateInput = screen.getByLabelText('Date')
    await user.clear(dateInput)
    await user.type(dateInput, uniqueDate)
    await user.click(screen.getByText('Start Session'))
    await screen.findByText('Time')

    // Enter data
    const weightInputs = screen.getAllByPlaceholderText('Weight')
    const repsInputs = screen.getAllByPlaceholderText('Reps')
    const setsInputs = screen.getAllByPlaceholderText('Sets')
    await user.type(weightInputs[0], '225')
    await user.type(repsInputs[0], '5')
    await user.type(setsInputs[0], '3')
    await user.type(weightInputs[1], '185')
    await user.type(repsInputs[1], '10')
    await user.type(setsInputs[1], '3')

    const notesTextarea = screen.getByPlaceholderText('Add any notes about this session...')
    await user.type(notesTextarea, 'Great session, felt strong')

    await new Promise(resolve => setTimeout(resolve, 600))

    // Confirm reset
    await user.click(screen.getByTestId('session-reset-btn'))
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    // Modal should be gone
    expect(screen.queryByText('Reset Session')).not.toBeInTheDocument()

    // Data should be cleared in IndexedDB
    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData | null
      const session = stored!.sessions[0]
      expect(session.notes).toBe('')
      expect(session.elapsedTime).toBe(0)
      expect(session.exercises[0].weight).toBe('')
      expect(session.exercises[0].reps).toBe('')
      expect(session.exercises[0].sets).toBeNull()
      expect(session.exercises[1].weight).toBe('')
      expect(session.exercises[1].reps).toBe('')
      expect(session.exercises[1].sets).toBeNull()
    }, { timeout: 5000 })
  })
})
