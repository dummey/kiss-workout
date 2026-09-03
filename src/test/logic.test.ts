import { describe, it, expect } from 'vitest'

// Test the date comparison logic from context
function dateCompare(a: string, b: string): number {
  const parse = (d: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
    if (/^\d{1,2}\/\d{1,2}(\s*-\s*\d{1,2}\/\d{1,2})?$/.test(d)) {
      const main = d.split('-')[0].trim()
      const parts = main.split('/')
      return `2026-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`
    }
    return '0000-00-00'
  }
  return parse(a).localeCompare(parse(b))
}

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

// Test exercise ID generation slug logic
describe('Exercise ID generation', () => {
  function generateId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  it('generates slug from exercise name', () => {
    expect(generateId('Barbell Back Squat')).toBe('barbell-back-squat')
    expect(generateId('DB Bench')).toBe('db-bench')
    expect(generateId('Single Leg RDL')).toBe('single-leg-rdl')
  })

  it('handles special characters', () => {
    expect(generateId('Cable Hip Flexion + Leg Extension')).toBe('cable-hip-flexion-leg-extension')
  })

  it('trims leading/trailing dashes', () => {
    expect(generateId(' Test Exercise ')).toBe('test-exercise')
  })
})

// Test duplicate detection for session dates
describe('Session duplicate date guard', () => {
  function canAddSession(existingSessions: { date: string }[], date: string): boolean {
    return !existingSessions.some(s => s.date === date)
  }

  it('allows new date', () => {
    expect(canAddSession([{ date: '2026-09-01' }], '2026-09-02')).toBe(true)
  })

  it('rejects duplicate date', () => {
    expect(canAddSession([{ date: '2026-09-01' }], '2026-09-01')).toBe(false)
  })
})

// Test parseInt for sets field
describe('Sets field parsing', () => {
  function parseSets(value: string): number | null {
    if (value === '') return null
    const n = parseInt(value, 10)
    return isNaN(n) ? null : n
  }

  it('parses valid numbers', () => {
    expect(parseSets('3')).toBe(3)
    expect(parseSets('10')).toBe(10)
    expect(parseSets('0')).toBe(0)
  })

  it('returns null for empty string', () => {
    expect(parseSets('')).toBeNull()
  })

  it('returns null for non-numeric input', () => {
    expect(parseSets('abc')).toBeNull()
  })
})
