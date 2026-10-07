import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext()

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const response = await api.get('/auth/me')
        if (response.data.success) {
          setUser(response.data.user)
          setIsAuthenticated(true)
        }
      } catch (error) {
        localStorage.removeItem('token')
        setIsAuthenticated(false)
      }
    }
    setLoading(false)
  }

  const login = async (email, password) => {
    try {
      setError(null)
      const response = await api.post('/auth/login', { email, password })
      if (response.data.success) {
        localStorage.setItem('token', response.data.token)
        setUser(response.data.user)
        setIsAuthenticated(true)
        return { success: true }
      }
    } catch (error) {
      console.error('Login error:', error)
      let message = 'Erreur de connexion'
      
      if (error.response) {
        // Le serveur a répondu avec un code d'erreur
        message = error.response.data?.message || `Erreur ${error.response.status}: ${error.response.statusText}`
      } else if (error.request) {
        // La requête a été faite mais aucune réponse n'a été reçue
        message = 'Impossible de joindre le serveur. Vérifiez que le backend ngrok est actif.'
      } else {
        // Une erreur s'est produite lors de la configuration de la requête
        message = error.message || 'Erreur de connexion'
      }
      
      setError(message)
      return { success: false, message }
    }
  }

  const register = async (email, password, firstName, lastName) => {
    try {
      setError(null)
      const response = await api.post('/auth/register', {
        email,
        password,
        firstName,
        lastName
      })
      if (response.data.success) {
        localStorage.setItem('token', response.data.token)
        setUser(response.data.user)
        setIsAuthenticated(true)
        return { success: true }
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Erreur lors de l\'inscription'
      setError(message)
      return { success: false, message }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    setIsAuthenticated(false)
  }

  const value = {
    user,
    setUser,
    isAuthenticated,
    loading,
    error,
    login,
    register,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

