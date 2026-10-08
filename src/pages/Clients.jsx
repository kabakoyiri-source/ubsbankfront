import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '../services/api'
import DeleteBeneficiaryDialog from '../components/DeleteBeneficiaryDialog'
import { 
  FiArrowRight, 
  FiSearch, 
  FiUsers, 
  FiLoader,
  FiArrowLeft,
  FiStar,
  FiTrash2
} from 'react-icons/fi'
import './Clients.css'

function Clients() {
  const navigate = useNavigate()
  const location = useLocation()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [favorites, setFavorites] = useState(new Set())
  const [deleting, setDeleting] = useState(null)
  const [notice, setNotice] = useState(location.state?.beneficiaryDeleted ? 'Bénéficiaire supprimé.' : '')

  useEffect(() => {
    loadClients()
    // Charger les favoris depuis le localStorage
    try {
      const savedFavorites = JSON.parse(localStorage.getItem('beneficiaryFavorites') || '[]')
      if (Array.isArray(savedFavorites)) setFavorites(new Set(savedFavorites))
    } catch { /* Ignore invalid device preferences so beneficiaries remain accessible. */ }
  }, [])

  const toggleFavorite = (clientId) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev)
      if (newFavorites.has(clientId)) {
        newFavorites.delete(clientId)
      } else {
        newFavorites.add(clientId)
      }
      // Sauvegarder dans le localStorage
      try { localStorage.setItem('beneficiaryFavorites', JSON.stringify(Array.from(newFavorites))) } catch { /* Favorites still work for this session. */ }
      return newFavorites
    })
  }

  const loadClients = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/clients')
      if (!response.data.success || !Array.isArray(response.data.data)) throw new Error('Chargement impossible')
      setClients(response.data.data)
    } catch (error) {
      setError('Impossible de charger les bénéficiaires. Réessayez.')
    } finally {
      setLoading(false)
    }
  }


  const filteredClients = clients.filter(client => [client.firstName, client.lastName, client.accountNumber].some(value => (value || '').toLowerCase().includes(searchTerm.toLowerCase())))

  if (loading) {
    return (
      <div className="container">
        <div className="loading-container">
          <FiLoader className="spinner-icon" size={48} />
          <p>Chargement des bénéficiaires...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="page-header">
        <div className="page-header-with-back">
          <button 
            onClick={() => navigate('/')} 
            className="back-button"
            aria-label="Retour"
          >
            <FiArrowLeft size={20} />
          </button>
          <h1>Bénéficiaires</h1>

        </div>
        <Link to="/clients/new" className="btn btn-primary" style={{ alignItems: 'right' }}>
          <FiArrowRight size={18} />
            <span>Ajouter un bénéficiaire</span>
        </Link>
      </div>

      {error && <div className="error-message" role="alert"><p>{error}</p><button type="button" className="btn btn-primary" onClick={loadClients}>Réessayer</button></div>}
      {notice && <p className="beneficiary-notice" role="status">{notice}</p>}

      <div className="search-section">
        <div className="search-wrapper">
          <FiSearch className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Rechercher un bénéficiaire par nom ou numéro de compte..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        {searchTerm && (
          <div className="search-results">
            {filteredClients.length} résultat(s) trouvé(s)
          </div>
        )}
      </div>

      {error ? null : filteredClients.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrapper">
            <FiUsers size={64} />
          </div>
          <h3>Aucun bénéficiaire trouvé</h3>
          <p>
            {searchTerm ? 'Aucun bénéficiaire ne correspond à votre recherche' : 'Commencez par ajouter votre premier bénéficiaire'}
          </p>
          {!searchTerm && (
            <Link to="/clients/new" className="btn btn-primary">
              <FiArrowRight size={18} />
              <span>Ajouter un bénéficiaire</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="clients-grid">
          {filteredClients.map((client) => (
            <div key={client._id} className="client-card">
              <Link to={`/clients/${client._id}`} className="client-content">
                <div className="client-name">
                  {client.firstName ? `${client.firstName} ` : ''}{client.lastName}
                </div>
                <div className="client-account-number">
                  {client.accountNumber}
                </div>
              </Link>
              <div className="beneficiary-card-actions">
              <button
                type="button"
                className={`favorite-btn ${favorites.has(client._id) ? 'favorited' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFavorite(client._id)
                }}
                aria-label={favorites.has(client._id) ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                <FiStar size={20} />
              </button>
              <button type="button" className="beneficiary-delete-btn"
                aria-label={`Supprimer ${[client.firstName, client.lastName].filter(Boolean).join(' ')}`}
                onClick={() => { setNotice(''); setDeleting(client) }}>
                <FiTrash2 size={20} aria-hidden="true" />
              </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {deleting && <DeleteBeneficiaryDialog client={deleting} onCancel={() => setDeleting(null)} onDeleted={client => {
        setClients(previous => previous.filter(item => item._id !== client._id))
        setFavorites(previous => new Set([...previous].filter(id => id !== client._id)))
        setDeleting(null)
        setNotice('Bénéficiaire supprimé.')
      }} />}
    </div>
  )
}

export default Clients
