import React from 'react'
import { useBackup } from '../context/BackupContext'
import Button from './Button'

interface BackupReminderBannerProps {
  onExport: () => void
}

export default function BackupReminderBanner({ onExport }: BackupReminderBannerProps) {
  const { shouldShowReminder, dismissReminder, meta, recordBackup } = useBackup()

  if (!shouldShowReminder) return null

  const daysSince = meta.lastBackupDate
    ? Math.floor((Date.now() - new Date(meta.lastBackupDate).getTime()) / (1000 * 60 * 60 * 24))
    : null

  const message = daysSince !== null
    ? `It's been ${daysSince} days since your last backup.`
    : `You have ${meta.sessionsSinceBackup} sessions without a backup.`

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%'
    }}>
      <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
        {message}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" variant="primary" onClick={async () => {
          await onExport()
          await recordBackup()
        }}>Export</Button>
        <Button size="sm" onClick={dismissReminder}>Remind me later</Button>
      </div>
    </div>
  )
}
