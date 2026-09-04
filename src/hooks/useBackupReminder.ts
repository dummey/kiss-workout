import { useState, useEffect, useCallback } from 'react'
import { getStore, setStore } from '../db'

export interface BackupMeta {
  lastBackupDate: string | null
  sessionsSinceBackup: number
}

export function useBackupReminder() {
  const [meta, setMeta] = useState<BackupMeta>({
    lastBackupDate: null,
    sessionsSinceBackup: 0
  })

  useEffect(() => {
    getStore('backup-meta').then((stored) => {
      if (stored && typeof stored === 'object') {
        setMeta(stored as BackupMeta)
      }
    }).catch(() => {
      // No backup meta yet
    })
  }, [])

  const shouldShowReminder = useCallback(() => {
    const { lastBackupDate, sessionsSinceBackup } = meta

    // Session-based: >10 sessions without backup
    if (sessionsSinceBackup >= 10) return true

    // Time-based: >14 days since last backup
    if (lastBackupDate) {
      const daysSince = (Date.now() - new Date(lastBackupDate).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince >= 14) return true
    }

    // No backup ever and at least 1 session
    if (!lastBackupDate && sessionsSinceBackup > 0) return true

    return false
  }, [meta])

  const recordBackup = useCallback(async () => {
    const newMeta: BackupMeta = {
      lastBackupDate: new Date().toISOString(),
      sessionsSinceBackup: 0
    }
    await setStore('backup-meta', newMeta)
    setMeta(newMeta)
  }, [])

  const dismissReminder = useCallback(() => {
    // Reset session count but keep lastBackupDate (so time-based trigger still works)
    const newMeta: BackupMeta = {
      ...meta,
      sessionsSinceBackup: 0
    }
    setMeta(newMeta)
    setStore('backup-meta', newMeta).catch(() => {})
  }, [meta])

  return {
    meta,
    shouldShowReminder: shouldShowReminder(),
    recordBackup,
    dismissReminder
  }
}
