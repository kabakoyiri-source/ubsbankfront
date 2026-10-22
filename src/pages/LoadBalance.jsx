import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiFileText, FiSave, FiX } from 'react-icons/fi'
import api from '../services/api'
import AmountInput from '../components/AmountInput'
import { formatAmount } from '../services/money'
import { useAuth } from '../contexts/AuthContext'
import './LoadBalance.css'
import { getPreferredCurrency, setPreferredCurrency } from '../services/currency'

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
    currency: getPreferredCurrency()
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
      console.error("Unable to load beneficiaries:", error)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'currency') setPreferredCurrency(value)
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
      setError("Enter a valid amount")
      return
    }

    if (operationType === 'deposit') {
      // Validate Mock Card Data
      if (!cardData.cardNumber || cardData.cardNumber.length < 19) {
        setError("Enter a valid card number")
        return
      }
      if (!cardData.cardHolder) {
        setError("Enter the cardholder’s name")
        return
      }
      if (!cardData.expiryDate || cardData.expiryDate.length < 5) {
        setError("Enter a valid expiry date (MM/YY)")
        return
      }
      if (!cardData.cvc || cardData.cvc.length < 3) {
        setError("Enter a valid CVC")
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
      setSecurityError("Incorrect security code")
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
          reason: formData.reason || "Balance top-up",
          // Note: Card data is intentionally NOT sent to backend
        }
      } else {
        // Validation spécifique au transfert
        if (!formData.clientId && !formData.recipientName.trim()) {
          setError("Select an existing beneficiary or enter the recipient’s name")
          setLoading(false)
          return
        }
        if (!formData.clientId && !formData.iban.trim()) {
          setError("Enter the recipient’s IBAN")
          setLoading(false)
          return
        }
        if (!formData.reason.trim()) {
          setError("Enter a transfer reference")
          setLoading(false)
          return
        }
        
        payload = {
          type: 'deposit',
          amount: amount,
          description: formData.description || "Manual transfer",
          currency: formData.currency,
          ...(formData.clientId && { clientId: formData.clientId }),
          recipientName: formData.recipientName,
          iban: formData.iban,
          reason: formData.reason
        }
      }
      
      console.log("Payload sent:", payload)
      
      const response = await api.post('/operations', payload)

      if (response.data.success) {
        setPreferredCurrency(formData.currency)
        if (response.data.balances) setUser(previous => previous ? { ...previous, balances: response.data.balances } : previous)
        const successMessage = operationType === 'deposit' 
          ? "Balance topped up successfully"
          : "Transfer completed successfully"
        navigate('/', { state: { message: successMessage, currency: formData.currency } })
      }
    } catch (err) {
      console.error("Transaction error:", err)
      setError(
        err.response?.data?.message || 
        "An error occurred during the transaction"
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
            aria-label="Back"
          >
            <FiArrowLeft size={20} />
          </button>
          <div className="header-content">
            <h1>{operationType === 'deposit' ? "Top up my balance" : "Make a transfer"}</h1>
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
          <h3>Transaction type</h3>
          <div className="type-buttons">
            <button
              type="button"
              className={`type-btn ${operationType === 'deposit' ? 'active' : ''}`}
              onClick={() => handleOperationTypeChange('deposit')}
            >
              Top up balance
            </button>
            <button
              type="button"
              className={`type-btn ${operationType === 'transfer' ? 'active' : ''}`}
              onClick={() => handleOperationTypeChange('transfer')}
            >
              Manual transfer
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
                ? "Top-up details"
                : "Transfer details"}
            </h2>
          </div>

          <div className="form-group" style={{ marginTop: '20px' }}>
            <label htmlFor="currency">Currency <span className="required">*</span></label>
            <select
              id="currency"
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              required
            >
              <option value="CHF">Swiss franc (CHF)</option>
              <option value="EUR">Euro (EUR)</option>
              <option value="USD">US dollar (USD)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="amount">
              Amount <span className="required">*</span>
            </label>
            <AmountInput
              id="amount"
              name="amount"
              value={formData.amount}
              onValueChange={amount => { setFormData(previous => ({ ...previous, amount })); setError('') }}
              placeholder="0.00"
              required
            />
          </div>

          {/* Credit Card Fields for Deposit */}
          {operationType === 'deposit' && (
            <div className="credit-card-section">
              <h3 className="subsection-title">Payment card</h3>
              <div className="form-group">
                <label>Cardholder name</label>
                <input
                  type="text"
                  name="cardHolder"
                  value={cardData.cardHolder}
                  onChange={handleCardChange}
                  placeholder="FULL NAME"
                  required
                />
              </div>
              <div className="form-group">
                <label>Card number</label>
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
                  <label>Expiry date</label>
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
                <label htmlFor="clientId">Beneficiary (optional)</label>
                <select
                  id="clientId"
                  name="clientId"
                  value={formData.clientId}
                  onChange={handleChange}
                >
                  <option value="">Select an existing beneficiary...</option>
                  {clients.map(client => (
                    <option key={client._id} value={client._id}>
                      {client.firstName && client.lastName 
                        ? `${client.firstName} ${client.lastName}`
                        : client.lastName || "Unnamed beneficiary"
                      }
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="recipientName">Recipient name</label>
                <input
                  type="text"
                  id="recipientName"
                  name="recipientName"
                  value={formData.recipientName}
                  onChange={handleChange}
                  placeholder="Enter the last name"
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
                <label htmlFor="reason">Reference</label>
                <textarea
                  id="reason"
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  placeholder="Reference..."
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
            <span>Cancel</span>
          </button>
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
          >
            <FiSave size={18} />
            <span>
              {loading ? "Processing..." : (operationType === 'deposit' ? "Top up balance" : "Transfer")}
            </span>
          </button>
        </div>
      </form>

      {/* Security Modal */}
      {showSecurityModal && (
        <div className="modal-overlay">
          <div className="modal-content security-modal">
            <div className="modal-header">
              <h3>Security verification</h3>
              <p>Enter the confirmation code received by SMS to approve the transaction of <strong>{formData.currency} {formatAmount(Number(formData.amount))}</strong>.</p>
            </div>
            
            <form onSubmit={handleVerifyCode}>
              <div className="form-group">
                <label>Security code</label>
                <input
                  type="text"
                  value={securityCode}
                  onChange={(e) => setSecurityCode(e.target.value)}
                  placeholder="Enter the security code"
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
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                >
                  Confirm payment
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

