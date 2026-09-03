import React, { useRef, useEffect, useMemo } from 'react'
import { BodyChart, ViewSide } from 'body-muscles'

const MUSCLE_NAME_TO_ID = {
  // Front
  'Front Delts': ['shoulder-front-left', 'shoulder-front-right'],
  'Chest': ['chest-upper-left', 'chest-lower-left', 'chest-upper-right', 'chest-lower-right'],
  'Biceps': ['biceps-left', 'biceps-right'],
  'Triceps': ['triceps-long-left', 'triceps-long-right', 'triceps-lateral-left', 'triceps-lateral-right'],
  'Forearms': ['forearm-left', 'forearm-right', 'forearm-extensors-left', 'forearm-extensors-right', 'forearm-flexors-left', 'forearm-flexors-right'],
  'Obliques': ['obliques-left', 'obliques-right'],
  'Rectus Abdominis': ['abs-upper-left', 'abs-upper-right', 'abs-lower-left', 'abs-lower-right'],
  'Transversus Abdominis': ['abs-upper-left', 'abs-upper-right', 'abs-lower-left', 'abs-lower-right'],
  'Quads': ['quads-left', 'quads-right'],
  'Hip Flexors': ['hip-flexor-left', 'hip-flexor-right'],
  'Adductors': ['adductors-left', 'adductors-right'],
  'Tibialis anterior': ['tibialis-anterior-left', 'tibialis-anterior-right'],
  'Gastrocnemius': ['calves-gastroc-medial-left', 'calves-gastroc-lateral-left', 'calves-gastroc-medial-right', 'calves-gastroc-lateral-right'],
  'Soleus': ['calves-soleus-left', 'calves-soleus-right'],
  'Core': ['abs-upper-left', 'abs-upper-right', 'abs-lower-left', 'abs-lower-right', 'obliques-left', 'obliques-right'],
  'Grip': ['forearm-left', 'forearm-right', 'hand-left', 'hand-right'],

  // Back
  'Rear Delts': ['deltoid-rear-left', 'deltoid-rear-right'],
  'Mid/Lower Trap': ['traps-lower-left', 'traps-lower-right', 'traps-mid-left', 'traps-mid-right'],
  'Traps': ['traps-upper-left', 'traps-upper-right', 'traps-mid-left', 'traps-mid-right', 'traps-lower-left', 'traps-lower-right'],
  'Lats': ['lats-upper-left', 'lats-upper-right', 'lats-mid-left', 'lats-mid-right', 'lats-lower-left', 'lats-lower-right'],
  'Erector Spinae': ['lower-back-erectors-left', 'lower-back-erectors-right'],
  'Rhomboids': ['traps-mid-left', 'traps-mid-right'],
  'Glutes': ['gluteus-maximus-left', 'gluteus-maximus-right'],
  'Hamstrings': ['hamstrings-medial-left', 'hamstrings-medial-right', 'hamstrings-lateral-left', 'hamstrings-lateral-right'],
  'Gluteus minimus / medius': ['gluteus-medius-left', 'gluteus-medius-right'],
  'Rotator Cuff': ['deltoid-rear-left', 'deltoid-rear-right'],
  'Upper Traps': ['traps-upper-left', 'traps-upper-right'],
}

function getMuscleIdsForMuscleName(name) {
  return MUSCLE_NAME_TO_ID[name] || []
}

function buildBodyState(highlightedMuscles, allMuscles) {
  const state = {}
  ;(allMuscles || []).forEach(muscleName => {
    getMuscleIdsForMuscleName(muscleName).forEach(id => {
      state[id] = { intensity: 3, selected: false }
    })
  })
  ;(highlightedMuscles || []).forEach(muscleName => {
    getMuscleIdsForMuscleName(muscleName).forEach(id => {
      state[id] = { intensity: 8, selected: true }
    })
  })
  return state
}

function BodyChartView({ view, bodyState, label }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    chartRef.current = new BodyChart(containerRef.current, {
      view,
      bodyState,
      showViewLabel: false,
    })
    return () => chartRef.current?.destroy()
  }, [view])

  useEffect(() => {
    chartRef.current?.update({ bodyState })
  }, [bodyState])

  return (
    <div style={{ textAlign: 'center' }}>
      <div ref={containerRef} style={{ minWidth: 160, minHeight: 320 }} />
      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
    </div>
    </div>
  )
}

export default function BodyMusclesChart({ muscles = [], allMuscles = [] }) {
  const musclesKey = muscles.join('|')
  const allKey = allMuscles.join('|')
  const bodyState = useMemo(() => {
    return buildBodyState(muscles, allMuscles)
  }, [musclesKey, allKey])

  return (
    <div style={{
      background: 'var(--surface2)', borderRadius: 'var(--radius)',
      padding: '20px 24px', marginBottom: 20, display: 'flex', justifyContent: 'center', gap: 16
    }}>
      <BodyChartView view={ViewSide.FRONT} bodyState={bodyState} label="Anterior (Front)" />
      <BodyChartView view={ViewSide.BACK} bodyState={bodyState} label="Posterior (Back)" />
    </div>
  )
}
