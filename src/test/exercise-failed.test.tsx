import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { TrackerProvider } from '../context'
import { BackupProvider } from '../context/BackupContext'
import { ModalProvider } from '../components/ModalProvider'
import SessionDetailPage from '../pages/SessionDetailPage'
import { deleteStore, getStore, setStore } from '../db'
import type { Session, TrackerData } from '../types'

const CURRENT_DATE = '2026-11-02'
const LEGACY_DATE = '2026-11-01'

function makeSession(date: string, failed?: boolean): Session {
  return {
    date,
    workoutName: 'Test Workout',
    elapsedTime: 123,
    notes: 'Keep these values',
    exercises: [{
      id: 'bench',
      name: 'Bench Press',
      muscles: ['Chest'],
      setup: 'Barbell',
      tier: 'T1',
      superset: '',
      weight: '225',
      reps: '5',
      sets: 3,
      ...(failed === undefined ? {} : { failed })
    }]
  }
}

function makeData(): TrackerData {
  return {
    meta: { method: 'GZCL', created: '2026-01-01T00:00:00.000Z' },
    exercises: [{
      id: 'bench',
      name: 'Bench Press',
      muscles: ['Chest'],
      setup: 'Barbell',
      superset: '',
      tier: 'T1'
    }],
    workouts: [{ name: 'Test Workout', exercises: ['bench'] }],
    sessions: [makeSession(CURRENT_DATE), makeSession(LEGACY_DATE)]
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/sessions/${CURRENT_DATE}`]}>
      <BackupProvider>
        <TrackerProvider>
          <ModalProvider>
            <Routes>
              <Route path="/sessions/:date" element={<SessionDetailPage />} />
            </Routes>
          </ModalProvider>
        </TrackerProvider>
      </BackupProvider>
    </MemoryRouter>
  )
}

describe('exercise failed marker', () => {
  beforeEach(async () => {
    await deleteStore('tracker')
    await deleteStore('backup-meta')
  })

  it('toggles the failed marker, persists it, and supports undoing it', async () => {
    const user = userEvent.setup()
    await setStore('tracker', makeData())

    renderPage()

    const markFailed = await screen.findByRole('button', { name: 'Mark Bench Press as failed' })
    expect(markFailed).toHaveAttribute('aria-pressed', 'false')
    expect(markFailed).toHaveAttribute('title', 'Mark Bench Press as failed')
    expect(markFailed).toHaveTextContent('↘')
    expect(screen.getByText('Test Workout — 1 exercises')).toBeInTheDocument()

    await user.click(markFailed)

    const undo = await screen.findByRole('button', { name: 'Undo failed status for Bench Press' })
    expect(undo).toHaveTextContent('↘')
    expect(undo).toHaveAttribute('title', 'Undo failed status for Bench Press')
    expect(undo).toHaveAttribute('aria-pressed', 'true')
    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      expect(stored.sessions[0].exercises[0].failed).toBe(true)
      expect(stored.sessions[0].exercises[0]).toMatchObject({
        weight: '225', reps: '5', sets: 3
      })
      expect(stored.sessions[0]).toMatchObject({ elapsedTime: 123, notes: 'Keep these values' })
      expect(stored.sessions[0].workoutName).toBe('Test Workout')
      expect(stored.sessions[0].exercises).toHaveLength(1)
    })

    await user.click(undo)
    const markAgain = await screen.findByRole('button', { name: 'Mark Bench Press as failed' })
    expect(markAgain).toHaveAttribute('aria-pressed', 'false')
    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      expect(stored.sessions[0].exercises[0].failed).toBe(false)
    })
  })

  it('loads legacy sessions without the field as not failed', async () => {
    const user = userEvent.setup()
    await setStore('tracker', makeData())

    renderPage()

    const markFailed = await screen.findByRole('button', { name: 'Mark Bench Press as failed' })
    // The toggle is icon-only: the trend-down glyph is the visible affordance,
    // the old "Mark failed" text label is gone but the accessible name is kept.
    expect(markFailed).toHaveTextContent('↘')
    expect(markFailed.textContent).not.toContain('Mark failed')
    expect(markFailed).toHaveAttribute('aria-pressed', 'false')

    await user.click(markFailed)
    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      expect(stored.sessions[0].exercises[0].failed).toBe(true)
    })
  })

  it('shows a blank prior failed performance in Last time', async () => {
    const data = makeData()
    const legacy = data.sessions[1]
    legacy.exercises[0].weight = ''
    legacy.exercises[0].reps = ''
    legacy.exercises[0].sets = null
    legacy.exercises[0].failed = true
    await setStore('tracker', data)

    renderPage()

    expect(await screen.findByText(/Last time: Failed/)).toBeInTheDocument()
    expect(screen.queryByText(/Last time: — x —/)).not.toBeInTheDocument()
  })

  it('shows recorded values and Failed in Last time without changing guidance', async () => {
    const data = makeData()
    data.sessions[1].exercises[0].failed = true
    await setStore('tracker', data)

    renderPage()

    expect(await screen.findByText(/Last time: 225 x 5 \(3\) — Failed/)).toBeInTheDocument()
    expect(screen.getByText(/Add 5lbs \(bench\) or 10lbs \(squat and deadlift\)/)).toBeInTheDocument()
  })

  it('persists a session that was previously failed after reload', async () => {
    const data = makeData()
    data.sessions[0].exercises[0].failed = true
    await setStore('tracker', data)

    const firstRender = renderPage()
    expect(await screen.findByRole('button', { name: 'Undo failed status for Bench Press' })).toHaveAttribute('aria-pressed', 'true')
    firstRender.unmount()

    renderPage()
    expect(await screen.findByRole('button', { name: 'Undo failed status for Bench Press' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('supports marking an exercise added to the session as failed and persists it', async () => {
    const user = userEvent.setup()
    const data = makeData()
    data.exercises.push({
      id: 'squat',
      name: 'Back Squat',
      muscles: ['Legs'],
      setup: 'Barbell',
      superset: '',
      tier: 'T1'
    })
    await setStore('tracker', data)

    renderPage()

    await user.click(await screen.findByRole('button', { name: '+ Add Exercise' }))
    await user.click(await screen.findByText('Back Squat'))
    const markAddedFailed = await screen.findByRole('button', { name: 'Mark Back Squat as failed' })
    expect(markAddedFailed).toHaveAttribute('aria-pressed', 'false')

    await user.click(markAddedFailed)
    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      const added = stored.sessions[0].exercises.find(ex => ex.id === 'squat')
      expect(added).toMatchObject({
        id: 'squat',
        weight: '',
        reps: '',
        sets: null,
        failed: true
      })
      expect(stored.sessions[0].exercises).toHaveLength(2)
    })
  })

  it('supports marking a duplicated exercise as failed independently', async () => {
    const user = userEvent.setup()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('duplicated-id')
    await setStore('tracker', makeData())

    renderPage()

    await user.click(await screen.findByTitle('Duplicate exercise'))
    const failedButtons = await screen.findAllByRole('button', { name: /as failed/ })
    expect(failedButtons).toHaveLength(2)

    await user.click(failedButtons[1])
    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      const [original, duplicate] = stored.sessions[0].exercises
      expect(original.failed).toBeUndefined()
      expect(duplicate).toMatchObject({ originalId: 'bench', failed: true })
    })
  })
})
