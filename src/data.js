export const SEED_DATA = {
  meta: {
    method: 'GZCL',
    created: new Date().toISOString()
  },

  // Flat exercise library - shared across all workouts
  exercises: [
    { id: 'barbell-back-squat', name: 'Barbell Back Squat', muscles: ['Quads', 'Glutes', 'Hamstrings', 'Core', 'Erector Spinae'], setup: 'Spotter at 18/2', tier: 'T1' },
    { id: 'alt-belt-squat', name: 'Alt: Belt Squat', muscles: ['Quads', 'Glutes', 'Adductors'], setup: '', tier: 'T2' },
    { id: 'db-bench', name: 'DB Bench', muscles: ['Chest', 'Front Delts', 'Triceps'], setup: 'DB, Bench', tier: 'T2' },
    { id: 'single-leg-rdl', name: 'Single Leg RDL', muscles: ['Hamstrings', 'Glutes', 'Adductors', 'Core'], setup: 'DB', tier: 'T2' },
    { id: 'lat-pulldown', name: 'Lat Pulldown', muscles: ['Lats', 'Biceps', 'Rear Delts', 'Rhomboids'], setup: 'Cable', tier: 'T3' },
    { id: 'pallof-press', name: 'Pallof Press', muscles: ['Obliques', 'Transversus Abdominis', 'Rectus Abdominis', 'Gluts', 'Scapular Stabilizers', 'Delts', 'Triceps'], setup: 'Bands', tier: 'T3' },
    { id: 'face-pulls', name: 'Face Pulls', muscles: ['Rear Delts', 'Mid/Lower Trap', 'Rhomboids', 'Rotator Cuff', 'Biceps Brachii'], setup: 'Cable', tier: 'T3' },
    { id: 'copenhagen-planks', name: 'Copenhagen planks', muscles: ['Adductors', 'Core', 'Obliques'], setup: 'Bench', tier: 'T3' },
    { id: 'single-arm-rows', name: 'Single Arm Rows', muscles: ['Lats', 'Rhomboids', 'Biceps', 'Rear Delts'], setup: 'Cable', tier: 'T3' },
    { id: 'barbell-bench', name: 'Barbell Bench', muscles: ['Chest', 'Front Delts', 'Triceps'], setup: 'Spotter at 8/-3', tier: 'T1' },
    { id: 'bulgarian-split-squats', name: 'Bulgarian Split Squats', muscles: ['Quads', 'Glutes', 'Hamstrings', 'Adductors'], setup: 'Place at -3', tier: 'T2' },
    { id: 'nordics', name: 'Nordics', muscles: ['Hamstrings', 'Glutes'], setup: 'Lowest 5/8"', tier: 'T2' },
    { id: 'glute-kickbacks', name: 'Glute Kickbacks (Sideways)', muscles: ['Gluteus minimus / medius'], setup: 'Cable', tier: 'T3' },
    { id: 'tib-raises', name: 'Tib Raises', muscles: ['Tibialis anterior'], setup: 'Tib Bar, Bench', tier: 'T3' },
    { id: 'calf-raises', name: 'Calf Raises (Dumbbells)', muscles: ['Gastrocnemius', 'Soleus'], setup: 'DB', tier: 'T3' },
    { id: 'cable-rotations', name: 'Cable Rotations', muscles: ['Obliques', 'Transversus Abdominis', 'Rectus Abdominis'], setup: 'Cable', tier: 'T3' },
    { id: 'cable-leg-curls', name: 'Cable Leg Curls', muscles: ['Hamstrings'], setup: 'Cable', tier: 'T3' },
    { id: 'cable-hip-flexion-leg-extension', name: 'Cable Hip Flexion + Leg Extension', muscles: ['Hip Flexors', 'Quads'], setup: 'Cable', tier: 'T3' },
    { id: 'deadlift', name: 'Deadlift', muscles: ['Hamstrings', 'Glutes', 'Erector Spinae', 'Adductors', 'Traps'], setup: '', tier: 'T1' },
    { id: 'bent-over-rows', name: 'Bent over Rows', muscles: ['Lats', 'Rhomboids', 'Biceps', 'Rear Delts', 'Erector Spinae'], setup: 'BB, Spotters', tier: 'T2' },
    { id: 'db-overhead-press', name: 'DB Overhead Press', muscles: ['Front Delts', 'Side Delts', 'Triceps', 'Upper Traps'], setup: 'DB, Bench', tier: 'T2' },
    { id: 'db-curls', name: 'DB Curls', muscles: ['Biceps', 'Brachialis', 'Forearms'], setup: 'DB', tier: 'T3' },
    { id: 'lat-raises', name: 'Lat Raises', muscles: ['Side Delts'], setup: 'Cable', tier: 'T3' },
    { id: 'ab-wheel', name: 'Ab Wheel', muscles: ['Rectus Abdominis', 'Obliques', 'Transversus Abdominis', 'Hip Flexors'], setup: '', tier: 'T3' },
    { id: 'triceps-pull-down', name: 'Triceps Pull Down', muscles: ['Triceps'], setup: 'Cable', tier: 'T3' },
    { id: 'farmer-carry', name: 'Farmer Carry', muscles: ['Forearms', 'Traps', 'Core', 'Quads', 'Grip'], setup: 'DB', tier: 'T3' }
  ],

  // Workouts reference exercises by ID
  workouts: [
    {
      name: 'Squat Workout',
      exercises: ['barbell-back-squat', 'alt-belt-squat', 'db-bench', 'single-leg-rdl', 'lat-pulldown', 'pallof-press', 'face-pulls', 'copenhagen-planks', 'single-arm-rows']
    },
    {
      name: 'Bench Workout',
      exercises: ['barbell-bench', 'bulgarian-split-squats', 'nordics', 'glute-kickbacks', 'tib-raises', 'calf-raises', 'cable-rotations', 'cable-leg-curls', 'cable-hip-flexion-leg-extension']
    },
    {
      name: 'Deadlift Workout',
      exercises: ['deadlift', 'bent-over-rows', 'db-overhead-press', 'db-curls', 'lat-raises', 'ab-wheel', 'triceps-pull-down', 'farmer-carry']
    },
    {
      name: 'Unscheduled',
      exercises: []
    }
  ],

  sessions: []
}
