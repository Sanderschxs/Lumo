const DB_NAME = 'lumo-media-v1'
const STORE_NAME = 'media'
const DB_VERSION = 1

export type StoredMedia = {
  id: string
  name: string
  type: string
  size: number
  blob: Blob
  createdAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveMedia(file: File): Promise<StoredMedia> {
  const record: StoredMedia = {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    blob: file,
    createdAt: Date.now(),
  }
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return record
}

export async function getMedia(id: string): Promise<StoredMedia | undefined> {
  const db = await openDb()
  const result = await new Promise<StoredMedia | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(id)
    request.onsuccess = () => resolve(request.result as StoredMedia | undefined)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return result
}

export async function deleteMedia(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
  return `${(mb / 1024).toFixed(1)} GB`
}
