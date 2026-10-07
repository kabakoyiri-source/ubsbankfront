// This feature is for a trusted personal device. Same-origin application code
// can decrypt the password; encryption is not protection against a compromised app.
const DATABASE = 'ubs-device-login'
const STORE = 'preferences'
const ENTRY = 'login'
const emptyLogin = () => ({ enabled: true, email: '', password: '' })

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB || !globalThis.crypto?.subtle) {
      reject(new Error('La mémorisation est indisponible dans ce navigateur.'))
      return
    }
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Le stockage de cet appareil est bloqué.'))
  })
}

async function readEntry() {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readonly')
      const request = transaction.objectStore(STORE).get(ENTRY)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}

async function writeEntry(entry) {
  const db = await openDatabase()
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite')
      transaction.objectStore(STORE).put(entry, ENTRY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error || new Error('Stockage interrompu.'))
    })
  } finally { db.close() }
}

export async function getRememberedLogin() {
  const entry = await readEntry()
  if (!entry) return emptyLogin()
  if (!entry.enabled) return { enabled: false, email: '', password: '' }
  try {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: entry.iv }, entry.key, entry.password)
    return { enabled: true, email: entry.email, password: new TextDecoder().decode(decrypted) }
  } catch {
    // An unreadable record must not keep returning broken credentials.
    await forgetRememberedLogin()
    return { enabled: false, email: '', password: '' }
  }
}

export async function saveRememberedLogin(email, password) {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(password))
  // CryptoKey is structured-cloned by IndexedDB and stays non-extractable.
  await writeEntry({ enabled: true, email, password: encrypted, iv, key })
}

export async function forgetRememberedLogin() {
  // Replace the entire record, dropping both the ciphertext and decryption key.
  await writeEntry({ enabled: false })
}
