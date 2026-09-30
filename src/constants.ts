/**
 * Shared display maps.
 *
 * These maps are the single source of truth for how a field is written on
 * screen, for fields that are only ever *displayed*. They live here rather than
 * in a page module so a value rendered in two places cannot drift — the
 * equipment pill, for instance, appears on both the exercise list card and the
 * session detail exercise card, and "Barbell" must read identically in both.
 *
 * This file is deliberately narrow. Anything that encodes a *rule* — which tier
 * exists, how long to rest, whether a logged record counts as logged — belongs
 * in `src/domain/sessionRules.ts`, next to the behaviour it drives, not here.
 * The tier drift this card fixes happened precisely because such rules were
 * copied into page modules; a bare constants file would not have caught it.
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
