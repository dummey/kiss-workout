import React, { useState } from 'react'
import Button from '../components/Button'
import { useTracker } from '../context'
import BodyMusclesChart from '../components/BodyMusclesChart'
import type { Exercise } from '../types'

export default function WorkoutsPage() {
  const { data, loading, getExercise, addExerciseToWorkout, removeExerciseFromWorkout, addWorkout, deleteWorkout } = useTracker()
  const [selectedWorkout, setSelectedWorkout] = useState(data?.workouts[0]?.name || '')
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [newWorkoutName, setNewWorkoutName] = useState('')
  const [showAddWorkout, setShowAddWorkout] = useState(false)
  const [highlightedMuscles, setHighlightedMuscles] = useState<string[]>([])

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading...</p>

  const workout = data!.workouts.find(w => w.name === selectedWorkout)
  const workoutExercises: Exercise[] = workout ? workout.exercises.map(id => getExercise(id)).filter((ex): ex is Exercise => ex !== undefined) : []
  const availableExercises = data!.exercises.filter(ex => !workout?.exercises.includes(ex.id))

  function handleAddExercise(exId: string) {
    addExerciseToWorkout(selectedWorkout, exId)
    setShowAddExercise(false)
  }

  function handleRemoveExercise(exId: string) {
    if (confirm('Remove this exercise from this workout?')) {
      removeExerciseFromWorkout(selectedWorkout, exId)
    }
  }

  function handleAddWorkout() {
    if (!newWorkoutName.trim()) return
    addWorkout(newWorkoutName.trim())
    setSelectedWorkout(newWorkoutName.trim())
    setNewWorkoutName('')
    setShowAddWorkout(false)
  }

  function handleDeleteCurrentWorkout() {
    if (!workout) return
    if (confirm(`Delete "${workout.name}"? This will not affect past sessions.`)) {
      const nextWorkout = data!.workouts.find(w => w.name !== workout.name)
      deleteWorkout(workout.name)
      setSelectedWorkout(nextWorkout?.name || '')
    }
  }

  const tierOrder = ['T1', 'T2', 'T3', '']
  const tierLabels: Record<string, string> = { 'T1': 'T1 — Main Lift', 'T2': 'T2 — Primary Accessory', 'T3': 'T3 — Secondary', '': 'Other' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Workouts</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Organize exercises into your workout split</p>
        </div>
        <Button variant="primary" onClick={() => setShowAddWorkout(true)}>+ Add Workout</Button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {data!.workouts.map(w => (
            <button
              key={w.name}
              className={'date-tab' + (w.name === selectedWorkout ? ' active' : '')}
              onClick={() => setSelectedWorkout(w.name)}
            >
              {w.name} ({w.exercises.length})
            </button>
          ))}
        </div>
      </div>

      {workout && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              {workout.name} — {workoutExercises.length} exercises
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="sm" variant="primary" onClick={() => setShowAddExercise(true)}>+ Add Exercise</Button>
              <Button size="sm" danger onClick={handleDeleteCurrentWorkout}>
                Delete
              </Button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24 }}>
            <div className="exercise-list" style={{ flex: '0 0 calc(50% - 12px)', minWidth: 340 }}>
              {workoutExercises.length === 0 ? (
                <p style={{ color: 'var(--muted)' }}>No exercises assigned to this workout. Click "+ Add Exercise" to get started.</p>
              ) : (
                tierOrder.map(tier => {
                  const tierExs = workoutExercises.filter(ex => (ex.tier || '') === tier)
                  if (tierExs.length === 0) return null
                  return (
                    <div key={tier} style={{ marginBottom: 16 }}>
                      <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>
                        {tierLabels[tier]}
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {tierExs.map(ex => (
                          <div key={ex.id} className="card" style={{ padding: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ex.name}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                                  {ex.tier && <span className={'tier-badge tier-' + ex.tier}>{ex.tier}</span>}
                                  {ex.setup && <span className="tag setup">{ex.setup}</span>}
                                  {ex.superset && <span className="tag ss">{ex.superset}</span>}
                                </div>
                                {ex.muscles && ex.muscles.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                                    {ex.muscles.map(m => (
                                      <span key={m} className="tag muscle" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{m}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <Button
                                size="sm"
                                style={{ fontSize: '0.65rem', padding: '3px 6px' }}
                                onClick={() => setHighlightedMuscles(
                                  highlightedMuscles.length === ex.muscles?.length &&
                                  highlightedMuscles.every(m => ex.muscles?.includes(m))
                                    ? []
                                    : (ex.muscles || [])
                                )}
                              >
                                {highlightedMuscles.length === ex.muscles?.length &&
                                 highlightedMuscles.every(m => ex.muscles?.includes(m))
                                  ? 'Hide'
                                  : 'Show'}
                              </Button>
                              <Button
                                size="sm"
                                danger
                                style={{ fontSize: '0.65rem', padding: '3px 6px' }}
                                onClick={() => handleRemoveExercise(ex.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div style={{ flex: '1', minWidth: 340 }}>
              {workoutExercises.length > 0 && (
                <BodyMusclesChart muscles={highlightedMuscles} allMuscles={workoutExercises.flatMap(ex => ex.muscles || [])} />
              )}
            </div>
          </div>
        </>
      )}

      {showAddExercise && (
        <div className="modal-overlay show" onClick={() => setShowAddExercise(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Exercise to {selectedWorkout}</h2>
            <p className="modal-sub">Select an exercise from your library.</p>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {availableExercises.length === 0 ? (
                <p style={{ color: 'var(--muted)' }}>All exercises are already in this workout.</p>
              ) : (
                availableExercises.map(ex => (
                  <div
                    key={ex.id}
                    className="card"
                    style={{ padding: 10, marginBottom: 6, cursor: 'pointer' }}
                    onClick={() => handleAddExercise(ex.id)}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ex.name}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      {ex.tier && <span className={'tier-badge tier-' + ex.tier}>{ex.tier}</span>}
                      {ex.muscles && ex.muscles.slice(0, 3).map(m => (
                        <span key={m} className="tag muscle">{m}</span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="modal-actions">
              <Button onClick={() => setShowAddExercise(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {showAddWorkout && (
        <div className="modal-overlay show" onClick={() => setShowAddWorkout(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Workout</h2>
            <p className="modal-sub">Create a new workout.</p>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={newWorkoutName}
                onChange={e => setNewWorkoutName(e.target.value)}
                placeholder="e.g. Push Day"
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <Button onClick={() => setShowAddWorkout(false)}>Cancel</Button>
              <Button variant="success" onClick={handleAddWorkout} disabled={!newWorkoutName.trim()}>Create Workout</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
