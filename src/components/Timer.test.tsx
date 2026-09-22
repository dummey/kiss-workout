import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import Timer from '../components/Timer'

describe('Timer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders 00:00 for 0 seconds', () => {
    render(<Timer elapsedTime={0} isRunning={false} onToggle={() => {}} onChange={() => {}} />)
    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('renders 00:59 for 59 seconds', () => {
    render(<Timer elapsedTime={59} isRunning={false} onToggle={() => {}} onChange={() => {}} />)
    expect(screen.getByText('00:59')).toBeInTheDocument()
  })

  it('renders 01:00 for 60 seconds', () => {
    render(<Timer elapsedTime={60} isRunning={false} onToggle={() => {}} onChange={() => {}} />)
    expect(screen.getByText('01:00')).toBeInTheDocument()
  })

  it('renders 59:59 for 3599 seconds', () => {
    render(<Timer elapsedTime={3599} isRunning={false} onToggle={() => {}} onChange={() => {}} />)
    expect(screen.getByText('59:59')).toBeInTheDocument()
  })

  it('renders 1:00:00 for 3600 seconds', () => {
    render(<Timer elapsedTime={3600} isRunning={false} onToggle={() => {}} onChange={() => {}} />)
    expect(screen.getByText('1:00:00')).toBeInTheDocument()
  })

  it('calls onToggle when button is pressed', () => {
    const onToggle = vi.fn()
    render(<Timer elapsedTime={0} isRunning={false} onToggle={onToggle} onChange={() => {}} />)
    screen.getByText('Start').click()
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('shows Start button when elapsedTime is 0 and not running', () => {
    render(<Timer elapsedTime={0} isRunning={false} onToggle={() => {}} onChange={() => {}} />)
    expect(screen.getByText('Start')).toBeInTheDocument()
  })

  it('shows Resume button when elapsedTime > 0 and not running', () => {
    render(<Timer elapsedTime={30} isRunning={false} onToggle={() => {}} onChange={() => {}} />)
    expect(screen.getByText('Resume')).toBeInTheDocument()
  })

  it('shows Pause button when isRunning is true', () => {
    render(<Timer elapsedTime={30} isRunning={true} onToggle={() => {}} onChange={() => {}} />)
    expect(screen.getByText('Pause')).toBeInTheDocument()
  })

  it('calls onChange with incrementing seconds while running', () => {
    const onChange = vi.fn()
    render(<Timer elapsedTime={0} isRunning={true} onToggle={() => {}} onChange={onChange} />)

    expect(onChange).toHaveBeenCalledWith(0)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onChange).toHaveBeenCalledWith(1)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('does not call onChange when not running', () => {
    const onChange = vi.fn()
    render(<Timer elapsedTime={30} isRunning={false} onToggle={() => {}} onChange={onChange} />)

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('display stays at paused value when isRunning is false', () => {
    render(<Timer elapsedTime={30} isRunning={false} onToggle={() => {}} onChange={() => {}} />)
    expect(screen.getByText('00:30')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.getByText('00:30')).toBeInTheDocument()
  })

  it('renders labeled format with Elapsed: prefix', () => {
    render(<Timer elapsedTime={65} isRunning={false} onToggle={() => {}} onChange={() => {}} format="labeled" />)
    expect(screen.getByText('Elapsed: 01:05')).toBeInTheDocument()
  })

  it('renders short format without prefix', () => {
    render(<Timer elapsedTime={65} isRunning={false} onToggle={() => {}} onChange={() => {}} format="short" />)
    expect(screen.getByText('01:05')).toBeInTheDocument()
  })
})
