import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SEED_DATA } from '../data'
import { validateTrackerData } from '../validation'
import ProgressionInfo from '../components/ProgressionInfo'
import type { PreviousPerformance, SessionExercise } from '../types'

const FAILED_SESSION_DATE = '2026-10-13'

function findSeedExercise(exerciseId: string): SessionExercise {
  const exercise = SEED_DATA.sessions
    .find(session => session.date === FAILED_SESSION_DATE)
    ?.exercises.find(item => item.id === exerciseId)

  if (!exercise) throw new Error(`Missing seed exercise ${exerciseId} on ${FAILED_SESSION_DATE}`)
  return exercise
}

function toPreviousPerformance(exercise: SessionExercise): PreviousPerformance {
  return {
    weight: exercise.weight || '—',
    reps: exercise.reps || '—',
    sets: exercise.sets ?? '—',
    date: FAILED_SESSION_DATE,
    failed: exercise.failed
  }
}

describe('seed meta', () => {
  it('names the seed data exactly "Seed Data"', () => {
    expect(SEED_DATA.meta.name).toBe('Seed Data')
  })
})

describe('seed import validity', () => {
  // resetToSeedData writes SEED_DATA straight to IndexedDB without re-validating,
  // so nothing else would catch an invalid seed: it would only surface when a user
  // tried to import a backup exported from a freshly-seeded app.
  it('passes validateTrackerData so an exported seed can be re-imported', () => {
    expect(validateTrackerData(SEED_DATA)).toEqual({ valid: true })
  })

  it('gives every exercise definition a string superset, including empty ones', () => {
    for (const exercise of SEED_DATA.exercises) {
      expect(typeof exercise.superset).toBe('string')
    }
    // The seed defines no superset pairings, so every value is the empty string —
    // the key must be present, not merely undefined.
    expect(SEED_DATA.exercises.filter(ex => ex.superset !== '')).toEqual([])
  })
})

describe('failed exercise seed data', () => {
  it('includes recorded and blank failed examples with valid exercise definitions', () => {
    const exerciseIds = new Set(SEED_DATA.exercises.map(exercise => exercise.id))
    const recordedFailure = findSeedExercise('barbell-bench')
    const blankFailure = findSeedExercise('nordics')

    expect(exerciseIds.has(recordedFailure.id)).toBe(true)
    expect(exerciseIds.has(blankFailure.id)).toBe(true)
    expect(recordedFailure).toMatchObject({
      weight: '190',
      reps: '4',
      sets: 4,
      failed: true
    })
    expect(blankFailure).toMatchObject({
      weight: '',
      reps: '',
      sets: null,
      failed: true
    })
  })

  it('renders both seed examples in the Last time display', () => {
    const { rerender } = render(
      <ProgressionInfo tier="T1" prevInfo={[toPreviousPerformance(findSeedExercise('barbell-bench'))]} />
    )
    expect(screen.getByText('Last time: 190 x 4 (4) — Failed')).toBeInTheDocument()

    rerender(
      <ProgressionInfo tier="T2" prevInfo={[toPreviousPerformance(findSeedExercise('nordics'))]} />
    )
    expect(screen.getByText('Last time: Failed')).toBeInTheDocument()
  })
})
