import type { PreviousPerformance } from '../types'

interface ProgressionInfoProps {
  tier?: string
  prevInfo: PreviousPerformance | null
}

function getNextProgression(tier: string, prevInfo: PreviousPerformance | null): string {
  if (tier === 'T1') {
    if (prevInfo) {
      const prevReps = prevInfo.reps
      const prevSets = prevInfo.sets
      if (prevSets && prevReps && prevReps !== '—') {
        return 'Try ' + prevInfo.weight + ' x ' + (parseInt(prevReps) + 1) + ' (' + prevSets + ') or add weight'
      }
    }
    return 'Work up to 2-3RM @ 85-100% Goal Weight'
  } else if (tier === 'T2') {
    if (prevInfo && prevInfo.reps && prevInfo.reps !== '—' && parseInt(prevInfo.reps) >= 10) {
      return 'Add weight, drop to 8 reps'
    }
    return 'Target: 8-10 reps @ 65-85% of T1'
  } else if (tier === 'T3') {
    if (prevInfo && prevInfo.reps && prevInfo.reps !== '—' && parseInt(prevInfo.reps) >= 15) {
      return 'Add weight, drop to 10 reps'
    }
    return 'Target: 10-15+ reps @ ≤65%'
  }
  return 'Fill in your target weight, reps, and sets'
}

export default function ProgressionInfo({ tier, prevInfo }: ProgressionInfoProps) {
  if (!prevInfo) return null

  const nextStep = getNextProgression(tier || '', prevInfo)

  return (
    <div className="progression-info">
      <div className="last-time">
        Last time: {prevInfo.weight} x {prevInfo.reps} ({prevInfo.sets})
      </div>
      <div className="next-step">{nextStep}</div>
    </div>
  )
}
