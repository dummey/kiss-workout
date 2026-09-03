import React, { useState, useEffect, createContext, useContext, useMemo } from 'react'
import { getStore, setStore } from './db'
import { SEED_DATA } from './data'
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

  useEffect(() => {
    initDB()
  }, [])

  async function initDB() {
    try {
      const stored = await getStore('tracker') as TrackerData | null
      if (stored) {
        setData(stored)
      } else {
        // Don't auto-load seed data — user can click "Load Seed" on Settings page
        setData(null)
      }
    } catch (err) {
      console.error('Failed to initialize database:', err)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  async function saveData(newData: TrackerData) {
    setData(newData)
    await setStore('tracker', newData)
  }

  function getExercise(id: string): Exercise | undefined {
    return data?.exercises.find(ex => ex.id === id)
  }

  function getWorkoutExercises(workoutName: string): Exercise[] {
    const workout = data?.workouts.find(w => w.name === workoutName)
    if (!workout) return []
    return workout.exercises.map(id => getExercise(id)).filter((ex): ex is Exercise => ex !== undefined)
  }

  function addSession(date: string, workoutType: string): Session | null {
    if (!data) return null
    if (data.sessions.some(s => s.date === date)) {
      alert(`A session already exists on ${date}. Please pick a different date.`)
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
    return newSession
  }

  function deleteSession(date: string) {
    if (!data) return
    const newData: TrackerData = {
      ...data,
      sessions: data.sessions.filter(s => s.date !== date)
    }
    saveData(newData)
  }

  function updateSessionNotes(date: string, notes: string) {
    if (!data) return
    const newData = { ...data }
    const session = newData.sessions.find(s => s.date === date)
    if (!session) return
    session.notes = notes
    saveData(newData)
  }

  function updateSessionTime(date: string, elapsedTime: number) {
    if (!data) return
    const newData = { ...data }
    const session = newData.sessions.find(s => s.date === date)
    if (!session) return
    session.elapsedTime = elapsedTime
    saveData(newData)
  }

  function updateExercise(sessionDate: string, exIdx: number, field: 'weight' | 'reps' | 'sets', value: string) {
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
  }

  function addExercise(exercise: Partial<Exercise> & { name: string }): string {
    if (!data) return ''
    const baseId = exercise.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    let id = baseId
    let counter = 2
    while (data.exercises.some(ex => ex.id === id)) {
      id = `${baseId}-${counter++}`
    }
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
  }

  function updateExerciseDef(exId: string, field: 'name' | 'setup' | 'superset' | 'tier' | 'muscles', value: string | string[]) {
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
  }

  function deleteExercise(exId: string) {
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
  }

  function addExerciseToWorkout(workoutName: string, exId: string) {
    if (!data) return
    const newData = { ...data }
    const workout = newData.workouts.find(w => w.name === workoutName)
    if (!workout) return
    if (!workout.exercises.includes(exId)) {
      workout.exercises.push(exId)
      saveData(newData)
    }
  }

  function removeExerciseFromWorkout(workoutName: string, exId: string) {
    if (!data) return
    const newData = { ...data }
    const workout = newData.workouts.find(w => w.name === workoutName)
    if (!workout) return
    workout.exercises = workout.exercises.filter(id => id !== exId)
    saveData(newData)
  }

  function addWorkout(name: string) {
    if (!data) return
    const newData: TrackerData = {
      ...data,
      workouts: [...data.workouts, { name, exercises: [] }]
    }
    saveData(newData)
  }

  function updateWorkout(oldName: string, newName: string) {
    if (!data) return
    const newData = { ...data }
    const workout = newData.workouts.find(w => w.name === oldName)
    if (!workout) return
    workout.name = newName
    newData.sessions.forEach(s => {
      if (s.workoutName === oldName) s.workoutName = newName
    })
    saveData(newData)
  }

  function deleteWorkout(name: string) {
    if (!data) return
    const newData: TrackerData = {
      ...data,
      workouts: data.workouts.filter(w => w.name !== name)
    }
    saveData(newData)
  }

  async function resetToSeedData() {
    await setStore('tracker', SEED_DATA)
    setData(SEED_DATA)
  }

  async function deleteAllData() {
    const emptyData: TrackerData = {
      meta: { method: 'GZCL', created: new Date().toISOString() },
      exercises: [],
      workouts: [],
      sessions: []
    }
    await setStore('tracker', emptyData)
    setData(emptyData)
  }

  function getPreviousPerformance(exName: string, currentDate: string): PreviousPerformance | null {
    let best: SessionExercise | null = null
    let bestDate = ''

    if (data?.sessions) {
      data.sessions.forEach(session => {
        if (dateCompare(session.date, currentDate) >= 0) return
        session.exercises.forEach(ex => {
          if (ex.name !== exName) return
          if (!ex.weight && !ex.reps) return
          if (!bestDate || dateCompare(session.date, bestDate) > 0) {
            best = ex
            bestDate = session.date
          }
        })
      })
    }

    if (!best) return null

    return {
      weight: best.weight || '—',
      reps: best.reps || '—',
      sets: best.sets !== null && best.sets !== undefined ? best.sets : '—',
      date: bestDate
    }
  }

  function dateCompare(a: string, b: string): number {
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
  }

  const value = useMemo<TrackerContextValue>(() => ({
    data,
    loading,
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
    getPreviousPerformance,
    dateCompare,
    deleteAllData,
    resetToSeedData
  }), [data, loading])

  return (
    <TrackerContext.Provider value={value}>
      {children}
    </TrackerContext.Provider>
  )
}
