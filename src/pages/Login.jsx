import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FiMail, FiLock, FiLogIn, FiUserPlus, FiAlertCircle } from 'react-icons/fi'
import './Auth.css'
import { getRememberedLogin, saveRememberedLogin, forgetRememberedLogin } from '../services/rememberedLogin'
import { supabaseConfigurationError } from '../services/supabase'

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
      setMemoryMessage("Saving credentials is unavailable in this browser. You can still log in normally.")
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
      setMemoryMessage("Unable to remove saved credentials. Try again.")
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
        loginMemoryError = "You are logged in, but your credentials could not be saved on this device."
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
          <h2>E-banking login</h2>
        </div>

        {(error || supabaseConfigurationError) && (
          <div className="error-message">
            <FiAlertCircle size={20} />
            <span>{error || supabaseConfigurationError}</span>
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
              placeholder="Enter your email"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">
              <FiLock size={18} />
              Password
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
              placeholder="Enter your password"
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
              <span>Remember my credentials on this device</span>
            </label>
            <p className="remember-login-help">Use this on your personal device. Your credentials will be filled in the next time you log in.</p>
            {savedLogin && <button type="button" className="forget-login" disabled={loading || forgetting} onClick={() => forget()}>Forget my credentials</button>}
            {memoryMessage && <p className="remember-login-message" role="status">{memoryMessage}</p>}
          </div>

          <button 
            type="submit" 
            className="btn btn-secondary btn-block btn-auth" 
            disabled={loading || readingSavedLogin || forgetting}
          >
            {readingSavedLogin ? <span>Loading…</span> : loading ? (
              <>
                <span className="spinner"></span>
                <span>Logging in...</span>
              </>
            ) : (
              <>
                <FiLogIn size={18} />
                <span>Log in</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don’t have an account?{' '}
            <Link to="/register" className="auth-link">
              <FiUserPlus size={16} />
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
