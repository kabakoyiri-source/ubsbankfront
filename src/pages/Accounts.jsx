import React, { useState, useEffect } from 'react'
import { formatAmount } from '../services/money'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { calculateBalances } from '../services/balances'
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
  const [error, setError] = useState('')
  const [showBalances, setShowBalances] = useState({
    chf: false,
    eur: false,
    usd: false
  })

  // Définition des 3 comptes
  const accounts = [
    {
      id: 'chf',
      name: "CHF account",
      rib: 'CH93 0076 2011 6238 5295 7',
      type: "Transaction account (CHF)",
      icon: FiLayers,
      color: '#3b82f6',
      description: "Main account for Swiss franc transactions"
    },
    {
      id: 'eur',
      name: "EUR account",
      rib: 'CH55 0023 5235 8890 1234 5',
      type: "Current account (EUR)",
      icon: FiSave,
      color: '#10b981',
      description: "Account for euro transactions"
    },
    {
      id: 'usd',
      name: "USD account",
      rib: 'CH81 0024 1016 3852 9450 1',
      type: "Reserve account (USD)",
      icon: 'USD',
      color: '#f59e0b',
      description: "Account for US dollar transactions"
    }
  ]

  useEffect(() => {
    loadBalance()
  }, [])

  const loadBalance = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/operations')
      if (response.data.success) {
        const operations = response.data.data || []
        setAdminBalance(calculateBalances(operations))
      }
    } catch (error) {
      console.error("Unable to load the balance:", error)
      setError("Unable to load accounts. Check your connection and try again.")
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


  if (loading) {
    return (
      <div className="accounts-container">
        <div className="loading-container">
          <FiLoader className="spinner-icon" size={48} />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (error) return <div className="error-message" role="alert"><span>{error}</span><button className="btn btn-primary" onClick={loadBalance}>Try again</button></div>

  return (
    <div className="accounts-container">
      <div className="accounts-header">
        <div className="page-header-with-back">
          <button 
            onClick={() => navigate('/')} 
            className="back-button"
            aria-label="Back"
          >
            <FiArrowLeft size={20} />
          </button>
          <h1>My accounts</h1>
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
                  aria-label={showBalance ? "Hide balance" : "Show balance"}
                >
                  {showBalance ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>

              <div className="account-card-body">
                <h2 className="account-name">{account.name}</h2>
                <p className="account-type">{account.type}</p>
                <p className="account-description">{account.description}</p>

                <div className="account-iban-box">
                  <label>IBAN</label>
                  <div className="account-iban">{account.rib}</div>
                </div>

                <div className="account-balance-box">
                  <label>Available balance</label>
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

