import React, { useState, useEffect } from 'react'
import { formatAmount } from '../services/money'
import AmountInput from '../components/AmountInput'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { FiArrowLeft, FiUser, FiUserPlus, FiRepeat, FiDollarSign, FiFileText, FiSave, FiX, FiLayers, FiClock, FiZap, FiAlertCircle } from 'react-icons/fi'
import api from '../services/api'
import { calculateBalances } from '../services/balances'
import './AddOperation.css'
import { getPreferredCurrency, setPreferredCurrency } from '../services/currency'

function AddOperation() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const clientIdParam = searchParams.get('clientId')
  const draft = location.state?.transferDraft || {}
  const source = ['chf', 'eur', 'usd'].includes(draft.adminAccountType) ? draft.adminAccountType : getPreferredCurrency().toLowerCase()

  const [clients, setClients] = useState([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [clientsError, setClientsError] = useState('')
  const [adminAccount, setAdminAccount] = useState(null)
  const [adminBalance, setAdminBalance] = useState({ chf: 0, eur: 0, usd: 0 })
  const [formData, setFormData] = useState({
    clientId: clientIdParam || draft.clientId || '',
    adminAccountId: '',
    adminAccountType: source,
    amount: typeof draft.amount === 'string' ? draft.amount : '',
    currency: source.toUpperCase(),
    description: typeof draft.description === 'string' ? draft.description : '',
    transferType: draft.transferType === 'delayed' ? 'delayed' : 'instant'
  })
  const [loading, setLoading] = useState(false)
  const [balanceLoading, setBalanceLoading] = useState(true)
  const [balanceError, setBalanceError] = useState('')
  const [error, setError] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)

  const MAX_INSTANT_AMOUNT = 20000 // 20k CHF maximum pour virement instantané

  // Comptes disponibles pour l'admin
  const adminAccounts = [
    { id: 'chf', name: "CHF account", rib: 'CH93 0076 2011 6238 5295 7', icon: FiLayers },
    { id: 'eur', name: "EUR account", rib: 'CH55 0023 5235 8890 1234 5', icon: FiSave },
    { id: 'usd', name: "USD account", rib: 'CH81 0024 1016 3852 9450 1', icon: FiDollarSign }
  ]

  useEffect(() => {
    loadClients()
    loadAdminAccount()
  }, [])


  const loadClients = async () => {
    setClientsLoading(true)
    setClientsError('')
    try {
      const response = await api.get('/clients')
      if (!response.data.success || !Array.isArray(response.data.data)) throw new Error("Unable to load")
      const clientsData = response.data.data
      setClients(clientsData)
      setFormData(previous => ({ ...previous, clientId: clientsData.some(client => client._id === previous.clientId && (!client.status || client.status === 'active')) ? previous.clientId : '' }))
    } catch (error) {
      setClientsError("Unable to load beneficiaries. Try again.")
    } finally { setClientsLoading(false) }
  }

  const loadAdminAccount = async () => {
    setBalanceLoading(true)
    setBalanceError('')
    try {
      const [userResponse, operationsResponse] = await Promise.all([
        api.get('/auth/me'),
        api.get('/operations')
      ])
      if (!userResponse.data.success || !operationsResponse.data.success) throw new Error("Unable to load")
      
      if (userResponse.data.success) {
        setAdminAccount(userResponse.data.user)
        setFormData(prev => ({
          ...prev,
          adminAccountId: userResponse.data.user.id || ''
        }))
      }

      if (operationsResponse.data.success) {
        const operations = operationsResponse.data.data || []
        setAdminBalance(calculateBalances(operations))
      }
    } catch (error) {
      setBalanceError("Unable to load the available balance. Try again.")
    } finally { setBalanceLoading(false) }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'adminAccountType') {
      setPreferredCurrency(value)
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
    if (clientsLoading || clientsError || !clients.some(client => client._id === formData.clientId && (!client.status || client.status === 'active'))) {
      setError("Select a beneficiary")
      return
    }

    if (!formData.adminAccountType) {
      setError("Select a source account")
      return
    }

    const amount = parseFloat(formData.amount)
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > .000001) {
      setError("Enter a valid amount")
      return
    }

    if (balanceLoading || balanceError) {
      setError("Load the available balance before continuing.")
      return
    }
    if (Math.round(amount * 100) > Math.round(adminBalance[formData.adminAccountType] * 100)) {
      setError(`Insufficient funds in the ${formData.currency} account. Add funds in Settings.`)
      return
    }

    // Validation pour virement instantané
    if (formData.transferType === 'instant' && amount > MAX_INSTANT_AMOUNT) {
      setError(`The maximum amount for an instant transfer is ${formatAmount(MAX_INSTANT_AMOUNT, 0)} ${formData.currency}. Choose a transfer within 2 working days for this amount.`)
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

      const response = await api.post('/operations/transfer', payload)
      if (response.data.success) {
        navigate('/operations')
      } else throw new Error(response.data.message || "The transfer failed.")
    } catch (error) {
      console.error("Full error:", error.response?.data || error)
      const errorMessage = error.response?.data?.message || error.message || "Unable to create the transaction"
      setError(errorMessage)
      setShowConfirmation(false)
      loadAdminAccount()
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
          aria-label="Back"
        >
          <FiArrowLeft size={20} />
        </button>
        <div className="header-content">
          <h1>New transaction</h1>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span>{error}</span>
        </div>
      )}
      {balanceError && <div className="error-message" role="alert"><span>{balanceError}</span><button type="button" className="btn btn-primary" onClick={loadAdminAccount}>Try again</button></div>}
      {location.state?.beneficiaryCreated && <p className="beneficiary-notice" role="status">Beneficiary added and selected. You can continue your transfer.</p>}

      <form onSubmit={handleSubmit} className="add-operation-form">
        {/* Informations de l'opération */}
        <div className="form-section">
          <div className="section-header">
            <div className="section-icon">
              <FiRepeat size={24} />
            </div>
            <h2>Transaction information</h2>
          </div>
          
          <div className="form-group">
            <label htmlFor="clientId">
              <FiUser size={16} /> 
              Beneficiary <span className="required">*</span>
            </label>
            <select
              id="clientId"
              name="clientId"
              value={formData.clientId}
              onChange={handleChange}
              disabled={clientsLoading || !!clientsError || !clients.length}
              aria-describedby="beneficiary-help"
              required
            >
              <option value="" disabled>{clientsLoading ? "Loading beneficiaries…" : clientsError ? "List unavailable" : !clients.length ? "No saved beneficiaries" : "Select a beneficiary"}</option>
              {clients.map((client) => {
                const displayName = client.firstName && client.lastName 
                  ? `${client.firstName} ${client.lastName}`
                  : client.firstName || client.lastName || client.accountNumber || "Unnamed beneficiary"
                return (
                  <option key={client._id} value={client._id} disabled={!!client.status && client.status !== 'active'}>
                    {displayName}{client.status && client.status !== 'active' ? "(unavailable)" : ''}
                  </option>
                )
              })}
            </select>
            <div id="beneficiary-help" className="beneficiary-help">
              {clientsError ? <div role="alert"><p>{clientsError}</p><button type="button" className="funds-shortcut" onClick={loadClients}>Try again</button></div> : !clientsLoading && !clients.length ? <p>Add your first beneficiary to make a transfer.</p> : null}
              <button type="button" className="funds-shortcut beneficiary-add" onClick={() => navigate('/clients/new', { state: { returnTo: location.pathname, transferDraft: formData } })}>
                <FiUserPlus size={20} aria-hidden="true" /> Add a beneficiary
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="adminAccountType">
              <FiLayers size={16} /> 
              Source account <span className="required">*</span>
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
                  <span>Available balance:</span>
                   <strong>{
                    formatAmount(adminBalance[formData.adminAccountType] || 0)
                  } {formData.adminAccountType.toUpperCase()}</strong>
                </div>
              </div>
            )}
            <button type="button" className="funds-shortcut" onClick={() => navigate('/settings')}>Add funds</button>
          </div>

          <div className="form-group">
            <label htmlFor="amount">
              <FiDollarSign size={20} aria-hidden="true" />
              Amount ({formData.currency}) <span className="required">*</span>
            </label>
            <AmountInput
              id="amount"
              name="amount"
              value={formData.amount}
              onValueChange={amount => { setFormData(previous => ({ ...previous, amount })); setError('') }}
              placeholder="0.00"
              required
            />
            {formData.amount && parseFloat(formData.amount) > MAX_INSTANT_AMOUNT && formData.transferType === 'instant' && (
              <div className="warning-message">
                <FiAlertCircle size={16} /> 
                <span>The maximum amount for an instant transfer is {formatAmount(MAX_INSTANT_AMOUNT, 0)} {formData.currency}. Choose a transfer within 2 working days for this amount.</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="transferType">
              <FiClock size={16} /> 
              Transfer type <span className="required">*</span>
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
                    <span className="transfer-option-title">Instant transfer</span>
                  </div>
                  <div className="transfer-option-details">
                    <span className="transfer-speed">Processed immediately</span>
                    <span className="transfer-limit">Maximum {formatAmount(MAX_INSTANT_AMOUNT, 0)} {formData.currency}</span>
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
                    <span className="transfer-option-title">Transfer within 2 working days</span>
                  </div>
                  <div className="transfer-option-details">
                    <span className="transfer-speed">Processed within 2 working days</span>
                    <span className="transfer-limit">No amount limit</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">
              <FiFileText size={16} /> 
              Reference
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              placeholder="Transaction reference (optional)"
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
            <span>Cancel</span>
          </button>
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading || showConfirmation || balanceLoading || !!balanceError || clientsLoading || !!clientsError || !formData.clientId}
          >
            <FiSave size={18} /> 
            <span>Continue</span>
          </button>
        </div>
      </form>

      {/* Modal de confirmation */}
      {showConfirmation && (
        <div className="confirmation-modal-overlay" onClick={handleCancelConfirmation}>
          <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirmation-header">
              <FiAlertCircle size={24} className="confirmation-icon" /> 
              <h3>Transfer confirmation</h3>
            </div>
            
            <div className="confirmation-content">
              <div className="confirmation-info">
                <p className="confirmation-text">
                  You are about to transfer:
                </p>
                 <div className="confirmation-amount">
                  <span className="amount-value">
                    {formatAmount(parseFloat(formData.amount) || 0)} {formData.currency}
                  </span>
                </div>
                
                <div className="confirmation-details">
                  <div className="confirmation-detail-item">
                    <span className="detail-label">Selected transfer type:</span>
                    <span className="detail-value">
                      {formData.transferType === 'instant' ? (
                        <>
                          <FiZap size={16} /> 
                          <strong>Instant transfer</strong>
                        </>
                      ) : (
                        <>
                          <FiClock size={16} /> 
                          <strong>Transfer within 2 working days</strong>
                        </>
                      )}
                    </span>
                  </div>
                  
                  {formData.transferType === 'instant' ? (
                    <div className="confirmation-note">
                      <FiZap size={16} /> 
                      <div>
                        <strong>Processed immediately</strong>
                        <br />
                        <span>The maximum amount for an instant transfer is <strong>{formatAmount(MAX_INSTANT_AMOUNT, 0)} {formData.currency}</strong>.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="confirmation-note">
                      <FiClock size={16} /> 
                      <div>
                        <strong>Processed within 2 working days</strong>
                        <br />
                        <span>There is no amount limit for this transfer type.</span>
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
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmTransfer}
                className="btn btn-primary"
                disabled={loading}
              >
                <FiSave size={18} /> 
                <span>{loading ? "Processing..." : "Confirm transfer"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AddOperation

