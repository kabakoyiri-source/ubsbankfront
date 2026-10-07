import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FiMail, FiLock, FiLogIn, FiUserPlus, FiAlertCircle } from 'react-icons/fi'
import './Auth.css'
import { getRememberedLogin, saveRememberedLogin, forgetRememberedLogin } from '../services/rememberedLogin'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState(true)
  const [savedLogin, setSavedLogin] = useState(false)
  const [readingSavedLogin, setReadingSavedLogin] = useState(true)
  const [forgetting, setForgetting] = useState(false)
  const [memoryAvailable, setMemoryAvailable] = useState(true)
  const [memoryMessage, setMemoryMessage] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    getRememberedLogin().then(saved => {
      if (!active) return
      setEmail(saved.email)
      setPassword(saved.password)
      setRemember(saved.enabled)
      setSavedLogin(Boolean(saved.email && saved.password))
    }).catch(() => {
      if (!active) return
      setRemember(false)
      setMemoryAvailable(false)
      setMemoryMessage('La mémorisation est indisponible dans ce navigateur. Vous pouvez vous connecter normalement.')
    }).finally(() => { if (active) setReadingSavedLogin(false) })
    return () => { active = false }
  }, [])

  const forget = async (clearFields = true) => {
    setForgetting(true)
    setMemoryMessage('')
    try {
      await forgetRememberedLogin()
      setRemember(false)
      setSavedLogin(false)
      if (clearFields) { setEmail(''); setPassword('') }
    } catch {
      setMemoryMessage('Impossible d’effacer les identifiants mémorisés. Réessayez.')
    } finally { setForgetting(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading || readingSavedLogin || forgetting) return
    setError('')
    setLoading(true)

    const result = await login(email.trim(), password)

    if (result.success) {
      let loginMemoryError
      try {
        if (memoryAvailable) {
          if (remember) await saveRememberedLogin(email.trim(), password)
          else await forgetRememberedLogin()
        }
      } catch {
        loginMemoryError = 'Connexion réussie, mais les identifiants n’ont pas pu être mémorisés sur cet appareil.'
      }
      navigate('/', { replace: true, state: loginMemoryError ? { loginMemoryError } : undefined })
    } else {
      setError(result.message)
    }
    setLoading(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <img src="/images/logo-wordmark.png" alt="UBS Logo" className="logo-icon" />
          </div>
          <h2>Connexion e-banking</h2>
        </div>

        {error && (
          <div className="error-message">
            <FiAlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="login-email">
              <FiMail size={18} />
              Email
            </label>
            <input
              id="login-email"
              name="username"
              disabled={readingSavedLogin || loading || forgetting}
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Entrez votre email"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">
              <FiLock size={18} />
              Mot de passe
            </label>
            <input
              id="login-password"
              name="password"
              disabled={readingSavedLogin || loading || forgetting}
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Entrez votre mot de passe"
              className="form-input"
            />
          </div>

          <div className="remember-login">
            <label className="remember-login-label" htmlFor="remember-login">
              <input id="remember-login" type="checkbox" checked={remember}
                disabled={readingSavedLogin || loading || forgetting || !memoryAvailable}
                onChange={(event) => {
                  if (event.target.checked) setRemember(true)
                  else forget(false)
                }} />
              <span>Mémoriser mes identifiants sur cet appareil</span>
            </label>
            <p className="remember-login-help">À utiliser sur votre appareil personnel. Les champs seront préremplis à votre prochaine connexion.</p>
            {savedLogin && <button type="button" className="forget-login" disabled={loading || forgetting} onClick={() => forget()}>Oublier mes identifiants</button>}
            {memoryMessage && <p className="remember-login-message" role="status">{memoryMessage}</p>}
          </div>

          <button 
            type="submit" 
            className="btn btn-secondary btn-block btn-auth" 
            disabled={loading || readingSavedLogin || forgetting}
          >
            {readingSavedLogin ? <span>Chargement…</span> : loading ? (
              <>
                <span className="spinner"></span>
                <span>Connexion...</span>
              </>
            ) : (
              <>
                <FiLogIn size={18} />
                <span>Se connecter</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Pas encore de compte ?{' '}
            <Link to="/register" className="auth-link">
              <FiUserPlus size={16} />
              S'inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
