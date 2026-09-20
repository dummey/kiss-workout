import { useMemo, useState, memo, useRef } from 'react'
import type { Session } from '../types'

interface CalendarHeatmapProps {
  sessions: Session[]
  months?: number
}

interface DayInfo {
  date: string
  intensity: 0 | 1 | 2 | 3 | 4
  session?: Session
}

function getIntensity(session: Session | undefined): 0 | 1 | 2 | 3 | 4 {
  if (!session) return 0
  const total = session.exercises.length
  if (total === 0) return 0
  const logged = session.exercises.filter(ex => ex.weight || ex.reps).length
  const pct = logged / total
  if (pct >= 1) return 4
  if (pct >= 0.7) return 3
  if (pct >= 0.4) return 2
  return 1
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const CELL = 14
const GAP = 1

function CalendarHeatmap({ sessions, months = 6 }: CalendarHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredDate, setHoveredDate] = useState<{ date: string; x: number; y: number } | null>(null)

  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - months * 30)
    startDate.setDate(startDate.getDate() - startDate.getDay())

    const sessionMap = new Map<string, Session>()
    sessions.forEach(s => sessionMap.set(s.date, s))

    const weeks: DayInfo[][] = []
    const monthData: { label: string; col: number }[] = []
    let currentDate = new Date(startDate)
    let week: DayInfo[] = []
    let lastMonth = -1

    while (currentDate <= today) {
      const dateStr = formatDate(currentDate)
      const session = sessionMap.get(dateStr)
      week.push({ date: dateStr, intensity: getIntensity(session), session })

      if (currentDate.getDate() === 1 || (weeks.length === 0 && week.length === 1)) {
        const label = currentDate.toLocaleString('default', { month: 'short' })
        if (currentDate.getMonth() !== lastMonth) {
          monthData.push({ label, col: weeks.length })
          lastMonth = currentDate.getMonth()
        }
      }

      if (week.length === 7) {
        weeks.push(week)
        week = []
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    if (week.length > 0) {
      while (week.length < 7) week.push({ date: '', intensity: 0 })
      weeks.push(week)
    }

    return { weeks, monthLabels: monthData }
  }, [sessions, months])

  const colors = [
    'var(--surface2)',
    'rgba(78, 203, 113, 0.2)',
    'rgba(78, 203, 113, 0.4)',
    'rgba(78, 203, 113, 0.7)',
    'var(--t3)'
  ]

  const gridWidth = weeks.length * (CELL + GAP) - GAP

  return (
    <div ref={containerRef} style={{ position: 'relative', width: 'fit-content' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
          Training Activity
        </h3>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Less</span>
          {colors.map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c, border: i === 0 ? '1px solid var(--border)' : 'none' }} />
          ))}
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>More</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: GAP, width: gridWidth }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
            {week.map((day, di) => (
              <div
                key={di}
                onMouseEnter={(e) => {
                  if (!day.date) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const containerRect = containerRef.current?.getBoundingClientRect()
                  if (!containerRect) return
                  const x = (rect.left + rect.width / 2) - containerRect.left
                  const y = (rect.top - 8) - containerRect.top
                  setHoveredDate({ date: day.date, x, y })
                }}
                onMouseLeave={() => setHoveredDate(null)}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 2,
                  background: day.date ? colors[day.intensity] : 'var(--surface2)',
                  border: '1px solid var(--border)',
                  cursor: day.date ? 'pointer' : 'default',
                  boxShadow: hoveredDate?.date === day.date ? '0 0 0 2px var(--accent)' : 'none'
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', height: 14, marginTop: 4, width: gridWidth }}>
        {monthLabels.map((m, i) => (
          <span key={i} style={{ position: 'absolute', left: m.col * (CELL + GAP), fontSize: '0.6rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {m.label}
          </span>
        ))}
      </div>

      {hoveredDate && (() => {
        const s = sessions.find(x => x.date === hoveredDate.date)
        if (!s) return null
        const logged = s.exercises.filter(ex => ex.weight || ex.reps).length
        // Clamp tooltip position to stay within container bounds
        const tooltipWidth = 180 // approximate width for clamping
        const tooltipHeight = 28
        const containerWidth = containerRef.current?.offsetWidth ?? gridWidth
        const containerHeight = containerRef.current?.offsetHeight ?? 200
        let left = hoveredDate.x
        let top = hoveredDate.y
        // Horizontal clamping: keep tooltip within container
        const halfWidth = tooltipWidth / 2
        if (left < halfWidth) left = halfWidth
        if (left > containerWidth - halfWidth) left = containerWidth - halfWidth
        // Vertical clamping: if tooltip would go above container, show below cell
        if (top - tooltipHeight < 0) {
          top = hoveredDate.y + tooltipHeight + 8
        }
        return (
          <div style={{
            position: 'absolute',
            left,
            top,
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
            <strong>{s.date}</strong> — {s.workoutName} ({logged}/{s.exercises.length})
          </div>
        )
      })()}
    </div>
  )
}

export default memo(CalendarHeatmap)
