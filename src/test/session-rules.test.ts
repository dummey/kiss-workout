import { describe, it, expect } from 'vitest'
import {
  canRemove,
  definitionId,
  isLogged,
  label,
  matchesRecord,
  order,
  restPeriod,
  restProse,
  DEFAULT_REST_SECONDS,
  DEFAULT_REST_TIER
} from '../domain/sessionRules'
import type { Session, SessionExercise } from '../types'

function record(overrides: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: 'bench-press',
    name: 'Bench Press',
    muscles: ['Chest'],
    setup: '',
    tier: 'T2',
    superset: '',
    weight: '',
    reps: '',
    sets: null,
    ...overrides
  }
}

function session(exercises: SessionExercise[]): Session {
  return { date: '2026-09-30', workoutName: 'Bench', elapsedTime: 0, notes: '', exercises }
}

// Tier values that resolve up Object.prototype's chain instead of missing from a
// table. restPeriod/label/restProse all take `string` because a stored tier is
// not statically a `Tier`, so these are values a hand-edited or third-party
// session JSON could carry.
const PROTOTYPE_KEYS = ['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__']

describe('restPeriod', () => {
  it("returns GZCL's rest period for each tier", () => {
    expect(restPeriod('T1')).toBe(240)
    expect(restPeriod('T2')).toBe(150)
    expect(restPeriod('T3')).toBe(75)
  })

  it('falls back to the default for an untiered exercise', () => {
    expect(restPeriod('')).toBe(DEFAULT_REST_SECONDS)
    expect(restPeriod('')).toBe(120)
  })

  it('falls back to the default for a tier it does not know', () => {
    // Sessions snapshot tier as a plain string, so an unrecognised value from
    // stored or imported data must not produce NaN or Infinity.
    expect(restPeriod('T9')).toBe(DEFAULT_REST_SECONDS)
  })

  it('falls back to the default for a tier naming an Object.prototype member', () => {
    // `??` catches only null/undefined, and an inherited member is neither, so a
    // plain object table hands one straight back. SessionDetailPage then computes
    // `restSeconds - elapsed`, and a function minus a number is NaN — the rest
    // clock renders "NaN:NaN". Asserted on value and type, never on truthiness:
    // a function IS truthy, so a truthiness assertion would pass here even though
    // the code is broken.
    for (const key of PROTOTYPE_KEYS) {
      expect(restPeriod(key)).toBe(DEFAULT_REST_SECONDS)
      expect(typeof restPeriod(key)).toBe('number')
    }
  })

  it('times an untiered exercise as a T1 main lift', () => {
    expect(restPeriod(DEFAULT_REST_TIER)).toBe(restPeriod('T1'))
  })
})

describe('order', () => {
  it('lists tiers T1 -> T2 -> T3, untiered last', () => {
    expect(order()).toEqual(['T1', 'T2', 'T3', ''])
  })

  it('includes the untiered bucket so those exercises are still grouped', () => {
    expect(order()).toContain('')
  })
})

describe('label', () => {
  it('names each tier', () => {
    expect(label('T1')).toBe('T1 — Main Lift')
    expect(label('T2')).toBe('T2 — Primary Accessory')
    expect(label('T3')).toBe('T3 — Secondary')
    expect(label('')).toBe('Other')
  })

  it('has a label for every tier in order(), so no group renders a blank heading', () => {
    for (const tier of order()) {
      expect(label(tier)).not.toBe('')
    }
  })

  it('returns an empty string, not an inherited member, for a tier it does not know', () => {
    // Severity differs from restPeriod here: a function handed to a render is a
    // hard React crash ("Functions are not valid as a React child"), failing the
    // whole page rather than one field showing nonsense.
    for (const key of [...PROTOTYPE_KEYS, 'T9']) {
      expect(label(key)).toBe('')
      expect(typeof label(key)).toBe('string')
    }
  })
})

describe('restProse', () => {
  it('states the rest guidance in prose for each tier', () => {
    expect(restProse('T1')).toBe('3–5 minutes between sets')
    expect(restProse('T2')).toBe('2–3 minutes between sets')
    expect(restProse('T3')).toBe('60–90 seconds between sets')
  })

  it('has no rest prose for an untiered exercise', () => {
    expect(restProse('')).toBe('')
  })

  it('returns an empty string, not an inherited member, for a tier it does not know', () => {
    for (const key of [...PROTOTYPE_KEYS, 'T9']) {
      expect(restProse(key)).toBe('')
      expect(typeof restProse(key)).toBe('string')
    }
  })

  it('agrees with restPeriod: every tier with prose has a real period', () => {
    for (const tier of order()) {
      if (restProse(tier)) {
        expect(restPeriod(tier)).toBeGreaterThan(0)
        expect(restPeriod(tier)).not.toBe(DEFAULT_REST_SECONDS)
      }
    }
  })
})

describe('matchesRecord', () => {
  it('matches a record by its own id', () => {
    expect(matchesRecord(record({ id: 'squat' }), 'squat')).toBe(true)
  })

  it('matches a duplicated record through originalId', () => {
    const copy = record({ id: 'squat-copy-abc', originalId: 'squat' })
    expect(matchesRecord(copy, 'squat')).toBe(true)
  })

  it('does not match an unrelated exercise', () => {
    expect(matchesRecord(record(), 'deadlift')).toBe(false)
  })

  it('does not match a different copy of the same exercise', () => {
    // A second copy points at the same original, so both match the original id
    // but neither matches the other's synthetic id.
    const a = record({ id: 'squat-copy-aaa', originalId: 'squat' })
    const b = record({ id: 'squat-copy-bbb', originalId: 'squat' })
    expect(matchesRecord(a, 'squat-copy-bbb')).toBe(false)
  })
})

describe('definitionId', () => {
  it('is the record id for a normal record', () => {
    expect(definitionId(record({ id: 'squat' }))).toBe('squat')
  })

  it('is the original id for a duplicated record, whose own id matches no definition', () => {
    expect(definitionId(record({ id: 'squat-copy-abc', originalId: 'squat' }))).toBe('squat')
  })
})

describe('isLogged', () => {
  it('is false for a record with nothing filled in', () => {
    expect(isLogged(record())).toBe(false)
  })

  it('is true once a weight is recorded', () => {
    expect(isLogged(record({ weight: '135' }))).toBe(true)
  })

  it('is true once reps are recorded', () => {
    expect(isLogged(record({ reps: '5' }))).toBe(true)
  })

  it('counts a failed-only record as logged — the attempt happened', () => {
    expect(isLogged(record({ failed: true }))).toBe(true)
  })
})

describe('canRemove', () => {
  it('allows removing a non-T1 record', () => {
    expect(canRemove(session([record({ id: 'a', tier: 'T2' })]), 'a')).toBe(true)
  })

  it('refuses to remove the last T1', () => {
    expect(canRemove(session([record({ id: 'squat', tier: 'T1' })]), 'squat')).toBe(false)
  })

  it('allows removing a T1 while another T1 remains', () => {
    const s = session([
      record({ id: 'squat', tier: 'T1' }),
      record({ id: 'bench', tier: 'T1' })
    ])
    expect(canRemove(s, 'squat')).toBe(true)
  })

  it('refuses for a record that is not in the session', () => {
    expect(canRemove(session([record({ id: 'a' })]), 'missing')).toBe(false)
  })

  it('treats a duplicated T1 as a T1 when applying the last-T1 guard', () => {
    // The guard counts T1 *records*, not distinct Exercises. `duplicateExerciseInSession`
    // snapshots the tier onto the copy, so a duplicated T1 satisfies "keep one T1"
    // and either half can be removed. Preserved as-is: this extraction moves rules,
    // it does not redefine them.
    const s = session([
      record({ id: 'squat', tier: 'T1' }),
      record({ id: 'squat-copy-abc', originalId: 'squat', tier: 'T1' })
    ])
    expect(canRemove(s, 'squat-copy-abc')).toBe(true)
    expect(canRemove(s, 'squat')).toBe(true)
  })

  it('still refuses once the last T1 record is the one being removed', () => {
    const s = session([
      record({ id: 'squat', tier: 'T1' }),
      record({ id: 'bench', tier: 'T2' })
    ])
    expect(canRemove(s, 'squat')).toBe(false)
    expect(canRemove(s, 'bench')).toBe(true)
  })
})
