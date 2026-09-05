import React, { useState, useEffect, useRef } from 'react'
import Button from '../components/Button'
import ProgressionInfo from '../components/ProgressionInfo'
import { useParams, useNavigate } from 'react-router-dom'
import { useTracker } from '../context'
import type { Exercise, SessionExercise, PreviousPerformance } from '../types'

export default function SessionDetailPage() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const { data, loading, updateExercise, deleteSession, updateSessionNotes, updateSessionTime, getPreviousPerformance, getExercise } = useTracker()
  const [notes, setNotes] = useState('')
  const [elapsedTime, setElapsedTime] = useState(0)
  const session = data?.sessions?.find(s => s.date === date)
  const isToday = date === new Date().toISOString().slice(0, 10)
  const [isRunning, setIsRunning] = useState(isToday && !(session?.elapsedTime > 0))
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef(Date.now())
  const lastSaveRef = useRef(0)

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const lastTimeRef = useRef(0)
  const updateSessionTimeRef = useRef(updateSessionTime)
  useEffect(() => {
    updateSessionTimeRef.current = updateSessionTime
  }, [updateSessionTime])

  useEffect(() => {
    return () => {
      if (lastTimeRef.current > 0 && date) {
        updateSessionTimeRef.current(date, lastTimeRef.current)
      }
    }
  }, [date])

  useEffect(() => {
    if (!isRunning || !date) return
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setElapsedTime(elapsed)
      lastTimeRef.current = elapsed
      if (elapsed - lastSaveRef.current >= 5) {
        lastSaveRef.current = elapsed
        updateSessionTimeRef.current(date, elapsed)
      }
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, date])

  useEffect(() => {
    const existingSession = data?.sessions?.find(s => s.date === date)
    if (existingSession?.elapsedTime) {
      setElapsedTime(existingSession.elapsedTime)
      startTimeRef.current = Date.now() - existingSession.elapsedTime * 1000
    }
    if (existingSession?.notes && notes === '') {
      setNotes(existingSession.notes)
    }
  }, [data, date])

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading...</p>

  if (!session) {
    return (
      <div>
        <p style={{ color: 'var(--muted)' }}>Session not found.</p>
        <button className="btn" onClick={() => navigate('/sessions')}>Back to Sessions</button>
      </div>
    )
  }

  function handleNotesChange(value: string) {
    setNotes(value)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      if (date) updateSessionNotes(date, value)
    }, 500)
  }
  const resolvedExercises = session.exercises.map((sessionEx, idx) => {
    const def = getExercise(sessionEx.id) || {}
    return {
      ...def,
      ...sessionEx,
      idx
    }
  })

  const tierOrder = ['T1', 'T2', 'T3', '']
  const tierLabels: Record<string, string> = { T1: 'T1 — Main Lift', T2: 'T2 — Primary Accessory', T3: 'T3 — Secondary', '': 'Other' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{session.date}</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{session.workoutName} — {session.exercises.length} exercises</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={() => {
            const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `session-${session.date}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }}>Export</Button>
          <Button danger onClick={() => {
            if (date) deleteSession(date)
            navigate('/sessions')
          }}>Delete</Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 400px', background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: 16, textAlign: 'center' }}>
          <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>
            Time
          </h3>
          <div style={{ fontSize: '3.6rem', fontWeight: 800, fontFamily: 'monospace', color: isRunning ? 'var(--t3)' : 'var(--muted)' }}>
            {elapsedTime >= 3600 && <span>{Math.floor(elapsedTime / 3600)}:</span>}
            {Math.floor((elapsedTime % 3600) / 60).toString().padStart(2, '0')}:
            {(elapsedTime % 60).toString().padStart(2, '0')}
          </div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 8 }}>
            <Button size="sm" onClick={() => { if (!isRunning) startTimeRef.current = Date.now() - elapsedTime * 1000; setIsRunning(!isRunning) }}>
              {isRunning ? 'Pause' : (elapsedTime === 0 ? 'Start' : 'Resume')}
            </Button>
            <Button size="sm" danger onClick={() => { setElapsedTime(0); startTimeRef.current = Date.now(); setIsRunning(false) }}>
              Reset
            </Button>
          </div>
        </div>

        <div style={{ flex: '1', background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: 16 }}>
          <h3 style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>
            Notes
          </h3>
          <textarea
            value={notes}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder="Add any notes about this session..."
            style={{
              width: '100%',
              minHeight: 80,
              padding: '8px 12px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: 8,
              fontSize: '0.82rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
        </div>
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
                const prevInfo = getPreviousPerformance(ex.id, session.date)

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
                      <ProgressionInfo tier={ex.tier} prevInfo={prevInfo} />
                      <div className="edit-row">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="edit-input"
                            placeholder="Weight"
                            value={ex.weight}
                            onChange={e => date && updateExercise(date, ex.idx, 'weight', e.target.value)}
                          />
                          <div className="edit-lbl">Weight</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input
                            type="text"
                            className="edit-input"
                            placeholder="Reps"
                            value={ex.reps}
                            onChange={e => date && updateExercise(date, ex.idx, 'reps', e.target.value)}
                          />
                          <div className="edit-lbl">Reps</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                          <input
                            type="text"
                            className="edit-input"
                            placeholder="Sets"
                            value={ex.sets ?? ''}
                            onChange={e => date && updateExercise(date, ex.idx, 'sets', e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box' }}
                          />
                          <Button
                            size="sm"
                            style={{
                              position: 'absolute',
                              right: 2,
                              top: 1,
                              // top: '50%',
                              // transform: 'translateY(-50%)',
                              padding: '6px',
                              minWidth: 36,
                              lineHeight: 1
                            }}
                            onClick={() => {
                              const current = ex.sets ?? 0
                              if (date) updateExercise(date, ex.idx, 'sets', (current + 1).toString())
                            }}
                          >
                            +
                          </Button>
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
