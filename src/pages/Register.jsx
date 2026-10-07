import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  FiMail, 
  FiLock, 
  FiUser, 
  FiUserPlus, 
  FiLogIn,
  FiAlertCircle 
} from 'react-icons/fi'
import './Auth.css'

function Register() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setLoading(true)
    const result = await register(
      formData.email,
      formData.password,
      formData.firstName,
      formData.lastName
    )
    setLoading(false)

    if (result.success) {
      navigate('/')
    } else {
      setError(result.message)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <img src="/images/ubs.png" alt="UBS Logo" className="logo-icon" />
          </div>
          <h1>Créer un compte</h1>
          <p>Rejoignez-nous dès aujourd'hui</p>
        </div>

        {error && (
          <div className="error-message">
            <FiAlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>
              <FiUser size={18} />
              Prénom
            </label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
              className="form-input"
              placeholder="Jean"
            />
          </div>

          <div className="form-group">
            <label>
              <FiUser size={18} />
              Nom
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
              className="form-input"
              placeholder="Dupont"
            />
          </div>

          <div className="form-group">
            <label>
              <FiMail size={18} />
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="form-input"
              placeholder="jean.dupont@example.com"
            />
          </div>

          <div className="form-group">
            <label>
              <FiLock size={18} />
              Mot de passe
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              className="form-input"
              placeholder="••••••••"
            />
            <small style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
              Minimum 6 caractères
            </small>
          </div>

          <div className="form-group">
            <label>
              <FiLock size={18} />
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              minLength={6}
              className="form-input"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block btn-auth" 
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                <span>Inscription...</span>
              </>
            ) : (
              <>
                <FiUserPlus size={18} />
                <span>S'inscrire</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Déjà un compte ?{' '}
            <Link to="/login" className="auth-link">
              <FiLogIn size={16} />
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
