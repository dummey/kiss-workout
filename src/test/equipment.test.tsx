import React, { useEffect } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TrackerProvider, useTracker } from '../context'
import { BackupProvider } from '../context/BackupContext'
import { getStore, setStore, deleteStore } from '../db'
import { SEED_DATA } from '../data'
import { validateTrackerData, validateSession } from '../validation'
import type { TrackerContextValue, TrackerData } from '../types'

vi.stubGlobal('alert', vi.fn())

/**
 * The latest tracker value, published from an effect so the assignment is not a
 * side effect of render. Tests read it at call time rather than holding a value
 * captured at mount: several context actions mutate nested objects in place, so a
 * snapshot taken before an action would already show the post-action state and
 * could mask a missing write.
 */
let current: TrackerContextValue | null = null

function Probe() {
  const tracker = useTracker()
  useEffect(() => {
    current = tracker
  })
  return <div>{tracker.loading ? 'loading' : 'ready'}</div>
}

function renderApp() {
  return render(
    <MemoryRouter>
      <BackupProvider>
        <TrackerProvider>
          <Probe />
        </TrackerProvider>
      </BackupProvider>
    </MemoryRouter>
  )
}

/** Mounts the app over `data` and returns a getter for the current tracker value. */
async function mountWith(data: TrackerData) {
  current = null
  await setStore('tracker', data)
  renderApp()
  await screen.findByText('ready')
  await waitFor(() => {
    expect(current).not.toBeNull()
    expect(current!.loading).toBe(false)
  })
  return () => current!
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const BARBELL_ID = 'barbell-back-squat'
const CABLE_ID = 'lat-pulldown'
const SESSION_DATE = '2026-12-01'

function definition(overrides: Partial<TrackerData['exercises'][number]> = {}) {
  return {
    id: BARBELL_ID,
    name: 'Barbell Back Squat',
    muscles: ['Quads'],
    setup: '',
    superset: '',
    tier: 'T1' as const,
    equipment: 'barbell' as const,
    ...overrides
  }
}

function baseData(exercises: TrackerData['exercises'] = [definition()]): TrackerData {
  return {
    meta: { method: 'GZCL', created: '2026-01-01T00:00:00.000Z' },
    exercises,
    workouts: [{ name: 'Squat Workout', exercises: exercises.map(e => e.id) }],
    sessions: []
  }
}

/** A session already on disk, as if the user had trained that day. */
function sessionOnDisk(exercises: TrackerData['sessions'][number]['exercises'] = []) {
  return {
    date: SESSION_DATE,
    workoutName: 'Squat Workout',
    elapsedTime: 0,
    notes: '',
    exercises
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('equipment import validation', () => {
  const backup = (exercise: Record<string, unknown>) => ({
    meta: { method: 'GZCL', created: '2026-01-01T00:00:00.000Z' },
    exercises: [exercise],
    workouts: [],
    sessions: []
  })

  const legacyExercise = {
    id: 'squat',
    name: 'Back Squat',
    muscles: ['Quads'],
    setup: '',
    superset: '',
    tier: 'T1'
  }

  it('accepts a legacy backup whose exercises have no equipment key at all', () => {
    expect(legacyExercise).not.toHaveProperty('equipment')
    expect(validateTrackerData(backup(legacyExercise))).toEqual({ valid: true })
  })

  it('accepts a backup with equipment: "barbell" and leaves the value intact', () => {
    const parsed = JSON.parse(JSON.stringify(backup({ ...legacyExercise, equipment: 'barbell' })))
    expect(validateTrackerData(parsed)).toEqual({ valid: true })
    expect(parsed.exercises[0].equipment).toBe('barbell')
  })

  it('accepts an explicit empty string as "None"', () => {
    expect(validateTrackerData(backup({ ...legacyExercise, equipment: '' }))).toEqual({ valid: true })
  })

  it.each([
    ['null', null],
    ['a number', 5],
    ['an unknown string', 'dumbbell']
  ])('rejects equipment set to %s — present-but-wrong-typed is not the same as absent', (_label, value) => {
    const result = validateTrackerData(backup({ ...legacyExercise, equipment: value }))
    expect(result.valid).toBe(false)
    expect(result.error).toContain("'equipment' must be '' or 'barbell'")
  })

  it('rejects a bad equipment value on a session exercise too', () => {
    // Deliberately invalid input: a SessionExercise whose equipment is not a known
    // value, cast because the type cannot express what the validator must reject.
    const badExercise = {
      id: 'squat',
      name: 'Back Squat',
      muscles: ['Quads'],
      setup: '',
      superset: '',
      tier: 'T1',
      weight: '',
      reps: '',
      sets: null,
      equipment: 'dumbbell'
    } as unknown as TrackerData['sessions'][number]['exercises'][number]
    const result = validateSession(sessionOnDisk([badExercise]))
    expect(result.valid).toBe(false)
    expect(result.error).toContain("'equipment' must be '' or 'barbell'")
  })

  it('accepts a legacy session whose exercises have no equipment key', () => {
    const result = validateSession(sessionOnDisk([{
      id: 'squat',
      name: 'Back Squat',
      muscles: ['Quads'],
      setup: '',
      superset: '',
      tier: 'T1',
      weight: '',
      reps: '',
      sets: null
    }]))
    expect(result).toEqual({ valid: true })
  })
})

describe('seed equipment', () => {
  const BARBELL_EXERCISE_IDS = [BARBELL_ID, 'barbell-bench', 'deadlift', 'bent-over-rows']

  it('gives every one of the 26 seed exercises an equipment key', () => {
    expect(SEED_DATA.exercises).toHaveLength(26)
    for (const exercise of SEED_DATA.exercises) {
      expect(exercise).toHaveProperty('equipment')
      expect(['barbell', '']).toContain(exercise.equipment)
    }
  })

  it('marks exactly the four barbell lifts as barbell and nothing else', () => {
    const barbell = SEED_DATA.exercises.filter(e => e.equipment === 'barbell').map(e => e.id)
    expect(barbell).toEqual(BARBELL_EXERCISE_IDS)
  })

  it('leaves the genuinely ambiguous lifts unset for the owner to choose', () => {
    for (const id of ['farmer-carry', 'alt-belt-squat']) {
      const exercise = SEED_DATA.exercises.find(e => e.id === id)
      expect(exercise).toBeDefined()
      expect(exercise!.equipment).toBe('')
    }
  })

  it('leaves the recorded seed sessions without an equipment key, as legacy data would be', () => {
    // Sessions are historical records; only newly-created ones carry the snapshot.
    const sessionExercises = SEED_DATA.sessions.flatMap(s => s.exercises)
    expect(sessionExercises.length).toBeGreaterThan(0)
    expect(sessionExercises.filter(e => 'equipment' in e)).toEqual([])
  })
})

describe('equipment snapshot onto SessionExercise', () => {
  beforeEach(async () => {
    cleanup()
    current = null
    vi.clearAllMocks()
    try {
      await deleteStore('tracker')
      await deleteStore('backup-meta')
    } catch {
      // ignore
    }
  })

  it('addSession copies equipment onto every created session exercise', async () => {
    const data = baseData([
      definition(),
      definition({ id: CABLE_ID, name: 'Lat Pulldown', tier: 'T3', equipment: '' })
    ])
    const ctx = await mountWith(data)

    const session = ctx().addSession(SESSION_DATE, 'Squat Workout')

    expect(session).not.toBeNull()
    const byId = Object.fromEntries(session!.exercises.map(e => [e.id, e]))
    expect(byId[BARBELL_ID].equipment).toBe('barbell')
    expect(byId[CABLE_ID].equipment).toBe('')
  })

  it('addExerciseToSession copies equipment onto the added session exercise', async () => {
    const data = baseData([definition(), definition({ id: CABLE_ID, name: 'Lat Pulldown', tier: 'T3', equipment: '' })])
    data.sessions = [sessionOnDisk()]
    const ctx = await mountWith(data)

    ctx().addExerciseToSession(SESSION_DATE, BARBELL_ID)

    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      expect(stored.sessions[0].exercises.map(e => e.equipment)).toEqual(['barbell'])
    })
  })

  it('normalises a legacy definition with no equipment key to an empty string', async () => {
    // A pre-field exercise definition read back out of IndexedDB.
    const legacyDefinition = { ...definition() } as Partial<TrackerData['exercises'][number]>
    delete legacyDefinition.equipment
    const ctx = await mountWith(baseData([legacyDefinition as TrackerData['exercises'][number]]))

    const session = ctx().addSession(SESSION_DATE, 'Squat Workout')

    expect(session!.exercises[0].equipment).toBe('')
  })

  it('duplicateExerciseInSession keeps the barbell snapshot', async () => {
    const ctx = await mountWith(baseData())

    ctx().addSession(SESSION_DATE, 'Squat Workout')
    await waitFor(() => {
      expect(ctx().data!.sessions).toHaveLength(1)
    })

    ctx().duplicateExerciseInSession(SESSION_DATE, 0)

    await waitFor(() => {
      expect(ctx().data!.sessions[0].exercises).toHaveLength(2)
    })
    const [original, copy] = ctx().data!.sessions[0].exercises
    expect(original.equipment).toBe('barbell')
    expect(copy.equipment).toBe('barbell')
    expect(copy.originalId).toBe(BARBELL_ID)
  })

  it('duplicateExerciseInSession normalises a legacy session exercise with no equipment', async () => {
    const data = baseData()
    data.sessions = [sessionOnDisk([{
      id: BARBELL_ID,
      name: 'Barbell Back Squat',
      muscles: ['Quads'],
      setup: '',
      tier: 'T1',
      superset: '',
      weight: '',
      reps: '',
      sets: null
    }])]
    const ctx = await mountWith(data)

    ctx().duplicateExerciseInSession(SESSION_DATE, 0)

    await waitFor(() => {
      expect(ctx().data!.sessions[0].exercises).toHaveLength(2)
    })
    expect(ctx().data!.sessions[0].exercises[0].equipment).toBeUndefined()
    expect(ctx().data!.sessions[0].exercises[1].equipment).toBe('')
  })
})

describe('updateExerciseDef with equipment', () => {
  beforeEach(async () => {
    cleanup()
    current = null
    try {
      await deleteStore('tracker')
      await deleteStore('backup-meta')
    } catch {
      // ignore
    }
  })

  it('writes a changed equipment value to the exercise definition', async () => {
    const ctx = await mountWith(baseData([definition({ equipment: '' })]))

    ctx().updateExerciseDef(BARBELL_ID, 'equipment', 'barbell')

    await waitFor(async () => {
      const stored = await getStore('tracker') as TrackerData
      expect(stored.exercises.find(e => e.id === BARBELL_ID)?.equipment).toBe('barbell')
    })
  })
})
