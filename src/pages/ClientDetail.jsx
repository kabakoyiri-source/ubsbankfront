import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { 
  FiArrowLeft, 
  FiArrowRight, 
  FiUser, 
  FiMail, 
  FiPhone, 
  FiMapPin, 
  FiCreditCard, 
  FiDollarSign, 
  FiRepeat,
  FiTrash2,
  FiLoader
} from 'react-icons/fi'
import api from '../services/api'
import './ClientDetail.css'

function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [operations, setOperations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadClient()
    loadOperations()
  }, [id])

  const loadClient = async () => {
    try {
      const response = await api.get(`/clients/${id}`)
      if (response.data.success) {
        setClient(response.data.data)
      }
    } catch (error) {
      setError('Erreur lors du chargement du client')
    } finally {
      setLoading(false)
    }
  }

  const loadOperations = async () => {
    try {
      const response = await api.get(`/operations?clientId=${id}`)
      if (response.data.success) {
        setOperations(response.data.data || [])
      }
    } catch (error) {
      console.error('Erreur lors du chargement des opérations:', error)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce bénéficiaire ?')) {
      return
    }

    try {
      await api.delete(`/clients/${id}`)
      navigate('/clients')
    } catch (error) {
      alert('Erreur lors de la suppression')
    }
  }

  if (loading) {
    return (
      <div className="client-detail-container">
        <div className="loading-container">
          <FiLoader className="spinner-icon" size={48} />
          <p>Chargement...</p>
        </div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="client-detail-container">
        <div className="error-message">
          <span>{error || 'Bénéficiaire non trouvé'}</span>
        </div>
        <Link to="/clients" className="btn btn-primary">
          <FiArrowLeft size={18} />
          <span>Retour à la liste</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="client-detail-container">
      <div className="client-detail-header">
        <button 
          onClick={() => navigate('/clients')} 
          className="back-button"
          aria-label="Retour"
        >
          <FiArrowLeft size={20} />
        </button>
        <div className="header-content">
          <h1>{client.firstName ? `${client.firstName} ` : ''}{client.lastName}</h1>
        </div>
        <div className="header-actions">
          <Link to={`/operations/new?clientId=${id}`} className="btn btn-primary">
            <FiArrowRight size={18} />
            <span>Nouvelle opération</span>
          </Link>
        
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span>{error}</span>
        </div>
      )}

      {/* Informations personnelles */}
      <div className="form-section">
        <div className="section-header">
          <div className="section-icon">
            <FiUser size={24} />
          </div>
          <h2>Informations personnelles</h2>
        </div>
        
        <div className="info-grid">
          <div className="info-item">
            <label>
              <FiUser size={16} />
              Prénom
            </label>
            <span>{client.firstName || '-'}</span>
          </div>
          <div className="info-item">
            <label>
              <FiUser size={16} />
              Nom
            </label>
            <span>{client.lastName}</span>
          </div>
          <div className="info-item">
            <label>
              <FiMail size={16} />
              Email
            </label>
            <span>{client.email}</span>
          </div>
          {client.phone && (
            <div className="info-item">
              <label>
                <FiPhone size={16} />
                Téléphone
              </label>
              <span>{client.phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Adresse */}
      {client.address && (client.address.street || client.address.city || client.address.postalCode || client.address.country) && (
        <div className="form-section">
          <div className="section-header">
            <div className="section-icon">
              <FiMapPin size={24} />
            </div>
            <h2>Adresse</h2>
          </div>
          
          <div className="info-grid">
            {client.address.street && (
              <div className="info-item">
                <label>Rue</label>
                <span>{client.address.street}</span>
              </div>
            )}
            {client.address.city && (
              <div className="info-item">
                <label>Ville</label>
                <span>{client.address.city}</span>
              </div>
            )}
            {client.address.postalCode && (
              <div className="info-item">
                <label>Code postal</label>
                <span>{client.address.postalCode}</span>
              </div>
            )}
            {client.address.country && (
              <div className="info-item">
                <label>Pays</label>
                <span>{client.address.country}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Informations bancaires */}
      <div className="form-section">
        <div className="section-header">
          <div className="section-icon">
            <FiCreditCard size={24} />
          </div>
          <h2>Informations bancaires</h2>
        </div>
        
        <div className="info-grid">
          <div className="info-item">
            <label>
              <FiCreditCard size={16} />
              Numéro de compte
            </label>
            <span className="account-number">{client.accountNumber}</span>
          </div>
          <div className="info-item">
            <label>
              <FiDollarSign size={16} />
              Solde
            </label>
            <span className="balance-amount">
              {client.balance.toFixed(2)} CHF
            </span>
          </div>
          <div className="info-item">
            <label>Statut</label>
            <span className={`status-badge status-${client.status}`}>
              {client.status}
            </span>
          </div>
        </div>
      </div>

      {/* Opérations */}
      <div className="form-section">
        <div className="section-header">
          <div className="section-icon">
            <FiRepeat size={24} />
          </div>
          <h2>Opérations ({operations.length})</h2>
        </div>
        
        {operations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <FiRepeat size={48} />
            </div>
            <p>Aucune opération pour ce bénéficiaire</p>
          </div>
        ) : (
          <div className="operations-list">
            {operations.map((op) => (
              <div key={op._id} className="operation-item">
                <div className="operation-icon">
                  <span className="operation-letter">
                    {op.type === 'deposit' ? 'C' : 
                     op.type === 'withdrawal' ? 'R' :
                     op.type === 'transfer' ? 'V' : 'P'}
                  </span>
                </div>
                <div className="operation-content">
                  <div className="operation-header">
                    <span className={`badge badge-${op.type}`}>
                      {op.type === 'deposit' ? 'Crédit (Dépôt)' : 
                       op.type === 'withdrawal' ? 'Débit (Retrait)' :
                       op.type === 'transfer' ? 'Débit (Virement)' : 'Débit (Paiement)'}
                    </span>
                    <span className={`badge badge-${op.status}`}>
                      {op.status}
                    </span>
                  </div>
                  <div className="operation-details">
                    <span className="operation-amount">
                      {op.type === 'deposit' ? '+' : '-'}{op.amount.toFixed(2)} CHF
                    </span>
                    <span className="operation-date">
                      {new Date(op.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  {op.description && (
                    <p className="operation-description">{op.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ClientDetail

