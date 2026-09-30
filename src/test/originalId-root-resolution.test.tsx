import React, { useEffect } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TrackerProvider, useTracker } from '../context'
import { BackupProvider } from '../context/BackupContext'
import { setStore } from '../db'
import type { TrackerContextValue, TrackerData, SessionExercise } from '../types'

vi.stubGlobal('alert', vi.fn())

/**
 * Regression cover for `originalId` pointing at the ROOT definition rather
 * than the record a copy was duplicated from.
 *
 * A duplicated record's `id` is synthetic (`<id>-copy-<uuid>`) and matches no
 * `Exercise`, so `originalId` is the only value a reader can use to find the
 * definition. Every reader treats it as a definition id:
 *
 *  - `getPreviousPerformances` filters `ex.id === exId || ex.originalId === exId`
 *  - `ExerciseDetailPage` history filters `record.id === id || record.originalId === id`
 *  - `SessionDetailPage` resolves the definition via `originalId ?? id`
 *
 * So when `duplicateExerciseInSession` duplicated a copy it wrote
 * `originalId: original.id` — the intermediate copy's synthetic id — and every
 * one of those readers resolved a value matching no definition. The record
 * silently dropped out of history and previous-performance lookups.
 */
let current: TrackerContextValue | null = null

function Probe() {
  const tracker = useTracker()
  useEffect(() => { current = tracker })
  return <div>{tracker.loading ? 'loading' : 'ready'}</div>
}

async function mountWith(data: TrackerData) {
  current = null
  await setStore('tracker', data)
  render(
    <MemoryRouter>
      <BackupProvider>
        <TrackerProvider>
          <Probe />
        </TrackerProvider>
      </BackupProvider>
    </MemoryRouter>
  )
  await screen.findByText('ready')
  await waitFor(() => {
    expect(current).not.toBeNull()
    expect(current!.loading).toBe(false)
  })
  return () => current!
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const BENCH = 'bench'
const D1 = '2026-12-01'
const D2 = '2026-12-08'

function logged(overrides: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: BENCH,
    name: 'Bench Press',
    muscles: ['Chest'],
    setup: '',
    tier: 'T2',
    superset: '',
    equipment: 'barbell',
    weight: '',
    reps: '',
    sets: null,
    ...overrides
  }
}

function baseData(sessions: TrackerData['sessions'] = []): TrackerData {
  return {
    meta: { method: 'GZCL', created: '2026-01-01T00:00:00.000Z' },
    exercises: [{
      id: BENCH,
      name: 'Bench Press',
      muscles: ['Chest'],
      setup: '',
      superset: '',
      tier: 'T2',
      equipment: 'barbell'
    }],
    workouts: [{ name: 'Push', exercises: [BENCH] }],
    sessions
  }
}

/** A session whose single record is the `bench` definition. */
function sessionOn(date: string, exercises: SessionExercise[]): TrackerData['sessions'][number] {
  return { date, workoutName: 'Push', elapsedTime: 0, notes: '', exercises }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('duplicateExerciseInSession: originalId resolves to the root definition', () => {
  it('writes the definition id on a first-generation copy', async () => {
    const ctx = await mountWith(baseData())
    ctx().addSession(D1, 'Push')
    await waitFor(() => expect(ctx().data!.sessions).toHaveLength(1))

    ctx().duplicateExerciseInSession(D1, 0)
    await waitFor(() => expect(ctx().data!.sessions[0].exercises).toHaveLength(2))

    expect(ctx().data!.sessions[0].exercises[1].originalId).toBe(BENCH)
  })

  it('carries the root forward when duplicating a copy, not the intermediate copy', async () => {
    const ctx = await mountWith(baseData())
    ctx().addSession(D1, 'Push')
    await waitFor(() => expect(ctx().data!.sessions).toHaveLength(1))

    ctx().duplicateExerciseInSession(D1, 0)
    await waitFor(() => expect(ctx().data!.sessions[0].exercises).toHaveLength(2))
    ctx().duplicateExerciseInSession(D1, 1)
    await waitFor(() => expect(ctx().data!.sessions[0].exercises).toHaveLength(3))

    const copy1 = ctx().data!.sessions[0].exercises[1]
    const copy2 = ctx().data!.sessions[0].exercises[2]

    expect(copy2.originalId).toBe(BENCH)
    // The regression: this used to be copy1's synthetic id, which matches no Exercise.
    expect(copy2.originalId).not.toBe(copy1.id)
    // Both values a reader can reach for must resolve to a real definition.
    expect(ctx().getExercise(copy2.originalId!)).toBeDefined()
    expect(ctx().getExercise(copy2.originalId ?? copy2.id)!.id).toBe(BENCH)
  })

  it('keeps a third-generation copy resolvable to the root', async () => {
    const ctx = await mountWith(baseData())
    ctx().addSession(D1, 'Push')
    await waitFor(() => expect(ctx().data!.sessions).toHaveLength(1))

    ctx().duplicateExerciseInSession(D1, 0)
    await waitFor(() => expect(ctx().data!.sessions[0].exercises).toHaveLength(2))
    ctx().duplicateExerciseInSession(D1, 1)
    await waitFor(() => expect(ctx().data!.sessions[0].exercises).toHaveLength(3))
    ctx().duplicateExerciseInSession(D1, 2)
    await waitFor(() => expect(ctx().data!.sessions[0].exercises).toHaveLength(4))

    // Every copy resolves to the one definition, none to a synthetic sibling.
    for (const copy of ctx().data!.sessions[0].exercises.slice(1)) {
      expect(copy.originalId).toBe(BENCH)
    }
  })

  it('shows a copy-of-a-copy in Exercise Detail history', async () => {
    const ctx = await mountWith(baseData())
    ctx().addSession(D1, 'Push')
    await waitFor(() => expect(ctx().data!.sessions).toHaveLength(1))

    ctx().duplicateExerciseInSession(D1, 0)
    await waitFor(() => expect(ctx().data!.sessions[0].exercises).toHaveLength(2))
    ctx().duplicateExerciseInSession(D1, 1)
    await waitFor(() => expect(ctx().data!.sessions[0].exercises).toHaveLength(3))

    // The exact filter ExerciseDetailPage:34 uses.
    const history = ctx().data!.sessions
      .flatMap(s => s.exercises)
      .filter(record => record.id === BENCH || record.originalId === BENCH)

    expect(history.map(r => r.name)).toEqual([
      'Bench Press',
      'Bench Press (2)',
      'Bench Press (2) (2)'
    ])
  })

  it('counts a copy-of-a-copy in getPreviousPerformances', async () => {
    // Only the two copies carry a logged weight; the original is blank, so a
    // previous-performance lookup has nothing to match on unless the copies'
    // originalId resolves to the real definition.
    const data = baseData([sessionOn(D1, [logged()])])
    const ctx = await mountWith(data)
    await waitFor(() => expect(ctx().data!.sessions).toHaveLength(1))

    ctx().duplicateExerciseInSession(D1, 0)
    await waitFor(() => expect(ctx().data!.sessions[0].exercises).toHaveLength(2))
    ctx().duplicateExerciseInSession(D1, 1)
    await waitFor(() => expect(ctx().data!.sessions[0].exercises).toHaveLength(3))

    ctx().updateExercise(D1, 1, 'weight', '100')
    ctx().updateExercise(D1, 2, 'weight', '100')

    const prev = ctx().getPreviousPerformances(BENCH, D2)
    // Both logged copies are this exercise's history. Before the fix the
    // copy-of-a-copy resolved to a synthetic id and only one entry came back.
    expect(prev).toHaveLength(2)
    expect(prev.map(p => p.weight)).toEqual(['100', '100'])
    expect(prev[0].date).toBe(D1)
  })
})
