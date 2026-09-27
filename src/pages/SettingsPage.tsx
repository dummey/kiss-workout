import React, { useState, useRef, useEffect } from 'react'
import { useTracker } from '../context'
import { setStore } from '../db'
import Button from '../components/Button'
import { useModal } from '../components/ModalProvider'
import { useBackup } from '../context/BackupContext'
import { validateTrackerData } from '../validation'
import { DEFAULT_BARBELL_WEIGHT, DEFAULT_PLATES, clonePlates, type PlateInventory } from '../utils/plates'
import type { TrackerData } from '../types'

export default function SettingsPage() {
  const { data, deleteAllData, resetToSeedData, setDisplayName, setBarbellSetup } = useTracker()
  const { showModal } = useModal()
  const { meta, recordBackup, exportBackup } = useBackup()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Display name edits are local until flushed, so typing never writes to IndexedDB
  // per keystroke. Flush happens on blur, on Enter, and ~500ms after the last keystroke.
  const [displayNameInput, setDisplayNameInput] = useState('')
  const nameSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nameDirtyRef = useRef(false)
  // The debounce timer must read the latest keystrokes, not the value captured when
  // the timer was scheduled — hence a ref rather than closing over the state var.
  const nameValueRef = useRef('')

  useEffect(() => {
    // Adopt the stored name, but never stomp an edit that has not been flushed yet.
    if (nameDirtyRef.current) return
    nameValueRef.current = data?.meta?.name ?? ''
    setDisplayNameInput(nameValueRef.current)
  }, [data?.meta?.name])

  useEffect(() => () => {
    if (nameSaveTimeoutRef.current) clearTimeout(nameSaveTimeoutRef.current)
  }, [])

  // ── Barbell setup ─────────────────────────────────────────────────────────
  // Same debounced-write pattern as the display name: edits stay local and are
  // flushed on blur, on Enter, and ~500ms after the last keystroke, so typing
  // never writes to IndexedDB per character.

  // Kept as a string while editing so a partially-typed number ("4", "45")
  // is not clobbered by a number round-trip. Parsed only at flush time.
  const [barbellWeightInput, setBarbellWeightInput] = useState(String(DEFAULT_BARBELL_WEIGHT))
  const barbellDirtyRef = useRef(false)
  const barbellTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [platesInput, setPlatesInput] = useState<PlateInventory[]>(clonePlates(DEFAULT_PLATES))
  const platesDirtyRef = useRef(false)
  const platesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Read the live input values at flush time rather than closing over state.
  // Declared before the adopting effects below so both write and read the same ref.
  const barbellValueRef = useRef(String(DEFAULT_BARBELL_WEIGHT))
  const platesValueRef = useRef<PlateInventory[]>(clonePlates(DEFAULT_PLATES))

  // Adopt stored values, but never stomp an edit that has not been flushed yet.
  // Each ref is synced alongside its state: a flush persists BOTH fields, so a
  // ref left at its initialiser would write the default kit over a stored one
  // the moment an unrelated field was edited.
  useEffect(() => {
    if (barbellDirtyRef.current) return
    barbellValueRef.current = String(data?.meta?.barbellWeight ?? DEFAULT_BARBELL_WEIGHT)
    setBarbellWeightInput(barbellValueRef.current)
  }, [data?.meta?.barbellWeight])

  useEffect(() => {
    if (platesDirtyRef.current) return
    const next = data?.meta?.plates ? clonePlates(data.meta.plates) : clonePlates(DEFAULT_PLATES)
    platesValueRef.current = next
    setPlatesInput(next)
  }, [data?.meta?.plates])

  useEffect(() => () => {
    if (barbellTimeoutRef.current) clearTimeout(barbellTimeoutRef.current)
    if (platesTimeoutRef.current) clearTimeout(platesTimeoutRef.current)
  }, [])

  function flushBarbellSetup() {
    if (barbellTimeoutRef.current) {
      clearTimeout(barbellTimeoutRef.current)
      barbellTimeoutRef.current = null
    }
    if (platesTimeoutRef.current) {
      clearTimeout(platesTimeoutRef.current)
      platesTimeoutRef.current = null
    }
    const barDirty = barbellDirtyRef.current
    const plateDirty = platesDirtyRef.current
    if (!barDirty && !plateDirty) return
    barbellDirtyRef.current = false
    platesDirtyRef.current = false

    // A blank or unparseable bar weight falls back to the default rather than
    // persisting NaN, which would make every breakdown silently disappear.
    const parsed = Number(barbellValueRef.current)
    const barWeight = barDirty && barbellValueRef.current.trim() !== '' && isFinite(parsed) && parsed > 0
      ? parsed
      : (data?.meta?.barbellWeight ?? DEFAULT_BARBELL_WEIGHT)

    setBarbellSetup(barWeight, platesValueRef.current)
  }

  function handleBarbellWeightChange(value: string) {
    barbellValueRef.current = value
    setBarbellWeightInput(value)
    barbellDirtyRef.current = true
    if (barbellTimeoutRef.current) clearTimeout(barbellTimeoutRef.current)
    barbellTimeoutRef.current = setTimeout(flushBarbellSetup, 500)
  }

  function handlePlateChange(index: number, field: 'count' | 'weight', value: string) {
    const parsed = value === '' ? 0 : Number(value)
    const next = platesValueRef.current.map((p, i) =>
      i === index ? { ...p, [field]: isFinite(parsed) ? parsed : 0 } : p
    )
    platesValueRef.current = next
    setPlatesInput(next)
    platesDirtyRef.current = true
    if (platesTimeoutRef.current) clearTimeout(platesTimeoutRef.current)
    platesTimeoutRef.current = setTimeout(flushBarbellSetup, 500)
  }

  function handleAddPlate() {
    const next = [...platesValueRef.current, { count: 2, weight: 5 }]
    platesValueRef.current = next
    setPlatesInput(next)
    platesDirtyRef.current = true
    flushBarbellSetup()
  }

  function handleRemovePlate(index: number) {
    const next = platesValueRef.current.filter((_, i) => i !== index)
    platesValueRef.current = next
    setPlatesInput(next)
    platesDirtyRef.current = true
    flushBarbellSetup()
  }

  function flushDisplayName() {
    if (nameSaveTimeoutRef.current) {
      clearTimeout(nameSaveTimeoutRef.current)
      nameSaveTimeoutRef.current = null
    }
    if (!nameDirtyRef.current) return
    nameDirtyRef.current = false
    setDisplayName(nameValueRef.current)
  }

  function handleDisplayNameChange(value: string) {
    nameValueRef.current = value
    setDisplayNameInput(value)
    nameDirtyRef.current = true
    if (nameSaveTimeoutRef.current) clearTimeout(nameSaveTimeoutRef.current)
    nameSaveTimeoutRef.current = setTimeout(() => {
      nameSaveTimeoutRef.current = null
      if (!nameDirtyRef.current) return
      nameDirtyRef.current = false
      setDisplayName(nameValueRef.current)
    }, 500)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const success = await exportBackup()
      if (!success) {
        showModal({
          title: 'Nothing to Export',
          message: 'There is no data to export yet.',
          actions: [{ label: 'OK', value: null }]
        })
      }
    } catch (err) {
      showModal({
        title: 'Export Failed',
        message: 'Failed to export: ' + (err as Error).message,
        actions: [{ label: 'OK', value: null }]
      })
    } finally {
      setExporting(false)
    }
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
        const validation = validateTrackerData(importedData)
        if (!validation.valid) {
          showModal({
            title: 'Invalid File',
            message: `Invalid backup file: ${validation.error}`,
            actions: [{ label: 'OK', value: null }]
          })
          return
        }
        await setStore('tracker', importedData)
        recordBackup()
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

        {/* Customization */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 24 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Customization</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <label
                htmlFor="display-name-input"
                style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}
              >
                What should we call you?
              </label>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                Used to personalize the app
              </div>
            </div>
            <input
              id="display-name-input"
              type="text"
              value={displayNameInput}
              onChange={e => handleDisplayNameChange(e.target.value)}
              onBlur={flushDisplayName}
              onKeyDown={e => {
                if (e.key === 'Enter') flushDisplayName()
              }}
              placeholder="Your name"
              style={{ minWidth: 200 }}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 24, paddingTop: 24 }}>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 12, fontWeight: 700 }}>
              Barbell
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div>
                <label
                  htmlFor="barbell-weight-input"
                  style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}
                >
                  Barbell weight
                </label>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  The empty bar, in pounds
                </div>
              </div>
              <input
                id="barbell-weight-input"
                type="number"
                inputMode="decimal"
                min={0}
                value={barbellWeightInput}
                onChange={e => handleBarbellWeightChange(e.target.value)}
                onBlur={flushBarbellSetup}
                onKeyDown={e => {
                  if (e.key === 'Enter') flushBarbellSetup()
                }}
                style={{ minWidth: 120 }}
              />
            </div>

            <div style={{ marginTop: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Plates you own</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 12 }}>
                Total plates, not per side — 2 means one on each side
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {platesInput.map((plate, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      aria-label={`Plate ${i + 1} count`}
                      value={plate.count}
                      onChange={e => handlePlateChange(i, 'count', e.target.value)}
                      style={{ width: 80 }}
                    />
                    <span style={{ color: 'var(--muted)' }}>×</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      aria-label={`Plate ${i + 1} weight`}
                      value={plate.weight}
                      onChange={e => handlePlateChange(i, 'weight', e.target.value)}
                      style={{ width: 100 }}
                    />
                    <span style={{ color: 'var(--muted)' }}>lb</span>
                    <Button
                      size="sm"
                      danger
                      aria-label={`Remove plate ${plate.weight}`}
                      onClick={() => handleRemovePlate(i)}
                    >×</Button>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12 }}>
                <Button size="sm" onClick={handleAddPlate}>Add Plate</Button>
              </div>
            </div>
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
              <Button danger onClick={handleDeleteAll}>Delete Everything</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
