import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getStore, setStore, deleteStore } from '../db'

describe('db.ts error handling', () => {
  beforeEach(async () => {
    try {
      await deleteStore('tracker')
      await deleteStore('backup-meta')
    } catch {
      // ignore
    }
  })

  it('getStore returns null for non-existent key', async () => {
    const result = await getStore('nonexistent')
    expect(result).toBeNull()
  })

  it('setStore and getStore round-trip', async () => {
    await setStore('test-key', { foo: 'bar' })
    const result = await getStore('test-key')
    expect(result).toEqual({ foo: 'bar' })
  })

  it('deleteStore removes a key', async () => {
    await setStore('to-delete', 'value')
    await deleteStore('to-delete')
    const result = await getStore('to-delete')
    expect(result).toBeNull()
  })

  it('setStore overwrites existing value', async () => {
    await setStore('overwrite', 'first')
    await setStore('overwrite', 'second')
    const result = await getStore('overwrite')
    expect(result).toBe('second')
  })

  it('handles multiple operations in sequence', async () => {
    await setStore('a', 1)
    await setStore('b', 2)
    await setStore('c', 3)

    expect(await getStore('a')).toBe(1)
    expect(await getStore('b')).toBe(2)
    expect(await getStore('c')).toBe(3)

    await deleteStore('b')
    expect(await getStore('b')).toBeNull()

    // a and c still intact
    expect(await getStore('a')).toBe(1)
    expect(await getStore('c')).toBe(3)
  })

  it('handles complex nested objects', async () => {
    const complex = {
      meta: { method: 'GZCL', created: '2026-01-01' },
      exercises: [
        { id: 'squat', name: 'Squat', muscles: ['quads'], tier: 'T1' }
      ],
      sessions: [
        { date: '2026-01-01', exercises: [{ weight: '225', reps: '5' }] }
      ]
    }
    await setStore('tracker', complex)
    const result = await getStore('tracker')
    expect(result).toEqual(complex)
  })
})

/**
 * Durability: these three helpers must settle on the transaction, not on the
 * request. A put/delete request can succeed and then be rolled back by an
 * abort that fires *after* every request in the transaction has succeeded —
 * quota exhaustion, a `versionchange` from another tab, an explicit abort.
 * Settling on `req.onsuccess` reports "saved" for a write that is about to be
 * discarded, and the later `tx.onabort` rejection is a no-op on an
 * already-settled promise.
 *
 * Each test forces that exact sequence against fake-indexeddb by spying on the
 * store method: perform the real operation, then abort the transaction from a
 * `success` listener added via `addEventListener` (so it fires independently of
 * whatever handler the module under test assigns).
 */
describe('db.ts durability', () => {
  /** Whether the transaction really aborted / committed, so no assertion
   *  below can pass vacuously because the abort never happened. */
  let aborted: boolean
  let committed: boolean

  beforeEach(async () => {
    aborted = false
    committed = false
    try {
      await deleteStore('tracker')
      await deleteStore('backup-meta')
    } catch {
      // ignore
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** Record how the transaction that `request` belongs to ends up. */
  function track(tx: IDBTransaction): void {
    tx.addEventListener('abort', () => {
      aborted = true
    })
    tx.addEventListener('complete', () => {
      committed = true
    })
  }

  /** Make the next put succeed and then abort its transaction. */
  function abortAfterPutSuccess(): void {
    const original = IDBObjectStore.prototype.put

    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey
    ) {
      const req = original.call(this, value, key)
      const tx = this.transaction
      track(tx)
      req.addEventListener('success', () => tx.abort())
      return req
    })
  }

  /** Make the next delete succeed and then abort its transaction. */
  function abortAfterDeleteSuccess(): void {
    const original = IDBObjectStore.prototype.delete

    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (
      this: IDBObjectStore,
      key: IDBKeyRange | IDBValidKey
    ) {
      const req = original.call(this, key)
      const tx = this.transaction
      track(tx)
      req.addEventListener('success', () => tx.abort())
      return req
    })
  }

  it('setStore rejects when the transaction aborts after the put succeeds', async () => {
    abortAfterPutSuccess()

    await expect(setStore('doomed', { foo: 'bar' })).rejects.toBeInstanceOf(
      Error
    )

    // The abort really happened, and the transaction never committed.
    expect(aborted).toBe(true)
    expect(committed).toBe(false)

    // And the write was rolled back — nothing durable landed.
    expect(await getStore('doomed')).toBeNull()
  })

  it('setStore resolves only after the transaction commits', async () => {
    // Record whether `complete` had fired at the moment setStore's promise
    // settled. Resolving on request success settles strictly earlier.
    const original = IDBObjectStore.prototype.put

    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey
    ) {
      const req = original.call(this, value, key)
      track(this.transaction)
      return req
    })

    let completeAtSettle: boolean | null = null
    await setStore('committed', 'value').then(() => {
      completeAtSettle = committed
    })

    expect(completeAtSettle).toBe(true)
    expect(await getStore('committed')).toBe('value')
  })

  it('deleteStore rejects when the transaction aborts after the delete succeeds', async () => {
    await setStore('keep-me', 'value')
    expect(await getStore('keep-me')).toBe('value')

    abortAfterDeleteSuccess()

    await expect(deleteStore('keep-me')).rejects.toBeInstanceOf(Error)

    expect(aborted).toBe(true)
    expect(committed).toBe(false)

    // The deletion was rolled back — the key is still there.
    expect(await getStore('keep-me')).toBe('value')
  })
})