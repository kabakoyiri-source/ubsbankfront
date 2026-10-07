import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FiHome, FiRepeat, FiLayers, FiCreditCard, FiMoreHorizontal } from 'react-icons/fi'
import './Layout.css'

const screens = {
  '/': 'dashboard', '/clients': 'clients', '/clients/new': 'addclient',
  '/operations': 'operations', '/operations/new': 'addoperation',
  '/operations/transfer': 'addoperation', '/balance/load': 'loadbalance',
  '/history': 'history', '/accounts': 'accounts', '/operation-details': 'operationdetails',
  '/cards': 'cards', '/more': 'plus', '/profile': 'profile', '/about': 'about', '/settings': 'settings',
}
const navItems = [
  { path: '/', label: 'Accueil', icon: FiHome, section: 'home' },
  { path: '/operations/new', label: 'Paiements', icon: FiRepeat, section: 'payments' },
  { path: '/accounts', label: 'Comptes', icon: FiLayers, section: 'accounts' },
  { path: '/cards', label: 'Cartes', icon: FiCreditCard, section: 'cards' },
  { path: '/more', label: 'Plus', icon: FiMoreHorizontal, section: 'more' },
]
function Layout({ children }) {
  const { pathname, state } = useLocation()
  const screen = screens[pathname] || (pathname.startsWith('/clients/') ? 'clientdetail' : 'dashboard')
  const section = pathname === '/' ? 'home'
    : pathname.startsWith('/operations') || pathname === '/history' || pathname === '/balance/load' || pathname === '/operation-details' ? 'payments'
    : pathname === '/accounts' ? 'accounts' : pathname === '/cards' ? 'cards' : 'more'
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <div className={'layout ' + (screen === 'dashboard' ? 'dashboard-page' : '')}>
      <main className="main-content" id="main-content">
        <div className={'content-wrapper screen-' + screen}>
          {state?.loginMemoryError && <div className="error-message" role="status">{state.loginMemoryError}</div>}
          {children}
        </div>
      </main>
      <nav className="app-bottom-nav" aria-label="Navigation principale">
        <div className="app-bottom-nav-inner">
          {navItems.map(({ path, label, icon: Icon, section: itemSection }) => (
            <Link key={path} to={path}
              className={'app-nav-link ' + (section === itemSection ? 'active' : '')}
              aria-current={section === itemSection ? 'page' : undefined}>
              <Icon size={23} aria-hidden="true" /><span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
export default Layout
