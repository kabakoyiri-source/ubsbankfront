import React, { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FiArrowLeft, FiSave, FiX } from 'react-icons/fi'
import api from '../services/api'
import './AddClient.css'

function AddClient() {
  const navigate = useNavigate()
  const location = useLocation()
  const submitting = useRef(false)
  const returnTo = ['/operations/new', '/operations/transfer'].includes(location.state?.returnTo) ? location.state.returnTo : '/clients'
  const returnToTransfer = returnTo !== '/clients'
  const returnState = returnToTransfer ? { transferDraft: location.state?.transferDraft } : undefined
  const handleCancel = () => navigate(returnTo, { state: returnState })
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    bankName: '',
    accountNumber: '',
    swiftCode: '',
    bankAddress: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting.current) return
    setError('')
    const payload = Object.fromEntries(Object.entries(formData).map(([key, value]) => [key, value.trim()]))
    payload.accountNumber = payload.accountNumber.replace(/\s+/g, '').toUpperCase()
    payload.swiftCode = payload.swiftCode.replace(/\s+/g, '').toUpperCase()
    if (['lastName', 'bankName', 'accountNumber', 'swiftCode', 'bankAddress'].some(key => !payload[key])) {
      setError('Complétez le nom et les coordonnées bancaires du bénéficiaire.')
      return
    }
    submitting.current = true
    setLoading(true)

    try {
      const response = await api.post('/clients', payload)
      if (!response.data.success || !response.data.data?._id) throw new Error(response.data.message || 'La création du bénéficiaire a échoué.')
      if (returnToTransfer) {
        const clientId = response.data.data._id
        navigate(`${returnTo}?clientId=${encodeURIComponent(clientId)}`, { replace: true, state: { transferDraft: { ...location.state?.transferDraft, clientId }, beneficiaryCreated: true } })
      } else navigate('/clients', { replace: true })
    } catch (error) {
      setError(error.response?.data?.message || error.message || 'Erreur lors de la création du bénéficiaire')
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <div className="add-client-container">
      <div className="add-client-header">
        <button 
          onClick={handleCancel}
          disabled={loading}
          className="back-button"
          aria-label="Retour"
        >
          <FiArrowLeft size={20} />
        </button>
        <div className="header-content">
          <h1>Ajouter un bénéficiaire</h1>
          {returnToTransfer && <p>Après l’ajout, vous retrouverez votre virement en cours.</p>}
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="add-client-form">
        {/* Informations */}
        <div className="form-section">
          <div className="form-group">
            <label htmlFor="firstName">Prénom (facultatif)</label>
            <input id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} autoComplete="off" placeholder="Entrez le prénom" />
          </div>
          <div className="form-group">
            <label htmlFor="lastName">
              Nom <span className="required">*</span>
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Entrez le nom"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="bankName">
              Nom de la banque <span className="required">*</span>
            </label>
            <input
              type="text"
              id="bankName"
              name="bankName"
              value={formData.bankName}
              onChange={handleChange}
              placeholder="Ex: UBS, Credit Suisse, etc."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="accountNumber">
            IBAN <span className="required">*</span>
            </label>
            <input
              type="text"
              id="accountNumber"
              name="accountNumber"
              value={formData.accountNumber}
              onChange={handleChange}
              placeholder="IBAN"
              autoCapitalize="characters"
              spellCheck={false}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="swiftCode">
              Code SWIFT <span className="required">*</span>
            </label>
            <input
              type="text"
              id="swiftCode"
              name="swiftCode"
              value={formData.swiftCode}
              onChange={handleChange}
              placeholder="Ex: UBSWCHZH80A"
              autoCapitalize="characters"
              spellCheck={false}
              required
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="bankAddress">
              Adresse de la banque <span className="required">*</span>
            </label>
            <textarea
              id="bankAddress"
              name="bankAddress"
              value={formData.bankAddress}
              onChange={handleChange}
              rows="3"
              placeholder="Adresse complète de la banque"
              required
            />
          </div>
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="btn btn-primary"
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
            <span>{loading ? 'Création en cours...' : 'Créer le bénéficiaire'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddClient

