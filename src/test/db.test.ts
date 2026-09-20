import { describe, it, expect, beforeEach, vi } from 'vitest'
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
