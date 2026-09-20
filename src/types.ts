export interface Exercise {
  id: string
  name: string
  muscles: string[]
  setup: string
  superset: string
  tier: 'T1' | 'T2' | 'T3' | ''
}

export interface Workout {
  name: string
  exercises: string[]
}

export interface SessionExercise {
  id: string
  name: string
  muscles: string[]
  setup: string
  tier: string
  superset: string
  weight: string
  reps: string
  sets: number | null
  originalId?: string
}

export interface Session {
  date: string
  workoutName: string
  elapsedTime: number
  notes: string
  exercises: SessionExercise[]
}

export interface TrackerData {
  meta: {
    method: string
    created: string
  }
  exercises: Exercise[]
  workouts: Workout[]
  sessions: Session[]
}

export interface PreviousPerformance {
  weight: string
  reps: string
  sets: number | string
  date: string
}

export interface TrackerContextValue {
  data: TrackerData | null
  loading: boolean
  getExercise: (id: string) => Exercise | undefined
  getWorkoutExercises: (workoutName: string) => Exercise[]
  addSession: (date: string, workoutType: string) => Session | null | undefined
  deleteSession: (date: string) => void
  updateSessionNotes: (date: string, notes: string) => void
  updateSessionTime: (date: string, elapsedTime: number) => void
  updateExercise: (sessionDate: string, exIdx: number, field: 'weight' | 'reps' | 'sets', value: string) => void
  addExercise: (exercise: Partial<Exercise> & { name: string }) => string
  updateExerciseDef: (exId: string, field: 'name' | 'setup' | 'superset' | 'tier' | 'muscles', value: string | string[]) => void
  deleteExercise: (exId: string) => void
  addExerciseToWorkout: (workoutName: string, exId: string) => void
  removeExerciseFromWorkout: (workoutName: string, exId: string) => void
  addWorkout: (name: string) => void
  updateWorkout: (oldName: string, newName: string) => void
  deleteWorkout: (name: string) => void
  getPreviousPerformances: (exId: string, currentDate: string) => PreviousPerformance[]
  dateCompare: (a: string, b: string) => number
  deleteAllData: () => Promise<void>
  resetToSeedData: () => Promise<void>
  importSession: (session: Session, overwrite?: boolean) => boolean
  addExerciseToSession: (sessionDate: string, exId: string) => void
  removeExerciseFromSession: (sessionDate: string, exId: string) => void
  canRemoveExerciseFromSession: (sessionDate: string, exId: string) => boolean
  duplicateExerciseInSession: (sessionDate: string, exIdx: number) => void
  cloneWorkout: (sourceName: string, newName: string) => void
  reorderWorkoutExercise: (workoutName: string, fromIndex: number, toIndex: number) => void
}
