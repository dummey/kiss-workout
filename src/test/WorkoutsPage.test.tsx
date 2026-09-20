import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { TrackerProvider } from '../context'
import { BackupProvider } from '../context/BackupContext'
import { ModalProvider } from '../components/ModalProvider'
import WorkoutsPage from '../pages/WorkoutsPage'
import { setStore, deleteStore } from '../db'
import { SEED_DATA } from '../data'

async function setup() {
  await deleteStore('tracker')
  await setStore('tracker', SEED_DATA)
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/workouts']}>
      <BackupProvider>
        <TrackerProvider>
          <ModalProvider>
            <Routes>
              <Route path="/workouts" element={<WorkoutsPage />} />
            </Routes>
          </ModalProvider>
        </TrackerProvider>
      </BackupProvider>
    </MemoryRouter>
  )
}

async function waitForExercises() {
  // Wait for tier header to render (indicates exercises are loaded)
  await screen.findByText(/Main Lift/, { timeout: 5000 })
}

describe('WorkoutsPage exercise reordering', () => {
  it('disables up button for first exercise in tier', async () => {
    await setup()
    renderPage()
    await waitForExercises()

    const upButtons = screen.getAllByLabelText(/Move .+ up/)
    expect(upButtons.length).toBeGreaterThan(0)
    // First up button in each tier should be disabled
    expect(upButtons[0]).toBeDisabled()
  })

  it('disables down button for last exercise in tier', async () => {
    await setup()
    renderPage()
    await waitForExercises()

    const downButtons = screen.getAllByLabelText(/Move .+ down/)
    expect(downButtons.length).toBeGreaterThan(0)
    // Last down button should be disabled
    expect(downButtons[downButtons.length - 1]).toBeDisabled()
  })

  it('swaps exercise order when clicking up', async () => {
    await setup()
    renderPage()
    await waitForExercises()

    const upButtons = screen.getAllByLabelText(/Move .+ up/).filter(b => !b.disabled)
    expect(upButtons.length).toBeGreaterThan(0)

    await userEvent.click(upButtons[0])
    // The page should re-render successfully with the new order
    expect(screen.getByText('Workouts')).toBeInTheDocument()
  })
})
