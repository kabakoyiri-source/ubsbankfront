import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import AddClient from './pages/AddClient'
import Operations from './pages/Operations'
import AddOperation from './pages/AddOperation'
import LoadBalance from './pages/LoadBalance'
import History from './pages/History'
import Accounts from './pages/Accounts'
import OperationDetails from './pages/OperationDetails'
import Cards from './pages/Cards'
import Plus from './pages/Plus'
import Profile from './pages/Profile'
import About from './pages/About'
import Layout from './components/Layout'
import StartupScreen from './components/StartupScreen'
import PwaStatus from './components/PwaStatus'

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { loading, authCheckError, checkAuth } = useAuth()
  if (loading) return <StartupScreen />
  if (authCheckError) return (
    <div className="app-error" role="alert">
      <p>{authCheckError}</p>
      <button className="btn btn-primary" onClick={checkAuth}>Réessayer</button>
    </div>
  )
  return (
    <Routes>
      <Route path="/login" element={<div className="screen-auth"><Login /></div>} />
      <Route path="/register" element={<div className="screen-auth"><Register /></div>} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <PrivateRoute>
            <Layout>
              <Clients />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/clients/new"
        element={
          <PrivateRoute>
            <Layout>
              <AddClient />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/clients/:id"
        element={
          <PrivateRoute>
            <Layout>
              <ClientDetail />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/operations"
        element={
          <PrivateRoute>
            <Layout>
              <Operations />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/operations/new"
        element={
          <PrivateRoute>
            <Layout>
              <AddOperation />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/operations/transfer"
        element={
          <PrivateRoute>
            <Layout>
              <AddOperation />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/balance/load"
        element={
          <PrivateRoute>
            <Layout>
              <LoadBalance />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/history"
        element={
          <PrivateRoute>
            <Layout>
              <History />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/accounts"
        element={
          <PrivateRoute>
            <Layout>
              <Accounts />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/operation-details"
        element={
          <PrivateRoute>
            <Layout>
              <OperationDetails />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/cards"
        element={
          <PrivateRoute>
            <Layout>
              <Cards />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/more"
        element={
          <PrivateRoute>
            <Layout>
              <Plus />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <PrivateRoute>
            <Layout>
              <Profile />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/about"
        element={
          <PrivateRoute>
            <Layout>
              <About />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
        <PwaStatus />
      </Router>
    </AuthProvider>
  )
}

export default App
