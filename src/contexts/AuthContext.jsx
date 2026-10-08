import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
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
  const [authCheckError, setAuthCheckError] = useState(null)
  const authGeneration = useRef(0)

  const logout = useCallback(() => {
    // Synchronous storage removal also runs when iOS freezes the hidden app.
    authGeneration.current += 1
    localStorage.removeItem('token')
    localStorage.removeItem('selectedOperation')
    setUser(null)
    setIsAuthenticated(false)
    setAuthCheckError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (document.visibilityState === 'hidden') logout()
    else checkAuth()
    const hidden = () => { if (document.visibilityState === 'hidden') logout() }
    const exited = () => logout()
    const restored = () => { if (!localStorage.getItem('token')) logout() }
    const sessionRemoved = event => { if (event.key === 'token' && !event.newValue) logout() }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', exited)
    window.addEventListener('pageshow', restored)
    window.addEventListener('storage', sessionRemoved)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', exited)
      window.removeEventListener('pageshow', restored)
      window.removeEventListener('storage', sessionRemoved)
    }
  }, [])

  const checkAuth = async () => {
    setLoading(true)
    setAuthCheckError(null)
    const generation = authGeneration.current
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const response = await api.get('/auth/me')
        if (generation !== authGeneration.current || localStorage.getItem('token') !== token) return
        if (document.visibilityState === 'hidden') { logout(); return }
        if (response.data.success) {
          setUser(response.data.user)
          setIsAuthenticated(true)
        }
      } catch (error) {
        if (generation !== authGeneration.current) return
        if (error.response?.status === 401) localStorage.removeItem('token')
        else setAuthCheckError('Impossible de vérifier votre connexion. Vérifiez Internet puis réessayez.')
        setIsAuthenticated(false)
      }
    }
    if (generation === authGeneration.current) setLoading(false)
  }

  const login = async (email, password) => {
    const generation = authGeneration.current
    try {
      setError(null)
      const response = await api.post('/auth/login', { email, password })
      if (generation !== authGeneration.current || document.visibilityState === 'hidden') return { success: false, message: 'La page a été quittée. Appuyez sur « Se connecter » pour reprendre.' }
      if (response.data.success) {
        localStorage.setItem('token', response.data.token)
        setUser(response.data.user)
        setIsAuthenticated(true)
        return { success: true }
      }
      return { success: false, message: response.data.message || 'Connexion impossible. Réessayez.' }
    } catch (error) {
      let message = 'Erreur de connexion'
      
      if (error.response) {
        // Le serveur a répondu avec un code d'erreur
        message = error.response.data?.message || `Erreur ${error.response.status}: ${error.response.statusText}`
      } else if (error.request) {
        // La requête a été faite mais aucune réponse n'a été reçue
        message = 'Impossible de joindre le serveur. Vérifiez votre connexion Internet puis réessayez.'
      } else {
        // Une erreur s'est produite lors de la configuration de la requête
        message = error.message || 'Erreur de connexion'
      }
      
      setError(message)
      return { success: false, message }
    }
  }

  const register = async (email, password, firstName, lastName) => {
    const generation = authGeneration.current
    try {
      setError(null)
      const response = await api.post('/auth/register', {
        email,
        password,
        firstName,
        lastName
      })
      if (generation !== authGeneration.current || document.visibilityState === 'hidden') return { success: false, message: 'La page a été quittée. Reconnectez-vous pour reprendre.' }
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

  const value = {
    user,
    setUser,
    isAuthenticated,
    loading,
    authCheckError,
    checkAuth,
    error,
    login,
    register,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

