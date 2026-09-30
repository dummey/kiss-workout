import type { Session, SessionExercise, Tier } from '../types'

/**
 * Tier semantics and SessionExercise record identity.
 *
 * Everything a caller used to re-derive for itself lives here: how long to rest
 * between sets, what a tier is called on screen, the order tiers render in, how
 * a logged record is matched back to an Exercise, and what counts as logged.
 * These were previously duplicated across `SessionDetailPage`, `WorkoutsPage`,
 * `ExercisesPage`, `CalendarHeatmap`, `SessionsPage` and `context.tsx`, and the
 * copies had already drifted apart.
 *
 * Scope note: GZCL *progression guidance* is deliberately NOT here. That prose
 * is being redesigned from first principles and still lives in `ProgressionInfo`.
 *
 * Scope note 2: rest periods stay hardcoded to GZCL's values. Per `PRD.md`, tiers
 * are a general concept but the scheme is not yet selectable — this module is the
 * seam a future scheme change plugs into, not a parameterisation of it.
 */

/** Rest seconds per tier. GZCL's values. */
const REST_SECONDS: Record<string, number> = {
  T1: 240, // 4 minutes
  T2: 150, // 2.5 minutes
  T3: 75   // 75 seconds
}

/**
 * Rest applied to a tier absent from {@link REST_SECONDS} — which in practice
 * means an untiered exercise. This was the bare `|| 120` at each of the four
 * former read sites; it is a real rule, not a defensive default, so it is named.
 */
export const DEFAULT_REST_SECONDS = 120

/**
 * The tier whose rest period applies to an exercise with no tier. Session detail
 * used to spell this `ex.tier || 'T1'` at each of the two places that start the
 * rest timer; an untiered exercise is timed as a main lift.
 */
export const DEFAULT_REST_TIER: Tier = 'T1'

/** Section heading for each tier. */
const TIER_LABELS: Record<string, string> = {
  T1: 'T1 — Main Lift',
  T2: 'T2 — Primary Accessory',
  T3: 'T3 — Secondary',
  '': 'Other'
}

/**
 * Rest guidance shown under a section heading, in prose rather than seconds —
 * the human-facing restatement of {@link REST_SECONDS}. `''` has none. The two
 * now sit in one file so the number and its prose cannot disagree.
 */
const TIER_REST_PROSE: Record<string, string> = {
  T1: '3–5 minutes between sets',
  T2: '2–3 minutes between sets',
  T3: '60–90 seconds between sets',
  '': ''
}

/**
 * Tiers in render order, plus `''` — the untiered bucket. It is part of the
 * order because sessions and workouts both group exercises into an "Other"
 * section, and a group-by that silently dropped untiered exercises would lose
 * them from the page entirely.
 */
const TIER_ORDER: readonly Tier[] = ['T1', 'T2', 'T3', '']

/** Tiers in render order, untiered last. Returns the shared array — do not mutate. */
export function order(): readonly Tier[] {
  return TIER_ORDER
}

/**
 * Rest period for a tier, in seconds.
 *
 * Takes `string` rather than `Tier` because `SessionExercise.tier` is a plain
 * `string`: sessions snapshot the tier at log time and predate this being a
 * closed union, so a value read back from storage is not statically a `Tier`.
 * Anything not in {@link REST_SECONDS} gets {@link DEFAULT_REST_SECONDS}.
 */
export function restPeriod(tier: string): number {
  return REST_SECONDS[tier] ?? DEFAULT_REST_SECONDS
}

/** Section heading for a tier, e.g. `'T1 — Main Lift'`. */
export function label(tier: string): string {
  return TIER_LABELS[tier] ?? ''
}

/** Rest guidance in prose for a tier, e.g. `'3–5 minutes between sets'`. Empty for untiered. */
export function restProse(tier: string): string {
  return TIER_REST_PROSE[tier] ?? ''
}

/**
 * The `Exercise` id a logged record belongs to.
 *
 * A record duplicated within a session carries a synthetic `<id>-copy-<uuid>` that
 * matches no definition, and keeps a pointer to what it was duplicated from in
 * `originalId`. Prefer that pointer; fall back to the record's own id.
 *
 * Note this is deliberately NOT {@link matchesRecord}: this answers "which
 * definition is this?", where that answers "does this record stand for this
 * exercise?", and a record that is itself a copy answers the second question
 * for its original.
 */
export function definitionId(record: SessionExercise): string {
  return record.originalId ?? record.id
}

/**
 * Whether a logged record stands for the given `Exercise` id.
 *
 * Matches on `id` or `originalId`, so a record logged against a since-deleted
 * exercise — and a record duplicated within its session — still resolves. Used
 * to decide whether an exercise is already in a session, to build a session's
 * history, and to filter the add-exercise picker.
 */
export function matchesRecord(record: SessionExercise, id: string): boolean {
  return record.id === id || record.originalId === id
}

/**
 * Whether a logged record counts as a logged attempt.
 *
 * A record with no weight and no reps was never filled in — unless it is marked
 * `failed`, in which case the attempt happened and failed, which still happened.
 * Skipping failed records here would silently drop a real session from the
 * heatmap, the completion count, and a session's own progression history.
 */
export function isLogged(record: SessionExercise): boolean {
  return Boolean(record.weight || record.reps || record.failed)
}

/**
 * Whether a record may be removed from its session.
 *
 * `exId` is the record's own id, not an `Exercise` id: a duplicated record has
 * its own synthetic id and is removable independently of the record it was
 * duplicated from, so the lookup is by exact id and deliberately does not go
 * through {@link matchesRecord}.
 *
 * A session keeps at least one T1. The last T1 is the main lift and is what the
 * session exists to record, so removing it would leave the session unrepresentable.
 */
export function canRemove(session: Session, exId: string): boolean {
  const ex = session.exercises.find(e => e.id === exId)
  if (!ex) return false

  if (ex.tier === 'T1') {
    const t1Count = session.exercises.filter(e => e.tier === 'T1').length
    if (t1Count <= 1) return false
  }

  return true
}
