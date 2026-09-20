import React, { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { getStore, setStore } from '../db'
import type { TrackerData } from '../types'

export interface BackupMeta {
  lastBackupDate: string | null
  sessionsSinceBackup: number
  dismissedAt: string | null
}

interface BackupContextValue {
  meta: BackupMeta
  incrementBackupCounter: () => void
  recordBackup: () => void
  exportBackup: () => Promise<boolean>
  resetBackupMeta: () => void
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
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    getStore('backup-meta').then((stored) => {
      if (stored && typeof stored === 'object') {
        setMeta(stored as BackupMeta)
      }
      setIsLoaded(true)
    }).catch(() => {
      setIsLoaded(true)
    })
  }, [])

  // Sync meta to IndexedDB whenever it changes (after initial load)
  useEffect(() => {
    if (isLoaded) {
      setStore('backup-meta', meta).catch(() => {})
    }
  }, [meta, isLoaded])

  const incrementBackupCounter = useCallback(() => {
    setMeta(prev => ({
      ...prev,
      sessionsSinceBackup: prev.sessionsSinceBackup + 1
    }))
  }, [])

  const recordBackup = useCallback(() => {
    setMeta(() => ({
      lastBackupDate: new Date().toISOString(),
      sessionsSinceBackup: 0,
      dismissedAt: null
    }))
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
    recordBackup()
    return true
  }, [recordBackup])

  const dismissReminder = useCallback(() => {
    setMeta(prev => ({ ...prev, sessionsSinceBackup: 0, dismissedAt: new Date().toISOString() }))
  }, [])

  const resetBackupMeta = useCallback(() => {
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
