import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTracker } from '../context'
import Button from '../components/Button'
import Pill from '../components/Pill'
import { useModal } from '../components/ModalProvider'
import { EQUIPMENT_LABELS } from '../constants'
import { order } from '../domain/sessionRules'
import type { Exercise } from '../types'

/**
 * Filter pills for the tier row. Built from `order()` so the set of tiers comes
 * from the domain module rather than a second hand-maintained list; the pill
 * `label` is the bare tier code (unlike `label(tier)`, which is the section
 * heading), and `tone` is the CSS tone Pill renders.
 *
 * `tone` comes from {@link TIER_TONES}, keyed by the tier itself so the compiler
 * checks it: a future `T4` added to the `Tier` union makes that object incomplete,
 * which is a build error, rather than silently rendering a `pill-t4` class with no
 * CSS behind it.
 */
const TIER_TONES: Record<Exclude<Exercise['tier'], ''>, 't1' | 't2' | 't3'> = {
  T1: 't1',
  T2: 't2',
  T3: 't3'
}

const TIER_PILLS: { tier: Exercise['tier']; label: string; tone: 't1' | 't2' | 't3' | 'default' }[] = [
  ...order().filter((t): t is Exclude<Exercise['tier'], ''> => t !== '').map(tier => ({
    tier,
    label: tier,
    tone: TIER_TONES[tier]
  })),
  { tier: '', label: 'None', tone: 'default' }
]

export default function ExercisesPage() {
  const { data, loading, addExercise, updateExerciseDef, deleteExercise, addExerciseToWorkout } = useTracker()
  const { showModal } = useModal()
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ name: string; muscles: string; setup: string; superset: string; tier: string; equipment: string }>({ name: '', muscles: '', setup: '', superset: '', tier: '', equipment: '' })
  const [newEx, setNewEx] = useState<{
    name: string
    muscles: string
    setup: string
    superset: string
    tier: Exercise['tier']
    equipment: Exercise['equipment']
  }>({ name: '', muscles: '', setup: '', superset: '', tier: '', equipment: '' })
  const [workoutToAdd, setWorkoutToAdd] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTiers, setSelectedTiers] = useState<string[]>([])

  // Library-wide tier counts — deliberately NOT derived from the filtered list, so
  // the numbers on the pills stay put while the user types.
  const tierCounts = useMemo(() => {
    // Keys come from the tier order, so a new tier needs no edit here.
    const counts: Record<string, number> = {}
    for (const tier of order()) counts[tier] = 0
    for (const ex of data?.exercises ?? []) {
      if (ex.tier in counts) counts[ex.tier]++
    }
    return counts
  }, [data?.exercises])

  // ✅ useMemo BEFORE the conditional return — hook count must be stable
  const filteredExercises = useMemo(() => {
    const exercises = data?.exercises ?? []
    const query = searchQuery.trim().toLowerCase()
    // Tier pills AND the text search — both must pass. No active pill = all tiers.
    return exercises.filter(ex => {
      if (selectedTiers.length > 0 && !selectedTiers.includes(ex.tier)) return false
      if (!query) return true
      return ex.name.toLowerCase().includes(query) ||
        (ex.muscles && ex.muscles.some(m => m.toLowerCase().includes(query))) ||
        (ex.setup && ex.setup.toLowerCase().includes(query))
    })
  }, [data?.exercises, searchQuery, selectedTiers])

  function toggleTier(tier: string) {
    setSelectedTiers(prev =>
      prev.includes(tier) ? prev.filter(t => t !== tier) : [...prev, tier]
    )
  }

  // ✅ Early return AFTER all hooks
  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading...</p>

  function handleAdd() {
    if (!newEx.name.trim()) return
    const id = addExercise({
      name: newEx.name,
      muscles: newEx.muscles.split(',').map(m => m.trim()).filter(Boolean),
      setup: newEx.setup,
      superset: newEx.superset,
      tier: newEx.tier,
      equipment: newEx.equipment as Exercise['equipment']
    })
    Object.entries(workoutToAdd).forEach(([workoutName, checked]) => {
      if (checked) addExerciseToWorkout(workoutName, id)
    })
    setNewEx({ name: '', muscles: '', setup: '', superset: '', tier: '', equipment: '' })
    setWorkoutToAdd({})
    setShowAdd(false)
  }

  function startEdit(ex: Exercise) {
    setEditingId(ex.id)
    setEditValues({
      name: ex.name || '',
      muscles: (ex.muscles || []).join(', '),
      setup: ex.setup || '',
      superset: ex.superset || '',
      tier: ex.tier || '',
      equipment: ex.equipment || ''
    })
  }

  function saveEdit(exId: string) {
    Object.entries(editValues).forEach(([field, value]) => {
      const val = field === 'muscles' ? value.split(',').map(m => m.trim()).filter(Boolean) : value
      updateExerciseDef(exId, field as 'name' | 'setup' | 'superset' | 'tier' | 'equipment' | 'muscles', val)
    })
    setEditingId(null)
    setEditValues({ name: '', muscles: '', setup: '', superset: '', tier: '', equipment: '' })
  }

  function getWorkoutNamesForExercise(exId: string): string[] {
    return data!.workouts.filter(w => w.exercises.includes(exId)).map(w => w.name)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Exercises</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{filteredExercises.length} exercises in library</p>
        </div>
        <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add Exercise</Button>
      </div>

      <div className="tier-filter-row" role="group" aria-label="Filter by tier">
        {TIER_PILLS
          // The untiered pill only appears once a user-created exercise needs it —
          // a permanently-dead filter on the default library is just noise.
          .filter(({ tier }) => tier !== '' || tierCounts[''] > 0)
          .map(({ tier, label, tone }) => {
            const active = selectedTiers.includes(tier)
            return (
              <Pill
                key={label}
                tone={tone}
                active={active}
                count={tierCounts[tier]}
                aria-label={`${label}, ${tierCounts[tier]} exercise${tierCounts[tier] === 1 ? '' : 's'}${active ? ', selected' : ''}`}
                onClick={() => toggleTier(tier)}
              >
                {label}
              </Pill>
            )
          })}
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search by name, muscle, or setup..."
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
        {filteredExercises.length === 0 && (data?.exercises.length ?? 0) > 0 && (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            No exercises match the current filters.
          </p>
        )}
        {filteredExercises.map(ex => {
          const workouts = getWorkoutNamesForExercise(ex.id)
          const isEditing = editingId === ex.id

          return (
            <div key={ex.id} className="card" style={{ padding: 16 }}>
              {isEditing ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr auto', gap: 8, alignItems: 'end', marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>Name</label>
                      <input type="text" value={editValues.name} onChange={e => setEditValues({ ...editValues, name: e.target.value })} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>Muscles (comma-sep)</label>
                      <input type="text" value={editValues.muscles} onChange={e => setEditValues({ ...editValues, muscles: e.target.value })} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>Equipment</label>
                      <select aria-label="Equipment" value={editValues.equipment} onChange={e => setEditValues({ ...editValues, equipment: e.target.value })} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, fontSize: '0.85rem' }}>
                        <option value="">None</option>
                        <option value="barbell">Barbell</option>
                      </select>
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
                        {order().filter(t => t !== '').map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Button size="sm" variant="success" onClick={() => saveEdit(ex.id)}>Save</Button>
                      <Button size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, marginRight: 8 }}>Add to workout:</label>
                    {data!.workouts.filter(w => !w.exercises.includes(ex.id)).map(w => (
                      <Button key={w.name} size="sm" style={{ marginRight: 4 }} onClick={() => addExerciseToWorkout(w.name, ex.id)}>
                        + {w.name}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <Link to={`/exercises/${encodeURIComponent(ex.id)}`} style={{ color: 'inherit', fontWeight: 600, textDecoration: 'none' }}>
                      {ex.name}
                    </Link>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {ex.tier && <span className={'tier-badge tier-' + ex.tier}>{ex.tier}</span>}
                      {ex.equipment && EQUIPMENT_LABELS[ex.equipment] && (
                        <span className="tag equipment">{EQUIPMENT_LABELS[ex.equipment]}</span>
                      )}
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
                  <Button size="sm" onClick={() => startEdit(ex)}>Edit</Button>
                  <Button size="sm" danger onClick={() => {
                    showModal({
                      title: 'Delete Exercise',
                      message: `Delete "${ex.name}"? It will be removed from all workouts.`,
                      actions: [
                        { label: 'Cancel', value: null },
                        { label: 'Delete', value: 'confirm', variant: 'danger' }
                      ]
                    }).then(result => {
                      if (result.action === 'confirm') deleteExercise(ex.id)
                    })
                  }}>Delete</Button>
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
              <label htmlFor="new-ex-equipment">Equipment</label>
              <select id="new-ex-equipment" value={newEx.equipment} onChange={e => setNewEx({ ...newEx, equipment: e.target.value as Exercise['equipment'] })}>
                <option value="">None</option>
                <option value="barbell">Barbell</option>
              </select>
            </div>
            <div className="form-group">
              <label>Tier</label>
              <select value={newEx.tier} onChange={e => setNewEx({ ...newEx, tier: e.target.value as Exercise['tier'] })}>
                <option value="">None</option>
                {order().filter(t => t !== '').map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 8 }}>Add to workouts (optional)</label>
              {data!.workouts.map(w => (
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
              <Button onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button variant="success" onClick={handleAdd} disabled={!newEx.name.trim()}>Add Exercise</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
