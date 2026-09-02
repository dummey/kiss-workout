import React, { useState, useMemo } from 'react'
import { useTracker } from '../context'

export default function ExercisesPage() {
  const { data, loading, addExercise, updateExerciseDef, deleteExercise, addExerciseToWorkout } = useTracker()
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [newEx, setNewEx] = useState({ name: '', muscles: '', setup: '', superset: '', tier: '' })
  const [workoutToAdd, setWorkoutToAdd] = useState({})
  const [searchQuery, setSearchQuery] = useState('')

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading...</p>

  // Filter exercises by search query
  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return data.exercises
    const query = searchQuery.toLowerCase()
    return data.exercises.filter(ex =>
      ex.name.toLowerCase().includes(query) ||
      (ex.muscles && ex.muscles.some(m => m.toLowerCase().includes(query))) ||
      (ex.tier && ex.tier.toLowerCase().includes(query)) ||
      (ex.setup && ex.setup.toLowerCase().includes(query))
    )
  }, [data.exercises, searchQuery])

  function handleAdd() {
    if (!newEx.name.trim()) return
    const id = addExercise({
      name: newEx.name,
      muscles: newEx.muscles.split(',').map(m => m.trim()).filter(Boolean),
      setup: newEx.setup,
      superset: newEx.superset,
      tier: newEx.tier
    })
    // Add to selected workouts
    Object.entries(workoutToAdd).forEach(([workoutName, checked]) => {
      if (checked) addExerciseToWorkout(workoutName, id)
    })
    setNewEx({ name: '', muscles: '', setup: '', superset: '', tier: '' })
    setWorkoutToAdd({})
    setShowAdd(false)
  }

  function startEdit(ex) {
    setEditingId(ex.id)
    setEditValues({
      name: ex.name || '',
      muscles: (ex.muscles || []).join(', '),
      setup: ex.setup || '',
      superset: ex.superset || '',
      tier: ex.tier || ''
    })
  }

  function saveEdit(exId) {
    Object.entries(editValues).forEach(([field, value]) => {
      const val = field === 'muscles' ? value.split(',').map(m => m.trim()).filter(Boolean) : value
      updateExerciseDef(exId, field, val)
    })
    setEditingId(null)
    setEditValues({})
  }

  function getWorkoutNamesForExercise(exId) {
    return data.workouts.filter(w => w.exercises.includes(exId)).map(w => w.name)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Exercises</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{filteredExercises.length} exercises in library</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Exercise</button>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search by name, muscle, tier, or setup..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text)', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredExercises.map(ex => {
          const workouts = getWorkoutNamesForExercise(ex.id)
          const isEditing = editingId === ex.id

          return (
            <div key={ex.id} className="card" style={{ padding: 16 }}>
              {isEditing ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr 0.8fr 0.8fr auto', gap: 8, alignItems: 'end', marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>Name</label>
                      <input type="text" value={editValues.name} onChange={e => setEditValues({ ...editValues, name: e.target.value })} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>Muscles (comma-sep)</label>
                      <input type="text" value={editValues.muscles} onChange={e => setEditValues({ ...editValues, muscles: e.target.value })} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>Setup</label>
                      <input type="text" value={editValues.setup} onChange={e => setEditValues({ ...editValues, setup: e.target.value })} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>Superset</label>
                      <input type="text" value={editValues.superset} onChange={e => setEditValues({ ...editValues, superset: e.target.value })} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>Tier</label>
                      <select value={editValues.tier} onChange={e => setEditValues({ ...editValues, tier: e.target.value })} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, fontSize: '0.85rem' }}>
                        <option value="">None</option>
                        <option value="T1">T1</option>
                        <option value="T2">T2</option>
                        <option value="T3">T3</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm btn-success" onClick={() => saveEdit(ex.id)}>Save</button>
                      <button className="btn btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, marginRight: 8 }}>Add to workout:</label>
                    {data.workouts.filter(w => !w.exercises.includes(ex.id)).map(w => (
                      <button key={w.name} className="btn btn-sm" style={{ marginRight: 4 }} onClick={() => addExerciseToWorkout(w.name, ex.id)}>
                        + {w.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{ex.name}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {ex.tier && <span className={'tier-badge tier-' + ex.tier}>{ex.tier}</span>}
                      {ex.setup && <span className="tag setup">{ex.setup}</span>}
                      {ex.superset && <span className="tag ss">{ex.superset}</span>}
                      {ex.muscles && ex.muscles.map(m => (
                        <span key={m} className="tag muscle">{m}</span>
                      ))}
                    </div>
                    {workouts.length > 0 && (
                      <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--muted)' }}>
                        Used in: {workouts.join(', ')}
                      </div>
                    )}
                  </div>
                  <button className="btn btn-sm" onClick={() => startEdit(ex)}>Edit</button>
                  <button className="btn btn-sm" style={{ color: 'var(--t1)' }} onClick={() => {
                    if (confirm(`Delete "${ex.name}"? It will be removed from all workouts.`)) deleteExercise(ex.id)
                  }}>Delete</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showAdd && (
        <div className="modal-overlay show" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Exercise</h2>
            <p className="modal-sub">Add a new exercise to your library.</p>
            <div className="form-group">
              <label>Name *</label>
              <input type="text" value={newEx.name} onChange={e => setNewEx({ ...newEx, name: e.target.value })} placeholder="e.g. Barbell Back Squat" />
            </div>
            <div className="form-group">
              <label>Muscles (comma-separated)</label>
              <input type="text" value={newEx.muscles} onChange={e => setNewEx({ ...newEx, muscles: e.target.value })} placeholder="e.g. Quads, Glutes, Core" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Setup</label>
                <input type="text" value={newEx.setup} onChange={e => setNewEx({ ...newEx, setup: e.target.value })} placeholder="e.g. Spotter at 18/2" />
              </div>
              <div className="form-group">
                <label>Superset</label>
                <input type="text" value={newEx.superset} onChange={e => setNewEx({ ...newEx, superset: e.target.value })} placeholder="e.g. SS1" />
              </div>
            </div>
            <div className="form-group">
              <label>Tier</label>
              <select value={newEx.tier} onChange={e => setNewEx({ ...newEx, tier: e.target.value })}>
                <option value="">None</option>
                <option value="T1">T1</option>
                <option value="T2">T2</option>
                <option value="T3">T3</option>
              </select>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 8 }}>Add to workouts (optional)</label>
              {data.workouts.map(w => (
                <label key={w.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={(workoutToAdd[w.name] || false)}
                    onChange={e => setWorkoutToAdd({ ...workoutToAdd, [w.name]: e.target.checked })}
                  />
                  {w.name}
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-success" onClick={handleAdd} disabled={!newEx.name.trim()}>Add Exercise</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
