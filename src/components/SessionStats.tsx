import React, { useMemo, memo } from 'react'
import type { Session } from '../types'
import { parseNumber } from '../utils'

interface SessionStatsProps {
  sessions: Session[]
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
}

function SessionStats({ sessions }: SessionStatsProps) {
  const stats = useMemo(() => {
    if (!sessions || sessions.length === 0) {
      return {
        totalSessions: 0,
        totalHours: 0,
        totalVolume: 0,
        avgDuration: 0,
        currentStreak: 0
      }
    }

    // Total hours and average duration
    const count = sessions.length
    const totalElapsed = sessions.reduce((sum, s) => sum + (s.elapsedTime || 0), 0)
    const totalHours = totalElapsed / 3600
    const avgDuration = count > 0 ? totalElapsed / count / 60 : 0

    // Total volume: sum(weight × reps × sets) for numeric weights
    let totalVolume = 0
    for (const session of sessions) {
      for (const ex of session.exercises) {
        const weight = parseNumber(ex.weight)
        const reps = parseNumber(ex.reps)
        const sets = ex.sets
        if (weight !== null && reps !== null && sets !== null && sets > 0) {
          totalVolume += weight * reps * sets
        }
      }
    }

    // Current streak: consecutive weeks with ≥1 session
    const sessionDates = sessions.map(s => new Date(s.date)).sort((a, b) => b.getTime() - a.getTime())
    let currentStreak = 0
    const now = new Date()
    const currentWeekStart = new Date(now)
    currentWeekStart.setDate(now.getDate() - now.getDay())
    currentWeekStart.setHours(0, 0, 0, 0)

    let checkWeekStart = new Date(currentWeekStart)
    let dateIndex = 0

    while (true) {
      const weekEnd = new Date(checkWeekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      // Check if any session falls in this week
      let hasSessionInWeek = false
      while (dateIndex < sessionDates.length) {
        const d = sessionDates[dateIndex]
        if (d >= checkWeekStart && d < weekEnd) {
          hasSessionInWeek = true
          dateIndex++
          break
        } else if (d < checkWeekStart) {
          // Session is before this week, skip
          dateIndex++
        } else {
          // Session is after this week
          break
        }
      }

      if (hasSessionInWeek) {
        currentStreak++
        checkWeekStart.setDate(checkWeekStart.getDate() - 7)
      } else {
        break
      }
    }

    return {
      totalHours,
      totalVolume,
      avgDuration,
      currentStreak
    }
  }, [sessions])

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Session Stats</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <StatItem label="Total Hours" value={`${stats.totalHours.toFixed(1)}h`} />
        <StatItem label="Total Volume" value={`${formatNumber(Math.round(stats.totalVolume))} lbs`} />
        <StatItem label="Avg Duration" value={`${stats.avgDuration.toFixed(0)} min`} />
        <StatItem label="Current Streak" value={`${stats.currentStreak} week${stats.currentStreak !== 1 ? 's' : ''}`} />
      </div>
    </div>
  )
}

export default memo(SessionStats)

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 8,
      padding: 12,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>{label}</div>
    </div>
  )
}
