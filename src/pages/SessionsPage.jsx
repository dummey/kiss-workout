import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTracker } from '../context'

export default function SessionsPage() {
  const { data, loading, addSession, deleteSession } = useTracker()
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [workout, setWorkout] = useState('Squat Workout')

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
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{data.sessions.length} sessions logged</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Session</button>
      </div>

      {data.sessions.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No sessions yet. Click "+ Add Session" to get started.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {data.sessions.map(session => (
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
