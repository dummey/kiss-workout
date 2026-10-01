import { useMemo, useState, useRef, memo } from 'react'
import type { CSSProperties } from 'react'
import HeatMap from '@uiw/react-heat-map'
import type { HeatMapValue } from '@uiw/react-heat-map'
import { isLogged } from '../domain/sessionRules'
import type { Session } from '../types'

interface TrainingHeatmapProps {
  sessions: Session[]
  months?: number
}

/**
 * Geometry. These must agree with what we hand the library, because the library
 * derives its column count from the rendered width (see {@link svgWidth}) and we
 * size the `<svg>` from the same numbers.
 */
const RECT_SIZE = 11
const SPACE = 2
/** The library's `leftPad` when `weekLabels` is false — see SVG.js `useState`. */
const LEFT_PAD = 5
/** The library's `monthRectY` when `monthPlacement` is 'bottom'. */
const MONTH_LABEL_Y = 15 * 7 + SPACE
const SVG_HEIGHT = MONTH_LABEL_Y + 14

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Intensity for a day, 0 (nothing logged) to 4 (everything logged).
 *
 * `isLogged` comes from the domain module rather than an inline
 * `weight || reps || failed` so this cell keeps agreeing with the sessions list
 * and with a session's own progression history. `failed` counting as logged is
 * load-bearing: without it a day that was genuinely trained renders as empty.
 */
function intensity(session: Session | undefined): 0 | 1 | 2 | 3 | 4 {
  if (!session) return 0
  const total = session.exercises.length
  if (total === 0) return 0
  const logged = session.exercises.filter(isLogged).length
  const pct = logged / total
  if (pct >= 1) return 4
  if (pct >= 0.7) return 3
  if (pct >= 0.4) return 2
  return 1
}

/**
 * Palette, keyed 0..4.
 *
 * This is a `Record`, not the array form the library accepts, and that is the
 * whole point: the array path runs `convertPanelColors`, which computes
 * `step = ceil(maxCount / (colors.length - 1))`. With zero sessions `maxCount`
 * is 0, so `step` is 0, every entry collapses onto key `0`, and last-write-wins
 * leaves the *darkest* green at `panelColors[0]` — i.e. a brand-new user sees a
 * full year of solid green. The `Record` path skips that conversion entirely.
 *
 * Values are the original `CalendarHeatmap` colours verbatim; dark mode and
 * theming both depend on the CSS vars.
 */
const PANEL_COLORS: Record<number, string> = {
  0: 'var(--surface2)',
  1: 'rgba(78, 203, 113, 0.2)',
  2: 'rgba(78, 203, 113, 0.4)',
  3: 'rgba(78, 203, 113, 0.7)',
  4: 'var(--t3)',
}

const PALETTE_ORDER = [0, 1, 2, 3, 4]

/**
 * The library's `data-date` bucket (`YYYY/M/D`) back to the `YYYY-MM-DD` day
 * string that `Session.date` uses. Only the shape changes; the day is the same.
 */
function bucketToDay(bucket: string): string {
  const [y, m, d] = bucket.split('/')
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

interface HoverTooltip {
  day: string
  left: number
  top: number
}

/** Approximate rendered size of the tooltip, used only to keep it in bounds. */
const TOOLTIP_WIDTH = 180
const TOOLTIP_HEIGHT = 28

function TrainingHeatmap({ sessions, months = 6 }: TrainingHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Position is clamped where it is measured — in the event handler, where the
  // ref is legal to read — so render stays a pure function of props and state.
  const [hovered, setHovered] = useState<HoverTooltip | null>(null)

  const sessionByDate = useMemo(() => {
    const map = new Map<string, Session>()
    sessions.forEach(s => map.set(s.date, s))
    return map
  }, [sessions])

  /**
   * Value items for the library. `date` stays the `YYYY-MM-DD` string from
   * `Session.date` — never a `Date`.
   *
   * The library's `parseDate` treats a date-only string as *local* midnight and
   * `getDateToString` re-serialises it with local getters, so the string
   * round-trips to the same bucket. Passing a `Date` instead would round-trip
   * through the instant's local time and shift a UTC session onto the previous
   * day in any timezone west of UTC.
   */
  const value = useMemo<HeatMapValue[]>(() => {
    const items: HeatMapValue[] = []
    sessionByDate.forEach((session, date) => {
      const level = intensity(session)
      // A session that logged nothing is an empty day, not a level-0 day.
      if (level === 0) return
      items.push({ date, count: level - 1 })
    })
    return items
  }, [sessionByDate])

  /**
   * The window, matching the previous component: `months * 30` days back, then
   * snapped back to the start of the week. The library snaps too
   * (`getStartOfWeek`), so we only pass the unsnapped date.
   */
  const { startDate, endDate, svgWidth } = useMemo(() => {
    const today = new Date()
    const start = new Date(today)
    start.setDate(start.getDate() - months * 30)
    const weekStart = startOfDay(start)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const spanDays = Math.floor((startOfDay(today).getTime() - weekStart.getTime()) / DAY_MS) + 1
    const columns = Math.max(1, Math.ceil(spanDays / 7))
    return {
      startDate: start,
      endDate: today,
      svgWidth: LEFT_PAD + columns * (RECT_SIZE + SPACE),
    }
  }, [months])

  const svgStyle = {
    // The library reads `--rhm-text-color` for the month labels and
    // `--rhm-rect-active` for `:active`; its own defaults are light-theme
    // values that are unreadable (and, on press, bright green) in dark mode.
    '--rhm-text-color': 'var(--muted)',
    '--rhm-rect-active': 'var(--t3)',
  } as CSSProperties

  return (
    <div ref={containerRef} style={{ position: 'relative', width: svgWidth }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
          Training Activity
        </h3>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Less</span>
          {PALETTE_ORDER.map(level => (
            <div
              key={level}
              // The empty swatch keeps its border so level 0 stays visibly
              // distinct from level 1, which is the same hue at low alpha.
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: PANEL_COLORS[level],
                border: level === 0 ? '1px solid var(--border)' : 'none',
              }}
            />
          ))}
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>More</span>
        </div>
      </div>

      <HeatMap
        value={value}
        startDate={startDate}
        endDate={endDate}
        panelColors={PANEL_COLORS}
        rectSize={RECT_SIZE}
        space={SPACE}
        monthPlacement="bottom"
        weekLabels={false}
        // The library's own legend carries no "Less"/"More" wording, so we draw
        // the one above instead of shipping a second, differently-worded legend.
        legendCellSize={0}
        style={{ ...svgStyle, width: svgWidth, height: SVG_HEIGHT }}
        rectRender={(rectProps, item) => {
          const day = bucketToDay(item.date)
          const session = sessionByDate.get(day)
          const total = session?.exercises.length ?? 0
          const logged = session ? session.exercises.filter(isLogged).length : 0
          const label = session
            ? `${day} — ${session.workoutName} (${logged}/${total})`
            : `${day} — no session`

          const showAt = (e: { currentTarget: SVGGElement }) => {
            const container = containerRef.current
            if (!container) return
            const containerRect = container.getBoundingClientRect()
            const rect = e.currentTarget.getBoundingClientRect()
            // Clamp inside the container: the tooltip is centred on the cell, so
            // near either edge it would otherwise overflow.
            const halfWidth = TOOLTIP_WIDTH / 2
            const left = Math.min(
              Math.max(rect.left + rect.width / 2 - containerRect.left, halfWidth),
              Math.max(container.offsetWidth || svgWidth, halfWidth) - halfWidth
            )
            const above = rect.top - 8 - containerRect.top
            // Near the top edge, flipping below the cell is the only way it fits.
            const top = above - TOOLTIP_HEIGHT < 0
              ? above + TOOLTIP_HEIGHT + 8
              : above
            setHovered({ day, left, top })
          }

          // The library emits a bare <rect> with only data-* attributes: no role,
          // no accessible name, not keyboard reachable. It also hands our output
          // straight through instead of wrapping it, so the <g> is ours to make
          // focusable.
          return (
            <g
              tabIndex={0}
              role="img"
              aria-label={label}
              onMouseEnter={showAt}
              onMouseLeave={() => setHovered(null)}
              onFocus={showAt}
              onBlur={() => setHovered(null)}
              style={{ outline: 'none', cursor: 'pointer' }}
            >
              <rect
                {...rectProps}
                stroke={hovered?.day === day ? 'var(--accent)' : 'none'}
                strokeWidth={2}
              />
            </g>
          )
        }}
      />

      {hovered && (() => {
        const session = sessionByDate.get(hovered.day)
        if (!session) return null
        const logged = session.exercises.filter(isLogged).length
        return (
          <div style={{
            position: 'absolute',
            left: hovered.left,
            top: hovered.top,
            transform: 'translate(-50%, -100%)',
            padding: '4px 8px',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontSize: '0.68rem',
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}>
            <strong>{session.date}</strong> — {session.workoutName} ({logged}/{session.exercises.length})
          </div>
        )
      })()}
    </div>
  )
}

export default memo(TrainingHeatmap)
