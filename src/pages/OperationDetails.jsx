import React, { useState, useEffect } from 'react'
import { formatAmount } from '../services/money'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiUser, FiCalendar, FiDollarSign, FiCreditCard, FiFileText } from 'react-icons/fi'
import './OperationDetails.css'
import { transactionInEnglish } from '../services/messages'

function OperationDetails() {
  const navigate = useNavigate()
  const [operation, setOperation] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedOperation = localStorage.getItem('selectedOperation')
    if (storedOperation) {
      try {
        const parsedOperation = JSON.parse(storedOperation)
        console.log("Transaction data received:", parsedOperation)
        console.log('Reason:', parsedOperation.reason)
        setOperation(transactionInEnglish(parsedOperation))
      } catch (error) {
        console.error("Unable to read the transaction data:", error)
        navigate('/')
      }
    } else {
      navigate('/')
    }
    setLoading(false)
  }, [navigate])


  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-GB", {
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
    if (!status) return "Completed"
    switch (status.toLowerCase()) {
      case 'pending':
        return "Processing"
      case 'completed':
        return "Completed"
      case 'failed':
        return "Failed"
      case 'cancelled':
        return "Cancelled"
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className="operation-details-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!operation) {
    return (
      <div className="operation-details-container">
        <div className="error-container">
          <p>Transaction not found</p>
          <button onClick={() => navigate('/')} className="back-btn">
            Back to Home
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
        <h1 className="details-title">Transaction details</h1>
      </div>

      {/* Main Content */}
      <div className="details-content">
        {/* Amount Card */}
        <div className="amount-card">
          
          <div className="amount-info">
            <div className={`amount-value ${isIncoming ? 'positive' : 'negative'}`}>
              {operation.currency || 'CHF'} {isIncoming && operation.amount > 0 ? '+' : ''}{formatAmount(operation.amount)}
            </div>
            <div className="amount-type">
              {isIncoming ? "Credit" : "Debit"}
            </div>
          </div>
        </div>

        {/* Client Information */}
        {client && (
          <div className="info-section">
            <h2 className="section-title">
              <FiUser size={20} />
              Beneficiary
            </h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Name</span>
                <span className="info-value">
                  {client.firstName && client.firstName.trim() 
                    ? `${client.firstName} ${client.lastName}` 
                    : client.lastName}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">IBAN</span>
                <span className="info-value">{client.accountNumber || "Not available"}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Bank</span>
                <span className="info-value">{client.bankName || "Not specified"}</span>
              </div>
            </div>
          </div>
        )}

        {/* Operation Information */}
        <div className="info-section">
          <h2 className="section-title">
            <FiFileText size={20} />
            Transaction information
          </h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Date</span>
              <span className="info-value">{formatDate(operation.createdAt)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Type</span>
              <span className="info-value">{operation.type === 'deposit' ? "Deposit" : "Transfer"}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Status</span>
              <span className="info-value status">{translateStatus(operation.status)}</span>
            </div>
            {(operation.reason || operation.description) && (
              <div className="info-item full-width">
                <span className="info-label">Reference</span>
                <span className="info-value">{operation.reason || operation.description}</span>
              </div>
            )}
            {operation.adminAccountName && (
              <div className="info-item">
                <span className="info-label">Source</span>
                <span className="info-value">From: {operation.adminAccountName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button onClick={() => navigate('/')} className="primary-btn">
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}

export default OperationDetails
