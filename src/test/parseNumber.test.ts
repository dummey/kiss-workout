import { describe, it, expect } from 'vitest'
import { parseNumber } from '../utils'

/**
 * Regression cover for the `parseNumber('8-10') === 810` defect: the old
 * digit-strip deleted the hyphen and glued the two numbers together, so a
 * perfectly normal free-text reps entry inflated the session volume ~100x
 * (100 × 810 × 3 = 243,000 lbs) with nothing on screen to explain it.
 *
 * The contract these tests pin down: a range is ONE user intent and yields one
 * number (the midpoint); input that cannot be read as a single number yields
 * null, never a confident guess. Downstream, null means "skip this record" and
 * a wrong number means "silently wrong stats" — the second is far worse.
 */
describe('parseNumber', () => {
  it('parses a bare integer', () => {
    expect(parseNumber('10')).toBe(10)
    expect(parseNumber('0')).toBe(0)
  })

  it('parses a decimal', () => {
    expect(parseNumber('12.5')).toBe(12.5)
    expect(parseNumber('  7.25  ')).toBe(7.25)
  })

  it('takes the midpoint of a reps range instead of concatenating it', () => {
    expect(parseNumber('8-10')).toBe(9)
    // The old implementation returned 810 here.
    expect(parseNumber('8-10')).not.toBe(810)
  })

  it('handles spacing and dash variants in a range', () => {
    expect(parseNumber('8 - 10')).toBe(9)
    expect(parseNumber('8–10')).toBe(9)   // en dash
    expect(parseNumber('8—10')).toBe(9)   // em dash
    expect(parseNumber('8.5-10.5')).toBe(9.5)
  })

  it('returns null for the em-dash placeholder', () => {
    expect(parseNumber('—')).toBeNull()
  })

  it('returns null for an empty or whitespace-only value', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('   ')).toBeNull()
  })

  it('returns null for the non-numeric labels the field really receives', () => {
    expect(parseNumber('BW')).toBeNull()
    expect(parseNumber('Heavy')).toBeNull()
    expect(parseNumber('bodyweight')).toBeNull()
  })

  it('tolerates a unit suffix on a single number', () => {
    expect(parseNumber('135 lbs')).toBe(135)
    expect(parseNumber('22.5kg')).toBe(22.5)
  })

  it('reads only the first number of a compound entry', () => {
    // "5x3" is a set scheme, not 53 reps.
    expect(parseNumber('5x3')).toBe(5)
  })

  it('refuses a malformed multi-number value rather than guessing', () => {
    // "8-10-12" is not a range and not one number — no honest single value.
    expect(parseNumber('8-10-12')).toBeNull()
    expect(parseNumber('-')).toBeNull()
    expect(parseNumber('8-')).toBeNull()
  })

  it('reads only the first number when a slash is not a range', () => {
    // Same rule as "5x3": a leading number plus trailing junk is the first number,
    // never the two glued together the way "8-10" used to become 810.
    expect(parseNumber('8/10')).toBe(8)
  })
})
