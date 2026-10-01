import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { TrackerProvider, useTracker } from '../context'
import { BackupProvider } from '../context/BackupContext'
import type { TrackerContextValue, TrackerData } from '../types'

// Gate machinery for the 'tracker' key. `setStore` is wrapped, NOT replaced:
// the real fake-indexeddb write still happens, but only once the test releases
// the gate. That is what lets us drive completion order directly instead of
// hoping the storage layer happens to be slow in the order we need.
//
// The value named FAIL_MARKER is rejected when its gate is released.
const h = vi.hoisted(() => ({
  gates: [] as Array<{ value: TrackerData; release: () => void }>,
}))

vi.mock('../db', async () => {
  const actual = await vi.importActual<typeof import('../db')>('../db')
  return {
    ...actual,
    setStore: vi.fn(async (key: string, value: unknown) => {
      if (key !== 'tracker') return actual.setStore(key, value)
      const data = value as TrackerData
      await new Promise<void>((resolve) => {
        h.gates.push({ value: data, release: resolve })
      })
      if (data.meta.name === 'FAIL') throw new Error('simulated write failure')
      return actual.setStore(key, data)
    }),
  }
})

const actualDb = await vi.importActual<typeof import('../db')>('../db')

function baseData(name?: string): TrackerData {
  return {
    meta: { method: 'GZCL', created: '2026-01-01T00:00:00.000Z', name },
    exercises: [],
    workouts: [],
    sessions: [],
  }
}

let latest: TrackerContextValue | null = null

function Probe() {
  latest = useTracker()
  return <div data-testid="name">{latest.data?.meta.name ?? 'none'}</div>
}

function Harness() {
  return (
    <BackupProvider>
      <TrackerProvider>
        <Probe />
      </TrackerProvider>
    </BackupProvider>
  )
}

async function renderLoaded() {
  render(<Harness />)
  await waitFor(() => expect(latest!.loading).toBe(false))
  expect(latest!.data?.meta.name).toBe('orig')
}

/** Flush pending microtasks inside act() so queued promise callbacks run. */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve()
  })
}

/** Release the newest pending gate. Repeated calls drain newest-first. */
async function releaseNewest() {
  const gate = h.gates.pop()
  if (!gate) throw new Error('no pending gate to release')
  await act(async () => {
    gate.release()
    for (let i = 0; i < 20; i++) await Promise.resolve()
  })
}

async function persistedName(): Promise<string | undefined> {
  const stored = await actualDb.getStore('tracker') as TrackerData | null
  return stored?.meta.name
}

beforeEach(async () => {
  h.gates.length = 0
  latest = null
  vi.clearAllMocks()
  await actualDb.deleteStore('tracker').catch(() => {})
  await actualDb.deleteStore('backup-meta').catch(() => {})
})

describe('saveData write serialization', () => {
  it('does not start the next write until the previous one has committed', async () => {
    await actualDb.setStore('tracker', baseData('orig'))
    await renderLoaded()

    // Two calls in the same tick, neither awaited. settle() flushes the
    // microtasks that start each write; the chain means only the first one
    // actually reaches setStore.
    act(() => {
      latest!.setDisplayName('A')
      latest!.setDisplayName('B')
    })
    await settle()

    // Only the FIRST write may be in flight. Before the fix both independent
    // transactions start immediately, so this is where it fails.
    expect(h.gates).toHaveLength(1)
    expect(h.gates[0].value.meta.name).toBe('A')

    await releaseNewest()
    await settle()
    expect(h.gates).toHaveLength(1)
    expect(h.gates[0].value.meta.name).toBe('B')

    await releaseNewest()
    await settle()

    expect(await persistedName()).toBe('B')
    expect(latest!.data?.meta.name).toBe('B')
  })

  it('persists the last call even when completion is forced into reverse order', async () => {
    await actualDb.setStore('tracker', baseData('orig'))
    await renderLoaded()

    act(() => {
      latest!.setDisplayName('A')
      latest!.setDisplayName('B')
    })
    await settle()

    // Release newest-first, repeatedly. With the chain this is just "the only
    // gate that exists"; before the fix B lands first and A lands last, so the
    // persisted value is A — the user's later edit silently reverts.
    for (let i = 0; i < 6 && h.gates.length > 0; i++) {
      await releaseNewest()
      await settle()
    }

    expect(await persistedName()).toBe('B')
  })

  it('a failed write does not poison the queue for later writes', async () => {
    await actualDb.setStore('tracker', baseData('orig'))
    await renderLoaded()

    act(() => {
      latest!.setDisplayName('FAIL')
      latest!.setDisplayName('B')
    })
    await settle()

    // First write rejects once released; the queued successor must still run.
    await releaseNewest()
    await settle()
    await releaseNewest()
    await settle()

    expect(await persistedName()).toBe('B')
  })

  it('surfaces the failure to the user via setError', async () => {
    await actualDb.setStore('tracker', baseData('orig'))
    await renderLoaded()

    act(() => {
      latest!.setDisplayName('FAIL')
      latest!.setDisplayName('B')
    })
    await settle()
    await releaseNewest()
    await settle()

    expect(latest!.error).toBe('Failed to save changes. Your data has been reverted.')

    // The successor write still lands, and the UI keeps it: a newer queued
    // write carries this change forward, so reverting here would desync the UI
    // from what is being persisted.
    await releaseNewest()
    await settle()
    expect(latest!.data?.meta.name).toBe('B')
    expect(await persistedName()).toBe('B')
  })

  it('rolls back to the snapshot the failed write replaced, not an older one', async () => {
    await actualDb.setStore('tracker', baseData('orig'))
    await renderLoaded()

    act(() => {
      latest!.setDisplayName('X')
      latest!.setDisplayName('FAIL')
    })
    await settle()

    await releaseNewest() // X commits
    await settle()
    // Optimistic UI shows the most recent call, not the one that just landed.
    expect(latest!.data?.meta.name).toBe('FAIL')

    await releaseNewest() // FAIL rejects
    await settle()

    // The failed write replaced state 'X', so 'X' is its rollback target.
    // Before the fix previousData came from the `data` closure, which was
    // still 'orig' for both calls in this tick, so it reverted to 'orig' and
    // threw away the successful X write.
    expect(latest!.data?.meta.name).toBe('X')
    expect(latest!.error).toBe('Failed to save changes. Your data has been reverted.')
  })

  it('rolls back to the prior state when the only write fails', async () => {
    await actualDb.setStore('tracker', baseData('orig'))
    await renderLoaded()

    act(() => {
      latest!.setDisplayName('FAIL')
    })
    await settle()
    await releaseNewest()
    await settle()

    expect(latest!.data?.meta.name).toBe('orig')
    expect(latest!.error).toBe('Failed to save changes. Your data has been reverted.')
  })
})