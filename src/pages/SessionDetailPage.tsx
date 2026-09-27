import React, { useState, useEffect, useRef, useCallback } from 'react'
import Button from '../components/Button'
import ProgressionInfo from '../components/ProgressionInfo'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTracker } from '../context'
import {
  calculatePlates,
  formatPlateBreakdown,
  parseWeightInput,
  DEFAULT_BARBELL_WEIGHT,
  DEFAULT_PLATES,
} from '../utils/plates'
import { EQUIPMENT_LABELS } from '../constants'
import type { Exercise, SessionExercise } from '../types'

/**
 * The equipment to render for a session exercise.
 *
 * `equipment` is snapshotted onto a session record when the session is created,
 * so the record — not the current definition — is the source of truth for what
 * was actually lifted that day. But two things complicate reading it back:
 *
 *  1. Records predating the field carry no `equipment` key at all, so the
 *     definition is the only thing that can answer the question.
 *  2. A duplicated exercise's id is synthetic (`<id>-copy-<uuid>`) and matches
 *     no definition, so its definition has to be reached through `originalId`.
 *     `duplicateExerciseInSession` normalises a missing snapshot to `''`, which
 *     makes a copy of a pre-equipment record indistinguishable from a record
 *     explicitly marked "None" — the empty string on a copy is an artefact of
 *     copying, not a recorded choice, so it must not win.
 *
 * So the rule is: take the recorded value only when the record is not a copy;
 * for a copy, follow it to the record it was duplicated from and, failing
 * that, to the definition. Returns undefined when nothing is known, which
 * reads as "not barbell" and renders no breakdown.
 */
function resolveEquipment(
  sessionEx: SessionExercise,
  siblings: SessionExercise[],
  getExercise: (id: string) => Exercise | undefined
): 'barbell' | '' | undefined {
  // Only a copy's own `equipment` is unreliable — the normaliser rewrote it.
  // A non-copy record is read as written, including an explicit ''.
  if (sessionEx.originalId) {
    // Prefer the record the copy was duplicated from: it is the closest thing
    // to an original reading, and it preserves the snapshot of a modern
    // session even when the definition has since been reclassified.
    const source = siblings.find(e => e.id === sessionEx.originalId)
    if (source) return source.equipment ?? getExercise(source.id)?.equipment
    // The source is gone (removed, or from a different session). Fall back to
    // the definition the copy points at.
    return getExercise(sessionEx.originalId)?.equipment
  }
  if ('equipment' in sessionEx) return sessionEx.equipment
  return getExercise(sessionEx.id)?.equipment
}

export default function SessionDetailPage() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const { data, loading, updateExercise, setExerciseFailed, deleteSession, updateSessionNotes, updateSessionTime, getPreviousPerformances, getExercise, addExerciseToSession, removeExerciseFromSession, canRemoveExerciseFromSession, duplicateExerciseInSession } = useTracker()
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [addExerciseSearch, setAddExerciseSearch] = useState('')
  const [removeConfirm, setRemoveConfirm] = useState<{ exId: string; name: string; tier: string; canRemove: boolean } | null>(null)
  const [restTime, setRestTime] = useState(0)
  const [restIsRunning, setRestIsRunning] = useState(false)
  const restStartTimeRef = useRef(Date.now())
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const restTierRef = useRef('T1')

  const tierRestDurations: Record<string, number> = {
    T1: 240,  // 4 minutes
    T2: 150,  // 2.5 minutes
    T3: 75    // 75 seconds
  }

  useEffect(() => {
    if (!restIsRunning) {
      if (restIntervalRef.current) {
        clearInterval(restIntervalRef.current)
        restIntervalRef.current = null
      }
      return
    }

    const tick = () => {
      const elapsed = Math.floor((Date.now() - restStartTimeRef.current) / 1000)
      const duration = tierRestDurations[restTierRef.current] || 120
      const remaining = duration - elapsed
      if (remaining <= 0) {
        setRestTime(0)
        setRestIsRunning(false)
        if (restIntervalRef.current) {
          clearInterval(restIntervalRef.current)
          restIntervalRef.current = null
        }
        navigator.vibrate?.([200, 100, 200])
      } else {
        setRestTime(remaining)
      }
    }

    tick()
    restIntervalRef.current = setInterval(tick, 250)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (restIntervalRef.current) {
        clearInterval(restIntervalRef.current)
        restIntervalRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [restIsRunning])

  const startRestTimer = useCallback((tier: string) => {
    const duration = tierRestDurations[tier] || 120
    restTierRef.current = tier
    setRestTime(duration)
    restStartTimeRef.current = Date.now()
    setRestIsRunning(true)
  }, [])

  const pauseRestTimer = useCallback(() => {
    setRestIsRunning(false)
  }, [])

  const resumeRestTimer = useCallback(() => {
    if (restTime > 0) {
      const duration = tierRestDurations[restTierRef.current] || 120
      restStartTimeRef.current = Date.now() - (duration - restTime) * 1000
      setRestIsRunning(true)
    }
  }, [restTime])

  const resetRestTimer = useCallback(() => {
    setRestIsRunning(false)
    setRestTime(tierRestDurations[restTierRef.current] || 120)
  }, [])

  const skipRestTimer = useCallback(() => {
    setRestIsRunning(false)
    setRestTime(0)
  }, [])

  useEffect(() => {
    if (showAddExercise) setAddExerciseSearch('')
  }, [showAddExercise])
  const [notes, setNotes] = useState('')
  const [elapsedTime, setElapsedTime] = useState(0)
  const session = data?.sessions?.find(s => s.date === date)
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const isToday = date === todayStr
  const [isRunning, setIsRunning] = useState(isToday && !((session?.elapsedTime ?? 0) > 0))
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

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setElapsedTime(elapsed)
      lastTimeRef.current = elapsed
      if (elapsed - lastSaveRef.current >= 5) {
        lastSaveRef.current = elapsed
        updateSessionTimeRef.current(date, elapsed)
      }
    }

    tick()
    const interval = setInterval(tick, 250)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
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
  const resolvedExercises = session?.exercises?.map((sessionEx, idx) => {
    // A duplicated exercise carries a synthetic id (`<id>-copy-<uuid>`) that
    // matches no definition; `originalId` points at the real one.
    const def = getExercise(sessionEx.originalId ?? sessionEx.id) || {}
    return {
      ...def,
      ...sessionEx,
      // `def.equipment` must not simply be shadowed by the record's own value,
      // so equipment is resolved explicitly — see resolveEquipment above.
      equipment: resolveEquipment(sessionEx, session.exercises, getExercise),
      idx
    }
  }) || []

  const tierOrder = ['T1', 'T2', 'T3', '']
  const tierLabels: Record<string, string> = { T1: 'T1 — Main Lift', T2: 'T2 — Primary Accessory', T3: 'T3 — Secondary', '': 'Other' }
  const tierSubtitles: Record<string, string> = { T1: '3–5 minutes between sets', T2: '2–3 minutes between sets', T3: '60–90 seconds between sets', '': '' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{session.date}</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{session.workoutName} — {session.exercises.length} exercises</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={() => setShowAddExercise(true)}>+ Add Exercise</Button>
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

      <div className="timer-row" style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)', padding: '8px 0' }}>
        <div className="timer-card" style={{ flex: '1 1 0', minWidth: 120, background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: 16, textAlign: 'center' }}>
          <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>
            Time
          </h3>
          <div style={{ fontSize: '2.8rem', fontWeight: 800, fontFamily: 'monospace', color: isRunning ? 'var(--t3)' : 'var(--muted)' }}>
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

        <div className="timer-card" style={{ flex: '1 1 0', minWidth: 120, background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: 16, textAlign: 'center' }}>
          <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>
            Rest Time
          </h3>
          <div style={{ fontSize: '2.8rem', fontWeight: 800, fontFamily: 'monospace', color: restIsRunning ? 'var(--t3)' : 'var(--muted)' }}>
            {restTime >= 60 && <span>{Math.floor(restTime / 60)}:</span>}
            {(restTime % 60).toString().padStart(2, '0')}
          </div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 8 }}>
            {restIsRunning ? (
              <Button size="sm" onClick={pauseRestTimer}>Pause</Button>
            ) : (
              <Button size="sm" onClick={resumeRestTimer}>Resume</Button>
            )}
            <Button size="sm" danger onClick={resetRestTimer}>Reset</Button>
            <Button size="sm" onClick={skipRestTimer}>Skip</Button>
          </div>
        </div>

        <div style={{ flex: '1 1 0', minWidth: 120, background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: 16 }}>
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
            <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 4, fontWeight: 700 }}>
              {tierLabels[tier]}
            </h3>
            {tierSubtitles[tier] && (
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 12 }}>
                {tierSubtitles[tier]}
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {tierExs.map((ex) => {
                const prevInfo = getPreviousPerformances(ex.id, session.date)

                // Recalculated on every render, so it tracks the input live.
                // `equipment` is optional on historical session exercises, so
                // read it defensively rather than assuming the key is present.
                const target = ex.equipment === 'barbell' ? parseWeightInput(ex.weight) : null
                const plateBreakdown = target === null
                  ? null
                  : formatPlateBreakdown(calculatePlates(
                      data?.meta?.barbellWeight ?? DEFAULT_BARBELL_WEIGHT,
                      data?.meta?.plates ?? DEFAULT_PLATES,
                      target
                    ))

                return (
                  <div key={ex.id || ex.idx} className="card">
                    <div className="card-head" style={{ justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Link to={`/exercises/${encodeURIComponent(ex.originalId || ex.id)}`} className="card-name" style={{ color: 'inherit', textDecoration: 'none' }}>
                          {ex.name}
                        </Link>
                        {ex.tier && <span className={'tier-badge tier-' + ex.tier}>{ex.tier}</span>}
                        {/* `ex.equipment` here is the value resolved by
                            `resolveEquipment` on the way into `resolvedExercises`
                            — the same field the plate calculation reads. Reading
                            the raw record instead would render a copy's
                            normalised `''` and the pill would lie. */}
                        {ex.equipment && EQUIPMENT_LABELS[ex.equipment] && (
                          <span className="tag equipment">{EQUIPMENT_LABELS[ex.equipment]}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 'auto' }}>
                        <Button
                          size="sm"
                          className="btn-icon btn-toggle"
                          aria-pressed={ex.failed === true}
                          aria-label={ex.failed ? `Undo failed status for ${ex.name}` : `Mark ${ex.name} as failed`}
                          title={ex.failed ? `Undo failed status for ${ex.name}` : `Mark ${ex.name} as failed`}
                          danger={ex.failed}
                          onClick={() => {
                            if (date) setExerciseFailed(date, ex.idx, ex.failed !== true)
                          }}
                        >
                          <span aria-hidden="true">↘</span>
                        </Button>
                        <Button size="sm" title="Duplicate exercise" onClick={() => {
                          if (date) duplicateExerciseInSession(date, ex.idx)
                        }}>⧉</Button>
                        <Button size="sm" danger title="Remove exercise" onClick={() => {
                          if (!canRemoveExerciseFromSession(date!, ex.id)) {
                            setRemoveConfirm({ exId: ex.id, name: ex.name, tier: ex.tier, canRemove: false })
                          } else {
                            setRemoveConfirm({ exId: ex.id, name: ex.name, tier: ex.tier || '', canRemove: true })
                          }
                        }}>×</Button>
                      </div>
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
                          {/* Plate breakdown, only for barbell moves and only when the
                              weight is a plain number. A non-numeric weight ("BW",
                              empty) renders nothing at all — no placeholder, no error.
                              The user's own total is not echoed; it is in the input above. */}
                          {plateBreakdown && (
                            <div className="plate-breakdown" data-testid="plate-breakdown">
                              {plateBreakdown}
                            </div>
                          )}
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
                            onChange={e => {
                              if (date) updateExercise(date, ex.idx, 'sets', e.target.value)
                              const newVal = parseInt(e.target.value, 10)
                              if (!isNaN(newVal) && newVal > 0) {
                                startRestTimer(ex.tier || 'T1')
                              }
                            }}
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
                              startRestTimer(ex.tier || 'T1')
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
      {showAddExercise && (
        <div className="modal-overlay show" onClick={() => setShowAddExercise(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Exercise</h2>
            <p className="modal-sub">Select an exercise from the library to add to this session.</p>
            <input
              type="text"
              placeholder="Search exercises..."
              value={addExerciseSearch}
              onChange={e => setAddExerciseSearch(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', background: 'var(--surface2)',
                border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8,
                fontSize: '0.9rem', marginBottom: 16, boxSizing: 'border-box'
              }}
            />
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {data?.exercises
                .filter(ex => !session?.exercises.some(se => se.id === ex.id))
                .filter(ex => addExerciseSearch.trim() === '' ||
                  ex.name.toLowerCase().includes(addExerciseSearch.toLowerCase()) ||
                  ex.muscles?.some(m => m.toLowerCase().includes(addExerciseSearch.toLowerCase()))
                )
                .map(ex => (
                  <div
                    key={ex.id}
                    className="card"
                    style={{ marginBottom: 8, cursor: 'pointer' }}
                    onClick={() => {
                      if (date) addExerciseToSession(date, ex.id)
                      setShowAddExercise(false)
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{ex.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {ex.tier} {ex.muscles.length > 0 && `• ${ex.muscles.join(', ')}`}
                    </div>
                  </div>
                ))}
            </div>
            <div className="modal-actions">
              <Button onClick={() => setShowAddExercise(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
      {removeConfirm && (
        <div className="modal-overlay show" onClick={() => setRemoveConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Remove Exercise</h2>
            <p className="modal-sub">
              {!removeConfirm.canRemove
                ? `${removeConfirm.name} is your T1 main lift. It can't be removed from the session.`
                : `Remove ${removeConfirm.name} from this session?`}
            </p>
            <div className="modal-actions">
              <Button onClick={() => setRemoveConfirm(null)}>Cancel</Button>
              {removeConfirm.canRemove && date && (
                <Button
                  danger
                  onClick={() => {
                    removeExerciseFromSession(date, removeConfirm.exId)
                    setRemoveConfirm(null)
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
