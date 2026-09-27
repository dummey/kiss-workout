import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BackupReminderBanner from '../components/BackupReminderBanner'
import { useBackup } from '../context/BackupContext'

vi.mock('../context/BackupContext', () => ({
  useBackup: vi.fn(),
}))

const mockedUseBackup = vi.mocked(useBackup)

/** Complete BackupContextValue; individual tests override only what they assert on. */
function backupMock(overrides: Partial<ReturnType<typeof useBackup>> = {}): ReturnType<typeof useBackup> {
  return {
    meta: { lastBackupDate: null, sessionsSinceBackup: 0, dismissedAt: null },
    incrementBackupCounter: vi.fn(),
    recordBackup: vi.fn(),
    exportBackup: vi.fn(),
    resetBackupMeta: vi.fn(),
    dismissReminder: vi.fn(),
    shouldShowReminder: false,
    ...overrides,
  }
}

describe('BackupReminderBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders null when shouldShowReminder is false', () => {
    mockedUseBackup.mockReturnValue(backupMock())
    const { container } = render(<BackupReminderBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the banner when shouldShowReminder is true', () => {
    mockedUseBackup.mockReturnValue(backupMock({
      shouldShowReminder: true,
      meta: { lastBackupDate: null, sessionsSinceBackup: 5, dismissedAt: null },
    }))
    render(<BackupReminderBanner />)
    expect(screen.getByText(/5 sessions without a backup/i)).toBeInTheDocument()
  })

  it('renders days-since-backup message when lastBackupDate is set', () => {
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    mockedUseBackup.mockReturnValue(backupMock({
      shouldShowReminder: true,
      meta: { lastBackupDate: twoDaysAgo.toISOString(), sessionsSinceBackup: 0, dismissedAt: null },
    }))
    render(<BackupReminderBanner />)
    expect(screen.getByText(/2 days since your last backup/i)).toBeInTheDocument()
  })

  it('renders singular day message for 1 day', () => {
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)
    mockedUseBackup.mockReturnValue(backupMock({
      shouldShowReminder: true,
      meta: { lastBackupDate: oneDayAgo.toISOString(), sessionsSinceBackup: 0, dismissedAt: null },
    }))
    render(<BackupReminderBanner />)
    expect(screen.getByText(/1 days since your last backup/i)).toBeInTheDocument()
  })

  it('calls exportBackup when Export is clicked', async () => {
    const user = userEvent.setup()
    const exportBackup = vi.fn().mockResolvedValue(true)
    mockedUseBackup.mockReturnValue(backupMock({
      shouldShowReminder: true,
      meta: { lastBackupDate: null, sessionsSinceBackup: 5, dismissedAt: null },
      exportBackup,
    }))
    render(<BackupReminderBanner />)

    const buttons = screen.getAllByText('Export')
    await user.click(buttons[0])
    await waitFor(() => {
      expect(exportBackup).toHaveBeenCalledTimes(1)
    })
  })

  it('calls dismissReminder when "Remind me later" is clicked', async () => {
    const user = userEvent.setup()
    const dismissReminder = vi.fn()
    mockedUseBackup.mockReturnValue(backupMock({
      shouldShowReminder: true,
      meta: { lastBackupDate: null, sessionsSinceBackup: 5, dismissedAt: null },
      dismissReminder,
    }))
    render(<BackupReminderBanner />)

    await user.click(screen.getByText('Remind me later'))
    expect(dismissReminder).toHaveBeenCalledTimes(1)
  })
})