import type { Session } from './types'

export function parseNumber(value: string): number | null {
  if (!value || value === '—') return null
  const cleaned = value.replace(/[^\d.]/g, '')
  if (!cleaned) return null
  const num = parseFloat(cleaned)
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
