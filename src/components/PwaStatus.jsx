import React, { useEffect, useState } from 'react'

export default function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [waiting, setWaiting] = useState(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const connected = () => setOnline(true)
    const disconnected = () => setOnline(false)
    window.addEventListener('online', connected)
    window.addEventListener('offline', disconnected)
    let disposed = false
    let registration
    const inspect = () => {
      if (!disposed && registration?.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting)
    }
    const updateFound = () => registration.installing?.addEventListener('statechange', inspect)
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' })
        .then((result) => {
          if (disposed) return
          registration = result
          inspect()
          registration.addEventListener('updatefound', updateFound)
          updateFound()
        }).catch((error) => console.error('Enregistrement PWA impossible', error))
    }
    return () => {
      disposed = true
      window.removeEventListener('online', connected)
      window.removeEventListener('offline', disconnected)
      registration?.removeEventListener('updatefound', updateFound)
    }
  }, [])

  const update = () => {
    setUpdating(true)
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
    waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  if (online && !waiting) return null
  return (
    <aside className="pwa-status" role="status">
      {!online ? <span>Hors connexion. Les opérations nécessitent Internet.</span> : <>
        <span>Une mise à jour est disponible.</span>
        <button type="button" onClick={update} disabled={updating}>
          {updating ? 'Mise à jour…' : 'Actualiser'}
        </button>
      </>}
    </aside>
  )
}
