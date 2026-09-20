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

describe('BackupReminderBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders null when shouldShowReminder is false', () => {
    mockedUseBackup.mockReturnValue({
      shouldShowReminder: false,
      dismissReminder: vi.fn(),
      meta: { lastBackupDate: null, sessionsSinceBackup: 0 },
      recordBackup: vi.fn(),
    })
    const onExport = vi.fn()
    const { container } = render(<BackupReminderBanner onExport={onExport} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the banner when shouldShowReminder is true', () => {
    mockedUseBackup.mockReturnValue({
      shouldShowReminder: true,
      dismissReminder: vi.fn(),
      meta: { lastBackupDate: null, sessionsSinceBackup: 5 },
      recordBackup: vi.fn(),
    })
    const onExport = vi.fn()
    render(<BackupReminderBanner onExport={onExport} />)
    expect(screen.getByText(/5 sessions without a backup/i)).toBeInTheDocument()
  })

  it('renders days-since-backup message when lastBackupDate is set', () => {
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    mockedUseBackup.mockReturnValue({
      shouldShowReminder: true,
      dismissReminder: vi.fn(),
      meta: { lastBackupDate: twoDaysAgo.toISOString(), sessionsSinceBackup: 0 },
      recordBackup: vi.fn(),
    })
    const onExport = vi.fn()
    render(<BackupReminderBanner onExport={onExport} />)
    expect(screen.getByText(/2 days since your last backup/i)).toBeInTheDocument()
  })

  it('renders singular day message for 1 day', () => {
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)
    mockedUseBackup.mockReturnValue({
      shouldShowReminder: true,
      dismissReminder: vi.fn(),
      meta: { lastBackupDate: oneDayAgo.toISOString(), sessionsSinceBackup: 0 },
      recordBackup: vi.fn(),
    })
    const onExport = vi.fn()
    render(<BackupReminderBanner onExport={onExport} />)
    expect(screen.getByText(/1 days since your last backup/i)).toBeInTheDocument()
  })

  it('calls onExport and recordBackup when Export is clicked', async () => {
    const user = userEvent.setup()
    const recordBackup = vi.fn().mockResolvedValue(undefined)
    mockedUseBackup.mockReturnValue({
      shouldShowReminder: true,
      dismissReminder: vi.fn(),
      meta: { lastBackupDate: null, sessionsSinceBackup: 5 },
      recordBackup,
    })
    const onExport = vi.fn().mockResolvedValue(undefined)
    render(<BackupReminderBanner onExport={onExport} />)

    const buttons = screen.getAllByText('Export')
    await user.click(buttons[0])
    await waitFor(() => {
      expect(onExport).toHaveBeenCalledTimes(1)
    })
    expect(recordBackup).toHaveBeenCalledTimes(1)
  })

  it('calls dismissReminder when "Remind me later" is clicked', async () => {
    const user = userEvent.setup()
    const dismissReminder = vi.fn()
    mockedUseBackup.mockReturnValue({
      shouldShowReminder: true,
      dismissReminder,
      meta: { lastBackupDate: null, sessionsSinceBackup: 5 },
      recordBackup: vi.fn(),
    })
    const onExport = vi.fn()
    render(<BackupReminderBanner onExport={onExport} />)

    await user.click(screen.getByText('Remind me later'))
    expect(dismissReminder).toHaveBeenCalledTimes(1)
  })
})
