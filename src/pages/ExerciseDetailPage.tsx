import React, { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BodyMusclesChart from '../components/BodyMusclesChart'
import { useTracker } from '../context'
import type { SessionExercise } from '../types'

const EMPTY_VALUE = '—'
const HISTORY_LIMIT = 12

type HistoryRecord = SessionExercise & { sessionDate: string }

function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY_VALUE
  if (typeof value === 'string' && value.trim() === '') return EMPTY_VALUE
  return String(value)
}

export default function ExerciseDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data, loading, getExercise, dateCompare } = useTracker()
  const [historySearch, setHistorySearch] = useState('')

  const exercise = getExercise(id)
  const workoutNames = useMemo(
    () => data?.workouts.filter(workout => workout.exercises.includes(id)).map(workout => workout.name) ?? [],
    [data?.workouts, id]
  )

  const history = useMemo<HistoryRecord[]>(() => {
    if (!data) return []

    return data.sessions
      .flatMap(session => session.exercises
        .filter(record => record.id === id || record.originalId === id)
        .map(record => ({ ...record, sessionDate: session.date })))
      .sort((a, b) => dateCompare(b.sessionDate, a.sessionDate))
      .slice(0, HISTORY_LIMIT)
  }, [data, dateCompare, id])

  const formattedHistory = useMemo(() => history.map(record => ({
    ...record,
    formattedDate: formatValue(record.sessionDate),
    formattedWeight: formatValue(record.weight),
    formattedReps: formatValue(record.reps),
    formattedSets: formatValue(record.sets),
    formattedFailed: record.failed === true ? 'Failed' : EMPTY_VALUE
  })), [history])

  const visibleHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase()
    if (!query) return formattedHistory
    return formattedHistory.filter(record => [
      record.formattedDate,
      record.formattedWeight,
      record.formattedReps,
      record.formattedSets,
      record.formattedFailed
    ].some(value => value.toLowerCase().includes(query)))
  }, [formattedHistory, historySearch])

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading...</p>

  if (!exercise) {
    return (
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>Exercise not found</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 16 }}>This exercise is no longer in your library.</p>
        <Link to="/exercises" className="btn">Back to Exercises</Link>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{exercise.name}</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 4 }}>Exercise details</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div>
            <dt style={{ color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Tier</dt>
            <dd>{exercise.tier ? <span className={'tier-badge tier-' + exercise.tier}>{exercise.tier}</span> : EMPTY_VALUE}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Muscles</dt>
            <dd style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {exercise.muscles.length > 0 ? exercise.muscles.map(muscle => <span key={muscle} className="tag muscle">{muscle}</span>) : EMPTY_VALUE}
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Setup</dt>
            <dd>{formatValue(exercise.setup)}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Superset</dt>
            <dd>{formatValue(exercise.superset)}</dd>
          </div>
        </dl>
        <div style={{ marginTop: 18 }}>
          <div style={{ color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Workouts</div>
          {workoutNames.length > 0 ? workoutNames.map(name => <span key={name} className="tag setup" style={{ marginRight: 6 }}>{name}</span>) : EMPTY_VALUE}
        </div>
      </div>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>Target Muscles</h2>
      <BodyMusclesChart muscles={exercise.muscles} allMuscles={exercise.muscles} />

      <section aria-labelledby="history-heading" style={{ marginTop: 8 }}>
        <h2 id="history-heading" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>History</h2>
        <label htmlFor="history-search" style={{ display: 'block', color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 700, marginBottom: 6 }}>Search history</label>
        <input
          id="history-search"
          type="search"
          value={historySearch}
          onChange={event => setHistorySearch(event.target.value)}
          placeholder="Search date, weight, reps, sets, or Failed..."
          style={{
            width: '100%', padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text)', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12
          }}
        />

        {history.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No history for this exercise.</p>
        ) : visibleHistory.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No history rows match your search.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <thead>
                <tr>
                  {['Date', 'Weight', 'Reps', 'Sets', 'Failed'].map(column => (
                    <th key={column} scope="col" style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleHistory.map((record, index) => (
                  <tr key={`${record.id}-${record.sessionDate}-${index}`} style={{ borderBottom: index === visibleHistory.length - 1 ? 'none' : '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>{record.formattedDate}</td>
                    <td style={{ padding: '10px 12px' }}>{record.formattedWeight}</td>
                    <td style={{ padding: '10px 12px' }}>{record.formattedReps}</td>
                    <td style={{ padding: '10px 12px' }}>{record.formattedSets}</td>
                    <td style={{ padding: '10px 12px' }}>{record.formattedFailed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
