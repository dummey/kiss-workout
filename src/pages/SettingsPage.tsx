import React, { useState, useRef } from 'react'
import { useTracker } from '../context'
import { getStore, setStore } from '../db'
import Button from '../components/Button'
import { useModal } from '../components/ModalProvider'
import { useBackup } from '../context/BackupContext'
import type { TrackerData } from '../types'

export default function SettingsPage() {
  const { data, deleteAllData, resetToSeedData } = useTracker()
  const { showModal } = useModal()
  const { meta, recordBackup } = useBackup()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    setExporting(true)
    getStore('tracker').then((data) => {
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
    }).catch((err) => {
      showModal({
        title: 'Export Failed',
        message: 'Failed to export: ' + err.message,
        actions: [{ label: 'OK', value: null }]
      })
    }).finally(() => {
      setExporting(false)
    })
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    showModal({
      title: 'Import Data',
      message: 'This will replace all existing data. Continue?',
      actions: [
        { label: 'Cancel', value: null },
        { label: 'Import', value: 'confirm', variant: 'primary' }
      ]
    }).then(async result => {
      if (result.action !== 'confirm') {
        e.target.value = ''
        return
      }

      try {
        const text = await file.text()
        const importedData = JSON.parse(text) as TrackerData
        if (!importedData || typeof importedData !== 'object' || !Array.isArray(importedData.exercises) || !Array.isArray(importedData.workouts) || !Array.isArray(importedData.sessions)) {
          showModal({
            title: 'Invalid File',
            message: 'Invalid backup file: missing exercises, workouts, or sessions array.',
            actions: [{ label: 'OK', value: null }]
          })
          return
        }
        await setStore('tracker', importedData)
        showModal({
          title: 'Import Successful',
          message: 'Data imported successfully!',
          actions: [{ label: 'OK', value: null }]
        }).then(() => {
          window.location.reload()
        })
      } catch (err) {
        showModal({
          title: 'Import Failed',
          message: 'Failed to import: ' + (err as Error).message,
          actions: [{ label: 'OK', value: null }]
        })
      }
    })
  }

  function handleDeleteAll() {
    deleteAllData()
    setShowDeleteConfirm(false)
  }

  function handleLoadSeed() {
    showModal({
      title: 'Load Seed Data',
      message: 'This will replace all current data with fresh seed data. Continue?',
      actions: [
        { label: 'Cancel', value: null },
        { label: 'Load Seed', value: 'confirm', variant: 'primary' }
      ]
    }).then(result => {
      if (result.action === 'confirm') {
        resetToSeedData()
      }
    })
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 24 }}>Settings</h1>

      <div style={{ display: 'grid', gap: 24, maxWidth: 600 }}>
        {/* Stats */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 24 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>App Statistics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>{data?.exercises.length || 0}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Exercises</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>{data?.workouts.length || 0}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Workouts</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>{data?.sessions.length || 0}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Sessions</div>
            </div>
          </div>
          <div style={{ 
            marginTop: 16, 
            paddingTop: 16, 
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: 'var(--muted)'
          }}>
            <span>
              {meta.lastBackupDate 
                ? `Last backup: ${Math.floor((Date.now() - new Date(meta.lastBackupDate).getTime()) / 86400000)} days ago`
                : 'No backup yet'}
            </span>
            <span>{meta.sessionsSinceBackup} sessions since backup</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 24 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Data Management</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>Export Data</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Download all data as JSON backup</div>
              </div>
              <Button onClick={handleExport} disabled={exporting}>
                {exporting ? 'Exporting...' : 'Export'}
              </Button>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>Import Data</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Restore from a JSON backup file</div>
              </div>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImport}
                style={{ display: 'none' }}
                id="import-input"
                ref={fileInputRef}
              />
              <label htmlFor="import-input" className="btn" style={{ cursor: 'pointer' }}>
                Import
              </label>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--t1)' }}>Delete All Data</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Permanently clear everything and reset to defaults</div>
              </div>
              <Button danger onClick={() => setShowDeleteConfirm(true)}>Delete All</Button>
            </div>
          </div>

          {/* Test Tools subsection */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 12, fontWeight: 700 }}>
              Test Tools
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>Load Seed Data</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Populate with sample exercises and 5 sessions</div>
              </div>
              <Button variant="primary" onClick={handleLoadSeed}>Load Seed</Button>
            </div>
          </div>
        </div>

        {/* About */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 24 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>About</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            KISS Workout Tracker — A local-first workout tracking app for the GZCL strength training method.
            All data is stored in your browser's IndexedDB. No server, no accounts.
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 12 }}>
            Version: pre-alpha
          </p>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay show" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Delete All Data?</h2>
            <p className="modal-sub">This action cannot be undone. All your exercises, workouts, and sessions will be permanently deleted and replaced with default seed data.</p>
            <div className="modal-actions">
              <Button onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button variant="danger" onClick={handleDeleteAll}>Delete Everything</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
