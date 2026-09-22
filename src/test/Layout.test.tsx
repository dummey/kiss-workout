import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Layout from '../components/Layout'
import { useBackup } from '../context/BackupContext'

vi.mock('../context/BackupContext', () => ({
  useBackup: vi.fn(),
}))

const mockedUseBackup = vi.mocked(useBackup)

vi.mock('../assets/logo.png', () => ({
  default: 'logo-mock.png',
}))

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders navigation links', () => {
    mockedUseBackup.mockReturnValue({
      shouldShowReminder: false,
      meta: { lastBackupDate: null, sessionsSinceBackup: 0 },
      incrementBackupCounter: vi.fn(),
      recordBackup: vi.fn(),
      resetBackupMeta: vi.fn(),
      dismissReminder: vi.fn(),
    })
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    )
    // Use getAllByText since Layout renders nav in both sidebar and bottom tab bar
    expect(screen.getAllByText('Sessions').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Exercises').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Workouts').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the main content area', () => {
    mockedUseBackup.mockReturnValue({
      shouldShowReminder: false,
      meta: { lastBackupDate: null, sessionsSinceBackup: 0 },
      incrementBackupCounter: vi.fn(),
      recordBackup: vi.fn(),
      resetBackupMeta: vi.fn(),
      dismissReminder: vi.fn(),
    })
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    )
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('renders bottom tab bar', () => {
    mockedUseBackup.mockReturnValue({
      shouldShowReminder: false,
      meta: { lastBackupDate: null, sessionsSinceBackup: 0 },
      incrementBackupCounter: vi.fn(),
      recordBackup: vi.fn(),
      resetBackupMeta: vi.fn(),
      dismissReminder: vi.fn(),
    })
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    )
    // Bottom tab bar should have the same navigation items
    const sessionsElements = screen.getAllByText('Sessions')
    expect(sessionsElements.length).toBeGreaterThan(1)
  })

  it('renders the logo image', () => {
    mockedUseBackup.mockReturnValue({
      shouldShowReminder: false,
      meta: { lastBackupDate: null, sessionsSinceBackup: 0 },
      incrementBackupCounter: vi.fn(),
      recordBackup: vi.fn(),
      resetBackupMeta: vi.fn(),
      dismissReminder: vi.fn(),
    })
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    )
    const img = screen.getByAltText('KISS Workout Tracker')
    expect(img).toBeInTheDocument()
  })

  it('shows backup reminder badge on Settings when reminder is active', () => {
    mockedUseBackup.mockReturnValue({
      shouldShowReminder: true,
      meta: { lastBackupDate: null, sessionsSinceBackup: 15 },
      incrementBackupCounter: vi.fn(),
      recordBackup: vi.fn(),
      resetBackupMeta: vi.fn(),
      dismissReminder: vi.fn(),
    })
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    )
    // The sidebar Settings nav link should have a reminder dot
    const sidebar = document.querySelector('.sidebar')!
    const settingsNavLink = sidebar.querySelector('a[href="/settings"]')!
    const reminderDot = settingsNavLink.querySelector('[style*="border-radius: 50%"]')
    expect(reminderDot).toBeInTheDocument()
  })

  it('renders the footer globally', () => {
    mockedUseBackup.mockReturnValue({
      shouldShowReminder: false,
      meta: { lastBackupDate: null, sessionsSinceBackup: 0 },
      incrementBackupCounter: vi.fn(),
      recordBackup: vi.fn(),
      resetBackupMeta: vi.fn(),
      dismissReminder: vi.fn(),
    })
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    )
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('does not show backup reminder badge when reminder is inactive', () => {
    mockedUseBackup.mockReturnValue({
      shouldShowReminder: false,
      meta: { lastBackupDate: null, sessionsSinceBackup: 0 },
      incrementBackupCounter: vi.fn(),
      recordBackup: vi.fn(),
      resetBackupMeta: vi.fn(),
      dismissReminder: vi.fn(),
    })
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    )
    // The sidebar Settings nav link should not have a reminder dot
    const sidebar = document.querySelector('.sidebar')!
    const settingsNavLink = sidebar.querySelector('a[href="/settings"]')!
    const reminderDot = settingsNavLink.querySelector('[style*="border-radius: 50%"]')
    expect(reminderDot).toBeNull()
  })
})
