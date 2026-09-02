import React, { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTracker } from '../context'

export default function SessionsPage() {
  const { data, loading, addSession, deleteSession } = useTracker()
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [workout, setWorkout] = useState('Squat Workout')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter sessions by search query - hook must be before conditional return
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return data?.sessions || []
    const query = searchQuery.toLowerCase()
    return (data?.sessions || []).filter(session =>
      session.date.toLowerCase().includes(query) ||
      session.workoutName.toLowerCase().includes(query) ||
      (session.notes && session.notes.toLowerCase().includes(query))
    )
  }, [data?.sessions, searchQuery])

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
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Session</button>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search by date, workout, or notes..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text)', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
        />
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
              <p style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                {session.exercises.filter(ex => ex.weight || ex.reps).length} / {session.exercises.length} exercises logged
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
                <label>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Workout</label>
                <select value={workout} onChange={e => setWorkout(e.target.value)}>
                  {data.workouts.map(w => (
                    <option key={w.name} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-success" onClick={handleAdd}>Start Session</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
