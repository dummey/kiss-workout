import React, { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTracker } from '../context'
import Button from '../components/Button'
import CalendarHeatmap from '../components/CalendarHeatmap'
import type { Session } from '../types'

type SortDirection = 'desc' | 'asc'

export default function SessionsPage() {
  const { data, loading, addSession, deleteSession } = useTracker()
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [workout, setWorkout] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  useEffect(() => {
    if (!workout || !data?.workouts.some(w => w.name === workout)) {
      setWorkout(data?.workouts[0]?.name || '')
    }
  }, [data?.workouts])

  const filteredSessions = useMemo(() => {
    const sessions = searchQuery.trim()
      ? (data?.sessions || []).filter(session =>
          session.date.toLowerCase().includes(searchQuery.toLowerCase()) ||
          session.workoutName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (session.notes && session.notes.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : (data?.sessions || [])

    return sessions.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date)
      return sortDirection === 'desc' ? -cmp : cmp
    })
  }, [data?.sessions, searchQuery, sortDirection])

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading...</p>

  function handleAdd() {
    const session = addSession(date, workout)
    if (session) {
      setShowAdd(false)
      navigate(`/sessions/${date}`)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Sessions</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{filteredSessions.length} sessions logged</p>
        </div>
        <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add Session</Button>
      </div>

      <CalendarHeatmap sessions={data?.sessions || []} />

      <div style={{ marginBottom: 20, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <input
          type="text"
          placeholder="Search by date, workout, or notes..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text)', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
        />
        <Button
          size="sm"
          style={{ padding: '14px 14px', display: 'flex', alignItems: 'center' }}
          onClick={() => setSortDirection(d => d === 'desc' ? 'asc' : 'desc')}
        >
          {sortDirection === 'desc' ? '↓ Newest' : '↑ Oldest'}
        </Button>
      </div>

      {filteredSessions.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No sessions found.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filteredSessions.map(session => (
            <div
              key={session.date}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/sessions/${session.date}`)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <strong style={{ fontSize: '1.1rem' }}>{session.date}</strong>
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 4 }}>{session.workoutName}</p>
                </div>
              </div>
              {session.notes && (
                <p style={{ 
                  color: 'var(--muted)', 
                  fontSize: '0.78rem', 
                  marginTop: 6,
                  marginBottom: 6,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {session.notes.length > 60 ? session.notes.slice(0, 60) + '…' : session.notes}
                </p>
              )}
              <p style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                {session.exercises.filter(ex => ex.weight || ex.reps).length} / {session.exercises.length} exercises logged
                {session.elapsedTime ? ` • ${Math.floor(session.elapsedTime / 60)}m ${session.elapsedTime % 60}s` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay show" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Session</h2>
            <p className="modal-sub">Pick a date and workout type to start logging.</p>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="session-date">Date</label>
                <input id="session-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="session-workout">Workout</label>
                <select id="session-workout" value={workout} onChange={e => setWorkout(e.target.value)}>
                  {data!.workouts.map(w => (
                    <option key={w.name} value={w.name}>{w.name}</option>
                  ))}
                </select>
                {!data!.workouts.some(w => w.name === workout) && (
                  <p style={{ color: 'var(--t1)', fontSize: '0.75rem', marginTop: 4 }}>
                    Selected workout no longer exists — pick another.
                  </p>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <Button onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button variant="success" onClick={handleAdd}>Start Session</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
