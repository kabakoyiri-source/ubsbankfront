import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiFileText, FiSave, FiX } from 'react-icons/fi'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import './LoadBalance.css'

function LoadBalance() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [operationType, setOperationType] = useState('deposit')
  const [clients, setClients] = useState([])
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    clientId: '',
    recipientName: '',
    iban: '',
    reason: '',
    currency: 'CHF'
  })
  
  // Mock Credit Card Data (Not sent to backend)
  const [cardData, setCardData] = useState({
    cardNumber: '',
    cardHolder: '',
    expiryDate: '',
    cvc: ''
  })

  // Security Modal State
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [securityCode, setSecurityCode] = useState('')
  const [securityError, setSecurityError] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (operationType === 'transfer') {
      loadClients()
    }
  }, [operationType])

  const loadClients = async () => {
    try {
      const response = await api.get('/clients')
      if (response.data.success) {
        const clientsData = response.data.data || []
        console.log('Clients loaded:', clientsData)
        setClients(clientsData)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des clients:', error)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
    setError('')
    
    // Si un client est sélectionné, pré-remplir les champs du destinataire
    if (name === 'clientId' && value) {
      const selectedClient = clients.find(client => client._id === value)
      if (selectedClient) {
        setFormData(prev => ({
          ...prev,
          clientId: value,
          recipientName: selectedClient.firstName && selectedClient.lastName 
            ? `${selectedClient.firstName} ${selectedClient.lastName}`
            : selectedClient.lastName || '',
          iban: selectedClient.accountNumber || ''
        }))
      }
    }
    
    // Si le champ clientId est vidé, vider aussi les champs pré-remplis
    if (name === 'clientId' && !value) {
      setFormData(prev => ({
        ...prev,
        clientId: '',
        recipientName: '',
        iban: ''
      }))
    }
  }

  const handleCardChange = (e) => {
    const { name, value } = e.target
    let formattedValue = value

    // Format Card Number
    if (name === 'cardNumber') {
      formattedValue = value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19)
    }
    // Format Expiry Date
    if (name === 'expiryDate') {
      formattedValue = value.replace(/\D/g, '').replace(/(.{2})/, '$1/').slice(0, 5)
    }
    // Format CVC
    if (name === 'cvc') {
      formattedValue = value.replace(/\D/g, '').slice(0, 3)
    }

    setCardData({
      ...cardData,
      [name]: formattedValue
    })
  }

  const handleOperationTypeChange = (type) => {
    setOperationType(type)
    setError('')
    // Réinitialiser les champs spécifiques au transfert quand on change de type
    if (type === 'deposit') {
      setFormData({
        ...formData,
        clientId: '',
        recipientName: '',
        iban: '',
        reason: ''
      })
    }
  }

  const handleInitialSubmit = (e) => {
    e.preventDefault()
    setError('')

    const amount = parseFloat(formData.amount)
    if (!amount || amount <= 0) {
      setError('Veuillez entrer un montant valide')
      return
    }

    if (operationType === 'deposit') {
      // Validate Mock Card Data
      if (!cardData.cardNumber || cardData.cardNumber.length < 19) {
        setError('Veuillez entrer un numéro de carte valide')
        return
      }
      if (!cardData.cardHolder) {
        setError('Veuillez entrer le nom du titulaire')
        return
      }
      if (!cardData.expiryDate || cardData.expiryDate.length < 5) {
        setError('Veuillez entrer une date d\'expiration valide (MM/YY)')
        return
      }
      if (!cardData.cvc || cardData.cvc.length < 3) {
        setError('Veuillez entrer un CVC valide')
        return
      }
      // Show Security Modal
      setShowSecurityModal(true)
    } else {
      // Direct submit for transfer
      processTransaction()
    }
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setSecurityError('')

    if (securityCode === '0131') {
      setShowSecurityModal(false)
      await processTransaction()
    } else {
      setSecurityError('Code de sécurité incorrect')
    }
  }

  const processTransaction = async () => {
    setLoading(true)

    try {
      const amount = parseFloat(formData.amount)
      let payload
      
      if (operationType === 'deposit') {
        payload = {
          type: 'deposit',
          amount: amount,
          currency: formData.currency,
          reason: formData.reason || 'Rechargement de solde',
          // Note: Card data is intentionally NOT sent to backend
        }
      } else {
        // Validation spécifique au transfert
        if (!formData.clientId && !formData.recipientName.trim()) {
          setError('Veuillez sélectionner un client existant ou entrer le nom du destinataire')
          setLoading(false)
          return
        }
        if (!formData.clientId && !formData.iban.trim()) {
          setError('Veuillez entrer l\'IBAN du destinataire')
          setLoading(false)
          return
        }
        if (!formData.reason.trim()) {
          setError('Veuillez entrer le motif du transfert')
          setLoading(false)
          return
        }
        
        payload = {
          type: 'deposit',
          amount: amount,
          description: formData.description || 'Transfert manuel',
          ...(formData.clientId && { clientId: formData.clientId }),
          recipientName: formData.recipientName,
          iban: formData.iban,
          reason: formData.reason
        }
      }
      
      console.log('Payload envoyé:', payload)
      
      const response = await api.post('/operations', payload)

      if (response.data.success) {
        const successMessage = operationType === 'deposit' 
          ? 'Solde chargé avec succès' 
          : 'Transfert effectué avec succès'
        navigate('/', { state: { message: successMessage } })
      }
    } catch (err) {
      console.error('Erreur transaction:', err)
      setError(
        err.response?.data?.message || 
        'Une erreur est survenue lors de la transaction'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="load-balance-container">
      <div className="load-balance-header">
        <div className="page-header-with-back">
          <button
            onClick={() => navigate('/')}
            className="back-button"
            aria-label="Retour"
          >
            <FiArrowLeft size={20} />
          </button>
          <div className="header-content">
            <h1>{operationType === 'deposit' ? 'Charger mon solde' : 'Effectuer un transfert'}</h1>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <form onSubmit={handleInitialSubmit} className="load-balance-form">
        <div className="operation-type-selector">
          <h3>Type d'opération</h3>
          <div className="type-buttons">
            <button
              type="button"
              className={`type-btn ${operationType === 'deposit' ? 'active' : ''}`}
              onClick={() => handleOperationTypeChange('deposit')}
            >
              Charger le solde
            </button>
            <button
              type="button"
              className={`type-btn ${operationType === 'transfer' ? 'active' : ''}`}
              onClick={() => handleOperationTypeChange('transfer')}
            >
              Transfert manuel
            </button>
          </div>
        </div>

        <div className="form-section">
          <div className="section-header" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            textAlign: 'center' 
          }}>
            <h2 style={{ margin: 0 }}>
              {operationType === 'deposit' 
                ? 'Informations de rechargement' 
                : 'Informations de transfert'}
            </h2>
          </div>

          <div className="form-group" style={{ marginTop: '20px' }}>
            <label htmlFor="currency">Devise <span className="required">*</span></label>
            <select
              id="currency"
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              required
            >
              <option value="CHF">Franc Suisse (CHF)</option>
              <option value="EUR">Euro (EUR)</option>
              <option value="USD">Dollar US (USD)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="amount">
              Montant <span className="required">*</span>
            </label>
            <input
              type="number"
              id="amount"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              required
            />
          </div>

          {/* Credit Card Fields for Deposit */}
          {operationType === 'deposit' && (
            <div className="credit-card-section">
              <h3 className="subsection-title">Carte de Paiement</h3>
              <div className="form-group">
                <label>Nom du titulaire</label>
                <input
                  type="text"
                  name="cardHolder"
                  value={cardData.cardHolder}
                  onChange={handleCardChange}
                  placeholder="NOM PRENOM"
                  required
                />
              </div>
              <div className="form-group">
                <label>Numéro de carte</label>
                <input
                  type="text"
                  name="cardNumber"
                  value={cardData.cardNumber}
                  onChange={handleCardChange}
                  placeholder="0000 0000 0000 0000"
                  maxLength="19"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group half">
                  <label>Date d'exp.</label>
                  <input
                    type="text"
                    name="expiryDate"
                    value={cardData.expiryDate}
                    onChange={handleCardChange}
                    placeholder="MM/YY"
                    maxLength="5"
                    required
                  />
                </div>
                <div className="form-group half">
                  <label>CVC</label>
                  <input
                    type="text"
                    name="cvc"
                    value={cardData.cvc}
                    onChange={handleCardChange}
                    placeholder="123"
                    maxLength="3"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Transfer Fields */}
          {operationType === 'transfer' && (
            <>
              <div className="form-group">
                <label htmlFor="clientId">Bénéficiaire (optionnel)</label>
                <select
                  id="clientId"
                  name="clientId"
                  value={formData.clientId}
                  onChange={handleChange}
                >
                  <option value="">Sélectionner un client existant...</option>
                  {clients.map(client => (
                    <option key={client._id} value={client._id}>
                      {client.firstName && client.lastName 
                        ? `${client.firstName} ${client.lastName}`
                        : client.lastName || 'Client sans nom'
                      }
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="recipientName">Nom du destinataire</label>
                <input
                  type="text"
                  id="recipientName"
                  name="recipientName"
                  value={formData.recipientName}
                  onChange={handleChange}
                  placeholder="Entrez le nom"
                  required={!formData.clientId}
                  disabled={!!formData.clientId}
                />
              </div>

              <div className="form-group">
                <label htmlFor="iban">IBAN</label>
                <input
                  type="text"
                  id="iban"
                  name="iban"
                  value={formData.iban}
                  onChange={handleChange}
                  placeholder="CHXX XXXX..."
                  required={!formData.clientId}
                  disabled={!!formData.clientId}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reason">Motif</label>
                <textarea
                  id="reason"
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  placeholder="Motif..."
                  required
                />
              </div>
            </>
          )}
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            onClick={() => navigate('/')} 
            className="btn btn-secondary"
          >
            <FiX size={18} />
            <span>Annuler</span>
          </button>
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
          >
            <FiSave size={18} />
            <span>
              {loading ? 'Traitement...' : (operationType === 'deposit' ? 'Charger le solde' : 'Transférer')}
            </span>
          </button>
        </div>
      </form>

      {/* Security Modal */}
      {showSecurityModal && (
        <div className="modal-overlay">
          <div className="modal-content security-modal">
            <div className="modal-header">
              <h3>Vérification Sécurité</h3>
              <p>Veuillez entrer le code de confirmation reçu par SMS pour valider la transaction de <strong>{formData.currency} {formData.amount}</strong>.</p>
            </div>
            
            <form onSubmit={handleVerifyCode}>
              <div className="form-group">
                <label>Code de sécurité</label>
                <input
                  type="text"
                  value={securityCode}
                  onChange={(e) => setSecurityCode(e.target.value)}
                  placeholder="Entrez le code de sécurité"
                  autoFocus
                  className="security-input"
                />
              </div>

              {securityError && <p className="error-text">{securityError}</p>}

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowSecurityModal(false)}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                >
                  Confirmer le paiement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default LoadBalance

