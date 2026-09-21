import React, { useState, useEffect, createContext, useContext, useMemo, useCallback } from 'react'
import { getStore, setStore } from './db'
import { SEED_DATA } from './data'
import { useBackup } from './context/BackupContext'
import type { TrackerData, TrackerContextValue, Exercise, Session, SessionExercise, PreviousPerformance } from './types'

const TrackerContext = createContext<TrackerContextValue | null>(null)

export function useTracker(): TrackerContextValue {
  const ctx = useContext(TrackerContext)
  if (!ctx) throw new Error('useTracker must be used within TrackerProvider')
  return ctx
}

export function TrackerProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<TrackerData | null>(null)
  const [loading, setLoading] = useState(true)
  const { incrementBackupCounter, resetBackupMeta } = useBackup()

  useEffect(() => {
    initDB()
  }, [])

  async function initDB() {
    try {
      const stored = await getStore('tracker') as TrackerData | null
      if (stored) {
        setData(stored)
      } else {
        setData(null)
      }
    } catch (err) {
      console.error('Failed to initialize database:', err)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const saveData = useCallback(async (newData: TrackerData) => {
    const previousData = data
    setData(newData)
    try {
      await setStore('tracker', newData)
    } catch (err) {
      console.error('Failed to save data:', err)
      setData(previousData)
      setError('Failed to save changes. Your data has been reverted.')
    }
  }, [data])

  const getExercise = useCallback((id: string): Exercise | undefined => {
    return data?.exercises.find(ex => ex.id === id)
  }, [data])

  const getWorkoutExercises = useCallback((workoutName: string): Exercise[] => {
    const workout = data?.workouts.find(w => w.name === workoutName)
    if (!workout) return []
    return workout.exercises.map(id => getExercise(id)).filter((ex): ex is Exercise => ex !== undefined)
  }, [data, getExercise])

  const addSession = useCallback((date: string, workoutType: string): Session | null => {
    if (!data) return null
    if (data.sessions.some(s => s.date === date)) {
      return null
    }

    const workout = data.workouts.find(w => w.name === workoutType)
    if (!workout) return null

    const newSession: Session = {
      date,
      workoutName: workoutType,
      elapsedTime: 0,
      notes: '',
      exercises: workout.exercises.map(id => {
        const ex = getExercise(id)!
        return {
          id: ex.id,
          name: ex.name,
          muscles: ex.muscles || [],
          setup: ex.setup || '',
          tier: ex.tier || '',
          superset: ex.superset || '',
          weight: '',
          reps: '',
          sets: null
        }
      })
    }

    const newData: TrackerData = {
      ...data,
      sessions: [newSession, ...data.sessions]
    }
    saveData(newData)
    incrementBackupCounter()
    return newSession
  }, [data, getExercise, saveData, incrementBackupCounter])

  const deleteSession = useCallback((date: string) => {
    if (!data) return
    const newData: TrackerData = {
      ...data,
      sessions: data.sessions.filter(s => s.date !== date)
    }
    saveData(newData)
  }, [data, saveData])

  const updateSessionNotes = useCallback((date: string, notes: string) => {
    if (!data) return
    const newData = { ...data }
    const session = newData.sessions.find(s => s.date === date)
    if (!session) return
    session.notes = notes
    saveData(newData)
  }, [data, saveData])

  const updateSessionTime = useCallback((date: string, elapsedTime: number) => {
    if (!data) return
    const newData = { ...data }
    const session = newData.sessions.find(s => s.date === date)
    if (!session) return
    session.elapsedTime = elapsedTime
    saveData(newData)
  }, [data, saveData])

  const updateExercise = useCallback((sessionDate: string, exIdx: number, field: 'weight' | 'reps' | 'sets', value: string) => {
    if (!data) return
    const newData = { ...data }
    const session = newData.sessions.find(s => s.date === sessionDate)
    if (!session) return
    const ex = session.exercises[exIdx]
    if (field === 'weight') ex.weight = value
    else if (field === 'reps') ex.reps = value
    else if (field === 'sets') {
      if (value === '') ex.sets = null
      else { const n = parseInt(value, 10); ex.sets = isNaN(n) ? null : n }
    }
    saveData(newData)
  }, [data, saveData])

  const addExercise = useCallback((exercise: Partial<Exercise> & { name: string }): string => {
    if (!data) return ''
    const baseId = exercise.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const id = `${baseId}-${crypto.randomUUID()}`
    const newEx: Exercise = {
      id,
      name: exercise.name || '',
      muscles: exercise.muscles || [],
      setup: exercise.setup || '',
      superset: exercise.superset || '',
      tier: exercise.tier || ''
    }
    const newData: TrackerData = {
      ...data,
      exercises: [...data.exercises, newEx]
    }
    saveData(newData)
    return id
  }, [data, saveData])

  const updateExerciseDef = useCallback((exId: string, field: 'name' | 'setup' | 'superset' | 'tier' | 'muscles', value: string | string[]) => {
    if (!data) return
    const newData = { ...data }
    const ex = newData.exercises.find(e => e.id === exId)
    if (!ex) return
    if (field === 'name') ex.name = value as string
    else if (field === 'setup') ex.setup = value as string
    else if (field === 'superset') ex.superset = value as string
    else if (field === 'tier') ex.tier = value as Exercise['tier']
    else if (field === 'muscles') ex.muscles = value as string[]
    saveData(newData)
  }, [data, saveData])

  const deleteExercise = useCallback((exId: string) => {
    if (!data) return
    const newData = { ...data }
    newData.exercises = newData.exercises.filter(e => e.id !== exId)
    newData.workouts.forEach(w => {
      w.exercises = w.exercises.filter(id => id !== exId)
    })
    newData.sessions.forEach(s => {
      s.exercises = s.exercises.filter(se => se.id !== exId)
    })
    saveData(newData)
  }, [data, saveData])

  const addExerciseToWorkout = useCallback((workoutName: string, exId: string) => {
    if (!data) return
    const newData = { ...data }
    const workout = newData.workouts.find(w => w.name === workoutName)
    if (!workout) return
    if (!workout.exercises.includes(exId)) {
      workout.exercises.push(exId)
      saveData(newData)
    }
  }, [data, saveData])

  const removeExerciseFromWorkout = useCallback((workoutName: string, exId: string) => {
    if (!data) return
    const newData = { ...data }
    const workout = newData.workouts.find(w => w.name === workoutName)
    if (!workout) return
    workout.exercises = workout.exercises.filter(id => id !== exId)
    saveData(newData)
  }, [data, saveData])

  const addWorkout = useCallback((name: string) => {
    if (!data) return
    const newData: TrackerData = {
      ...data,
      workouts: [...data.workouts, { name, exercises: [] }]
    }
    saveData(newData)
  }, [data, saveData])

  const updateWorkout = useCallback((oldName: string, newName: string) => {
    if (!data) return
    const newData = { ...data }
    const workout = newData.workouts.find(w => w.name === oldName)
    if (!workout) return
    workout.name = newName
    newData.sessions.forEach(s => {
      if (s.workoutName === oldName) s.workoutName = newName
    })
    saveData(newData)
  }, [data, saveData])

  const deleteWorkout = useCallback((name: string) => {
    if (!data) return
    const newData: TrackerData = {
      ...data,
      workouts: data.workouts.filter(w => w.name !== name)
    }
    saveData(newData)
  }, [data, saveData])

  const cloneWorkout = useCallback((sourceName: string, newName: string) => {
    if (!data) return
    const source = data.workouts.find(w => w.name === sourceName)
    if (!source) return
    const newData: TrackerData = {
      ...data,
      workouts: [...data.workouts, { name: newName, exercises: [...source.exercises] }]
    }
    saveData(newData)
  }, [data, saveData])

  const reorderWorkoutExercise = useCallback((workoutName: string, fromIndex: number, toIndex: number) => {
    if (!data) return
    const workout = data.workouts.find(w => w.name === workoutName)
    if (!workout) return
    if (fromIndex < 0 || fromIndex >= workout.exercises.length) return
    if (toIndex < 0 || toIndex >= workout.exercises.length) return
    if (fromIndex === toIndex) return

    const newExercises = [...workout.exercises]
    const [removed] = newExercises.splice(fromIndex, 1)
    newExercises.splice(toIndex, 0, removed)

    const newData = { ...data }
    const target = newData.workouts.find(w => w.name === workoutName)!
    target.exercises = newExercises
    saveData(newData)
  }, [data, saveData])

  const resetToSeedData = useCallback(async () => {
    await setStore('tracker', SEED_DATA)
    setData(SEED_DATA)
  }, [])

  const deleteAllData = useCallback(async () => {
    const emptyData: TrackerData = {
      meta: { method: 'GZCL', created: new Date().toISOString() },
      exercises: [],
      workouts: [],
      sessions: []
    }
    await setStore('tracker', emptyData)
    await resetBackupMeta()
    setData(emptyData)
  }, [resetBackupMeta])

  const importSession = useCallback((session: Session, overwrite = false) => {
    if (!data) return false
    const existingIdx = data.sessions.findIndex(s => s.date === session.date)
    if (existingIdx >= 0 && !overwrite) {
      return false
    }
    const newData = { ...data }
    if (existingIdx >= 0) {
      newData.sessions[existingIdx] = session
    } else {
      newData.sessions = [session, ...data.sessions]
    }
    saveData(newData)
    incrementBackupCounter()
    return true
  }, [data, saveData, incrementBackupCounter])

  const addExerciseToSession = useCallback((sessionDate: string, exId: string) => {
    if (!data) return
    const session = data.sessions.find(s => s.date === sessionDate)
    if (!session) return
    const ex = getExercise(exId)
    if (!ex) return
    if (session.exercises.some(se => se.id === exId || se.originalId === exId)) return

    const newEx: SessionExercise = {
      id: ex.id,
      name: ex.name,
      muscles: ex.muscles || [],
      setup: ex.setup || '',
      tier: ex.tier || '',
      superset: '',
      weight: '',
      reps: '',
      sets: null
    }

    const newData = { ...data }
    const target = newData.sessions.find(s => s.date === sessionDate)!
    target.exercises = [...target.exercises, newEx]
    saveData(newData)
  }, [data, getExercise, saveData])

  const duplicateExerciseInSession = useCallback((sessionDate: string, exIdx: number) => {
    if (!data) return
    const session = data.sessions.find(s => s.date === sessionDate)
    if (!session || !session.exercises[exIdx]) return

    const original = session.exercises[exIdx]
    const copy: SessionExercise = {
      ...original,
      id: `${original.id}-copy-${crypto.randomUUID()}`,
      originalId: original.id,
      name: `${original.name} (2)`,
      weight: '',
      reps: '',
      sets: null
    }

    const newData = { ...data }
    const target = newData.sessions.find(s => s.date === sessionDate)!
    target.exercises = [
      ...target.exercises.slice(0, exIdx + 1),
      copy,
      ...target.exercises.slice(exIdx + 1)
    ]
    saveData(newData)
  }, [data, saveData])

  const canRemoveExerciseFromSession = useCallback((sessionDate: string, exId: string): boolean => {
    if (!data) return false
    const session = data.sessions.find(s => s.date === sessionDate)
    if (!session) return false

    const ex = session.exercises.find(e => e.id === exId)
    if (!ex) return false

    if (ex.tier === 'T1') {
      const t1Count = session.exercises.filter(e => e.tier === 'T1').length
      if (t1Count <= 1) return false
    }

    return true
  }, [data])

  const removeExerciseFromSession = useCallback((sessionDate: string, exId: string) => {
    if (!canRemoveExerciseFromSession(sessionDate, exId)) return

    const newData = { ...data }
    const target = newData.sessions.find(s => s.date === sessionDate)!
    target.exercises = target.exercises.filter(e => e.id !== exId)
    saveData(newData)
  }, [data, saveData, canRemoveExerciseFromSession])

  const getPreviousPerformances = useCallback((exId: string, currentDate: string): PreviousPerformance[] => {
    let bestSession: typeof data.sessions[number] | null = null

    if (data?.sessions) {
      data.sessions.forEach(session => {
        if (dateCompare(session.date, currentDate) >= 0) return
        let hasMatch = false
        session.exercises.forEach(ex => {
          if (!hasMatch && ex.id !== exId && ex.originalId !== exId) return
          if (!ex.weight && !ex.reps) return
          if (!hasMatch) {
            hasMatch = true
            if (!bestSession || dateCompare(session.date, bestSession.date) > 0) {
              bestSession = session
            }
          }
        })
      })
    }

    if (!bestSession) return []

    const exercises = bestSession.exercises.filter(ex => (ex.id === exId || ex.originalId === exId) && (ex.weight || ex.reps))

    if (exercises.length === 0) return []

    return exercises.map(ex => ({
      weight: ex.weight || '—',
      reps: ex.reps || '—',
      sets: ex.sets !== null && ex.sets !== undefined ? ex.sets : '—',
      date: bestSession.date
    }))
  }, [data])

  const dateCompare = useCallback((a: string, b: string): number => {
    const parse = (d: string): string => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
      if (/^\d{1,2}\/\d{1,2}(\s*-\s*\d{1,2}\/\d{1,2})?$/.test(d)) {
        const main = d.split('-')[0].trim()
        const parts = main.split('/')
        return `2026-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
      }
      return '0000-00-00'
    }
    return parse(a).localeCompare(parse(b))
  }, [])

  const value = useMemo<TrackerContextValue>(() => ({
    data,
    loading,
    error,
    clearError,
    getExercise,
    getWorkoutExercises,
    addSession,
    deleteSession,
    updateSessionNotes,
    updateSessionTime,
    updateExercise,
    addExercise,
    updateExerciseDef,
    deleteExercise,
    addExerciseToWorkout,
    removeExerciseFromWorkout,
    addWorkout,
    updateWorkout,
    deleteWorkout,
    getPreviousPerformances,
    dateCompare,
    deleteAllData,
    resetToSeedData,
    importSession,
    addExerciseToSession,
    removeExerciseFromSession,
    canRemoveExerciseFromSession,
    duplicateExerciseInSession,
    cloneWorkout,
    reorderWorkoutExercise
  }), [data, loading, error, clearError, getExercise, getWorkoutExercises, addSession, deleteSession, updateSessionNotes, updateSessionTime, updateExercise, addExercise, updateExerciseDef, deleteExercise, addExerciseToWorkout, removeExerciseFromWorkout, addWorkout, updateWorkout, deleteWorkout, getPreviousPerformances, dateCompare, deleteAllData, resetToSeedData, importSession, addExerciseToSession, removeExerciseFromSession, canRemoveExerciseFromSession, duplicateExerciseInSession, cloneWorkout, reorderWorkoutExercise])

  return (
    <TrackerContext.Provider value={value}>
      {error && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: 'var(--t1)',
          color: '#fff',
          padding: '8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.85rem'
        }}>
          <span>{error}</span>
          <button
            onClick={clearError}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: '0 4px'
            }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
      {children}
    </TrackerContext.Provider>
  )
}
