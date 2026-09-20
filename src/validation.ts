import type { Session, TrackerData, Exercise, Workout } from './types'

// ── Validation helpers ──────────────────────────────────────────────────────

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function isArrayOfStrings(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString)
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && !isNaN(v)
}

// ── SessionExercise validation ──────────────────────────────────────────────

function validateSessionExercise(ex: unknown, index: number): string | null {
  if (!ex || typeof ex !== 'object') {
    return `Exercise #${index + 1} is not an object`
  }
  const e = ex as Record<string, unknown>
  if (!isString(e.id)) return `Exercise #${index + 1}: missing or invalid 'id'`
  if (!isString(e.name)) return `Exercise #${index + 1}: missing or invalid 'name'`
  if (!isArrayOfStrings(e.muscles)) return `Exercise #${index + 1}: 'muscles' must be an array of strings`
  if (!isString(e.tier)) return `Exercise #${index + 1}: missing or invalid 'tier'`
  return null
}

// ── Session validation (for single session import) ──────────────────────────

export function validateSession(data: unknown): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Session data is not an object' }
  }
  const s = data as Record<string, unknown>

  if (!isNonEmptyString(s.date)) {
    return { valid: false, error: 'Missing or empty session date' }
  }
  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date as string)) {
    return { valid: false, error: `Invalid date format '${s.date}'. Expected YYYY-MM-DD` }
  }

  if (!isNonEmptyString(s.workoutName)) {
    return { valid: false, error: 'Missing or empty workout name' }
  }

  if (!Array.isArray(s.exercises)) {
    return { valid: false, error: 'Missing or invalid exercises array' }
  }

  if ((s.exercises as unknown[]).length === 0) {
    return { valid: false, error: 'Exercises array is empty' }
  }

  for (let i = 0; i < (s.exercises as unknown[]).length; i++) {
    const err = validateSessionExercise((s.exercises as unknown[])[i], i)
    if (err) return { valid: false, error: err }
  }

  // Optional fields type-check
  if (s.notes !== undefined && s.notes !== null && !isString(s.notes)) {
    return { valid: false, error: `Field 'notes' must be a string` }
  }
  if (s.elapsedTime !== undefined && s.elapsedTime !== null && !isNumber(s.elapsedTime)) {
    return { valid: false, error: `Field 'elapsedTime' must be a number` }
  }

  return { valid: true }
}

// ── Exercise validation ─────────────────────────────────────────────────────

function validateExercise(ex: unknown, index: number): string | null {
  if (!ex || typeof ex !== 'object') {
    return `Exercise #${index + 1} is not an object`
  }
  const e = ex as Record<string, unknown>
  if (!isNonEmptyString(e.id)) return `Exercise #${index + 1}: missing or empty 'id'`
  if (!isNonEmptyString(e.name)) return `Exercise #${index + 1}: missing or empty 'name'`
  if (!isArrayOfStrings(e.muscles)) return `Exercise #${index + 1}: 'muscles' must be an array of strings`
  if (!isString(e.setup)) return `Exercise #${index + 1}: missing or invalid 'setup'`
  if (!isString(e.superset)) return `Exercise #${index + 1}: missing or invalid 'superset'`
  if (!isString(e.tier)) return `Exercise #${index + 1}: missing or invalid 'tier'`
  return null
}

// ── Workout validation ──────────────────────────────────────────────────────

function validateWorkout(w: unknown, index: number): string | null {
  if (!w || typeof w !== 'object') {
    return `Workout #${index + 1} is not an object`
  }
  const wo = w as Record<string, unknown>
  if (!isNonEmptyString(wo.name)) return `Workout #${index + 1}: missing or empty 'name'`
  if (!isArrayOfStrings(wo.exercises)) return `Workout #${index + 1}: 'exercises' must be an array of strings`
  return null
}

// ── TrackerData validation (for full backup import) ─────────────────────────

export function validateTrackerData(data: unknown): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Backup data is not an object' }
  }
  const d = data as Record<string, unknown>

  // Validate meta
  if (!d.meta || typeof d.meta !== 'object') {
    return { valid: false, error: `Missing or invalid 'meta' object` }
  }
  const meta = d.meta as Record<string, unknown>
  if (!isString(meta.method)) return { valid: false, error: `meta.method must be a string` }
  if (!isString(meta.created)) return { valid: false, error: `meta.created must be a string` }

  // Validate exercises array
  if (!Array.isArray(d.exercises)) {
    return { valid: false, error: 'Missing or invalid exercises array' }
  }
  for (let i = 0; i < (d.exercises as unknown[]).length; i++) {
    const err = validateExercise((d.exercises as unknown[])[i], i)
    if (err) return { valid: false, error: err }
  }

  // Validate workouts array
  if (!Array.isArray(d.workouts)) {
    return { valid: false, error: 'Missing or invalid workouts array' }
  }
  for (let i = 0; i < (d.workouts as unknown[]).length; i++) {
    const err = validateWorkout((d.workouts as unknown[])[i], i)
    if (err) return { valid: false, error: err }
  }

  // Validate sessions array
  if (!Array.isArray(d.sessions)) {
    return { valid: false, error: 'Missing or invalid sessions array' }
  }
  for (let i = 0; i < (d.sessions as unknown[]).length; i++) {
    const result = validateSession((d.sessions as unknown[])[i])
    if (!result.valid) {
      return { valid: false, error: `Session #${i + 1}: ${result.error}` }
    }
  }

  return { valid: true }
}
