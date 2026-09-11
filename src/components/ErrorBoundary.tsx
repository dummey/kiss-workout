import React, { Component } from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          color: 'var(--text)',
          padding: 32,
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 16 }}>Something went wrong</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 24, maxWidth: 400 }}>
            The app encountered an error. Your data is safe — try reloading.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
            style={{ padding: '10px 24px' }}
          >
            Reload App
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
