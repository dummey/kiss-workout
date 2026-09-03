import React, { useState, useEffect, createContext, useContext, useMemo } from 'react'
import { getStore, setStore } from './db'
import { SEED_DATA } from './data'

const TrackerContext = createContext(null)

export function useTracker() {
  return useContext(TrackerContext)
}

export function TrackerProvider({ children }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initDB()
  }, [])

  async function initDB() {
    try {
      const stored = await getStore('tracker')
      if (stored) {
        setData(stored)
      } else {
        setData(SEED_DATA)
        await setStore('tracker', SEED_DATA)
      }
    } catch (err) {
      console.error('Failed to initialize database:', err)
      setData(SEED_DATA)
    } finally {
      setLoading(false)
    }
  }

  async function saveData(newData) {
    setData(newData)
    await setStore('tracker', newData)
  }

  // Get full exercise definition by ID
  function getExercise(id) {
    return data?.exercises.find(ex => ex.id === id)
  }

  // Get exercises for a workout (resolves IDs)
  function getWorkoutExercises(workoutName) {
    const workout = data.workouts.find(w => w.name === workoutName)
    if (!workout) return []
    return workout.exercises.map(id => getExercise(id)).filter(Boolean)
  }

  function addSession(date, workoutType) {
    // Guard against duplicate dates — route key is :date, so duplicates are unreachable
    if (data.sessions.some(s => s.date === date)) {
      alert(`A session already exists on ${date}. Please pick a different date.`)
      return null
    }

    const workout = data.workouts.find(w => w.name === workoutType)
    if (!workout) return

    const newSession = {
      date,
      workoutName: workoutType,
      exercises: workout.exercises.map(id => {
        const ex = getExercise(id)
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

    const newData = {
      ...data,
      sessions: [newSession, ...data.sessions]
    }
    saveData(newData)
    return newSession
  }

  function deleteSession(date) {
    const newData = {
      ...data,
      sessions: data.sessions.filter(s => s.date !== date)
    }
    saveData(newData)
  }

  function updateSessionNotes(date, notes) {
    const newData = { ...data }
    const session = newData.sessions.find(s => s.date === date)
    if (!session) return
    session.notes = notes
    saveData(newData)
  }

  function updateSessionTime(date, elapsedTime) {
    const newData = { ...data }
    const session = newData.sessions.find(s => s.date === date)
    if (!session) return
    session.elapsedTime = elapsedTime
    saveData(newData)
  }

  function updateExercise(sessionDate, exIdx, field, value) {
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

  // Exercise library CRUD
  function addExercise(exercise) {
    const baseId = exercise.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    let id = baseId
    let counter = 2
    while (data.exercises.some(ex => ex.id === id)) {
      id = `${baseId}-${counter++}`
    }
    const newEx = {
      id,
      name: exercise.name || '',
      muscles: exercise.muscles || [],
      setup: exercise.setup || '',
      superset: exercise.superset || '',
      tier: exercise.tier || ''
    }
    const newData = {
      ...data,
      exercises: [...data.exercises, newEx]
    }
    saveData(newData)
    return id
  }

  function updateExerciseDef(exId, field, value) {
    const newData = { ...data }
    const ex = newData.exercises.find(e => e.id === exId)
    if (!ex) return
    if (field === 'name') ex.name = value
    else if (field === 'setup') ex.setup = value
    else if (field === 'superset') ex.superset = value
    else if (field === 'tier') ex.tier = value
    else if (field === 'muscles') ex.muscles = value
    saveData(newData)
  }

  function deleteExercise(exId) {
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

  // Add exercise to a workout
  function addExerciseToWorkout(workoutName, exId) {
    const newData = { ...data }
    const workout = newData.workouts.find(w => w.name === workoutName)
    if (!workout) return
    if (!workout.exercises.includes(exId)) {
      workout.exercises.push(exId)
      saveData(newData)
    }
  }

  // Remove exercise from a workout
  function removeExerciseFromWorkout(workoutName, exId) {
    const newData = { ...data }
    const workout = newData.workouts.find(w => w.name === workoutName)
    if (!workout) return
    workout.exercises = workout.exercises.filter(id => id !== exId)
    saveData(newData)
  }

  // Workout CRUD
  function addWorkout(name) {
    const newData = {
      ...data,
      workouts: [...data.workouts, { name, exercises: [] }]
    }
    saveData(newData)
  }

  function updateWorkout(oldName, newName) {
    const newData = { ...data }
    const workout = newData.workouts.find(w => w.name === oldName)
    if (!workout) return
    workout.name = newName
    // Update workoutName references in sessions
    newData.sessions.forEach(s => {
      if (s.workoutName === oldName) s.workoutName = newName
    })
    saveData(newData)
  }

  function deleteWorkout(name) {
    const newData = {
      ...data,
      workouts: data.workouts.filter(w => w.name !== name)
    }
    saveData(newData)
  }

  function getPreviousPerformance(exName, currentDate) {
    let best = null
    let bestDate = ''

    if (data.sessions) {
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

  function dateCompare(a, b) {
    const parse = (d) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
      if (/^\d{1,2}\/\d{1,2}(\s*-\s*\d{1,2}\/\d{1,2})?$/.test(d)) {
        const main = d.split('-')[0].trim()
        const parts = main.split('/')
        return `2026-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`
      }
      return '0000-00-00'
    }
    return parse(a).localeCompare(parse(b))
  }

  const value = useMemo(() => ({
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
    dateCompare
  }), [data, loading])

  return (
    <TrackerContext.Provider value={value}>
      {children}
    </TrackerContext.Provider>
  )
}
