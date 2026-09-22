import React from 'react'
import './FunFactTooltip.css'

interface FunFactTooltipProps {
  children: React.ReactNode
}

const FUN_FACTS = [
  "The biceps brachii is actually made up of two heads — the long head and the short head. Both work together, but they have slightly different jobs at the shoulder.",
  "Your glutes are the largest and strongest muscles in your body. They're not just for sitting — they're crucial for walking, running, and jumping.",
  "The rectus abdominis is one muscle, not six. The 'six-pack' look comes from tendinous intersections that create the segmented appearance.",
  "Deadlifts work over 200 muscles in your body. It's one of the most comprehensive exercises you can do for overall strength.",
  "Your quads contain four distinct muscles. The rectus femoris is the only one that crosses both the hip and knee joints.",
  "The serratus anterior is nicknamed the 'boxer's muscle' because it's crucial for punching — it protracts the scapula and keeps your shoulder stable.",
  "Your body has over 600 skeletal muscles. They make up about 40% of your total body weight in an average adult.",
  "The triceps makes up about two-thirds of your upper arm. If you want bigger arms, triceps work matters more than biceps.",
  "The soleus in your calf can generate more force than any other muscle relative to its size. It's a powerhouse for endurance activities.",
  "Muscle memory is real — your nuclei persist even after atrophy, making it easier to regain lost muscle than to build it the first time."
]

function truncateFact(fact: string, max: number): string {
  return fact.length > max ? fact.slice(0, max - 1) + '…' : fact
}

export default function FunFactTooltip({ children }: FunFactTooltipProps) {
  const fact = truncateFact(FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)], 120)

  return (
    <span className="fun-fact-tooltip" title={fact}>
      {children}
      <span className="fun-fact-tooltip__bubble">{fact}</span>
    </span>
  )
}
