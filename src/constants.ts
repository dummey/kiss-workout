/**
 * Shared display constants.
 *
 * These maps are the single source of truth for how an enum-ish value is
 * written on screen. They live here rather than in a page module so that a
 * value rendered in two places cannot drift — the equipment pill, for
 * instance, appears on both the exercise list card and the session detail
 * exercise card, and "Barbell" must read identically in both.
 */

/**
 * Display labels for the `equipment` field.
 *
 * `''` means nothing was declared and is deliberately absent — it renders no
 * pill. Adding a future equipment value is a data change here, not a
 * structural change to any card's markup.
 */
export const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'Barbell',
}
