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

      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
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

      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'))
      tx.onerror = () => reject(tx.error || new Error('Transaction error'))

      const store = tx.objectStore(STORE_NAME)
      let req: IDBRequest
      try {
        req = store.put(value, key)
      } catch (err) {
        reject(err)
        return
      }

      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
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

      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'))
      tx.onerror = () => reject(tx.error || new Error('Transaction error'))

      const store = tx.objectStore(STORE_NAME)
      let req: IDBRequest
      try {
        req = store.delete(key)
      } catch (err) {
        reject(err)
        return
      }

      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  })
}

export { getStore, setStore, deleteStore }
