import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiSave, FiX } from 'react-icons/fi'
import api from '../services/api'
import './AddClient.css'

function AddClient() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
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
    setError('')
    setLoading(true)

    try {
      // Convertir le code SWIFT en majuscules et s'assurer que firstName est vide si non fourni
      const payload = {
        ...formData,
        firstName: '', // Explicitement vide car non requis
        swiftCode: formData.swiftCode.toUpperCase().trim()
      }
      
      const response = await api.post('/clients', payload)
      if (response.data.success) {
        navigate('/clients')
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la création du client')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="add-client-container">
      <div className="add-client-header">
        <button 
          onClick={() => navigate('/clients')} 
          className="back-button"
          aria-label="Retour"
        >
          <FiArrowLeft size={20} />
        </button>
        <div className="header-content">
          <h1>Ajouter un bénéficiaire</h1>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="add-client-form">
        {/* Informations */}
        <div className="form-section">
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
            onClick={() => navigate('/clients')}
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

