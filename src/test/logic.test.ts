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

// TODO(candidate-01): this block still re-declares the GZCL Progression rule by hand.
// It is the one shadow copy deliberately left in place — `getNextProgression` belongs to the
// tier module that the Candidate 01 extraction will create. Move these assertions to import
// the real implementation at that point and delete the copy below.

// Test GZCL progression logic
describe('GZCL Progression', () => {
  function getNextProgression(tier: string, prevInfo: { weight: string; reps: string; sets: number | string } | null): string {
    if (tier === 'T1') {
      if (prevInfo) {
        const prevReps = prevInfo.reps
        const prevSets = prevInfo.sets
        if (prevSets && prevReps && prevReps !== '—') {
          return 'Try ' + prevInfo.weight + ' x ' + (parseInt(prevReps) + 1) + ' (' + prevSets + ') or add weight'
        }
      }
      return 'Work up to 2-3RM @ 85-100% Goal Weight'
    } else if (tier === 'T2') {
      if (prevInfo && prevInfo.reps && prevInfo.reps !== '—' && parseInt(prevInfo.reps) >= 10) {
        return 'Add weight, drop to 8 reps'
      }
      return 'Target: 8-10 reps @ 65-85% of T1'
    } else if (tier === 'T3') {
      if (prevInfo && prevInfo.reps && prevInfo.reps !== '—' && parseInt(prevInfo.reps) >= 15) {
        return 'Add weight, drop to 10 reps'
      }
      return 'Target: 10-15+ reps @ ≤65%'
    }
    return 'Fill in your target weight, reps, and sets'
  }

  it('suggests rep increase for T1 when previous data exists', () => {
    const result = getNextProgression('T1', { weight: '135', reps: '3', sets: 3 })
    expect(result).toContain('135')
    expect(result).toContain('4')
    expect(result).toContain('or add weight')
  })

  it('gives default T1 guidance without previous data', () => {
    const result = getNextProgression('T1', null)
    expect(result).toContain('2-3RM')
  })

  it('suggests weight increase for T2 when reps hit 10+', () => {
    const result = getNextProgression('T2', { weight: '100', reps: '10', sets: 3 })
    expect(result).toContain('Add weight')
    expect(result).toContain('8 reps')
  })

  it('gives default T2 guidance when reps below 10', () => {
    const result = getNextProgression('T2', { weight: '100', reps: '8', sets: 3 })
    expect(result).toContain('8-10 reps')
  })

  it('suggests weight increase for T3 when reps hit 15+', () => {
    const result = getNextProgression('T3', { weight: '50', reps: '15', sets: 4 })
    expect(result).toContain('Add weight')
    expect(result).toContain('10 reps')
  })

  it('gives default guidance for unknown tier', () => {
    const result = getNextProgression('', null)
    expect(result).toContain('target weight')
  })
})

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
