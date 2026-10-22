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
      setError("Passwords do not match")
      return
    }

    if (formData.password.length < 6) {
      setError("Your password must contain at least 6 characters")
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
            <img src="/images/logo-wordmark.png" alt="UBS Logo" className="logo-icon" />
          </div>
          <h1>Create an account</h1>
          <p>Join us today</p>
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
              First name
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
              Last name
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
              Password
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
              At least 6 characters
            </small>
          </div>

          <div className="form-group">
            <label>
              <FiLock size={18} />
              Confirm password
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
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <FiUserPlus size={18} />
                <span>Sign up</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              <FiLogIn size={16} />
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
