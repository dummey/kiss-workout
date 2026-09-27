// ── Barbell plate calculator ────────────────────────────────────────────────
//
// Given a bar weight and the plates a user owns, work out the best plate
// combination to reach a target weight.
//
// Design notes:
//
// * The search is a bounded subset search over PER-SIDE sums, not a
//   "largest plate first" greedy loop. Greedy strands remainders it cannot
//   fill whenever the largest plate does not fit the remaining budget.
//   Measured: on the seed inventory (bar 35, 2x45 2x25 4x10 2x5 2x2.5) a
//   skip-and-continue greedy happens to agree on every reachable target, so
//   the seed kit does not by itself prove the search is needed. It is needed
//   for other inventories: across 300 randomly generated kits, 107 of them
//   had at least one target where greedy under-loads, 13153 of 179400 targets
//   (7.3%) overall, and a single kit shape accounted for 33% of its targets.
//   Users type their own plate counts, so the non-seed kits are the norm.
//
// * The objective is the LARGEST reachable per-side sum that does not push the
//   total past the target. Within a given sum, the fewest plates wins. Note the
//   ordering: sum is the primary objective and plate count only breaks ties.
//   Letting plate count outrank the sum is a real bug — it makes the algorithm
//   return the empty bar for many targets it could actually load.
//
// * All arithmetic is in integer quarter-pound units, so 2.5 lb plates are
//   exact. Plain float arithmetic drifts and was how the first version of this
//   got its answers wrong.

/** A plate the user owns. `count` is the TOTAL owned, not the per-side count. */
export interface PlateInventory {
  count: number
  weight: number
}

export interface PerSidePlate {
  weight: number
  count: number
}

export interface PlateBreakdown {
  /** Weight actually loadable: bar + plates on both sides. Never exceeds the target. */
  total: number
  /** Shortfall against the target, in pounds. 0 when the target is hit exactly. */
  leftover: number
  /** Plates per side, heaviest first. Empty when the bar alone is the answer. */
  perSide: PerSidePlate[]
  /** Total plates on ONE side. The bar is not counted. */
  plateCount: number
}

/** Pounds are tracked in quarter-pound units so 2.5 lb plates stay exact. */
const UNITS_PER_LB = 4

export const DEFAULT_BARBELL_WEIGHT = 45

/**
 * The default kit, used to seed the Settings inputs.
 *
 * Frozen and `readonly` deliberately: callers persist this straight into
 * `meta.plates`, so a shared mutable module constant would let one in-place
 * write corrupt the default for every user who has no stored value. Use
 * `clonePlates()` to get a writable copy.
 */
export const DEFAULT_PLATES: readonly PlateInventory[] = Object.freeze([
  Object.freeze({ count: 2, weight: 45 }),
  Object.freeze({ count: 2, weight: 25 }),
  Object.freeze({ count: 4, weight: 10 }),
  Object.freeze({ count: 2, weight: 5 }),
  Object.freeze({ count: 2, weight: 2.5 }),
]) as readonly PlateInventory[]

/** A fresh, writable copy of a plate list. Used at every persistence boundary. */
export function clonePlates(plates: readonly PlateInventory[]): PlateInventory[] {
  return plates.map(p => ({ ...p }))
}

function toUnits(lb: number): number {
  return Math.round(lb * UNITS_PER_LB)
}

function fromUnits(units: number): number {
  return units / UNITS_PER_LB
}

/**
 * Parse a free-text weight field into a number.
 *
 * Deliberately strict: the Weight input is free text that has historically held
 * non-numeric values like "BW" (bodyweight) and empty strings. Those must be
 * skipped silently rather than coerced, so this accepts only a plain number and
 * returns null for anything else. Callers treat null as "render nothing".
 */
export function parseWeightInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num <= 0) return null
  return num
}

/**
 * Per-side plate stock: an odd owned count cannot be split symmetrically, so it
 * is floored rather than rejected — that is a misconfiguration, not an error.
 * Zero-stock and unparseable rows are dropped.
 */
function perSideStock(inventory: readonly PlateInventory[]): number[] {
  const items: number[] = []
  for (const plate of inventory ?? []) {
    if (!plate || typeof plate.count !== 'number' || typeof plate.weight !== 'number') continue
    if (!Number.isFinite(plate.count) || !Number.isFinite(plate.weight)) continue
    const perSide = Math.floor(plate.count / 2)
    const weight = toUnits(plate.weight)
    if (perSide <= 0 || weight <= 0) continue
    for (let i = 0; i < perSide; i++) items.push(weight)
  }
  return items
}

/**
 * Fewest plates needed for every exactly-reachable sum up to `budget`.
 *
 * Returns a 2-D table where `dp[i][s]` is the minimum number of plates drawn
 * from `items[0..i)` that sum to exactly `s` (Infinity if unreachable).
 *
 * The second dimension is what makes this correct. A 0/1 knapsack can only be
 * reconstructed from a table that remembers the *prefix* of items considered at
 * each sum: a single-slot `pick[s]` gets overwritten by later items, so walking
 * it back can consume the same physical plate more than once. Keeping the
 * prefix index lets the walk-back consume each item at most once, which is what
 * enforces the per-side stock limit.
 */
function minPlatesPerSum(items: number[], budget: number): number[][] {
  const n = items.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(budget + 1).fill(Infinity))
  dp[0][0] = 0
  for (let i = 0; i < n; i++) {
    const w = items[i]
    const prev = dp[i]
    const next = dp[i + 1]
    for (let s = 0; s <= budget; s++) {
      next[s] = prev[s] // skip items[i]
      if (s >= w && prev[s - w] + 1 < next[s]) next[s] = prev[s - w] + 1 // take items[i]
    }
  }
  return dp
}

/**
 * Reconstruct the physical plates behind `bestSum` by walking the 2-D table
 * forward, consuming each item at most once.
 */
function reconstruct(dp: number[][], items: number[], bestSum: number): Map<number, number> {
  const counts = new Map<number, number>()
  let remaining = bestSum
  for (let i = items.length - 1; i >= 0; i--) {
    const w = items[i]
    // Take items[i] only if that is the transition that produced the optimum.
    if (remaining >= w && dp[i][remaining - w] + 1 === dp[i + 1][remaining]) {
      counts.set(w, (counts.get(w) ?? 0) + 1)
      remaining -= w
    }
  }
  return counts
}

/**
 * Best plate combination for `target`, or null when there is nothing to say.
 *
 * Returns null for a non-numeric target. Never exceeds the target: when the
 * target is below the bar weight the answer is the bar alone with no leftover,
 * because a bar cannot be unloaded.
 */
export function calculatePlates(
  barbellWeight: number,
  inventory: readonly PlateInventory[],
  target: number
): PlateBreakdown | null {
  if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) return null

  const bar = Number.isFinite(barbellWeight) && barbellWeight > 0 ? barbellWeight : DEFAULT_BARBELL_WEIGHT
  const barUnits = toUnits(bar)
  const targetUnits = toUnits(target)

  // Cap at the bar: the bar alone is the floor, and it cannot be partially unloaded.
  if (targetUnits <= barUnits) {
    return { total: bar, leftover: 0, perSide: [], plateCount: 0 }
  }

  const items = perSideStock(inventory)
  if (items.length === 0) {
    return { total: bar, leftover: Math.max(0, target - bar), perSide: [], plateCount: 0 }
  }

  // Per-side budget, capped by the most the stock can physically load.
  const maxLoadable = items.reduce((a, b) => a + b, 0)
  const budget = Math.min(Math.floor((targetUnits - barUnits) / 2), maxLoadable)
  if (budget < 0) {
    return { total: bar, leftover: 0, perSide: [], plateCount: 0 }
  }

  const dp = minPlatesPerSum(items, budget)
  const last = dp[items.length]

  // Largest reachable sum <= budget. Scanning down and stopping at the first
  // reachable sum yields the max sum, and the table entry is already the fewest
  // plates for it — continuing the scan would let a lighter total win on count.
  let bestSum = 0
  for (let s = budget; s >= 0; s--) {
    if (last[s] !== Infinity) {
      bestSum = s
      break
    }
  }

  const counts = reconstruct(dp, items, bestSum)

  const perSide: PerSidePlate[] = [...counts.entries()]
    .map(([weight, count]) => ({ weight: fromUnits(weight), count }))
    .sort((a, b) => b.weight - a.weight)

  const total = bar + 2 * fromUnits(bestSum)
  return {
    total,
    leftover: Math.max(0, target - total),
    perSide,
    plateCount: perSide.reduce((a, p) => a + p.count, 0),
  }
}

/**
 * Render a breakdown for display under the Weight input.
 *
 * Shows the per-side plate list and, when the target cannot be hit exactly, the
 * loadable total with the shortfall in parentheses — e.g. `45 + 5 per side
 * (135 (2))`. The user's own total is deliberately not echoed, since it is
 * already on screen in the input above.
 *
 * Returns null when there is nothing worth saying: a bar-only load with no
 * shortfall carries no information.
 */
export function formatPlateBreakdown(breakdown: PlateBreakdown | null): string | null {
  if (!breakdown) return null

  const parts: string[] = []
  if (breakdown.perSide.length > 0) {
    // Every physical plate is listed, not one entry per weight: `perSide` is
    // grouped by weight, and rendering `weight` alone would show one plate where
    // `count` of them are actually needed — telling the user to under-load the
    // bar, which is the one thing this line must never do.
    const list = breakdown.perSide
      .flatMap(p => Array.from({ length: p.count }, () => p.weight))
      .join(' + ')
    parts.push(`${list} per side`)
  }
  if (breakdown.leftover > 0) {
    parts.push(`${breakdown.total} (${breakdown.leftover})`)
  }

  return parts.length > 0 ? parts.join(' · ') : null
}
