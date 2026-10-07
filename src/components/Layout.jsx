import React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  FiHome, 
  FiUsers, 
  FiRepeat, 
  FiClock, 
  FiLogOut
} from 'react-icons/fi'
import './Layout.css'

function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path) => {
    return location.pathname === path
  }

  const navItems = [
    { path: '/', label: 'Accueil', icon: FiHome },
    { path: '/clients', label: 'Bénéficiaires', icon: FiUsers },
    { path: '/operations', label: 'Opérations', icon: FiRepeat },
    { path: '/history', label: 'Historique', icon: FiClock },
  ]

  const isDashboard = location.pathname === '/'

  return (
    <div className={`layout ${isDashboard ? 'dashboard-page' : ''}`}>

      
      <main className="main-content">
        <div className={`content-wrapper fade-in ${isDashboard ? 'dashboard-wrapper' : ''}`}>
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={`bottom-nav ${isDashboard ? 'hidden' : ''}`}>
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`bottom-nav-link ${isActive(item.path) ? 'active' : ''}`}
            >
              <Icon size={22} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export default Layout
