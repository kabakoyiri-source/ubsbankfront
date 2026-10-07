import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiUser, FiCalendar, FiDollarSign, FiCreditCard, FiFileText } from 'react-icons/fi'
import './OperationDetails.css'

function OperationDetails() {
  const navigate = useNavigate()
  const [operation, setOperation] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedOperation = localStorage.getItem('selectedOperation')
    if (storedOperation) {
      try {
        const parsedOperation = JSON.parse(storedOperation)
        console.log('Données de l\'opération reçues:', parsedOperation)
        console.log('Reason:', parsedOperation.reason)
        setOperation(parsedOperation)
      } catch (error) {
        console.error('Erreur lors de la lecture des données de l\'opération:', error)
        navigate('/')
      }
    } else {
      navigate('/')
    }
    setLoading(false)
  }, [navigate])

  const formatAmount = (amount) => {
    if (amount === undefined || amount === null) return '0,00'
    const absoluteAmount = Math.abs(amount)
    const fixed = absoluteAmount.toFixed(2)
    const [intPart, decPart] = fixed.split('.')
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'")
    return `${amount < 0 ? '-' : ''}${formattedInt},${decPart}`
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatAccountNumber = (accountNumber) => {
    if (!accountNumber) return '***'
    const last3 = accountNumber.slice(-3)
    return `***${last3}`
  }

  const getCardType = (bankName) => {
    if (!bankName) return 'visa'
    const name = bankName.toLowerCase()
    if (name.includes('master')) return 'mastercard'
    return 'visa'
  }

  const translateStatus = (status) => {
    if (!status) return 'Terminé'
    switch (status.toLowerCase()) {
      case 'pending':
        return 'En cours de traitement'
      case 'completed':
        return 'Terminé'
      case 'failed':
        return 'Échoué'
      case 'cancelled':
        return 'Annulé'
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className="operation-details-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Chargement...</p>
        </div>
      </div>
    )
  }

  if (!operation) {
    return (
      <div className="operation-details-container">
        <div className="error-container">
          <p>Opération non trouvée</p>
          <button onClick={() => navigate('/')} className="back-btn">
            Retour à l'accueil
          </button>
        </div>
      </div>
    )
  }

  const client = operation.clientId
  const isIncoming = operation.type === 'deposit'
  const cardType = client ? getCardType(client.bankName) : 'visa'

  return (
    <div className="operation-details-container">
      {/* Header */}
      <div className="details-header">
        <button onClick={() => navigate('/')} className="back-button">
          <FiArrowLeft size={24} />
          <span>←</span>
        </button>
        <h1 className="details-title">Détails de l'opération</h1>
      </div>

      {/* Main Content */}
      <div className="details-content">
        {/* Amount Card */}
        <div className="amount-card">
          
          <div className="amount-info">
            <div className={`amount-value ${isIncoming ? 'positive' : 'negative'}`}>
              CHF {isIncoming ? '+' : ''}{formatAmount(operation.amount)}
            </div>
            <div className="amount-type">
              {isIncoming ? 'Crédit' : 'Débit'}
            </div>
          </div>
        </div>

        {/* Client Information */}
        {client && (
          <div className="info-section">
            <h2 className="section-title">
              <FiUser size={20} />
              Bénéficiaire
            </h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Nom</span>
                <span className="info-value">
                  {client.firstName && client.firstName.trim() 
                    ? `${client.firstName} ${client.lastName}` 
                    : client.lastName}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">IBAN</span>
                <span className="info-value">{client.accountNumber || 'Non disponible'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Banque</span>
                <span className="info-value">{client.bankName || 'Non spécifiée'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Operation Information */}
        <div className="info-section">
          <h2 className="section-title">
            <FiFileText size={20} />
            Informations sur l'opération
          </h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Date</span>
              <span className="info-value">{formatDate(operation.createdAt)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Type</span>
              <span className="info-value">{operation.type === 'deposit' ? 'Dépôt' : 'Virement'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Statut</span>
              <span className="info-value status">{translateStatus(operation.status)}</span>
            </div>
            {(operation.reason || operation.description) && (
              <div className="info-item full-width">
                <span className="info-label">Motif</span>
                <span className="info-value">{operation.reason || operation.description}</span>
              </div>
            )}
            {operation.adminAccountName && (
              <div className="info-item">
                <span className="info-label">Source</span>
                <span className="info-value">De: {operation.adminAccountName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button onClick={() => navigate('/')} className="primary-btn">
            Retour à l'accueil
          </button>
        </div>
      </div>
    </div>
  )
}

export default OperationDetails
