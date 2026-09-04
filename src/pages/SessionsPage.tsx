import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTracker } from '../context'
import Button from '../components/Button'
import CalendarHeatmap from '../components/CalendarHeatmap'
import SessionStats from '../components/SessionStats'
import { useModal } from '../components/ModalProvider'
import type { Session } from '../types'

type SortDirection = 'desc' | 'asc'

const PAGE_SIZES = [12, 24, 48]

export default function SessionsPage() {
  const { data, loading, addSession, deleteSession, importSession } = useTracker()
  const { showModal } = useModal()
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [workout, setWorkout] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!workout || !data?.workouts.some(w => w.name === workout)) {
      setWorkout(data?.workouts[0]?.name || '')
    }
  }, [data?.workouts])

  const filteredSessions = useMemo(() => {
    const sessions = searchQuery.trim()
      ? (data?.sessions || []).filter(session =>
          session.date.toLowerCase().includes(searchQuery.toLowerCase()) ||
          session.workoutName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (session.notes && session.notes.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : (data?.sessions || [])
    
    return sessions.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date)
      return sortDirection === 'desc' ? -cmp : cmp
    })
  }, [data?.sessions, searchQuery, sortDirection])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sortDirection, pageSize])

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading...</p>

  const totalPages = Math.ceil(filteredSessions.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedSessions = filteredSessions.slice(startIndex, endIndex)

  function handleAdd() {
    const session = addSession(date, workout)
    if (session) {
      setShowAdd(false)
      navigate(`/sessions/${date}`)
    } else {
      showModal({
        title: 'Session Exists',
        message: `A session on ${date} already exists. Please pick a different date.`,
        actions: [
          { label: 'OK', value: null }
        ]
      })
    }
  }

  async function handleImportSession(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file) return

    const text = await file.text()
    try {
      const session = JSON.parse(text) as Session
      if (!session || typeof session !== 'object' || !session.date || !session.workoutName || !Array.isArray(session.exercises)) {
        showModal({
          title: 'Invalid File',
          message: 'Invalid session file: missing date, workoutName, or exercises array.',
          actions: [{ label: 'OK', value: null }]
        })
        return
      }
      const success = importSession(session, false)
      if (!success) {
        const result = await showModal({
          title: 'Session Exists',
          message: `A session on ${session.date} already exists. Overwrite it?`,
          actions: [
            { label: 'Cancel', value: null },
            { label: 'Overwrite', value: 'confirm', variant: 'danger' }
          ]
        })
        if (result.action === 'confirm') {
          importSession(session, true)
        }
      } else {
        showModal({
          title: 'Import Successful',
          message: 'Session imported successfully!',
          actions: [{ label: 'OK', value: null }]
        })
      }
    } catch (err) {
      showModal({
        title: 'Import Failed',
        message: 'Failed to import: ' + (err as Error).message,
        actions: [{ label: 'OK', value: null }]
      })
    }
    e.target.value = ''
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Sessions</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{filteredSessions.length} sessions logged</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleImportSession}
            style={{ display: 'none' }}
            id="import-session-input"
            ref={fileInputRef}
          />
          <label htmlFor="import-session-input" className="btn" style={{ cursor: 'pointer' }}>
            Import Session
          </label>
          <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add Session</Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        <div style={{ flex: '1 1 60%', height: '100%' }}>
          <CalendarHeatmap sessions={data?.sessions || []} />
        </div>
        <div style={{ flex: '1 1 40%' }}>
          <SessionStats sessions={data?.sessions || []} />
        </div>
      </div>

      <div style={{ marginBottom: 20, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <input
          type="text"
          placeholder="Search by date, workout, or notes..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text)', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
        />
        <Button
          size="sm"
          style={{ padding: '14px 14px', display: 'flex', alignItems: 'center' }}
          onClick={() => setSortDirection(d => d === 'desc' ? 'asc' : 'desc')}
        >
          {sortDirection === 'desc' ? '↓ Newest' : '↑ Oldest'}
        </Button>
      </div>

      {filteredSessions.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No sessions found.</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {paginatedSessions.map(session => (
              <div
                key={session.date}
                className="card"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/sessions/${session.date}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <strong style={{ fontSize: '1.1rem' }}>{session.date}</strong>
                    <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 4 }}>{session.workoutName}</p>
                  </div>
                </div>
                {session.notes && (
                  <p style={{ 
                    color: 'var(--muted)', 
                    fontSize: '0.78rem', 
                    marginTop: 6,
                    marginBottom: 6,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {session.notes.length > 60 ? session.notes.slice(0, 60) + '…' : session.notes}
                  </p>
                )}
                <p style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                  {session.exercises.filter(ex => ex.weight || ex.reps).length} / {session.exercises.length} exercises logged
                  {session.elapsedTime ? ` • ${Math.floor(session.elapsedTime / 60)}m ${session.elapsedTime % 60}s` : ''}
                </p>
              </div>
            ))}
          </div>

          {/* Pagination controls */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginTop: 24,
            padding: '12px 0',
            borderTop: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem', marginRight: 8 }}>Per page:</span>
              {PAGE_SIZES.map(size => (
                <Button
                  key={size}
                  size="sm"
                  variant={pageSize === size ? 'primary' : 'default'}
                  onClick={() => setPageSize(size)}
                  style={{ padding: '4px 10px' }}
                >
                  {size}
                </Button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                {startIndex + 1}–{Math.min(endIndex, filteredSessions.length)} of {filteredSessions.length}
              </span>
              <Button
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                ← Prev
              </Button>
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem', minWidth: 60, textAlign: 'center' }}>
                {currentPage} / {totalPages}
              </span>
              <Button
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next →
              </Button>
            </div>
          </div>
        </>
      )}

      {showAdd && (
        <div className="modal-overlay show" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Session</h2>
            <p className="modal-sub">Pick a date and workout type to start logging.</p>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="session-date">Date</label>
                <input id="session-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="session-workout">Workout</label>
                <select id="session-workout" value={workout} onChange={e => setWorkout(e.target.value)}>
                  {data!.workouts.map(w => (
                    <option key={w.name} value={w.name}>{w.name}</option>
                  ))}
                </select>
                {!data!.workouts.some(w => w.name === workout) && (
                  <p style={{ color: 'var(--t1)', fontSize: '0.75rem', marginTop: 4 }}>
                    Selected workout no longer exists — pick another.
                  </p>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <Button onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button variant="success" onClick={handleAdd}>Start Session</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
