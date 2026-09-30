import { describe, it, expect } from 'vitest'
import { dateCompare, generateExerciseId, canAddSession, parseSets } from '../utils'

describe('dateCompare', () => {
  it('compares YYYY-MM-DD dates correctly', () => {
    expect(dateCompare('2026-09-01', '2026-09-02')).toBeLessThan(0)
    expect(dateCompare('2026-09-02', '2026-09-01')).toBeGreaterThan(0)
    expect(dateCompare('2026-09-01', '2026-09-01')).toBe(0)
  })

  it('parses M/D format dates', () => {
    expect(dateCompare('9/1', '9/2')).toBeLessThan(0)
    expect(dateCompare('12/31', '1/1')).toBeGreaterThan(0)
  })

  it('handles range dates by using first date', () => {
    expect(dateCompare('9/1 - 9/30', '9/15')).toBeLessThan(0)
  })

  it('returns 0000-00-00 for invalid dates', () => {
    expect(dateCompare('invalid', 'invalid')).toBe(0)
    expect(dateCompare('invalid', '2026-09-01')).toBeLessThan(0)
  })
})

// GZCL progression guidance is NOT tested here. `getNextProgression` lives in
// `src/components/ProgressionInfo.tsx` and is covered by `ProgressionInfo.test.tsx`.
// This file previously carried a hand-written second copy of that function plus
// six tests against it; five of the six asserted behaviour the shipped
// implementation does not have (its adaptive branches were commented out in
// ca5bee0 and this copy was never updated), so those tests passed while
// exercising zero production lines. Progression is being redesigned from
// scratch, so the copy is deleted rather than reconciled.

describe('Exercise ID generation', () => {
  it('prefixes the id with a slug of the exercise name', () => {
    expect(generateExerciseId('Barbell Back Squat')).toMatch(/^barbell-back-squat-/)
    expect(generateExerciseId('DB Bench')).toMatch(/^db-bench-/)
    expect(generateExerciseId('Single Leg RDL')).toMatch(/^single-leg-rdl-/)
  })

  it('collapses special characters in the slug', () => {
    expect(generateExerciseId('Cable Hip Flexion + Leg Extension')).toMatch(/^cable-hip-flexion-leg-extension-/)
  })

  it('trims leading/trailing dashes from the slug', () => {
    expect(generateExerciseId(' Test Exercise ')).toMatch(/^test-exercise-/)
  })

  it('appends a unique suffix so same-named exercises do not collide', () => {
    expect(generateExerciseId('Barbell Back Squat')).not.toBe(generateExerciseId('Barbell Back Squat'))
  })
})

describe('Session duplicate date guard', () => {
  it('allows new date', () => {
    expect(canAddSession([{ date: '2026-09-01' }], '2026-09-02')).toBe(true)
  })

  it('rejects duplicate date', () => {
    expect(canAddSession([{ date: '2026-09-01' }], '2026-09-01')).toBe(false)
  })

  it('allows any date when no Session exists', () => {
    expect(canAddSession([], '2026-09-01')).toBe(true)
  })
})

describe('Sets field parsing', () => {
  it('parses valid numbers', () => {
    expect(parseSets('3')).toBe(3)
    expect(parseSets('10')).toBe(10)
    expect(parseSets('0')).toBe(0)
  })

  it('returns null for empty string', () => {
    expect(parseSets('')).toBeNull()
  })

  it('truncates decimals to an integer set count', () => {
    expect(parseSets('3.5')).toBe(3)
    expect(parseSets('3abc')).toBe(3)
  })

  it('returns null for non-numeric input', () => {
    expect(parseSets('abc')).toBeNull()
  })
})
