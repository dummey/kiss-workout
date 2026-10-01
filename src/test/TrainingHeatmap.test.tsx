import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TrainingHeatmap from '../components/TrainingHeatmap'
import type { Session, SessionExercise } from '../types'

/**
 * @uiw/react-heat-map derives its column count from the *measured* width of its
 * `<svg>`: `gridNum = floor((clientWidth - leftPad) / (rectSize + space))`. jsdom
 * reports `clientWidth === 0` for every element, so the real grid renders zero
 * day cells and every assertion below would pass vacuously against an empty
 * DOM. Stub the measurement, and `expectDayCells` re-asserts that the stub
 * actually took effect before any other assertion is trusted.
 */
let widthSpy: ReturnType<typeof vi.spyOn> | undefined

const STUBBED_WIDTH = 900

beforeEach(() => {
  widthSpy = vi.spyOn(SVGElement.prototype, 'clientWidth', 'get').mockReturnValue(STUBBED_WIDTH)
})

afterEach(() => {
  widthSpy?.mockRestore()
  widthSpy = undefined
})

/**
 * A `YYYY-MM-DD` day string `n` days from today, formatted the way the grid
 * buckets days: local calendar fields. Offsets rather than literal dates keep
 * the fixtures inside the default 6-month window whenever the suite runs.
 */
function dayOffset(n: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + n)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/**
 * The grid's `data-date` form of a `YYYY-MM-DD` day string: `YYYY/M/D`, with the
 * month and day *not* zero-padded.
 */
function bucket(day: string): string {
  const [y, m, d] = day.split('-')
  return `${y}/${Number(m)}/${Number(d)}`
}

function exercise(over: Partial<SessionExercise> & { id: string; name: string }): SessionExercise {
  return {
    muscles: ['Chest'],
    setup: 'Barbell',
    tier: 'T1',
    superset: '',
    weight: '',
    reps: '',
    sets: null,
    ...over,
  }
}

function session(date: string, name: string, exercises: SessionExercise[]): Session {
  return { date, workoutName: name, elapsedTime: 3000, notes: '', exercises }
}

const LOGGED = exercise({ id: 'squat', name: 'Back Squat', weight: '225', reps: '5', sets: 3 })
const FAILED = exercise({ id: 'bench', name: 'Bench Press', failed: true })
const UNTOUCHED = exercise({ id: 'dl', name: 'Deadlift' })

function dayCells(): SVGRectElement[] {
  return Array.from(document.querySelectorAll<SVGRectElement>('rect[data-date]'))
}

/**
 * Guard against the width stub silently failing to apply: no day cells means the
 * grid never sized, so nothing rendered below would be evidence of anything.
 */
function expectDayCells(min = 20): SVGRectElement[] {
  const cells = dayCells()
  expect(cells.length).toBeGreaterThan(min)
  return cells
}

function fillOf(day: string): string {
  const cell = document.querySelector<SVGRectElement>(`rect[data-date="${bucket(day)}"]`)
  expect(cell, `no day cell for ${day}`).toBeTruthy()
  return cell!.getAttribute('fill') ?? ''
}

describe('TrainingHeatmap', () => {
  it('renders the heading and legend', () => {
    render(<TrainingHeatmap sessions={[]} />)
    expect(screen.getByText('Training Activity')).toBeInTheDocument()
    expect(screen.getByText('Less')).toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()
    expectDayCells()
  })

  it('renders month labels', () => {
    render(<TrainingHeatmap sessions={[]} />)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    expect(months.some(m => screen.queryByText(m))).toBe(true)
  })

  // Defect 1 — the empty-state palette collapse. `convertPanelColors` derives its
  // key spacing from `Math.ceil(maxCount / 4)`, so with zero sessions every
  // palette entry collapses onto key 0 and the *darkest* green ends up on every
  // empty day. A new user would see a full year that looks fully trained.
  it('paints every empty day as the neutral surface colour, not the darkest green', () => {
    render(<TrainingHeatmap sessions={[]} />)
    expectDayCells()
    const fills = new Set(dayCells().map(c => c.getAttribute('fill')))
    expect([...fills]).toEqual(['var(--surface2)'])
  })

  it('paints days without a session neutrally while painting trained days green', () => {
    const day = dayOffset(-3)
    render(<TrainingHeatmap sessions={[session(day, 'Squat Day', [LOGGED])]} />)
    expectDayCells()
    expect(fillOf(dayOffset(-4))).toBe('var(--surface2)')
    expect(fillOf(day)).toBe('var(--t3)')
  })

  // Defect 2 — the library emits bare <rect>s: no role, no name, unreachable by
  // keyboard.
  it('gives every day cell a role, an accessible name and keyboard reachability', () => {
    render(<TrainingHeatmap sessions={[]} />)
    expectDayCells()
    const cells = screen.getAllByRole('img')
    expect(cells.length).toBe(dayCells().length)
    for (const cell of cells) {
      expect(cell.getAttribute('tabindex')).toBe('0')
      expect(cell.getAttribute('aria-label')).toMatch(/^\d{4}-\d{2}-\d{2} — /)
    }
  })

  it('names a trained cell with its workout and logged count', () => {
    const day = dayOffset(-5)
    render(<TrainingHeatmap sessions={[session(day, 'Squat Day', [LOGGED, FAILED])]} />)
    expectDayCells()
    expect(screen.getByLabelText(`${day} — Squat Day (2/2)`)).toBeInTheDocument()
  })

  it('names an untrained cell as having no session', () => {
    render(<TrainingHeatmap sessions={[]} />)
    expectDayCells()
    expect(screen.getByLabelText(`${dayOffset(-5)} — no session`)).toBeInTheDocument()
  })

  // Defect 3 — the library buckets days with local-time getters, so a UTC
  // `Session.date` handed over as a `Date` lands on the previous day west of UTC.
  // The wrapper passes the date-only string instead, which the library parses
  // into a *local* midnight and re-serialises unchanged.
  it('buckets a UTC session onto its own day, not the day before', () => {
    const day = dayOffset(-6)
    render(<TrainingHeatmap sessions={[session(day, 'Bench Day', [LOGGED])]} />)
    expectDayCells()
    expect(fillOf(day)).toBe('var(--t3)')
    expect(fillOf(dayOffset(-7))).toBe('var(--surface2)')
  })

  it('maps partial completion onto the intermediate palette levels', () => {
    const full = dayOffset(-10)
    const mostly = dayOffset(-11)
    const partly = dayOffset(-12)
    const barely = dayOffset(-13)
    render(<TrainingHeatmap
      sessions={[
        // 1 of 1 logged -> 100% -> level 4
        session(full, 'Full', [LOGGED]),
        // 3 of 4 logged -> 75% -> level 3
        session(mostly, 'Mostly', [LOGGED, FAILED, LOGGED, UNTOUCHED]),
        // 2 of 3 logged -> 67% -> level 2
        session(partly, 'Partly', [LOGGED, FAILED, UNTOUCHED]),
        // 1 of 3 logged -> 33% -> level 1
        session(barely, 'Barely', [LOGGED, UNTOUCHED, UNTOUCHED]),
      ]}
    />)
    expectDayCells()
    expect(fillOf(full)).toBe('var(--t3)')
    expect(fillOf(mostly)).toBe('rgba(78, 203, 113, 0.7)')
    expect(fillOf(partly)).toBe('rgba(78, 203, 113, 0.4)')
    expect(fillOf(barely)).toBe('rgba(78, 203, 113, 0.2)')
  })

  // A session that recorded nothing still lands on the *lowest* level rather
  // than the empty swatch — the pre-existing rule, preserved deliberately. The
  // load-bearing half is that its tooltip reads 0/1, asserted below.
  it('shows 0/1 in the tooltip for a session where nothing was recorded', () => {
    const day = dayOffset(-14)
    render(<TrainingHeatmap sessions={[session(day, 'Nothing', [UNTOUCHED])]} />)
    expectDayCells()
    fireEvent.mouseOver(screen.getByLabelText(`${day} — Nothing (0/1)`))
    expect(screen.getByText(day).parentElement).toHaveTextContent('— Nothing (0/1)')
  })

  it('treats a session with no exercises as an empty day', () => {
    const day = dayOffset(-15)
    render(<TrainingHeatmap sessions={[session(day, 'Empty', [])]} />)
    expectDayCells()
    expect(fillOf(day)).toBe('var(--surface2)')
  })

  it('honours the months prop by narrowing the window', () => {
    const { unmount } = render(<TrainingHeatmap sessions={[]} months={1} />)
    const oneMonth = expectDayCells().length
    unmount()
    render(<TrainingHeatmap sessions={[]} months={6} />)
    expect(expectDayCells().length).toBeGreaterThan(oneMonth)
  })

  it('shows the tooltip with the logged count on hover', () => {
    const day = dayOffset(-16)
    render(<TrainingHeatmap sessions={[session(day, 'Squat Day', [LOGGED, UNTOUCHED])]} />)
    fireEvent.mouseOver(screen.getByLabelText(`${day} — Squat Day (1/2)`))
    // The tooltip's <strong> holds the date; its parent holds the whole line.
    expect(screen.getByText(day).parentElement).toHaveTextContent('— Squat Day (1/2)')
  })

  it('shows the tooltip when a cell is focused from the keyboard', () => {
    const day = dayOffset(-17)
    render(<TrainingHeatmap sessions={[session(day, 'Squat Day', [LOGGED, FAILED])]} />)
    fireEvent.focus(screen.getByLabelText(`${day} — Squat Day (2/2)`))
    expect(screen.getByText(day).parentElement).toHaveTextContent('— Squat Day (2/2)')
  })
})
