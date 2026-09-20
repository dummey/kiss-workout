import React, { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { getStore, setStore, deleteStore } from '../db'
import type { TrackerData } from '../types'

export interface BackupMeta {
  lastBackupDate: string | null
  sessionsSinceBackup: number
  dismissedAt: string | null
}

interface BackupContextValue {
  meta: BackupMeta
  incrementBackupCounter: () => Promise<void>
  recordBackup: () => Promise<void>
  exportBackup: () => Promise<boolean>
  resetBackupMeta: () => Promise<void>
  dismissReminder: () => void
  shouldShowReminder: boolean
}

const BackupContext = createContext<BackupContextValue | null>(null)

export function useBackup(): BackupContextValue {
  const ctx = useContext(BackupContext)
  if (!ctx) throw new Error('useBackup must be used within BackupProvider')
  return ctx
}

export function BackupProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMeta] = useState<BackupMeta>({
    lastBackupDate: null,
    sessionsSinceBackup: 0,
    dismissedAt: null
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

  const incrementBackupCounter = useCallback(async () => {
    const stored = await getStore('backup-meta') as BackupMeta | null
    const current = stored || { lastBackupDate: null, sessionsSinceBackup: 0, dismissedAt: null }
    const newMeta = { ...current, sessionsSinceBackup: current.sessionsSinceBackup + 1 }
    await setStore('backup-meta', newMeta)
    setMeta(newMeta)
  }, [])

  const recordBackup = useCallback(async () => {
    const newMeta: BackupMeta = {
      lastBackupDate: new Date().toISOString(),
      sessionsSinceBackup: 0,
      dismissedAt: null
    }
    await setStore('backup-meta', newMeta)
    setMeta(newMeta)
  }, [])

  const exportBackup = useCallback(async (): Promise<boolean> => {
    const data = await getStore('tracker')
    if (!data || (data as TrackerData).sessions.length === 0) {
      return false
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kiss-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    await recordBackup()
    return true
  }, [recordBackup])

  const dismissReminder = useCallback(() => {
    const newMeta = { ...meta, sessionsSinceBackup: 0, dismissedAt: new Date().toISOString() }
    setMeta(newMeta)
    setStore('backup-meta', newMeta).catch(() => {})
  }, [meta])

  const resetBackupMeta = useCallback(async () => {
    await deleteStore('backup-meta')
    setMeta({ lastBackupDate: null, sessionsSinceBackup: 0, dismissedAt: null })
  }, [])

  const shouldShowReminder = (() => {
    const { lastBackupDate, sessionsSinceBackup, dismissedAt } = meta
    if (sessionsSinceBackup >= 10) return true

    const isDismissedRecently = dismissedAt &&
      (Date.now() - new Date(dismissedAt).getTime()) / (1000 * 60 * 60 * 24) < 14

    if (lastBackupDate && !isDismissedRecently) {
      const daysSince = (Date.now() - new Date(lastBackupDate).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince >= 14) return true
    }
    if (!lastBackupDate && sessionsSinceBackup > 0) return true
    return false
  })()

  return (
    <BackupContext.Provider value={{ meta, incrementBackupCounter, recordBackup, exportBackup, dismissReminder, shouldShowReminder, resetBackupMeta }}>
      {children}
    </BackupContext.Provider>
  )
}
