import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BackupProvider, useBackup, type BackupMeta } from '../context/BackupContext'
import { getStore, setStore } from '../db'

vi.mock('../db', () => ({
  getStore: vi.fn(),
  setStore: vi.fn().mockResolvedValue(undefined),
}))

describe('BackupContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws error when useBackup is used outside BackupProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function TestComp() {
      useBackup()
      return null
    }
    expect(() => render(<TestComp />)).toThrow('useBackup must be used within BackupProvider')
    spy.mockRestore()
  })

  it('exportBackup returns false when tracker store is empty', async () => {
    const mockedGetStoreRef = vi.mocked(getStore)
    mockedGetStoreRef.mockResolvedValue(null)
    const mockedSetStoreRef = vi.mocked(setStore)
    mockedSetStoreRef.mockResolvedValue(undefined)

    function TestComp() {
      const { exportBackup } = useBackup()
      return <button onClick={() => exportBackup()}>Export</button>
    }

    const user = userEvent.setup()
    render(
      <BackupProvider>
        <TestComp />
      </BackupProvider>
    )

    await user.click(screen.getByText('Export'))
    await waitFor(() => {
      expect(mockedGetStoreRef).toHaveBeenCalledWith('tracker')
    })
    // Should not call setStore with recordBackup payload (no recordBackup) when data is empty
    // Note: setStore IS called once on mount with default meta (lastBackupDate: null) via sync effect
    const recordBackupCalls = mockedSetStoreRef.mock.calls.filter(
      (call) => call[1] && (call[1] as BackupMeta).lastBackupDate !== null
    )
    expect(recordBackupCalls).toHaveLength(0)
  })

  it('exportBackup downloads data and calls recordBackup when store has data', async () => {
    const mockData = { sessions: [{ date: '2026-01-01' }] }
    const mockedGetStoreRef = vi.mocked(getStore)
    mockedGetStoreRef.mockResolvedValue(mockData)
    const mockedSetStoreRef = vi.mocked(setStore)
    mockedSetStoreRef.mockResolvedValue(undefined)

    // Mock URL.createObjectURL and URL.revokeObjectURL
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock')
    const mockRevokeObjectURL = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    })

    // Mock document.createElement and click
    const mockClick = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName)
      if (tagName === 'a') {
        el.click = mockClick
      }
      return el
    })

    function TestComp() {
      const { exportBackup } = useBackup()
      return <button onClick={() => exportBackup()}>Export</button>
    }

    const user = userEvent.setup()
    render(
      <BackupProvider>
        <TestComp />
      </BackupProvider>
    )

    await user.click(screen.getByText('Export'))
    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })
    expect(mockClick).toHaveBeenCalled()
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock')
    // recordBackup should have been called (setStore with backup-meta)
    await waitFor(() => {
      expect(mockedSetStoreRef).toHaveBeenCalledWith('backup-meta', expect.objectContaining({ sessionsSinceBackup: 0 }))
    })

    vi.restoreAllMocks()
  })

  it('initializes with default meta when no stored data', async () => {
    const mockedGetStoreRef = vi.mocked(getStore)
    mockedGetStoreRef.mockResolvedValue(null)

    function TestComp() {
      const { meta } = useBackup()
      return <div>{meta.sessionsSinceBackup}</div>
    }

    render(
      <BackupProvider>
        <TestComp />
      </BackupProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  it('loads stored meta on mount', async () => {
    const mockedGetStoreRef = vi.mocked(getStore)
    mockedGetStoreRef.mockResolvedValue({ lastBackupDate: '2026-01-01T00:00:00.000Z', sessionsSinceBackup: 3 })

    function TestComp() {
      const { meta } = useBackup()
      return <div>{meta.sessionsSinceBackup}</div>
    }

    render(
      <BackupProvider>
        <TestComp />
      </BackupProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('shouldShowReminder is false when sessionsSinceBackup is 0', async () => {
    const mockedGetStoreRef = vi.mocked(getStore)
    mockedGetStoreRef.mockResolvedValue(null)

    function TestComp() {
      const { shouldShowReminder } = useBackup()
      return <div>{String(shouldShowReminder)}</div>
    }

    render(
      <BackupProvider>
        <TestComp />
      </BackupProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('false')).toBeInTheDocument()
    })
  })

  it('shouldShowReminder is true when sessionsSinceBackup >= 10', async () => {
    const mockedGetStoreRef = vi.mocked(getStore)
    mockedGetStoreRef.mockResolvedValue({ lastBackupDate: null, sessionsSinceBackup: 10 })

    function TestComp() {
      const { shouldShowReminder } = useBackup()
      return <div>{String(shouldShowReminder)}</div>
    }

    render(
      <BackupProvider>
        <TestComp />
      </BackupProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('true')).toBeInTheDocument()
    })
  })

  it('shouldShowReminder is true when lastBackupDate is over 14 days ago', async () => {
    const fifteenDaysAgo = new Date()
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
    const mockedGetStoreRef = vi.mocked(getStore)
    mockedGetStoreRef.mockResolvedValue({ lastBackupDate: fifteenDaysAgo.toISOString(), sessionsSinceBackup: 0 })

    function TestComp() {
      const { shouldShowReminder } = useBackup()
      return <div>{String(shouldShowReminder)}</div>
    }

    render(
      <BackupProvider>
        <TestComp />
      </BackupProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('true')).toBeInTheDocument()
    })
  })

  it('shouldShowReminder is true when no lastBackupDate and sessionsSinceBackup > 0', async () => {
    const mockedGetStoreRef = vi.mocked(getStore)
    mockedGetStoreRef.mockResolvedValue({ lastBackupDate: null, sessionsSinceBackup: 1 })

    function TestComp() {
      const { shouldShowReminder } = useBackup()
      return <div>{String(shouldShowReminder)}</div>
    }

    render(
      <BackupProvider>
        <TestComp />
      </BackupProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('true')).toBeInTheDocument()
    })
  })

  it('incrementBackupCounter increments the counter', async () => {
    const mockedGetStoreRef = vi.mocked(getStore)
    mockedGetStoreRef.mockResolvedValue(null)
    const mockedSetStoreRef = vi.mocked(setStore)
    mockedSetStoreRef.mockResolvedValue(undefined)

    function TestComp() {
      const { meta, incrementBackupCounter } = useBackup()
      return (
        <div>
          <span>{meta.sessionsSinceBackup}</span>
          <button onClick={() => incrementBackupCounter()}>Inc</button>
        </div>
      )
    }

    const user = userEvent.setup()
    render(
      <BackupProvider>
        <TestComp />
      </BackupProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Inc'))

    await waitFor(() => {
      expect(mockedSetStoreRef).toHaveBeenCalledWith('backup-meta', { lastBackupDate: null, sessionsSinceBackup: 1, dismissedAt: null })
    })

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  it('recordBackup sets lastBackupDate and resets counter', async () => {
    const mockedGetStoreRef = vi.mocked(getStore)
    mockedGetStoreRef.mockResolvedValue({ lastBackupDate: null, sessionsSinceBackup: 5 })
    const mockedSetStoreRef = vi.mocked(setStore)
    mockedSetStoreRef.mockResolvedValue(undefined)

    function TestComp() {
      const { meta, recordBackup } = useBackup()
      return (
        <div>
          <span>{meta.sessionsSinceBackup}</span>
          <button onClick={() => recordBackup()}>Record</button>
        </div>
      )
    }

    const user = userEvent.setup()
    render(
      <BackupProvider>
        <TestComp />
      </BackupProvider>
    )

    await user.click(screen.getByText('Record'))
    await waitFor(() => {
      expect(mockedSetStoreRef).toHaveBeenCalledWith('backup-meta', expect.objectContaining({ sessionsSinceBackup: 0 }))
    })
  })

  it('resetBackupMeta clears the meta and syncs defaults to store', async () => {
    const mockedGetStoreRef = vi.mocked(getStore)
    mockedGetStoreRef.mockResolvedValue({ lastBackupDate: '2026-01-01', sessionsSinceBackup: 5 })
    const mockedSetStoreRef = vi.mocked(setStore)
    mockedSetStoreRef.mockResolvedValue(undefined)

    function TestComp() {
      const { meta, resetBackupMeta } = useBackup()
      return (
        <div>
          <span>{meta.sessionsSinceBackup}</span>
          <button onClick={() => resetBackupMeta()}>Reset</button>
        </div>
      )
    }

    const user = userEvent.setup()
    render(
      <BackupProvider>
        <TestComp />
      </BackupProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Reset'))
    await waitFor(() => {
      expect(mockedSetStoreRef).toHaveBeenCalledWith('backup-meta', { lastBackupDate: null, sessionsSinceBackup: 0, dismissedAt: null })
    })
  })

  it('dismissReminder sets dismissedAt and resets sessionsSinceBackup', async () => {
    const fifteenDaysAgo = new Date()
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
    const mockedGetStoreRef = vi.mocked(getStore)
    mockedGetStoreRef.mockResolvedValue({ lastBackupDate: fifteenDaysAgo.toISOString(), sessionsSinceBackup: 5, dismissedAt: null })
    const mockedSetStoreRef = vi.mocked(setStore)
    mockedSetStoreRef.mockResolvedValue(undefined)

    function TestComp() {
      const { meta, dismissReminder } = useBackup()
      return (
        <div>
          <span>{meta.sessionsSinceBackup}</span>
          <button onClick={() => dismissReminder()}>Dismiss</button>
        </div>
      )
    }

    const user = userEvent.setup()
    render(
      <BackupProvider>
        <TestComp />
      </BackupProvider>
    )

    await user.click(screen.getByText('Dismiss'))
    await waitFor(() => {
      expect(mockedSetStoreRef).toHaveBeenCalledWith('backup-meta', expect.objectContaining({
        sessionsSinceBackup: 0,
        dismissedAt: expect.any(String)
      }))
    })
  })

  it('shouldShowReminder is false after dismissReminder when lastBackupDate is old', async () => {
    const fifteenDaysAgo = new Date()
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
    const justNow = new Date()
    const mockedGetStoreRef = vi.mocked(getStore)
    mockedGetStoreRef.mockResolvedValue({ lastBackupDate: fifteenDaysAgo.toISOString(), sessionsSinceBackup: 0, dismissedAt: justNow.toISOString() })

    function TestComp() {
      const { shouldShowReminder } = useBackup()
      return <div>{String(shouldShowReminder)}</div>
    }

    render(
      <BackupProvider>
        <TestComp />
      </BackupProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('false')).toBeInTheDocument()
    })
  })

  it('shouldShowReminder becomes true after dismiss cooldown expires', async () => {
    const fifteenDaysAgo = new Date()
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
    const twentyDaysAgo = new Date()
    twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20)
    const mockedGetStoreRef = vi.mocked(getStore)
    mockedGetStoreRef.mockResolvedValue({ lastBackupDate: fifteenDaysAgo.toISOString(), sessionsSinceBackup: 0, dismissedAt: twentyDaysAgo.toISOString() })

    function TestComp() {
      const { shouldShowReminder } = useBackup()
      return <div>{String(shouldShowReminder)}</div>
    }

    render(
      <BackupProvider>
        <TestComp />
      </BackupProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('true')).toBeInTheDocument()
    })
  })
})