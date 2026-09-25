import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/Button'
import { useModal } from '../components/ModalProvider'
import { useTracker } from '../context'
import BodyMusclesChart from '../components/BodyMusclesChart'
import type { Exercise } from '../types'

export default function WorkoutsPage() {
  const { data, loading, getExercise, addExerciseToWorkout, removeExerciseFromWorkout, reorderWorkoutExercise, addWorkout, deleteWorkout, cloneWorkout, updateWorkout } = useTracker()
  const { showModal } = useModal()
  const [selectedWorkout, setSelectedWorkout] = useState(data?.workouts[0]?.name || '')

  useEffect(() => {
    if (data && !selectedWorkout && data.workouts.length > 0) {
      setSelectedWorkout(data.workouts[0].name)
    }
  }, [data, selectedWorkout])
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [newWorkoutName, setNewWorkoutName] = useState('')
  const [showAddWorkout, setShowAddWorkout] = useState(false)
  const [highlightedMuscles, setHighlightedMuscles] = useState<string[]>([])

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading...</p>
  if (!data) return <p style={{ color: 'var(--muted)' }}>No data available. Go to Settings → Load Seed to get started.</p>

  const workout = data.workouts.find(w => w.name === selectedWorkout)
  const workoutExercises: Exercise[] = workout ? workout.exercises.map(id => getExercise(id)).filter((ex): ex is Exercise => ex !== undefined) : []
  const availableExercises = data.exercises.filter(ex => !workout?.exercises.includes(ex.id))

  function handleAddExercise(exId: string) {
    addExerciseToWorkout(selectedWorkout, exId)
    setShowAddExercise(false)
  }

  function handleRemoveExercise(exId: string) {
    showModal({
      title: 'Remove Exercise',
      message: 'Remove this exercise from this workout?',
      actions: [
        { label: 'Cancel', value: null },
        { label: 'Remove', value: 'confirm', variant: 'danger' }
      ]
    }).then(result => {
      if (result.action === 'confirm') {
        removeExerciseFromWorkout(selectedWorkout, exId)
        setHighlightedMuscles([])
      }
    })
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
    showModal({
      title: 'Delete Workout',
      message: `Delete "${workout.name}"? This will not affect past sessions.`,
      actions: [
        { label: 'Cancel', value: null },
        { label: 'Delete', value: 'confirm', variant: 'danger' }
      ]
    }).then(result => {
      if (result.action === 'confirm') {
        const nextWorkout = data.workouts.find(w => w.name !== workout.name)
        deleteWorkout(workout.name)
        setSelectedWorkout(nextWorkout?.name || '')
      }
    })
  }

  const tierOrder = ['T1', 'T2', 'T3', '']
  const tierLabels: Record<string, string> = { 'T1': 'T1 — Main Lift', 'T2': 'T2 — Primary Accessory', 'T3': 'T3 — Secondary', '': 'Other' }

  function handleMoveExercise(exId: string, direction: 'up' | 'down') {
    if (!workout) return
    const ex = getExercise(exId)
    if (!ex) return
    const tier = ex.tier || ''
    const tierExIds = workout.exercises.filter(id => {
      const e = getExercise(id)
      return e && (e.tier || '') === tier
    })
    const tierIdx = tierExIds.indexOf(exId)
    if (direction === 'up' && tierIdx <= 0) return
    if (direction === 'down' && tierIdx >= tierExIds.length - 1) return

    const swapExId = direction === 'up' ? tierExIds[tierIdx - 1] : tierExIds[tierIdx + 1]
    const globalIdx1 = workout.exercises.indexOf(exId)
    const globalIdx2 = workout.exercises.indexOf(swapExId)
    if (globalIdx1 === -1 || globalIdx2 === -1) return

    reorderWorkoutExercise(selectedWorkout, globalIdx1, globalIdx2)
  }

  function canMoveUp(exId: string): boolean {
    if (!workout) return false
    const ex = getExercise(exId)
    if (!ex) return false
    const tier = ex.tier || ''
    const tierExIds = workout.exercises.filter(id => {
      const e = getExercise(id)
      return e && (e.tier || '') === tier
    })
    return tierExIds.indexOf(exId) > 0
  }

  function canMoveDown(exId: string): boolean {
    if (!workout) return false
    const ex = getExercise(exId)
    if (!ex) return false
    const tier = ex.tier || ''
    const tierExIds = workout.exercises.filter(id => {
      const e = getExercise(id)
      return e && (e.tier || '') === tier
    })
    const idx = tierExIds.indexOf(exId)
    return idx >= 0 && idx < tierExIds.length - 1
  }

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
          {data.workouts.map(w => (
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
              <Button size="sm" onClick={async () => {
                const result = await showModal({
                  title: 'Rename Workout',
                  message: 'Enter a new name for this workout.',
                  input: { defaultValue: workout.name, placeholder: 'Workout name' },
                  actions: [
                    { label: 'Cancel', value: null },
                    { label: 'Rename', value: 'confirm', variant: 'success' }
                  ]
                })
                if (result.action === 'confirm' && result.input?.trim() && result.input.trim() !== workout.name) {
                  updateWorkout(workout.name, result.input.trim())
                  setSelectedWorkout(result.input.trim())
                }
              }}>Rename</Button>
              <Button size="sm" onClick={async () => {
                const result = await showModal({
                  title: 'Clone Workout',
                  message: `Clone "${workout.name}" as:`,
                  input: { defaultValue: `${workout.name} (Copy)`, placeholder: 'New workout name' },
                  actions: [
                    { label: 'Cancel', value: null },
                    { label: 'Clone', value: 'confirm', variant: 'success' }
                  ]
                })
                if (result.action === 'confirm' && result.input?.trim()) {
                  cloneWorkout(workout.name, result.input.trim())
                  setSelectedWorkout(result.input.trim())
                }
              }}>Clone</Button>
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
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }} aria-label="Reorder exercise">
                                <button
                                  className="btn btn-sm reorder-btn"
                                  onClick={() => handleMoveExercise(ex.id, 'up')}
                                  disabled={!canMoveUp(ex.id)}
                                  style={{ opacity: canMoveUp(ex.id) ? 1 : 0.3 }}
                                  aria-label={`Move ${ex.name} up`}
                                >
                                  ▲
                                </button>
                                <button
                                  className="btn btn-sm reorder-btn"
                                  onClick={() => handleMoveExercise(ex.id, 'down')}
                                  disabled={!canMoveDown(ex.id)}
                                  style={{ opacity: canMoveDown(ex.id) ? 1 : 0.3 }}
                                  aria-label={`Move ${ex.name} down`}
                                >
                                  ▼
                                </button>
                              </div>
                              <div style={{ flex: 1 }}>
                                <Link to={`/exercises/${encodeURIComponent(ex.id)}`} style={{ color: 'inherit', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>
                                  {ex.name}
                                </Link>
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
