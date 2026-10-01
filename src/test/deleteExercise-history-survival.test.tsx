import React, { useEffect } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TrackerProvider, useTracker } from '../context'
import { BackupProvider } from '../context/BackupContext'
import { setStore } from '../db'
import { SEED_DATA } from '../data'
import { isLogged, matchesRecord } from '../domain/sessionRules'
import type { TrackerContextValue, TrackerData, SessionExercise } from '../types'

vi.stubGlobal('alert', vi.fn())

/**
 * Regression cover for `deleteExercise` destroying logged history.
 *
 * A session record standing for the deleted definition was matched by id only.
 * That was wrong twice over:
 *
 *  - it destroyed every logged record, though `PRD.md:56` promises the record
 *    survives with `originalId` carrying the link to the deleted definition, and
 *  - it missed every copy outright. A copy's id is synthetic
 *    (`<id>-copy-<uuid>`), so `se.id !== exId` is always true for one: the copies
 *    were left behind pointing at a definition that no longer exists, rendering
 *    in Session Detail as an orphan with nothing behind it.
 *
 * `matchesRecord` (id OR originalId) is the predicate every other reader already
 * uses, so deletion now uses it too, and strips a matched record only when it
 * was never logged — no evidence, no reason to keep an orphan.
 */

let current: TrackerContextValue | null = null

function Probe() {
  const tracker = useTracker()
  useEffect(() => { current = tracker })
  return <div>{tracker.loading ? 'loading' : 'ready'}</div>
}

async function mountWith(data: TrackerData) {
  // A still-mounted earlier Probe would keep republishing its own context over
  // `current`, and its queued `setStore` writes can land in IndexedDB after the
  // `setStore` below — the next mount would then read the previous test's data.
  // Unmount, let those writes drain, then seed.
  cleanup()
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
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
const ROW = 'row'
const D1 = '2026-12-01'
const D2 = '2026-12-08'

function record(overrides: Partial<SessionExercise> = {}): SessionExercise {
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

function sessionOn(date: string, exercises: SessionExercise[]): TrackerData['sessions'][number] {
  return { date, workoutName: 'Push', elapsedTime: 0, notes: '', exercises }
}

/**
 * One `bench` definition with a logged record in `D1` and a never-logged record
 * in `D2`. A second definition, `row`, is unrelated: its records must be
 * untouched, and it keeps the `exercises[]` / `workout.exercises[]` assertions
 * honest (something must survive for them to be about `bench` specifically).
 */
function baseData(): TrackerData {
  return {
    meta: { method: 'GZCL', created: '2026-01-01T00:00:00.000Z' },
    exercises: [
      {
        id: BENCH,
        name: 'Bench Press',
        muscles: ['Chest'],
        setup: '',
        superset: '',
        tier: 'T2',
        equipment: 'barbell'
      },
      {
        id: ROW,
        name: 'Bent Over Row',
        muscles: ['Back'],
        setup: '',
        superset: '',
        tier: 'T2',
        equipment: 'barbell'
      }
    ],
    workouts: [
      { name: 'Push', exercises: [BENCH] },
      { name: 'Pull', exercises: [ROW] }
    ],
    sessions: [
      sessionOn(D1, [record({ weight: '100', reps: '5', sets: 3 })]),
      sessionOn(D2, [record()])
    ]
  }
}

/** Records standing for the `bench` definition, via the readers' own predicate. */
function benchRecords(ctx: TrackerContextValue) {
  return ctx.data!.sessions.flatMap(s => s.exercises).filter(r => matchesRecord(r, BENCH))
}

/**
 * Run a context action. `current` is republished by an effect, so a bare call
 * leaves every read below it looking at the pre-action state.
 */
function run(fn: () => void) {
  act(fn)
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('deleteExercise: logged history survives, never-logged placeholders do not', () => {
  it('keeps a logged record and pins originalId to the deleted definition', async () => {
    const ctx = await mountWith(baseData())

    run(() => ctx().deleteExercise(BENCH))

    const kept = benchRecords(ctx())
    expect(kept).toHaveLength(1)
    expect(kept[0].weight).toBe('100')
    // The id resolves to nothing now, so this is the only handle left.
    expect(kept[0].originalId).toBe(BENCH)
  })

  it('still lists the surviving record in Exercise Detail history', async () => {
    const ctx = await mountWith(baseData())

    run(() => ctx().deleteExercise(BENCH))

    // The exact filter ExerciseDetailPage:35 uses.
    const history = benchRecords(ctx())
    expect(history.map(r => `${r.name} @ ${r.weight}×${r.reps}`)).toEqual(['Bench Press @ 100×5'])
  })

  it('still resolves previous performances through the surviving record', async () => {
    const ctx = await mountWith(baseData())

    run(() => ctx().deleteExercise(BENCH))

    const prev = ctx().getPreviousPerformances(BENCH, '2026-12-15')
    expect(prev).toHaveLength(1)
    expect(prev[0].weight).toBe('100')
    expect(prev[0].date).toBe(D1)
  })

  it('strips a never-logged record rather than leaving an empty orphan', async () => {
    const ctx = await mountWith(baseData())
    expect(ctx().data!.sessions.find(s => s.date === D2)!.exercises).toHaveLength(1)

    run(() => ctx().deleteExercise(BENCH))

    // No weight, no reps, no failure: nothing to preserve, and the record's
    // definition is gone — keeping it is exactly the orphan this removes.
    expect(ctx().data!.sessions.find(s => s.date === D2)!.exercises).toHaveLength(0)
  })

  it('keeps a logged copy instead of orphaning it on a deleted definition', async () => {
    // The regression: the copy's id is `<id>-copy-<uuid>`, so an id-only filter
    // skipped it entirely and it survived pointing at nothing.
    const ctx = await mountWith(baseData())
    run(() => ctx().duplicateExerciseInSession(D1, 0))
    run(() => ctx().updateExercise(D1, 1, 'weight', '80'))
    run(() => ctx().updateExercise(D1, 1, 'reps', '8'))

    const copy = ctx().data!.sessions[0].exercises[1]
    expect(copy.id).not.toBe(BENCH)

    run(() => ctx().deleteExercise(BENCH))

    const kept = benchRecords(ctx())
    expect(kept).toHaveLength(2)
    const keptCopy = kept.find(r => r.id === copy.id)
    expect(keptCopy).toBeDefined()
    expect(keptCopy!.weight).toBe('80')
    expect(keptCopy!.originalId).toBe(BENCH)
  })

  it('strips a never-logged copy too, rather than leaving it orphaned', async () => {
    // Duplicating resets the copy's weight/reps/failed, so a copy that was
    // never filled in is exactly the orphan case.
    const ctx = await mountWith(baseData())
    run(() => ctx().duplicateExerciseInSession(D1, 0))

    const copy = ctx().data!.sessions[0].exercises[1]
    expect(isLogged(copy)).toBe(false)

    run(() => ctx().deleteExercise(BENCH))

    expect(ctx().data!.sessions[0].exercises.find(r => r.id === copy.id)).toBeUndefined()
    expect(benchRecords(ctx())).toHaveLength(1)
  })

  it('removes the definition from exercises[] and every workout', async () => {
    const ctx = await mountWith(baseData())

    run(() => ctx().deleteExercise(BENCH))

    expect(ctx().getExercise(BENCH)).toBeUndefined()
    expect(ctx().data!.workouts.find(w => w.name === 'Push')!.exercises).not.toContain(BENCH)
    expect(ctx().data!.workouts.find(w => w.name === 'Pull')!.exercises).toEqual([ROW])
  })

  it('leaves an unrelated exercise and its records untouched', async () => {
    const ctx = await mountWith(baseData())

    run(() => ctx().deleteExercise(BENCH))

    expect(ctx().getExercise(ROW)).toBeDefined()
    expect(ctx().data!.exercises.map(e => e.id)).toEqual([ROW])
  })
})

describe('deleteExercise: seed copies carrying originalId', () => {
  it('leaves another definition\'s originalId copies alone', async () => {
    // SEED_DATA's `barbell-bench-copy-*` records point at `barbell-bench` via
    // originalId (data.ts:553, 723, 934, 950). Deleting a different definition
    // must not touch them — a match that reached past the requested id would
    // strip the seed's own history.
    const data: TrackerData = structuredClone(SEED_DATA)
    const copiesBefore = data.sessions
      .flatMap(s => s.exercises)
      .filter(r => r.originalId === 'barbell-bench')
    expect(copiesBefore.length).toBeGreaterThan(0)

    const ctx = await mountWith(data)
    run(() => ctx().deleteExercise('deadlift'))

    const copiesAfter = ctx().data!.sessions
      .flatMap(s => s.exercises)
      .filter(r => r.originalId === 'barbell-bench')
    expect(copiesAfter).toEqual(copiesBefore)
  })

  it('keeps every logged barbell-bench record and drops the placeholders', async () => {
    // The seed's own records for `barbell-bench` — direct and copies alike.
    // The logged ones are evidence and must survive, each still resolvable to
    // the deleted definition; the blank ones are placeholders and must not
    // outlive the thing they were standing in for.
    const data: TrackerData = structuredClone(SEED_DATA)
    const matching = data.sessions
      .flatMap(s => s.exercises)
      .filter(r => matchesRecord(r, 'barbell-bench'))
    const loggedBefore = matching.filter(isLogged)
    expect(loggedBefore.length).toBeGreaterThan(3)
    // A copy is among them, so this is not a plain id lookup.
    expect(loggedBefore.some(r => r.originalId === 'barbell-bench')).toBe(true)

    const ctx = await mountWith(data)
    run(() => ctx().deleteExercise('barbell-bench'))

    const after = ctx().data!.sessions
      .flatMap(s => s.exercises)
      .filter(r => matchesRecord(r, 'barbell-bench'))
    expect(after.map(r => r.id)).toEqual(loggedBefore.map(r => r.id))
    expect(after.map(r => r.weight)).toEqual(loggedBefore.map(r => r.weight))
    // Every survivor still resolves back to the deleted id.
    expect(after.every(r => r.originalId === 'barbell-bench')).toBe(true)
  })
})
