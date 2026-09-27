import { describe, it, expect } from 'vitest'
import {
  calculatePlates,
  formatPlateBreakdown,
  parseWeightInput,
  DEFAULT_BARBELL_WEIGHT,
  DEFAULT_PLATES,
  type PlateInventory,
} from '../utils/plates'

// The owner's real kit, and the 35 lb bar they lift with.
const BAR = 35
const SEED: PlateInventory[] = [
  { count: 2, weight: 45 },
  { count: 2, weight: 25 },
  { count: 4, weight: 10 },
  { count: 2, weight: 5 },
  { count: 2, weight: 2.5 },
]

/** Max loadable on the seed kit: bar + both sides of every plate. */
const MAX_LOADABLE = 230

function perSideSum(perSide: { weight: number; count: number }[]): number {
  return perSide.reduce((a, p) => a + p.weight * p.count, 0)
}

describe('parseWeightInput', () => {
  it('accepts plain numbers, including decimals', () => {
    expect(parseWeightInput('135')).toBe(135)
    expect(parseWeightInput('122.5')).toBe(122.5)
    expect(parseWeightInput(' 45 ')).toBe(45)
  })

  // The Weight field is free text and historical seed data holds "BW" and
  // empty strings. Both must be skipped silently, not coerced to 0.
  //
  // "BW" and "abc" are already rejected by Number() returning NaN, so those two
  // alone would not prove the plain-number guard exists. The exponent and hex
  // forms are the cases Number() *does* accept (1e3 -> 1000, 0x10 -> 16) and
  // that the regex is there to reject.
  it.each([
    ['BW', 'bodyweight marker'],
    ['', 'empty'],
    ['abc', 'letters'],
    ['--', 'garbage'],
    ['1.2.3', 'malformed'],
    ['1e3', 'exponent form'],
    ['0x10', 'hex form'],
    ['  45kg', 'trailing unit'],
  ])('rejects %j (%s) so the caller renders nothing', input => {
    expect(parseWeightInput(input as string)).toBeNull()
  })

  it('rejects non-positive values', () => {
    expect(parseWeightInput('0')).toBeNull()
    expect(parseWeightInput('-45')).toBeNull()
  })
})

describe('calculatePlates', () => {
  // The owner's own worked example, and the single most important case here:
  // a naive largest-plate-first greedy strands the 2 lb remainder and fails.
  it('loads 137 as 135 (45 + 5 per side), leaving 2', () => {
    const r = calculatePlates(BAR, SEED, 137)!
    expect(r.total).toBe(135)
    expect(r.leftover).toBe(2)
    expect(perSideSum(r.perSide)).toBe(50)
    expect(r.perSide).toEqual([
      { weight: 45, count: 1 },
      { weight: 5, count: 1 },
    ])
  })

  it('caps at the bar when the target is exactly the bar, with no plates', () => {
    const r = calculatePlates(BAR, SEED, BAR)!
    expect(r.total).toBe(BAR)
    expect(r.perSide).toEqual([])
    expect(r.plateCount).toBe(0)
    expect(r.leftover).toBe(0)
  })

  it('still returns the bar when the target is below it, and claims no leftover', () => {
    // A bar cannot be unloaded, so the floor is the bar itself.
    const r = calculatePlates(BAR, SEED, 34)!
    expect(r.total).toBe(BAR)
    expect(r.perSide).toEqual([])
    expect(r.leftover).toBe(0)
  })

  it('loads the max exactly when the target is the max loadable', () => {
    const r = calculatePlates(BAR, SEED, MAX_LOADABLE)!
    expect(r.total).toBe(MAX_LOADABLE)
    expect(r.leftover).toBe(0)
    // Every plate in the kit, on both sides.
    const kitPerSide = SEED.reduce((a, p) => a + Math.floor(p.count / 2) * p.weight, 0)
    expect(perSideSum(r.perSide)).toBe(kitPerSide)
  })

  it('saturates at the max loadable and reports the shortfall above it', () => {
    const r = calculatePlates(BAR, SEED, 250)!
    expect(r.total).toBe(MAX_LOADABLE)
    expect(r.leftover).toBe(250 - MAX_LOADABLE)
  })

  it('returns null for a non-numeric target so the caller renders nothing', () => {
    expect(calculatePlates(BAR, SEED, NaN)).toBeNull()
    expect(calculatePlates(BAR, SEED, 0)).toBeNull()
    expect(calculatePlates(BAR, SEED, -100)).toBeNull()
  })

  it('floors an odd plate count rather than throwing', () => {
    // Three 45s cannot be split symmetrically, so only one is usable per side.
    const odd: PlateInventory[] = [{ count: 3, weight: 45 }]
    const r = calculatePlates(BAR, odd, 125)!
    expect(r.total).toBe(125)
    expect(r.perSide).toEqual([{ weight: 45, count: 1 }])
  })

  it('handles an empty inventory as a bar-only load', () => {
    const r = calculatePlates(BAR, [], 135)!
    expect(r.total).toBe(BAR)
    expect(r.perSide).toEqual([])
    expect(r.leftover).toBe(135 - BAR)
  })

  // Preferring the fewest plates must not override getting closest to the
  // target: plate count only breaks ties between equal-weight totals.
  it('prefers the heaviest total it can reach, not merely the fewest plates', () => {
    // 10 + 10 (2 plates) and 25 + 5 (2 plates) both weigh 20 per side; the
    // search must return a total that beats the lighter alternative.
    const r = calculatePlates(BAR, SEED, 95)!
    expect(r.total).toBe(95)
    expect(r.leftover).toBe(0)
  })

  it('breaks ties on equal per-side sums by using fewer plates', () => {
    // Per side this stocks 2x10 and 5x5, so 20 lb is reachable as 10+10
    // (2 plates) or four 5s (4 plates). The heavier-total rule cannot break
    // this tie — only the plate count can.
    const tie: PlateInventory[] = [
      { count: 4, weight: 10 },
      { count: 10, weight: 5 },
    ]
    const r = calculatePlates(BAR, tie, BAR + 40)!
    expect(perSideSum(r.perSide)).toBe(20)
    expect(r.plateCount).toBe(2)
  })

  it('never exceeds the target across a wide sweep', () => {
    for (let t = 1; t <= 400; t += 0.5) {
      const r = calculatePlates(BAR, SEED, t)
      if (!r) continue
      if (t < BAR) {
        // Below the bar the floor is the bar itself — it cannot be unloaded —
        // so the only valid answer is the bar with nothing loaded.
        expect(r.total).toBe(BAR)
        expect(r.perSide).toEqual([])
      } else {
        expect(r.total).toBeLessThanOrEqual(t)
      }
      expect(r.leftover).toBeGreaterThanOrEqual(0)
      // The reported breakdown must actually add up to the reported total.
      expect(r.total).toBe(BAR + 2 * perSideSum(r.perSide))
    }
  })

  it('is exact with 2.5 lb plates — no float drift', () => {
    const r = calculatePlates(BAR, SEED, 122.5)!
    expect(r.total).toBe(120)
    expect(r.leftover).toBe(2.5)
    expect(perSideSum(r.perSide)).toBe(42.5)
  })

  it('scales with the bar weight rather than assuming one', () => {
    // A 45 lb bar leaves (137-45)/2 = 46 per side, and a single 45 fits there.
    const r = calculatePlates(45, SEED, 137)!
    expect(r.total).toBe(135)
    expect(r.leftover).toBe(2)
    expect(perSideSum(r.perSide)).toBe(45)
  })
})

describe('formatPlateBreakdown', () => {
  it('shows the per-side list and the shortfall', () => {
    const text = formatPlateBreakdown(calculatePlates(BAR, SEED, 137))
    expect(text).toContain('45 + 5 per side')
    expect(text).toContain('135 (2)')
  })

  it('omits the parenthetical when the target is hit exactly', () => {
    const text = formatPlateBreakdown(calculatePlates(BAR, SEED, 135))!
    expect(text).toBe('45 + 5 per side')
    expect(text).not.toContain('(')
  })

  it('returns null for a null breakdown', () => {
    expect(formatPlateBreakdown(null)).toBeNull()
  })

  it('returns null for a bar-only load with no shortfall, since there is nothing to say', () => {
    expect(formatPlateBreakdown(calculatePlates(BAR, SEED, BAR))).toBeNull()
  })
})

describe('defaults', () => {
  it('exposes a 45 lb default bar and the seed kit', () => {
    expect(DEFAULT_BARBELL_WEIGHT).toBe(45)
    expect(DEFAULT_PLATES.length).toBeGreaterThan(0)
    expect(DEFAULT_PLATES.every(p => p.count >= 2 && p.weight > 0)).toBe(true)
  })
})
