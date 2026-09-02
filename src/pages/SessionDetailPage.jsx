import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTracker } from '../context'

export default function SessionDetailPage() {
  const { date } = useParams()
  const navigate = useNavigate()
  const { data, loading, updateExercise, deleteSession, updateSessionNotes, getPreviousPerformance, getExercise } = useTracker()
  const [notes, setNotes] = useState('')
  const saveTimeoutRef = useRef(null)

  // All hooks must come before any conditional returns
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const session = data?.sessions?.find(s => s.date === date)
    if (session?.notes && notes === '') {
      setNotes(session.notes)
    }
  }, [data, date])

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading...</p>

  const session = data.sessions.find(s => s.date === date)
  if (!session) {
    return (
      <div>
        <p style={{ color: 'var(--muted)' }}>Session not found.</p>
        <button className="btn" onClick={() => navigate('/sessions')}>Back to Sessions</button>
      </div>
    )
  }

  // Save notes after a short delay when typing
  function handleNotesChange(value) {
    setNotes(value)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      updateSessionNotes(date, value)
    }, 500)
  }

  function getNextProgression(ex, prevInfo) {
    const tier = ex.tier
    if (tier === 'T1') {
      if (prevInfo) {
        const prevReps = prevInfo.reps
        const prevSets = prevInfo.sets
        if (prevSets && prevReps && prevReps !== '—') {
          return 'Try ' + prevInfo.weight + ' x ' + (parseInt(prevReps) + 1) + ' (' + prevSets + ') or add weight'
        }
      }
      return 'Work up to 2-3RM @ 85-100% Goal Weight'
    } else if (tier === 'T2') {
      if (prevInfo && prevInfo.reps && prevInfo.reps !== '—' && parseInt(prevInfo.reps) >= 10) {
        return 'Add weight, drop to 8 reps'
      }
      return 'Target: 8-10 reps @ 65-85% of T1'
    } else if (tier === 'T3') {
      if (prevInfo && prevInfo.reps && prevInfo.reps !== '—' && parseInt(prevInfo.reps) >= 15) {
        return 'Add weight, drop to 10 reps'
      }
      return 'Target: 10-15+ reps @ ≤65%'
    }
    return 'Fill in your target weight, reps, and sets'
  }

  // Resolve exercise IDs to full definitions
  const resolvedExercises = session.exercises.map((sessionEx, idx) => {
    const def = getExercise(sessionEx.id) || {}
    return {
      ...def,
      ...sessionEx,
      idx
    }
  })

  const tierOrder = ['T1', 'T2', 'T3', '']
  const tierLabels = { T1: 'T1 — Main Lift', T2: 'T2 — Primary Accessory', T3: 'T3 — Secondary', '': 'Other' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{session.date}</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{session.workoutName} — {session.exercises.length} exercises</p>
        </div>
        <button className="btn btn-sm" style={{ color: 'var(--t1)' }} onClick={() => {
          deleteSession(date)
          navigate('/sessions')
        }}>Delete Session</button>
      </div>

      {/* Notes section */}
      <div style={{ marginBottom: 24, background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: 16 }}>
        <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>
          Notes
        </h3>
        <textarea
          value={notes}
          onChange={e => handleNotesChange(e.target.value)}
          placeholder="Add any notes about this session..."
          style={{
            width: '100%',
            minHeight: 100,
            padding: '10px 14px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            borderRadius: 8,
            fontSize: '0.85rem',
            fontFamily: 'inherit',
            resize: 'vertical',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {tierOrder.map(tier => {
        const tierExs = resolvedExercises.filter(ex => (ex.tier || '') === tier)
        if (tierExs.length === 0) return null
        return (
          <div key={tier} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 12, fontWeight: 700 }}>
              {tierLabels[tier]}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {tierExs.map((ex) => {
                const prevInfo = getPreviousPerformance(ex.name, session.date)
                const nextStep = getNextProgression(ex, prevInfo)

                return (
                  <div key={ex.id || ex.idx} className={'card' + (ex.tier === 'T1' ? ' t1-highlight' : '')}>
                    <div className="card-head">
                      <div className="card-name">{ex.name}</div>
                      {ex.tier && <span className={'tier-badge tier-' + ex.tier}>{ex.tier}</span>}
                    </div>
                    <div className="card-tags">
                      {ex.setup && <span className="tag setup">{ex.setup}</span>}
                      {ex.superset && <span className="tag ss">{ex.superset}</span>}
                      {ex.muscles && ex.muscles.map(m => (
                        <span key={m} className="tag muscle">{m}</span>
                      ))}
                    </div>
                    <div className="card-footer">
                      {prevInfo && (
                        <div className="progression-info">
                          <div className="last-time">Last time: {prevInfo.weight} x {prevInfo.reps} ({prevInfo.sets})</div>
                          <div className="next-step">{nextStep}</div>
                        </div>
                      )}
                      <div className="edit-row">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input
                            type="text"
                            className="edit-input"
                            placeholder="Weight"
                            value={ex.weight}
                            onChange={e => updateExercise(date, ex.idx, 'weight', e.target.value)}
                          />
                          <div className="edit-lbl">Weight</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input
                            type="text"
                            className="edit-input"
                            placeholder="Reps"
                            value={ex.reps}
                            onChange={e => updateExercise(date, ex.idx, 'reps', e.target.value)}
                          />
                          <div className="edit-lbl">Reps</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input
                            type="text"
                            className="edit-input"
                            placeholder="Sets"
                            value={ex.sets || ''}
                            onChange={e => updateExercise(date, ex.idx, 'sets', e.target.value)}
                          />
                          <div className="edit-lbl">Sets</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
