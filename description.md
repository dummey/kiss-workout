## User request

Exercise reordering (DATA-93, merged in `ea1f477`) currently allows moving exercises across tier boundaries — e.g., a T3 exercise can be swapped above a T2 exercise in the underlying `workout.exercises` array. Visually the tier-grouped display masks this, but the data order becomes inconsistent with the tier grouping.

### Requirement

- `handleMoveExercise` in `WorkoutsPage.tsx` must prevent swaps that would cross a tier boundary.
- The ▲/▼ move buttons must be disabled at tier boundaries (top of a tier = up disabled, bottom of a tier = down disabled), in addition to the existing first/last-of-list guards.
- Tier grouping must remain visually and data-consistent during reordering.

### Context

The workouts screen renders exercises grouped by tier (`T1`, `T2`, `T3`, `Other`) via `tierOrder` (line 84). Each card's move buttons currently use `globalIdx = workout.exercises.indexOf(ex.id)` to determine position, and the `disabled` checks only guard the first and last items of the entire workout (`globalIdx === 0` and `globalIdx === workout.exercises.length - 1`). There is no tier-boundary check.

**Files to modify:**
- `src/pages/WorkoutsPage.tsx` — `handleMoveExercise` (lines 25–35) and the button `disabled`/`opacity` logic (lines 183–198)

**Suggested approach:**
- Compute the exercise's position within its tier group (not just the global index) and use that to determine whether a move stays within the same tier.
- The `handleMoveExercise` function should return early if the swap would cross tiers (i.e., the adjacent item at `swapIdx` has a different `tier` value).
- The button `disabled` and opacity checks should additionally consider tier boundaries.

This is a follow-up to the already-merged DATA-93 feature. Build, tests, and lint should continue to pass.
