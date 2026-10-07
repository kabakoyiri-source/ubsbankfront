import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { 
  FiArrowLeft,
  FiLayers,
  FiSave,
  FiDollarSign,
  FiEye,
  FiEyeOff,
  FiLoader
} from 'react-icons/fi'
import { useAuth } from '../contexts/AuthContext'
import './Accounts.css'

function Accounts() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [adminBalance, setAdminBalance] = useState({ chf: 0, eur: 0, usd: 0 })
  const [loading, setLoading] = useState(true)
  const [showBalances, setShowBalances] = useState({
    chf: false,
    eur: false,
    usd: false
  })

  // Définition des 3 comptes
  const accounts = [
    {
      id: 'chf',
      name: 'Compte CHF',
      rib: 'CH93 0076 2011 6238 5295 7',
      type: 'Compte de transaction (CHF)',
      icon: FiLayers,
      color: '#3b82f6',
      description: 'Compte principal pour les transactions en Francs Suisses'
    },
    {
      id: 'eur',
      name: 'Compte EUR',
      rib: 'CH55 0023 5235 8890 1234 5',
      type: 'Compte courant (EUR)',
      icon: FiSave,
      color: '#10b981',
      description: 'Compte pour les transactions en Euros'
    },
    {
      id: 'usd',
      name: 'Compte USD',
      rib: 'CH81 0024 1016 3852 9450 1',
      type: 'Compte de réserve (USD)',
      icon: 'USD',
      color: '#f59e0b',
      description: 'Compte pour les transactions en Dollars US'
    }
  ]

  useEffect(() => {
    loadBalance()
  }, [])

  const loadBalance = async () => {
    try {
      const response = await api.get('/operations?admin=true')
      if (response.data.success) {
        const operations = response.data.data || []
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
      console.error('Erreur lors du chargement du solde:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleBalance = (accountId) => {
    setShowBalances(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }))
  }

  const formatAmount = (amount) => {
    if (amount === undefined || amount === null) return '0,00'
    const absoluteAmount = Math.abs(amount)
    const fixed = absoluteAmount.toFixed(2)
    const [intPart, decPart] = fixed.split('.')
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'")
    return `${amount < 0 ? '-' : ''}${formattedInt},${decPart}`
  }

  if (loading) {
    return (
      <div className="accounts-container">
        <div className="loading-container">
          <FiLoader className="spinner-icon" size={48} />
          <p>Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="accounts-container">
      <div className="accounts-header">
        <div className="page-header-with-back">
          <button 
            onClick={() => navigate('/')} 
            className="back-button"
            aria-label="Retour"
          >
            <FiArrowLeft size={20} />
          </button>
          <h1>Mes Comptes</h1>
        </div>
      </div>

      <div className="accounts-grid">
        {accounts.map((account) => {
          const Icon = account.icon
          const showBalance = showBalances[account.id]
          const isTextIcon = typeof Icon === 'string'

          return (
            <div key={account.id} className="account-card">
              <div className="account-card-header">
                <div className="account-icon" style={{ backgroundColor: `${account.color}20` }}>
                  {isTextIcon ? (
                    <span style={{ color: account.color, fontSize: '20px', fontWeight: 'bold' }}>
                      {Icon}
                    </span>
                  ) : (
                    <Icon size={28} style={{ color: account.color }} />
                  )}
                </div>
                <button 
                  className="eye-btn"
                  onClick={() => toggleBalance(account.id)}
                  aria-label={showBalance ? "Masquer le solde" : "Afficher le solde"}
                >
                  {showBalance ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>

              <div className="account-card-body">
                <h2 className="account-name">{account.name}</h2>
                <p className="account-type">{account.type}</p>
                <p className="account-description">{account.description}</p>

                <div className="account-iban-box">
                  <label>RIB</label>
                  <div className="account-iban">{account.rib}</div>
                </div>

                <div className="account-balance-box">
                  <label>Solde disponible</label>
                  <div className="account-balance" style={{ color: account.color }}>
                    {showBalance ? (
                      <>{account.id.toUpperCase()} {formatAmount(adminBalance[account.id] || 0)}</>
                    ) : (
                      '•••••••'
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Accounts

