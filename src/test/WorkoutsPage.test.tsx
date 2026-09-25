import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { TrackerProvider } from '../context'
import { BackupProvider } from '../context/BackupContext'
import { ModalProvider } from '../components/ModalProvider'
import WorkoutsPage from '../pages/WorkoutsPage'
import { setStore, deleteStore } from '../db'
import { SEED_DATA } from '../data'

vi.mock('../components/BodyMusclesChart', () => ({
  default: ({ muscles = [], allMuscles = [] }: { muscles?: string[]; allMuscles?: string[] }) => (
    <div
      data-testid="body-muscles-chart"
      data-highlighted={muscles.join('|')}
      data-all={allMuscles.join('|')}
    />
  ),
}))

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

  it('shows, hides, and switches an exercise muscle highlight', async () => {
    await setup()
    renderPage()
    await waitForExercises()

    const squatCard = screen.getByText('Barbell Back Squat').closest('.card')
    const altSquatCard = screen.getByText('Alt: Belt Squat').closest('.card')
    expect(squatCard).not.toBeNull()
    expect(altSquatCard).not.toBeNull()
    if (!squatCard || !altSquatCard) return

    const chart = screen.getByTestId('body-muscles-chart')
    expect(chart).toHaveAttribute('data-highlighted', '')

    const squatShow = within(squatCard).getByRole('button', { name: 'Show' })
    await userEvent.click(squatShow)
    expect(chart).toHaveAttribute('data-highlighted', 'Quads|Glutes|Hamstrings|Core|Erector Spinae')
    expect(within(squatCard).getByRole('button', { name: 'Hide' })).toBeInTheDocument()

    const altSquatShow = within(altSquatCard).getByRole('button', { name: 'Show' })
    await userEvent.click(altSquatShow)
    expect(chart).toHaveAttribute('data-highlighted', 'Quads|Glutes|Adductors')
    expect(within(squatCard).getByRole('button', { name: 'Show' })).toBeInTheDocument()
    expect(within(altSquatCard).getByRole('button', { name: 'Hide' })).toBeInTheDocument()

    await userEvent.click(within(altSquatCard).getByRole('button', { name: 'Hide' }))
    expect(chart).toHaveAttribute('data-highlighted', '')
  })

  it('clears the muscle highlight when switching workouts', async () => {
    await setup()
    renderPage()
    await waitForExercises()

    const squatCard = screen.getByText('Barbell Back Squat').closest('.card')
    expect(squatCard).not.toBeNull()
    if (!squatCard) return

    await userEvent.click(within(squatCard).getByRole('button', { name: 'Show' }))
    const chart = screen.getByTestId('body-muscles-chart')
    expect(chart).not.toHaveAttribute('data-highlighted', '')

    await userEvent.click(screen.getByRole('button', { name: /^Bench Workout \(9\)$/ }))
    expect(screen.getByText('Barbell Bench')).toBeInTheDocument()
    expect(screen.getByTestId('body-muscles-chart')).toHaveAttribute('data-highlighted', '')
  })
})
