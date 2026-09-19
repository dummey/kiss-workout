import React, { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { getStore, setStore, deleteStore } from '../db'

export interface BackupMeta {
  lastBackupDate: string | null
  sessionsSinceBackup: number
}

interface BackupContextValue {
  meta: BackupMeta
  incrementBackupCounter: () => Promise<void>
  recordBackup: () => Promise<void>
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

  const incrementBackupCounter = useCallback(async () => {
    const stored = await getStore('backup-meta') as BackupMeta | null
    const current = stored || { lastBackupDate: null, sessionsSinceBackup: 0 }
    const newMeta = { ...current, sessionsSinceBackup: current.sessionsSinceBackup + 1 }
    await setStore('backup-meta', newMeta)
    setMeta(newMeta)
  }, [])

  const recordBackup = useCallback(async () => {
    const newMeta: BackupMeta = {
      lastBackupDate: new Date().toISOString(),
      sessionsSinceBackup: 0
    }
    await setStore('backup-meta', newMeta)
    setMeta(newMeta)
  }, [])

  const dismissReminder = useCallback(() => {
    const newMeta = { ...meta, sessionsSinceBackup: 0 }
    setMeta(newMeta)
    setStore('backup-meta', newMeta).catch(() => {})
  }, [meta])

  const resetBackupMeta = useCallback(async () => {
    await deleteStore('backup-meta')
    setMeta({ lastBackupDate: null, sessionsSinceBackup: 0 })
  }, [])

  const shouldShowReminder = (() => {
    const { lastBackupDate, sessionsSinceBackup } = meta
    if (sessionsSinceBackup >= 10) return true
    if (lastBackupDate) {
      const daysSince = (Date.now() - new Date(lastBackupDate).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince >= 14) return true
    }
    if (!lastBackupDate && sessionsSinceBackup > 0) return true
    return false
  })()

  return (
    <BackupContext.Provider value={{ meta, incrementBackupCounter, recordBackup, dismissReminder, shouldShowReminder, resetBackupMeta }}>
      {children}
    </BackupContext.Provider>
  )
}
