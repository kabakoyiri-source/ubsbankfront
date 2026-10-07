import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { 
  FiUser, 
  FiMoreHorizontal,
  FiMessageSquare,
  FiArrowRight,
  FiLoader,
  FiPlus,
  FiHome,
  FiRepeat,
  FiCreditCard,
  FiLayers,
  FiSend,
  FiSearch,
  FiEye,
  FiEyeOff,
  FiUsers,
  FiClock,
  FiX,
  FiLogOut
} from 'react-icons/fi'
import { BiQrScan, BiMessage } from 'react-icons/bi'
// Composants pour les icônes de cartes depuis Icons8
const VisaIcon = ({ size = 32, className = '' }) => (
  <img 
    src="https://img.icons8.com/color/48/visa.png" 
    alt="Visa" 
    width={size} 
    height={size * 0.6}
    className={className}
    style={{ objectFit: 'contain' }}
  />
)

const MastercardIcon = ({ size = 32, className = '' }) => (
  <img 
    src="https://img.icons8.com/color/48/mastercard.png" 
    alt="Mastercard" 
    width={size} 
    height={size * 0.6}
    className={className}
    style={{ objectFit: 'contain' }}
  />
)
import './Dashboard.css'

function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [operations, setOperations] = useState([])
  const [adminBalance, setAdminBalance] = useState({ chf: 0, eur: 0, usd: 0 })
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showBalance, setShowBalance] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const menuRef = useRef(null)
  const [selectedCurrency, setSelectedCurrency] = useState('chf')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!sidebarOpen) return
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    menuRef.current?.querySelector('button')?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false)
      if (event.key !== 'Tab') return
      const items = menuRef.current?.querySelectorAll('button, a[href]')
      if (!items?.length) return
      const first = items[0], last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [sidebarOpen])

  const loadData = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [clientsRes, operationsRes] = await Promise.all([
        api.get('/clients'),
        api.get('/operations?admin=true')
      ])

      setClients(clientsRes.data.data || [])
      
      const allOperations = operationsRes.data.data || []
      
      // Calculer le solde dynamique par devise (somme algébrique simple)
      let balance = { chf: 0, eur: 0, usd: 0 }
      allOperations.forEach(op => {
        const currency = (op.currency || 'chf').toLowerCase()
        if (op.status === 'completed') {
          if (currency in balance) balance[currency] += Number(op.amount || 0)
        } else if (op.status === 'pending') {
          // Pour les opérations pending, on soustrait toujours la valeur absolue
          if (currency in balance) balance[currency] -= Math.abs(Number(op.amount || 0))
        }
      })
      setAdminBalance(balance)
      
      // Charger les 10 dernières opérations pour l'affichage
      const recentOperations = allOperations.slice(0, 10)
      setOperations(recentOperations)
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error)
      setLoadError('Impossible de charger vos comptes. Vérifiez votre connexion puis réessayez.')
    } finally {
      setLoading(false)
    }
  }

  const filteredClients = clients.filter(client => {
    if (activeTab === 'all') return true
    if (activeTab === 'active') return client.status === 'active'
    if (activeTab === 'inactive') return client.status === 'inactive'
    return true
  }).filter(client =>
    (client.firstName && client.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (client.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.accountNumber || '').includes(searchTerm)
  )

  const activeClients = clients.filter(c => c.status === 'active').length
  const pendingOperations = operations.filter(op => op.status === 'pending').length
  
  // Obtenir la dernière opération récente
  const recentOperation = operations.length > 0 ? operations[0] : null
  const hasRecentAction = recentOperation && new Date(recentOperation.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Dernières 24h

  // Fonction pour formater les montants avec point pour décimales et apostrophe pour milliers
  const formatAmount = (amount) => {
    if (amount === undefined || amount === null) return '0,00'
    const absoluteAmount = Math.abs(amount)
    const fixed = absoluteAmount.toFixed(2)
    const [intPart, decPart] = fixed.split('.')
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'")
    return `${amount < 0 ? '-' : ''}${formattedInt},${decPart}`
  }

  // Fonction de déconnexion
  const handleLogout = () => {
    // Supprimer le token d'authentification du localStorage
    logout()
    // Rediriger vers la page de login
    navigate('/login')
  }

  // Fonction pour gérer le clic sur une opération
  const handleOperationClick = (operation) => {
    // Stocker les détails de l'opération pour la page de détails
    localStorage.setItem('selectedOperation', JSON.stringify(operation))
    // Naviguer vers la page de détails
    navigate('/operation-details')
  }

  // Fonction pour gérer le clic sur les notifications
  const handleNotificationClick = () => {
    // Naviguer vers l'historique pour voir les actions récentes
    navigate('/history', { state: { showRecent: true } })
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-container">
          <FiLoader className="spinner-icon" size={48} />
          <p>Chargement...</p>
        </div>
      </div>
    )
  }

  if (loadError) return (
    <div className="dashboard-error" role="alert">
      <p>{loadError}</p>
      <button className="btn btn-primary" onClick={loadData}>Réessayer</button>
    </div>
  )

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <div className="profile-section">
              <button 
                className="profile-avatar"
                onClick={() => setSidebarOpen(true)}
                aria-label="Ouvrir le menu"
              >
                <FiUser size={24} />
              </button>
              <div className="home-section">
                <span className="home-label">Accueil</span>
                {user && (
                  <span className="greeting-text">
                      {user.firstName && user.lastName 
                      ? `${user.firstName} ${user.lastName}` 
                      : user.firstName || user.lastName || ''}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="header-right">
            <button className="header-icon-btn" aria-label="Ouvrir le menu" onClick={() => setSidebarOpen(true)}>
              <FiMoreHorizontal size={24} />
            </button>
            <button 
              className={`header-icon-btn notification-btn ${hasRecentAction ? 'has-recent' : ''}`}
              aria-label="Consulter les notifications"
              onClick={handleNotificationClick}
            >
              <BiMessage size={24} />
              {hasRecentAction && (
                <span className="notification-dot"></span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <Link to="/" className="quick-action-item">
          <div className="quick-action-icon scan-icon">
            <BiQrScan size={24} />
          </div>
          <span className="quick-action-label">Scanner & Payer</span>
        </Link>
        <Link to="/balance/load" className="quick-action-item">
          <div className="quick-action-icon load-icon">
            <FiCreditCard size={24} />
          </div>
          <span className="quick-action-label">Recharger</span>
        </Link>
          <Link to="/operations/transfer" className="quick-action-item">
          <div className="quick-action-icon transfer-icon">
            <FiSend size={24} />
          </div>
          <span className="quick-action-label">Transfert</span>
        </Link>
      </div>

      {/* Trading Portfolio */}
      <div className="trading-portfolio">
        <div className="portfolio-header">
          <span className="portfolio-dot"></span>
          <span className="portfolio-title">Portefeuille de Trading</span>
        </div>

        <div className="portfolio-main">
          <div className="portfolio-currency-selector">
            <button 
              className={`currency-tab ${selectedCurrency === 'chf' ? 'active' : ''}`}
              onClick={() => setSelectedCurrency('chf')}
            >CHF</button>
            <button 
              className={`currency-tab ${selectedCurrency === 'eur' ? 'active' : ''}`}
              onClick={() => setSelectedCurrency('eur')}
            >EUR</button>
            <button 
              className={`currency-tab ${selectedCurrency === 'usd' ? 'active' : ''}`}
              onClick={() => setSelectedCurrency('usd')}
            >USD</button>
          </div>
          <span className="portfolio-amount">
            {selectedCurrency.toUpperCase()} {formatAmount(adminBalance[selectedCurrency])}
          </span>
          <div className="portfolio-gain">
            <span className="gain-percent">+2.04%</span>
            <span className="gain-amount">CHF 1'043</span>
          </div>
        </div>

        <div className="portfolio-chart">
          <svg viewBox="0 0 320 140" className="portfolio-svg">
            {/* Ligne 0% */}
            <line
              x1="0"
              y1="85"
              x2="320"
              y2="85"
              stroke="#d0d0d0"
              strokeDasharray="3 4"
              strokeWidth="1"
            />
            
            {/* Label 0% */}
            <text
              x="318"
              y="80"
              fontSize="12"
              fill="#999"
              textAnchor="end"
            >
              0%
            </text>

            {/* Courbe */}
            <polyline
              points="0,90 40,95 80,65 120,70 160,45 200,60 240,55 280,45 320,35"
              fill="none"
              stroke="#5AA9E6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Zone bleue */}
            <polygon
              points="0,90 40,95 80,65 120,70 160,45 200,60 240,55 280,45 320,35 320,120 0,120"
              fill="url(#blueGradient)"
            />

            <defs>
              <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5AA9E6" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#5AA9E6" stopOpacity="0.05" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="portfolio-footer">
          
        </div>

        <div className="custody-row">
          <span>Compte de garde</span>
          <span>{selectedCurrency.toUpperCase()} {formatAmount(adminBalance[selectedCurrency])}</span>
        </div>
      </div>

      {/* Favorites */}
      <div className="favorites-section">
        <div className="favorites-header">Favoris</div>

        <div className="favorite-item">
          <div className="favorite-left">
            <span className="favorite-icon">⛃</span>
            <div>
              <div className="favorite-label">Compte CHF</div>
              <div className="favorite-amount">CHF {formatAmount(adminBalance.chf)}</div>
            </div>
          </div>
          <span className="favorite-arrow">›</span>
        </div>

        <div className="favorite-divider"></div>

        <div className="favorite-item">
          <div className="favorite-left">
            <span className="favorite-icon savings-icon">
              <FiLayers size={18} />
            </span>

            <div>
              <div className="favorite-label">Compte EUR</div>
              <div className="favorite-amount">EUR {formatAmount(adminBalance.eur)}</div>
            </div>
          </div>
          <span className="favorite-arrow">›</span>
        </div>
      </div>

      {/* Sidebar Menu */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}></div>
      <div ref={menuRef} className={`sidebar-menu ${sidebarOpen ? 'open' : ''}`} role="dialog" aria-label="Menu" aria-modal={sidebarOpen ? true : undefined} aria-hidden={!sidebarOpen} inert={sidebarOpen ? undefined : ''}>
        <div className="sidebar-header">
          <h2>Menu</h2>
          <button 
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le menu"
          >
            <FiX size={24} />
          </button>
        </div>
        <nav className="sidebar-nav">
          <Link 
            to="/" 
            className="sidebar-nav-item"
            onClick={() => setSidebarOpen(false)}
          >
            <FiHome size={22} />
            <span>Accueil</span>
          </Link>
          <Link 
            to="/clients" 
            className="sidebar-nav-item"
            onClick={() => setSidebarOpen(false)}
          >
            <FiUsers size={22} />
            <span>Bénéficiaires</span>
          </Link>
          <Link 
            to="/operations" 
            className="sidebar-nav-item"
            onClick={() => setSidebarOpen(false)}
          >
            <FiRepeat size={22} />
            <span>Opérations</span>
          </Link>
          <Link 
            to="/history" 
            className="sidebar-nav-item"
            onClick={() => setSidebarOpen(false)}
          >
            <FiClock size={22} />
            <span>Historique</span>
          </Link>
        </nav>
        <div className="sidebar-logout">
          <button 
            className="sidebar-nav-item logout-btn"
            onClick={handleLogout}
          >
            <FiLogOut size={12} />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
