import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initializeIosViewport } from './services/iosViewport'
import './index.css'
import './mobile.css'

initializeIosViewport()

// Development must never keep the production shell cached.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) registration.unregister()
  })
  caches.keys().then(keys => {
    for (const key of keys) if (key.startsWith('ubs-bank-')) caches.delete(key)
  })
}

class ErrorBoundary extends React.Component {
  state = { hasError: false }
  componentDidMount() { window.__UBS_MARK_READY__?.() }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error, info) { console.error("Application error", error, info) }
  render() {
    if (this.state.hasError) return (
      <div className="app-error" role="alert">
        <h1>Unable to display this page</h1>
        <p>Reload the app to try again.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Top up</button>
      </div>
    )
    return this.props.children
  }
}
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>,
)
