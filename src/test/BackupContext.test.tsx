import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BackupProvider, useBackup } from '../context/BackupContext'
import { getStore, setStore, deleteStore } from '../db'

vi.mock('../db', () => ({
  getStore: vi.fn(),
  setStore: vi.fn().mockResolvedValue(undefined),
  deleteStore: vi.fn().mockResolvedValue(undefined),
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

    mockedGetStoreRef.mockResolvedValue({ lastBackupDate: null, sessionsSinceBackup: 1 })

    await user.click(screen.getByText('Inc'))

    await waitFor(() => {
      expect(mockedSetStoreRef).toHaveBeenCalledWith('backup-meta', { lastBackupDate: null, sessionsSinceBackup: 2 })
    })

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
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

  it('resetBackupMeta clears the meta and deletes store', async () => {
    const mockedGetStoreRef = vi.mocked(getStore)
    mockedGetStoreRef.mockResolvedValue({ lastBackupDate: '2026-01-01', sessionsSinceBackup: 5 })
    const mockedDeleteStoreRef = vi.mocked(deleteStore)
    mockedDeleteStoreRef.mockResolvedValue(undefined)

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

    await user.click(screen.getByText('Reset'))
    await waitFor(() => {
      expect(mockedDeleteStoreRef).toHaveBeenCalledWith('backup-meta')
    })
  })
})