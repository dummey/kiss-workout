import type { Session } from './types'

/**
 * Reads a single number out of a free-text weight/reps field, or null when the
 * field holds no usable number at all.
 *
 * The fields these values come from are `type="text"`, so users legitimately
 * type more than one form:
 *
 *  - a range (`8-10`) — one intent, not two numbers glued together. Volume
 *    needs a single figure, so the midpoint is the honest representative.
 *    The previous digit-strip returned `810` here, inflating a session's
 *    volume ~100x (100 × 810 × 3 = 243,000 lbs) with no visible cause.
 *  - a bare number, optionally with trailing units (`12.5`, `135 lbs`)
 *  - junk (`BW`, `Heavy`) — null, so the caller skips the record
 *
 * Any *other* dash-bearing input is returned as null rather than parsed. The
 * whole point is that a wrong number here is indistinguishable from a right one
 * downstream, so an input we cannot interpret must not silently become one.
 */
export function parseNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '—') return null

  // A well-formed range, e.g. "8-10", "8 - 10", "8–10" (en dash).
  const range = /^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)$/.exec(trimmed)
  if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2

  // A dash that didn't form a range means this isn't one number. Refusing is
  // the safe answer — never concatenate the digits on either side.
  if (/[-–—]/.test(trimmed)) return null

  // One leading number, tolerating trailing units. Only the first number is
  // taken, so "5x3" is 5 rather than 53.
  const single = /^(\d+(?:\.\d+)?)/.exec(trimmed)
  if (!single) return null
  const num = parseFloat(single[1])
  return isNaN(num) ? null : num
}

/**
 * Ordering key for Session dates.
 *
 * Session dates are stored as `YYYY-MM-DD`, but imported/legacy data may use
 * `M/D` or a `M/D - M/D` range (only the first date is used). Anything that
 * matches neither shape sorts to `0000-00-00`, i.e. before every real date.
 *
 * NOTE: bare `M/D` values are pinned to year 2026 because no year is present in
 * that format. Change that constant and the M/D branch silently changes meaning.
 */
export function dateCompare(a: string, b: string): number {
  const parse = (d: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
    if (/^\d{1,2}\/\d{1,2}(\s*-\s*\d{1,2}\/\d{1,2})?$/.test(d)) {
      const main = d.split('-')[0].trim()
      const parts = main.split('/')
      return `2026-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
    }
    return '0000-00-00'
  }
  return parse(a).localeCompare(parse(b))
}

/**
 * Builds the `Exercise.id` for a newly created Exercise: a slug of the name
 * plus a UUID suffix, so two Exercises with the same name never collide.
 */
export function generateExerciseId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug}-${crypto.randomUUID()}`
}

/** Duplicate-date guard: a Session may only be added for a date not already logged. */
export function canAddSession(existingSessions: readonly Pick<Session, 'date'>[], date: string): boolean {
  return !existingSessions.some(s => s.date === date)
}

/** Parses the raw `sets` input of a SessionExercise into a number, or null when blank/unparseable. */
export function parseSets(value: string): number | null {
  if (value === '') return null
  const n = parseInt(value, 10)
  return isNaN(n) ? null : n
}
