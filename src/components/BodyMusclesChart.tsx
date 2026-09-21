import React, { useRef, useEffect, useMemo, useState } from 'react'
import { BodyChart, ViewSide } from 'body-muscles'
import type { BodyState } from 'body-muscles'

const MUSCLE_NAME_TO_ID: Record<string, string[]> = {
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

function getMuscleIdsForMuscleName(name: string): string[] {
  return MUSCLE_NAME_TO_ID[name] || []
}

function getIntensityForCount(count: number): number {
  if (count === 0) return 0
  if (count === 1) return 2
  if (count === 2) return 5
  return 8
}

function buildBodyState(allMuscles: string[]): BodyState {
  const state: BodyState = {}
  const muscleCounts: Record<string, number> = {}

  ;(allMuscles || []).forEach(muscleName => {
    muscleCounts[muscleName] = (muscleCounts[muscleName] || 0) + 1
  })

  ;(allMuscles || []).forEach(muscleName => {
    const count = muscleCounts[muscleName] || 0
    const intensity = getIntensityForCount(count)
    getMuscleIdsForMuscleName(muscleName).forEach(id => {
      state[id] = { intensity, selected: count > 0 }
    })
  })

  return state
}

interface BodyChartViewProps {
  view: ViewSide | string
  bodyState: BodyState
  label: string
  idTooltipMap: Record<string, { name: string; count: number }>
  onHover: (data: { name: string; count: number; x: number; y: number } | null) => void
}

function BodyChartView({ view, bodyState, label, idTooltipMap, onHover }: BodyChartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<BodyChart | null>(null)
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    chartRef.current = new BodyChart(containerRef.current, {
      view,
      bodyState,
      showViewLabel: false,
      onMuscleHover: (muscleId: string | null) => {
        if (muscleId && idTooltipMap[muscleId]) {
          const rect = containerRef.current?.getBoundingClientRect()
          if (rect) {
            onHover({
              name: idTooltipMap[muscleId].name,
              count: idTooltipMap[muscleId].count,
              x: mouseRef.current.x - rect.left,
              y: mouseRef.current.y - rect.top,
            })
          }
        } else {
          onHover(null)
        }
      },
    })
    return () => chartRef.current?.destroy()
  }, [view, idTooltipMap, onHover])

  useEffect(() => {
    chartRef.current?.update({ bodyState })
  }, [bodyState])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }

    container.addEventListener('mousemove', handleMouseMove)
    return () => container.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div style={{ textAlign: 'center' }}>
      <div ref={containerRef} style={{ minWidth: 160, minHeight: 320 }} />
      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </div>
    </div>
  )
}

interface BodyMusclesChartProps {
  allMuscles?: string[]
}

export default function BodyMusclesChart({ allMuscles = [] }: BodyMusclesChartProps) {
  const allKey = allMuscles.join('|')
  const [hovered, setHovered] = useState<{ name: string; count: number; x: number; y: number } | null>(null)

  const bodyState = useMemo(() => buildBodyState(allMuscles), [allKey])

  const idTooltipMap = useMemo(() => {
    const counts: Record<string, number> = {}
    ;(allMuscles || []).forEach(name => {
      counts[name] = (counts[name] || 0) + 1
    })

    const idMap: Record<string, { name: string; count: number }> = {}
    Object.entries(counts).forEach(([name, count]) => {
      getMuscleIdsForMuscleName(name).forEach(id => {
        idMap[id] = { name, count }
      })
    })
    return idMap
  }, [allKey])

  return (
    <div style={{
      background: 'var(--surface2)', borderRadius: 'var(--radius)',
      padding: '20px 24px', marginBottom: 20, display: 'flex', justifyContent: 'center', gap: 16,
      position: 'relative'
    }}>
      <BodyChartView view={ViewSide.FRONT} bodyState={bodyState} label="Anterior (Front)" idTooltipMap={idTooltipMap} onHover={setHovered} />
      <BodyChartView view={ViewSide.BACK} bodyState={bodyState} label="Posterior (Back)" idTooltipMap={idTooltipMap} onHover={setHovered} />
      {hovered && (
        <div style={{
          position: 'absolute',
          left: hovered.x,
          top: hovered.y - 32,
          padding: '4px 8px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          fontSize: '0.72rem',
          color: 'var(--text)',
          whiteSpace: 'nowrap',
          zIndex: 100,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}>
          {hovered.name} — {hovered.count} exercise{hovered.count !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
