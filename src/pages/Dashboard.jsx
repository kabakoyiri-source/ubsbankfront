import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { calculateBalances } from '../services/balances'
import { formatAmount } from '../services/money'
import ScanIcon from '../components/ScanIcon'
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

// Illustrative portfolio curves, independent of the actual account balance.
const tradingPreview = {
  chf: { percent: 2.04, gain: 1043, points: '0,90 40,95 80,65 120,70 160,45 200,60 240,55 280,45 320,35' },
  eur: { percent: 1.37, gain: 682, points: '0,92 40,80 80,88 120,62 160,70 200,50 240,58 280,42 320,38' },
  usd: { percent: .86, gain: 435, points: '0,88 40,96 80,84 120,90 160,66 200,74 240,57 280,62 320,48' },
}

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
  const preview = tradingPreview[selectedCurrency]

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
        api.get('/operations')
      ])

      setClients(clientsRes.data.data || [])
      
      const allOperations = operationsRes.data.data || []
      
      // Calculer le solde dynamique par devise (somme algébrique simple)
      setAdminBalance(calculateBalances(allOperations))
      
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
              <FiMessageSquare size={24} />
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
            <ScanIcon size={24} />
          </div>
          <span className="quick-action-label">Scanner &amp;<br />Payer</span>
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
              aria-pressed={selectedCurrency === 'chf'}
              onClick={() => setSelectedCurrency('chf')}
            >CHF</button>
            <button 
              className={`currency-tab ${selectedCurrency === 'eur' ? 'active' : ''}`}
              aria-pressed={selectedCurrency === 'eur'}
              onClick={() => setSelectedCurrency('eur')}
            >EUR</button>
            <button 
              className={`currency-tab ${selectedCurrency === 'usd' ? 'active' : ''}`}
              aria-pressed={selectedCurrency === 'usd'}
              onClick={() => setSelectedCurrency('usd')}
            >USD</button>
          </div>
          <span className="portfolio-amount">
            {selectedCurrency.toUpperCase()} {formatAmount(adminBalance[selectedCurrency])}
          </span>
          <div className="portfolio-gain">
            <span className="gain-percent">+{formatAmount(preview.percent)}%</span>
            <span className="gain-amount">{selectedCurrency.toUpperCase()} {formatAmount(preview.gain)}</span>
          </div>
        </div>

        <div className="portfolio-chart">
          <svg viewBox="0 0 320 140" className="portfolio-svg" role="img" aria-label={`Courbe de démonstration ${selectedCurrency.toUpperCase()}`}>
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
              points={preview.points}
              fill="none"
              stroke="#5AA9E6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Zone bleue */}
            <polygon
              points={preview.points + ' 320,120 0,120'}
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
        <p className="portfolio-demo-note">Courbe de démonstration</p>

        <div className="portfolio-footer">
          
        </div>

        <div className="custody-row">
          <span>Compte de garde</span>
          <span>{selectedCurrency.toUpperCase()} {formatAmount(adminBalance[selectedCurrency])}</span>
        </div>
      </div>

      {/* Favorites */}
      <section className="favorites-section" aria-labelledby="favorites-heading">
        <h2 className="favorites-header" id="favorites-heading">Favoris</h2>
        <div className="favorites-list">

        <div className="favorite-item">
          <div className="favorite-left">
            <span className="favorite-icon"><FiLayers size={24} aria-hidden="true" /></span>
            <div>
              <div className="favorite-label">Compte CHF</div>
              <div className="favorite-amount">CHF {formatAmount(adminBalance.chf)}</div>
            </div>
          </div>
          <span className="favorite-arrow">›</span>
        </div>

        <div className="favorite-item">
          <div className="favorite-left">
            <span className="favorite-icon">
              <FiLayers size={24} aria-hidden="true" />
            </span>

            <div>
              <div className="favorite-label">Compte EUR</div>
              <div className="favorite-amount">EUR {formatAmount(adminBalance.eur)}</div>
            </div>
          </div>
          <span className="favorite-arrow">›</span>
        </div>
        </div>
      </section>

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
