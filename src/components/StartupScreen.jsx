import React from 'react'

export default function StartupScreen() {
  return (
    <div className="startup-screen" role="status" aria-label="Chargement de l’application">
      <img src="/images/logo-wordmark.png" width="240" height="86" alt="UBS" />
      <span className="startup-indicator" aria-hidden="true" />
      <span className="sr-only">Chargement…</span>
    </div>
  )
}
