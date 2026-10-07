import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { 
  FiArrowRight, 
  FiSearch, 
  FiUsers, 
  FiLoader,
  FiArrowLeft,
  FiStar
} from 'react-icons/fi'
import './Clients.css'

function Clients() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [favorites, setFavorites] = useState(new Set())

  useEffect(() => {
    loadClients()
    // Charger les favoris depuis le localStorage
    const savedFavorites = localStorage.getItem('beneficiaryFavorites')
    if (savedFavorites) {
      setFavorites(new Set(JSON.parse(savedFavorites)))
    }
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
      localStorage.setItem('beneficiaryFavorites', JSON.stringify(Array.from(newFavorites)))
      return newFavorites
    })
  }

  const loadClients = async () => {
    try {
      const response = await api.get('/clients')
      if (response.data.success) {
        setClients(response.data.data || [])
      }
    } catch (error) {
      setError('Erreur lors du chargement des clients')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }


  const filteredClients = clients.filter(client =>
    (client.firstName && client.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.accountNumber.includes(searchTerm)
  )

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

      {error && <div className="error-message">{error}</div>}

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

      {filteredClients.length === 0 ? (
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
              <div className="client-content">
                <div className="client-name">
                  {client.firstName ? `${client.firstName} ` : ''}{client.lastName}
                </div>
                <div className="client-account-number">
                  {client.accountNumber}
                </div>
              </div>
              <button
                className={`favorite-btn ${favorites.has(client._id) ? 'favorited' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFavorite(client._id)
                }}
                aria-label={favorites.has(client._id) ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                <FiStar size={20} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Clients
