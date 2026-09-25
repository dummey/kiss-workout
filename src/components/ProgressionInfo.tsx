import type { PreviousPerformance } from '../types'

interface ProgressionInfoProps {
  tier?: string
  prevInfo: PreviousPerformance[]
}

function getNextProgression(tier: string, _prevInfo: PreviousPerformance[]): string {
  if (tier === 'T1') {
    // if (prevInfo.length > 0) {
    //   const first = prevInfo[0]
    //   const prevReps = parseNumber(first.reps)
    //   const prevSets = first.sets
    //   if (prevSets && prevReps) {
    //     return `Try ${first.weight} x ${prevReps + 1} (${prevSets}) or add weight`
    //   }
    // }
    return 'Add 5lbs (bench) or 10lbs (squat and deadlift). \n If fail, 5x3 > 6x2 > 10x1 > restart at 85% of 1rep.'
  } else if (tier === 'T2') {
    // if (prevInfo.length > 0 && parseNumber(prevInfo[0].reps) && parseNumber(prevInfo[0].reps)! >= 10) {
    //   return 'Add weight, drop to 8 reps'
    // }
    return 'Add weight. If fail, 3x10 > 3x8 > 3x6 > restart, +5-10lbs from last 3x10.'
  } else if (tier === 'T3') {
    // if (prevInfo.length > 0 && parseNumber(prevInfo[0].reps) && parseNumber(prevInfo[0].reps)! >= 15) {
    //   return 'Add weight, drop to 10 reps'
    // }
    return '3x10-15, AMRAP on last set, add weight when >25 reps.'
  }
  return 'Fill in your target weight, reps, and sets'
}

export default function ProgressionInfo({ tier, prevInfo }: ProgressionInfoProps) {
  if (!prevInfo || prevInfo.length === 0) return null

  const nextStep = getNextProgression(tier || '', prevInfo)
  const lastTimeText = prevInfo.map(p => {
    const performance = `${p.weight} x ${p.reps} (${p.sets})`
    if (!p.failed) return performance
    const hasRecordedValues = p.weight !== '—' || p.reps !== '—' || p.sets !== '—'
    return hasRecordedValues ? `${performance} — Failed` : 'Failed'
  }).join(', ')

  return (
    <div className="progression-info">
      <div className="last-time">
        Last time: {lastTimeText}
      </div>
      <div className="next-step">{nextStep}</div>
    </div>
  )
}
