import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../components/ErrorBoundary'

function BrokenChild(): React.ReactElement {
  throw new Error('Test crash')
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Everything is fine</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Everything is fine')).toBeInTheDocument()
  })

  it('renders error UI when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/The app encountered an error/)).toBeInTheDocument()
    expect(screen.getByText('Reload App')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('renders a "Reload App" button that reloads the page', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true,
    })

    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>
    )

    const button = screen.getByText('Reload App')
    button.click()
    expect(reloadSpy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
