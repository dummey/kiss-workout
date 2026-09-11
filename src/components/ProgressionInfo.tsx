import type { PreviousPerformance } from '../types'

interface ProgressionInfoProps {
  tier?: string
  prevInfo: PreviousPerformance[]
}

function parseNumber(value: string): number | null {
  if (!value || value === '—') return null
  const cleaned = value.replace(/[^\d.]/g, '')
  if (!cleaned) return null
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function getNextProgression(tier: string, prevInfo: PreviousPerformance[]): string {
  if (tier === 'T1') {
    if (prevInfo.length > 0) {
      const first = prevInfo[0]
      const prevReps = parseNumber(first.reps)
      const prevSets = first.sets
      if (prevSets && prevReps) {
        return `Try ${first.weight} x ${prevReps + 1} (${prevSets}) or add weight`
      }
    }
    return 'Work up to 2-3RM @ 85-100% Goal Weight'
  } else if (tier === 'T2') {
    if (prevInfo.length > 0 && parseNumber(prevInfo[0].reps) && parseNumber(prevInfo[0].reps)! >= 10) {
      return 'Add weight, drop to 8 reps'
    }
    return 'Target: 8-10 reps @ 65-85% of T1'
  } else if (tier === 'T3') {
    if (prevInfo.length > 0 && parseNumber(prevInfo[0].reps) && parseNumber(prevInfo[0].reps)! >= 15) {
      return 'Add weight, drop to 10 reps'
    }
    return 'Target: 10-15+ reps @ ≤65%'
  }
  return 'Fill in your target weight, reps, and sets'
}

export default function ProgressionInfo({ tier, prevInfo }: ProgressionInfoProps) {
  if (!prevInfo || prevInfo.length === 0) return null

  const nextStep = getNextProgression(tier || '', prevInfo)
  const lastTimeText = prevInfo.map(p => `${p.weight} x ${p.reps} (${p.sets})`).join(', ')

  return (
    <div className="progression-info">
      <div className="last-time">
        Last time: {lastTimeText}
      </div>
      <div className="next-step">{nextStep}</div>
    </div>
  )
}
