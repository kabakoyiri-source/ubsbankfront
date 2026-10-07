import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FiArrowLeft, FiUser, FiRepeat, FiDollarSign, FiFileText, FiSave, FiX, FiLayers, FiClock, FiZap, FiAlertCircle } from 'react-icons/fi'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import './AddOperation.css'

function AddOperation() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const clientIdParam = searchParams.get('clientId')
  const { setUser } = useAuth()

  const [clients, setClients] = useState([])
  const [adminAccount, setAdminAccount] = useState(null)
  const [adminBalance, setAdminBalance] = useState({ chf: 0, eur: 0, usd: 0 })
  const [formData, setFormData] = useState({
    clientId: clientIdParam || '',
    adminAccountId: '',
    adminAccountType: 'chf', // Type de compte admin source
    amount: '',
    currency: 'CHF',
    description: '',
    transferType: 'instant' // 'instant' ou 'delayed'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)

  const MAX_INSTANT_AMOUNT = 20000 // 20k CHF maximum pour virement instantané

  // Comptes disponibles pour l'admin
  const adminAccounts = [
    { id: 'chf', name: 'Compte CHF', rib: 'CH93 0076 2011 6238 5295 7', icon: FiLayers },
    { id: 'eur', name: 'Compte EUR', rib: 'CH55 0023 5235 8890 1234 5', icon: FiSave },
    { id: 'usd', name: 'Compte USD', rib: 'CH81 0024 1016 3852 9450 1', icon: FiDollarSign }
  ]

  useEffect(() => {
    loadClients()
    loadAdminAccount()
  }, [])

  const formatAmount = (amount) => {
    if (amount === undefined || amount === null) return '0,00'
    const absoluteAmount = Math.abs(amount)
    const fixed = absoluteAmount.toFixed(2)
    const [intPart, decPart] = fixed.split('.')
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'")
    return `${amount < 0 ? '-' : ''}${formattedInt},${decPart}`
  }

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

  const loadAdminAccount = async () => {
    try {
      const [userResponse, operationsResponse] = await Promise.all([
        api.get('/auth/me'),
        api.get('/operations?admin=true')
      ])
      
      if (userResponse.data.success) {
        setAdminAccount(userResponse.data.user)
        setFormData(prev => ({
          ...prev,
          adminAccountId: userResponse.data.user.id || ''
        }))
      }

      if (operationsResponse.data.success) {
        const operations = operationsResponse.data.data || []
        let balance = { chf: 0, eur: 0, usd: 0 }
        operations.forEach(op => {
          const currency = (op.currency || 'chf').toLowerCase()
          if (op.status === 'completed') {
            balance[currency] += (op.amount || 0)
          } else if (op.status === 'pending') {
            balance[currency] -= Math.abs(op.amount || 0)
          }
        })
        setAdminBalance(balance)
      }
    } catch (error) {
      console.error('Erreur lors du chargement du compte admin:', error)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'adminAccountType') {
      setFormData(prev => ({
        ...prev,
        adminAccountType: value,
        currency: value.toUpperCase()
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!formData.clientId) {
      setError('Veuillez sélectionner un bénéficiaire')
      return
    }

    if (!formData.adminAccountType) {
      setError('Veuillez sélectionner le compte source')
      return
    }

    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      setError('Veuillez saisir un montant valide')
      return
    }

    // Validation pour virement instantané
    if (formData.transferType === 'instant' && amount > MAX_INSTANT_AMOUNT) {
      setError(`Le montant maximum pour un virement instantané est de ${MAX_INSTANT_AMOUNT.toLocaleString('fr-CH')} CHF. Veuillez choisir un virement en 2 jours ouvrables pour ce montant.`)
      return
    }

    // Afficher la confirmation avant d'exécuter
    setShowConfirmation(true)
  }

  const handleConfirmTransfer = async () => {
    setError('')
    setLoading(true)

    try {
      const amount = parseFloat(formData.amount)
      const selectedAccount = adminAccounts.find(acc => acc.id === formData.adminAccountType)
      const payload = {
        clientId: formData.clientId,
        adminAccountId: adminAccount?.id,
        adminAccountType: formData.adminAccountType,
        adminAccountName: selectedAccount?.name,
        adminAccountIban: selectedAccount?.rib,
        type: 'transfer',
        amount: amount,
        currency: formData.currency, // Devise liée au compte source
        description: formData.description || '',
        transferType: formData.transferType,
        transferSpeed: formData.transferType === 'instant' ? 'instant' : '2-3 days',
        isScheduled: formData.transferType === 'delayed'
      }

      console.log('Payload envoyé:', payload)

      const response = await api.post('/operations/transfer', payload)
      if (response.data.success) {
        navigate('/operations')
      }
    } catch (error) {
      console.error('Erreur complète:', error.response?.data || error)
      const errorMessage = error.response?.data?.message || error.message || 'Erreur lors de la création de l\'opération'
      setError(errorMessage)
      setShowConfirmation(false)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelConfirmation = () => {
    setShowConfirmation(false)
  }

  const handleCancel = () => {
    navigate('/operations')
  }

  return (
    <div className="add-operation-container">
      <div className="add-operation-header">
        <button 
          onClick={() => navigate('/operations')} 
          className="back-button"
          aria-label="Retour"
        >
          <FiArrowLeft size={20} />
        </button>
        <div className="header-content">
          <h1>Nouvelle opération</h1>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="add-operation-form">
        {/* Informations de l'opération */}
        <div className="form-section">
          <div className="section-header">
            <div className="section-icon">
              <FiRepeat size={24} />
            </div>
            <h2>Informations de l'opération</h2>
          </div>
          
          <div className="form-group">
            <label htmlFor="clientId">
              <FiUser size={16} /> 
              Bénéficiaire <span className="required">*</span>
            </label>
            <select
              id="clientId"
              name="clientId"
              value={formData.clientId}
              onChange={handleChange}
              required
            >
              <option value="" disabled>Sélectionner un bénéficiaire</option>
              {clients.map((client) => {
                console.log('Client data:', client)
                const displayName = client.firstName && client.lastName 
                  ? `${client.firstName} ${client.lastName}`
                  : client.firstName || client.lastName || client.accountNumber || 'Client sans nom'
                return (
                  <option key={client._id} value={client._id}>
                    {displayName}
                  </option>
                )
              })}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="adminAccountType">
              <FiLayers size={16} /> 
              Compte source (Admin) <span className="required">*</span>
            </label>
            <select
              id="adminAccountType"
              name="adminAccountType"
              value={formData.adminAccountType}
              onChange={handleChange}
              required
              className="account-select-compact"
            >
              {adminAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            
            {adminAccount && (
              <div className="account-info-box">
                <div className="account-balance">
                  <span>Solde disponible:</span>
                   <strong>{
                    formatAmount(adminBalance[formData.adminAccountType] || 0)
                  } {formData.adminAccountType.toUpperCase()}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="amount">
              Montant ({formData.currency}) <span className="required">*</span>
            </label>
            <input
              type="number"
              id="amount"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              step="0.01"
              min="0.01"
              placeholder="0.00"
              required
            />
            {formData.amount && parseFloat(formData.amount) > MAX_INSTANT_AMOUNT && formData.transferType === 'instant' && (
              <div className="warning-message">
                <FiAlertCircle size={16} /> 
                <span>Le montant maximum pour un virement instantané est de {MAX_INSTANT_AMOUNT.toLocaleString('fr-CH')} CHF. Veuillez choisir "Virement en 2 jours ouvrables" pour ce montant.</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="transferType">
              <FiClock size={16} /> 
              Type de virement <span className="required">*</span>
            </label>
            <div className="transfer-type-options">
              <label className={`transfer-option ${formData.transferType === 'instant' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="transferType"
                  value="instant"
                  checked={formData.transferType === 'instant'}
                  onChange={handleChange}
                />
                <div className="transfer-option-content">
                  <div className="transfer-option-header">
                    <FiZap size={20} /> 
                    <span className="transfer-option-title">Virement instantané</span>
                  </div>
                  <div className="transfer-option-details">
                    <span className="transfer-speed">Traitement immédiat</span>
                    <span className="transfer-limit">Maximum {MAX_INSTANT_AMOUNT.toLocaleString('fr-CH')} CHF</span>
                  </div>
                </div>
              </label>
              
              <label className={`transfer-option ${formData.transferType === 'delayed' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="transferType"
                  value="delayed"
                  checked={formData.transferType === 'delayed'}
                  onChange={handleChange}
                />
                <div className="transfer-option-content">
                  <div className="transfer-option-header">
                    <FiClock size={20} /> 
                    <span className="transfer-option-title">Virement en 2 jours ouvrables</span>
                  </div>
                  <div className="transfer-option-details">
                    <span className="transfer-speed">Traitement sous 2 jours ouvrables</span>
                    <span className="transfer-limit">Montant illimité</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">
              <FiFileText size={16} /> 
              Motifs
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              placeholder="Motifs de l'opération (optionnel)"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button 
            type="button"
            onClick={handleCancel}
            className="btn btn-primary"
            disabled={loading || showConfirmation}
          >
            <FiX size={18} /> 
            <span>Annuler</span>
          </button>
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading || showConfirmation}
          >
            <FiSave size={18} /> 
            <span>Continuer</span>
          </button>
        </div>
      </form>

      {/* Modal de confirmation */}
      {showConfirmation && (
        <div className="confirmation-modal-overlay" onClick={handleCancelConfirmation}>
          <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirmation-header">
              <FiAlertCircle size={24} className="confirmation-icon" /> 
              <h3>Confirmation du virement</h3>
            </div>
            
            <div className="confirmation-content">
              <div className="confirmation-info">
                <p className="confirmation-text">
                  Vous êtes sur le point d'effectuer un virement de :
                </p>
                 <div className="confirmation-amount">
                  <span className="amount-value">
                    {formatAmount(parseFloat(formData.amount) || 0)} {formData.currency}
                  </span>
                </div>
                
                <div className="confirmation-details">
                  <div className="confirmation-detail-item">
                    <span className="detail-label">Type de virement choisi :</span>
                    <span className="detail-value">
                      {formData.transferType === 'instant' ? (
                        <>
                          <FiZap size={16} /> 
                          <strong>Virement instantané</strong>
                        </>
                      ) : (
                        <>
                          <FiClock size={16} /> 
                          <strong>Virement en 2 jours ouvrables</strong>
                        </>
                      )}
                    </span>
                  </div>
                  
                  {formData.transferType === 'instant' ? (
                    <div className="confirmation-note">
                      <FiZap size={16} /> 
                      <div>
                        <strong>Traitement immédiat</strong>
                        <br />
                        <span>Le montant maximum pour un virement instantané est de <strong>{MAX_INSTANT_AMOUNT.toLocaleString('fr-CH')} CHF</strong>.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="confirmation-note">
                      <FiClock size={16} /> 
                      <div>
                        <strong>Traitement sous 2 jours ouvrables</strong>
                        <br />
                        <span>Montant illimité pour ce type de virement.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="confirmation-actions">
              <button
                type="button"
                onClick={handleCancelConfirmation}
                className="btn btn-secondary"
                disabled={loading}
              >
                <FiX size={18} /> 
                <span>Annuler</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmTransfer}
                className="btn btn-primary"
                disabled={loading}
              >
                <FiSave size={18} /> 
                <span>{loading ? 'Traitement en cours...' : 'Confirmer le virement'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AddOperation

