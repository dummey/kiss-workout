import React, { useEffect, useRef } from 'react'
import Button from './Button'

interface TimerProps {
  elapsedTime: number
  isRunning: boolean
  onToggle: () => void
  onChange: (seconds: number) => void
  format?: 'short' | 'labeled'
}

export default function Timer({
  elapsedTime,
  isRunning,
  onToggle,
  onChange,
  format = 'short'
}: TimerProps) {
  const startTimeRef = useRef(0)
  const baseElapsedRef = useRef(0)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!isRunning) return

    baseElapsedRef.current = elapsedTime
    startTimeRef.current = Date.now()

    const tick = () => {
      const sinceStart = Math.floor((Date.now() - startTimeRef.current) / 1000)
      onChangeRef.current(sinceStart + baseElapsedRef.current)
    }

    tick()
    const interval = setInterval(tick, 1000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [isRunning]) // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60

    const mm = String(mins).padStart(2, '0')
    const ss = String(secs).padStart(2, '0')

    if (hours > 0) {
      return `${hours}:${mm}:${ss}`
    }
    return `${mm}:${ss}`
  }

  const display = formatTime(elapsedTime)
  const prefix = format === 'labeled' ? 'Elapsed: ' : ''

  const buttonLabel = isRunning ? 'Pause' : (elapsedTime === 0 ? 'Start' : 'Resume')

  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: '2.8rem',
          fontWeight: 800,
          fontFamily: 'monospace',
          color: isRunning ? 'var(--t3)' : 'var(--muted)'
        }}
      >
        {prefix}{display}
      </div>
      <Button size="sm" onClick={onToggle}>
        {buttonLabel}
      </Button>
    </div>
  )
}
