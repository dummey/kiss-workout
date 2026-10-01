const DB_NAME = 'gzcl-tracker-v2'
const DB_VERSION = 1
const STORE_NAME = 'data'

let db: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(new Error('IndexedDB open blocked by another tab'))

    request.onsuccess = () => {
      const database = request.result
      db = database

      database.onversionchange = () => {
        database.close()
        db = null
      }

      database.onclose = () => {
        if (db === database) {
          db = null
        }
      }

      resolve(database)
    }

    request.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME)
      }
    }
  })
}

/**
 * All three store helpers settle on the *transaction*, never on the request.
 *
 * A request can succeed and still be rolled back: IndexedDB aborts the whole
 * transaction on quota exhaustion, a `versionchange` from another tab, or an
 * explicit `abort()`. Those aborts fire *after* every request in the
 * transaction has already succeeded, so settling on `req.onsuccess` reports
 * "saved" for a write that is about to be discarded — and a later
 * `tx.onabort` rejection against an already-settled promise is a silent no-op.
 *
 * Resolving on `tx.oncomplete` makes the promise mean what callers assume it
 * means: the data is durable. A request-level error still surfaces, because an
 * unhandled request error propagates to the transaction and aborts it, which
 * rejects through `onabort` below.
 */
function getStore(key: string): Promise<unknown> {
  return openDB().then(database => {
    return new Promise<unknown>((resolve, reject) => {
      let tx: IDBTransaction
      try {
        tx = database.transaction(STORE_NAME, 'readonly')
      } catch (err) {
        reject(err)
        return
      }

      tx.oncomplete = () => resolve(result)
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'))
      tx.onerror = () => reject(tx.error || new Error('Transaction error'))

      const store = tx.objectStore(STORE_NAME)
      let req: IDBRequest
      try {
        req = store.get(key)
      } catch (err) {
        reject(err)
        return
      }

      let result: unknown = null
      req.onsuccess = () => {
        result = req.result ?? null
      }
    })
  })
}

function setStore(key: string, value: unknown): Promise<void> {
  return openDB().then(database => {
    return new Promise<void>((resolve, reject) => {
      let tx: IDBTransaction
      try {
        tx = database.transaction(STORE_NAME, 'readwrite')
      } catch (err) {
        reject(err)
        return
      }

      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'))
      tx.onerror = () => reject(tx.error || new Error('Transaction error'))

      const store = tx.objectStore(STORE_NAME)
      try {
        store.put(value, key)
      } catch (err) {
        reject(err)
      }
    })
  })
}

function deleteStore(key: string): Promise<void> {
  return openDB().then(database => {
    return new Promise<void>((resolve, reject) => {
      let tx: IDBTransaction
      try {
        tx = database.transaction(STORE_NAME, 'readwrite')
      } catch (err) {
        reject(err)
        return
      }

      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'))
      tx.onerror = () => reject(tx.error || new Error('Transaction error'))

      const store = tx.objectStore(STORE_NAME)
      try {
        store.delete(key)
      } catch (err) {
        reject(err)
      }
    })
  })
}

export { getStore, setStore, deleteStore }