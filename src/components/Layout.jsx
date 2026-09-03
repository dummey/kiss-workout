import React, { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { getStore, setStore } from '../db'

export default function Layout() {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const data = await getStore('tracker')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kiss-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to export: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm('This will replace all existing data. Continue?')) {
      e.target.value = ''
      return
    }

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      // Validate shape before storing
      if (!data || typeof data !== 'object' || !Array.isArray(data.exercises) || !Array.isArray(data.workouts) || !Array.isArray(data.sessions)) {
        alert('Invalid backup file: missing exercises or workouts array.')
        e.target.value = ''
        return
      }
      await setStore('tracker', data)
      alert('Data imported successfully!')
      window.location.reload()
    } catch (err) {
      alert('Failed to import: ' + err.message)
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{
        width: 200, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        padding: 24, display: 'flex', flexDirection: 'column', gap: 8
      }}>
        <div style={{ marginBottom: 32 }}>
          <img src="/src/assets/logo.png" alt="KISS Workout Tracker" style={{ width: '100%', height: 'auto' }} />
          <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 4 }}>pre-alpha</p>
        </div>

        <NavLink to="/sessions" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Sessions
        </NavLink>
        <NavLink to="/exercises" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Exercises
        </NavLink>
        <NavLink to="/workouts" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Workouts
        </NavLink>

        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            style={{ display: 'none' }}
            id="import-input"
          />
          <label htmlFor="import-input" className="btn btn-sm" style={{ width: '100%', fontSize: '0.78rem', textAlign: 'center', cursor: 'pointer', display: 'block' }}>
            Import Data
          </label>
          <button
            className="btn btn-sm"
            onClick={handleExport}
            disabled={exporting}
            style={{ width: '100%', fontSize: '0.78rem' }}
          >
            {exporting ? 'Exporting...' : 'Export Data'}
          </button>
        </div>
      </nav>

      <main style={{ flex: 1, padding: 32 }}>
        <Outlet />
      </main>
    </div>
  )
}
