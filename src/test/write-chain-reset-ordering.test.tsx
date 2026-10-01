import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, waitFor, cleanup } from '@testing-library/react'
import { TrackerProvider, useTracker } from '../context'
import { BackupProvider } from '../context/BackupContext'
import type { TrackerContextValue, TrackerData } from '../types'
import type { BackupMeta } from '../context/BackupContext'

// Regression cover for `resetToSeedData` / `deleteAllData` and the write chain
// in src/context.tsx.
//
// Both reset functions replace the whole 'tracker' key, so they persist through
// the same chain `saveData` uses. But they used to only AWAIT the chain tail:
//
//   await writeChainRef.current.then(() => setStore('tracker', SEED_DATA))
//
// They never reassigned `writeChainRef.current`, so the reset's own write was
// not part of the chain. An edit issued in the same tick chained off the
// already-resolved old tail and its `setStore` started while the reset's write
// was still in flight — two `readwrite` transactions racing, with the older
// (reset) state free to commit last. Measured pre-fix, firing a reset and a
// follow-up edit in one tick gives start:0, start:1, commit:0, commit:1: write
// #1 began before write #0 committed, and the post-reset edit was lost.
//
// The fix reassigns the tail, so the reset's write is the tail and later
// writes queue behind it.

// Gate machinery for the 'tracker' key. `setStore` is wrapped, NOT replaced:
// the real fake-indexeddb write still happens, but only once the test releases
// the gate. That lets these tests drive completion order directly instead of
// hoping the storage layer happens to be slow in the order we need.
//
// A gate records the write's value at the moment setStore was ENTERED, so
// `gates.length` is a direct measure of how many writes are in flight at once.
const h = vi.hoisted(() => ({
  gates: [] as Array<{ value: TrackerData; release: () => void; fail: boolean }>,
  failNext: false,
}))

vi.mock('../db', async () => {
  const actual = await vi.importActual<typeof import('../db')>('../db')
  return {
    ...actual,
    setStore: vi.fn(async (key: string, value: unknown) => {
      if (key !== 'tracker') return actual.setStore(key, value)
      const data = value as TrackerData
      const fail = h.failNext
      h.failNext = false
      await new Promise<void>((resolve) => {
        h.gates.push({ value: data, release: resolve, fail })
      })
      if (fail) throw new Error('simulated write failure')
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

const BACKUP_META: BackupMeta = {
  lastBackupDate: '2026-01-01T00:00:00.000Z',
  sessionsSinceBackup: 5,
  dismissedAt: null,
}

let latest: TrackerContextValue | null = null

function Probe() {
  latest = useTracker()
  return <div>{latest.loading ? 'loading' : 'ready'}</div>
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

/**
 * Seed, mount, and wait for the provider to publish loaded state.
 *
 * `cleanup()` runs in afterEach and the gates are drained there too, so nothing
 * from a previous test is still mounted or mid-write when this seeds. Skipping
 * that lets a still-mounted previous Probe republish its context over the seed
 * below and lets its queued setStore land in IndexedDB after this seed — which
 * in a suite about deferred write ordering is exactly how a test passes for the
 * wrong reason.
 */
async function mountWith(data: TrackerData, backupMeta: BackupMeta | null = null) {
  latest = null
  h.gates.length = 0
  await actualDb.setStore('tracker', data)
  if (backupMeta) await actualDb.setStore('backup-meta', backupMeta)
  render(<Harness />)
  await waitFor(() => {
    expect(latest).not.toBeNull()
    expect(latest!.loading).toBe(false)
  })
  return latest!
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

async function persisted(): Promise<TrackerData | null> {
  return await actualDb.getStore('tracker') as TrackerData | null
}

async function persistedBackupMeta(): Promise<BackupMeta | null> {
  return await actualDb.getStore('backup-meta') as BackupMeta | null
}

beforeEach(async () => {
  h.gates.length = 0
  h.failNext = false
  latest = null
  await actualDb.deleteStore('tracker').catch(() => {})
  await actualDb.deleteStore('backup-meta').catch(() => {})
})

afterEach(async () => {
  // Unmount first, then drain: a component still mounted at seed time (below)
  // republishes its context over the new data.
  cleanup()
  while (h.gates.length) h.gates.shift()!.release()
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve()
  })
  h.gates.length = 0
})

describe('resetToSeedData write-chain ordering', () => {
  it('does not start a queued edit\'s write until the reset write has committed', async () => {
    const ctx = await mountWith(baseData('orig'))

    // Same tick: the reset is issued and then the user edits. The reset's
    // setStore is entered first and stays in flight until released.
    let resetDone: Promise<void> | undefined
    act(() => {
      resetDone = ctx.resetToSeedData()
      ctx.setDisplayName('EDIT')
    })
    await settle()

    // Exactly one write may be in flight, and it must be the reset's.
    // Before the fix the edit chained off the resolved pre-reset tail and
    // entered setStore immediately, so this was 2.
    expect(h.gates).toHaveLength(1)
    expect(h.gates[0].value.meta.name).toBe('Seed Data')

    await releaseNewest()
    await settle()
    expect(h.gates).toHaveLength(1)
    expect(h.gates[0].value.meta.name).toBe('EDIT')

    await act(async () => { await resetDone })
    await releaseNewest()
    await settle()

    expect((await persisted())?.meta.name).toBe('EDIT')
  })

  it('persists the post-reset edit, not SEED_DATA, when completion order is forced', async () => {
    const ctx = await mountWith(baseData('orig'))

    let resetDone: Promise<void> | undefined
    act(() => {
      resetDone = ctx.resetToSeedData()
      ctx.setDisplayName('EDIT')
    })
    await settle()

    // Newest-first, repeatedly. With the chain this is always "the only gate
    // that exists". Before the fix both writes were in flight, so this released
    // the edit first and the older SEED_DATA write committed last — the
    // user's edit was silently reverted.
    for (let i = 0; i < 6 && h.gates.length > 0; i++) {
      await releaseNewest()
      await settle()
    }

    await act(async () => { await resetDone })

    expect((await persisted())?.meta.name).toBe('EDIT')
  })
})

describe('deleteAllData write-chain ordering', () => {
  it('does not start a queued edit\'s write until the empty-data write has committed', async () => {
    const ctx = await mountWith(baseData('orig'))

    let deleteDone: Promise<void> | undefined
    act(() => {
      deleteDone = ctx.deleteAllData()
      ctx.setDisplayName('EDIT')
    })
    await settle()

    expect(h.gates).toHaveLength(1)
    // The empty payload the delete writes, not the pre-delete 'orig' state.
    expect(h.gates[0].value.sessions).toHaveLength(0)
    expect(h.gates[0].value.meta.name).toBeUndefined()

    await releaseNewest()
    await settle()
    expect(h.gates).toHaveLength(1)
    expect(h.gates[0].value.meta.name).toBe('EDIT')

    await act(async () => { await deleteDone })
    await releaseNewest()
    await settle()

    expect((await persisted())?.meta.name).toBe('EDIT')
  })

  it('persists the post-delete edit, not the empty payload', async () => {
    const ctx = await mountWith(baseData('orig'))

    let deleteDone: Promise<void> | undefined
    act(() => {
      deleteDone = ctx.deleteAllData()
      ctx.setDisplayName('EDIT')
    })
    await settle()

    for (let i = 0; i < 6 && h.gates.length > 0; i++) {
      await releaseNewest()
      await settle()
    }

    await act(async () => { await deleteDone })

    expect((await persisted())?.meta.name).toBe('EDIT')
  })

  it('resets backup-meta from inside the chain, after the empty write commits', async () => {
    const ctx = await mountWith(baseData('orig'), BACKUP_META)

    let deleteDone: Promise<void> | undefined
    act(() => {
      deleteDone = ctx.deleteAllData()
    })
    await settle()

    // resetBackupMeta runs inside the chained callback, so the counter must
    // still be intact while the 'tracker' write is gated.
    expect(h.gates).toHaveLength(1)
    expect((await persistedBackupMeta())?.sessionsSinceBackup).toBe(5)

    await releaseNewest()
    await act(async () => { await deleteDone })

    await waitFor(async () => {
      expect((await persistedBackupMeta())?.sessionsSinceBackup).toBe(0)
    })
  })
})

describe('write chain recovery', () => {
  it('a failed reset does not poison the chain for later writes', async () => {
    const ctx = await mountWith(baseData('orig'))

    // The reset's own write fails once its gate is released.
    h.failNext = true
    let resetDone: Promise<void> | undefined
    act(() => {
      resetDone = ctx.resetToSeedData()
    })
    await settle()
    expect(h.gates).toHaveLength(1)
    await releaseNewest()
    await act(async () => { await resetDone })

    // `ctx` is the context value captured at mount; setError is fresh state, so
    // re-read it off the live `latest` the Probe republishes on every render.
    await waitFor(() => {
      expect(latest!.error).toBe('Failed to reset data. Your data has been left unchanged.')
    })

    // A write queued behind the failed one must still commit. Without the
    // `.catch` on the reset's chain link the tail stays rejected and this
    // setStore is never entered.
    act(() => {
      ctx.setDisplayName('EDIT')
    })
    await settle()
    expect(h.gates).toHaveLength(1)
    expect(h.gates[0].value.meta.name).toBe('EDIT')

    await releaseNewest()
    await settle()

    expect((await persisted())?.meta.name).toBe('EDIT')
  })

  it('a failed delete does not poison the chain for later writes', async () => {
    const ctx = await mountWith(baseData('orig'))

    h.failNext = true
    let deleteDone: Promise<void> | undefined
    act(() => {
      deleteDone = ctx.deleteAllData()
    })
    await settle()
    await releaseNewest()
    await act(async () => { await deleteDone })

    await waitFor(() => {
      expect(latest!.error).toBe('Failed to delete data. Your data has been left unchanged.')
    })

    act(() => {
      ctx.setDisplayName('EDIT')
    })
    await settle()
    expect(h.gates).toHaveLength(1)
    expect(h.gates[0].value.meta.name).toBe('EDIT')

    await releaseNewest()
    await settle()

    expect((await persisted())?.meta.name).toBe('EDIT')
  })
})
