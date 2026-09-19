import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { TrackerProvider } from '../context'
import { BackupProvider } from '../context/BackupContext'
import { ModalProvider } from '../components/ModalProvider'
import WorkoutsPage from '../pages/WorkoutsPage'
import { setStore, deleteStore } from '../db'
import { SEED_DATA } from '../data'

beforeEach(async () => {
  await deleteStore('tracker')
  await setStore('tracker', SEED_DATA)
})

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
  await screen.findByText(/Main Lift/, { timeout: 5000 })
}

async function enterReorderMode() {
  const reorderBtn = await screen.findByRole('button', { name: 'Reorder' })
  await userEvent.click(reorderBtn)
}

describe('WorkoutsPage exercise reordering — tier boundaries', () => {
  it('disables up button for first exercise in each tier', async () => {
    renderPage()
    await waitForExercises()
    await enterReorderMode()

    // Barbell Back Squat is T1 and the only T1 exercise in Squat Workout
    const upButton = screen.getByLabelText(/Move Barbell Back Squat up/)
    expect(upButton).toBeDisabled()
  })

  it('disables down button for last exercise in each tier', async () => {
    renderPage()
    await waitForExercises()
    await enterReorderMode()

    // Single Leg RDL is the last T2 exercise in Squat Workout
    const downButton = screen.getByLabelText(/Move Single Leg RDL down/)
    expect(downButton).toBeDisabled()
  })

  it('allows moving an exercise up within the same tier', async () => {
    renderPage()
    await waitForExercises()
    await enterReorderMode()

    // DB Bench is 2nd in T2 (after Alt: Belt Squat), so its up button is enabled
    const upButton = screen.getByLabelText(/Move DB Bench up/)
    expect(upButton).not.toBeDisabled()

    await userEvent.click(upButton)
    // Page should re-render successfully
    expect(screen.getByText('Workouts')).toBeInTheDocument()
  })

  it('allows moving an exercise down within the same tier', async () => {
    renderPage()
    await waitForExercises()
    await enterReorderMode()

    // Alt: Belt Squat is 1st in T2, so its down button is enabled
    const downButton = screen.getByLabelText(/Move Alt: Belt Squat down/)
    expect(downButton).not.toBeDisabled()

    await userEvent.click(downButton)
    expect(screen.getByText('Workouts')).toBeInTheDocument()
  })

  it('disables up button at top of T3 tier', async () => {
    renderPage()
    await waitForExercises()
    await enterReorderMode()

    // Lat Pulldown is first T3 in Squat Workout
    const upButton = screen.getByLabelText(/Move Lat Pulldown up/)
    expect(upButton).toBeDisabled()
  })

  it('disables down button at bottom of T3 tier', async () => {
    renderPage()
    await waitForExercises()
    await enterReorderMode()

    // Single Arm Rows is last T3 in Squat Workout
    const downButton = screen.getByLabelText(/Move Single Arm Rows down/)
    expect(downButton).toBeDisabled()
  })
})
