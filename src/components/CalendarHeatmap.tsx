import { useMemo, useState } from 'react'
import type { Session } from '../types'

interface CalendarHeatmapProps {
  sessions: Session[]
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

export default function CalendarHeatmap({ sessions }: CalendarHeatmapProps) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  const { weeks, months } = useMemo(() => {
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 365)

    // Align to Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay())

    const sessionMap = new Map<string, Session>()
    sessions.forEach(s => sessionMap.set(s.date, s))

    const weeks: DayInfo[][] = []
    const months: { label: string; colStart: number }[] = []
    let currentDate = new Date(startDate)
    let week: DayInfo[] = []
    let lastMonth = -1

    while (currentDate <= today) {
      const dateStr = formatDate(currentDate)
      const session = sessionMap.get(dateStr)
      const dayInfo: DayInfo = {
        date: dateStr,
        intensity: getIntensity(session),
        session
      }

      if (currentDate.getDate() === 1 || (weeks.length === 0 && week.length === 0)) {
        const monthLabel = currentDate.toLocaleString('default', { month: 'short' })
        if (currentDate.getMonth() !== lastMonth) {
          months.push({ label: monthLabel, colStart: weeks.length })
          lastMonth = currentDate.getMonth()
        }
      }

      week.push(dayInfo)
      if (week.length === 7) {
        weeks.push(week)
        week = []
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    if (week.length > 0) {
      while (week.length < 7) {
        week.push({ date: '', intensity: 0 })
      }
      weeks.push(week)
    }

    return { weeks, months }
  }, [sessions])

  const intensityColors = [
    'var(--surface2)',  // 0 - no session
    'rgba(78, 203, 113, 0.2)',  // 1 - light
    'rgba(78, 203, 113, 0.4)',  // 2 - medium
    'rgba(78, 203, 113, 0.7)',  // 3 - high
    'var(--t3)'   // 4 - complete
  ]

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--radius)',
      padding: 16,
      marginBottom: 24,
      position: 'relative'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 700 }}>
          Training Activity
        </h3>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)', marginRight: 4 }}>Less</span>
          {intensityColors.map((color, i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: color,
                border: i === 0 ? '1px solid var(--border)' : 'none'
              }}
            />
          ))}
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)', marginLeft: 4 }}>More</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, overflow: 'hidden' }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 16 }}>
          {dayLabels.map((label, i) => (
            <div key={i} style={{ height: 12, fontSize: '0.6rem', color: 'var(--muted)', lineHeight: '12px' }}>
              {i % 2 === 1 ? label : ''}
            </div>
          ))}
        </div>

        {/* Months and weeks */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {/* Month labels */}
          <div style={{ display: 'flex', height: 12, marginBottom: 4, position: 'relative' }}>
            {months.map((month, i) => (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: `${month.colStart * 14}px`,
                  fontSize: '0.6rem',
                  color: 'var(--muted)',
                  whiteSpace: 'nowrap'
                }}
              >
                {month.label}
              </span>
            ))}
          </div>

          {/* Week columns */}
          <div style={{ display: 'flex', gap: 3 }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {week.map((day, di) => (
                  <div
                    key={di}
                    onMouseEnter={() => day.date && setHoveredDate(day.date)}
                    onMouseLeave={() => setHoveredDate(null)}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      background: day.date ? intensityColors[day.intensity] : 'transparent',
                      border: day.date ? 'none' : '1px solid transparent',
                      cursor: day.date ? 'pointer' : 'default',
                      boxShadow: hoveredDate === day.date ? '0 0 0 2px var(--accent)' : 'none'
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredDate && (() => {
        const session = sessions.find(s => s.date === hoveredDate)
        if (!session) return null
        const logged = session.exercises.filter(ex => ex.weight || ex.reps).length
        return (
          <div style={{
            position: 'absolute',
            bottom: -40,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: '0.72rem',
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            zIndex: 10
          }}>
            <strong>{session.date}</strong> — {session.workoutName}
            <span style={{ color: 'var(--muted)', marginLeft: 8 }}>
              {logged}/{session.exercises.length} exercises
              {session.elapsedTime ? ` • ${Math.floor(session.elapsedTime / 60)}m` : ''}
            </span>
          </div>
        )
      })()}
    </div>
  )
}
