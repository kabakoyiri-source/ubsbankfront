// History.jsx – Version finale 100% conforme capture (filtres fonctionnels + dates dynamiques + animation + responsive)

import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './History.css'
import api from '../services/api'

const TABS = {
  LAST_30_DAYS: 'LAST_30_DAYS',
  LAST_20: 'LAST_20',
  LAST_6_MONTHS: 'LAST_6_MONTHS',
  AVENIR: 'AVENIR'
}

const TAB_LABELS = {
  [TABS.LAST_30_DAYS]: '30 derniers jours',
  [TABS.LAST_20]: '20 dernières transactions',
  [TABS.LAST_6_MONTHS]: '6 derniers mois',
  [TABS.AVENIR]: 'À venir'
}

const History = () => {
  const navigate = useNavigate()
  const [operations, setOperations] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(TABS.LAST_20)
  const [swipedOperationId, setSwipedOperationId] = useState(null)

  useEffect(() => {
    fetchOperations()
  }, [])

  const fetchOperations = async () => {
    try {
      setLoading(true)
      const res = await api.get('/operations?admin=true')
      if (res.data?.success) {
        const operationsData = res.data.data || []
        console.log('Raw operations from API:', operationsData)
        console.log('Operations with isScheduled:', operationsData.filter(op => op.isScheduled === true))
        setOperations(operationsData)
      }
    } finally {
      setLoading(false)
    }
  }

  const filteredOperations = useMemo(() => {
    const now = new Date()
    let filtered = [...operations]

    if (activeTab === TABS.LAST_30_DAYS) {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      filtered = filtered.filter(op => new Date(op.createdAt) >= d)
    }

    if (activeTab === TABS.LAST_6_MONTHS) {
      const d = new Date()
      d.setMonth(d.getMonth() - 6)
      filtered = filtered.filter(op => new Date(op.createdAt) >= d)
    }

    if (activeTab === TABS.LAST_20) {
      filtered = filtered.slice(0, 20)
    }

    if (activeTab === TABS.AVENIR) {
      console.log('All operations:', operations)
      console.log('Filtering scheduled operations...')
      filtered = filtered.filter(op => {
        const isScheduled = op.isScheduled === true || op.transferType === 'delayed' || op.status === 'pending'
        console.log(`Operation ${op._id}:`, { 
          isScheduled: op.isScheduled, 
          transferType: op.transferType,
          status: op.status,
          willShow: isScheduled 
        })
        return isScheduled
      })
      console.log('Scheduled operations found:', filtered.length)
    }

    return filtered
  }, [operations, activeTab])

  const groupedByYear = useMemo(() => {
    const groups = {}
    filteredOperations.forEach(op => {
      const y = new Date(op.createdAt).getFullYear()
      if (!groups[y]) groups[y] = []
      groups[y].push(op)
    })
    return groups
  }, [filteredOperations])

  const formatAmount = (amount) => {
    if (amount === undefined || amount === null) return '0,00'
    const absoluteAmount = Math.abs(amount)
    const fixed = absoluteAmount.toFixed(2)
    const [intPart, decPart] = fixed.split('.')
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'")
    return `${amount < 0 ? '-' : ''}${formattedInt},${decPart}`
  }
  const formatDate = (d) => new Date(d).toLocaleDateString('en-GB')

  const handleOperationClick = (operation) => {
    if (swipedOperationId) return // Ne pas naviguer si une opération est en mode swipe
    localStorage.setItem('selectedOperation', JSON.stringify(operation))
    navigate('/operation-details')
  }

  const handleDeleteOperation = async (operationId) => {
    try {
      const response = await api.delete(`/operations/${operationId}?admin=true`)
      if (response.data.success) {
        // Supprimer l'opération de la liste locale
        setOperations(prev => prev.filter(op => op._id !== operationId))
        setSwipedOperationId(null)
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
      setSwipedOperationId(null)
    }
  }

  const handleTouchStart = (e, operationId) => {
    const touch = e.touches[0]
    const startX = touch.clientX
    
    const handleTouchMove = (e) => {
      const touch = e.touches[0]
      const currentX = touch.clientX
      const diffX = startX - currentX
      
      if (diffX > 50) { // Swipe vers la gauche de plus de 50px
        setSwipedOperationId(operationId)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
      }
    }
    
    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
    
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)
  }

  const handleMouseDown = (e, operationId) => {
    const startX = e.clientX
    
    const handleMouseMove = (e) => {
      const currentX = e.clientX
      const diffX = startX - currentX
      
      if (diffX > 50) { // Swipe vers la gauche de plus de 50px
        setSwipedOperationId(operationId)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const lastDate = filteredOperations[0]?.createdAt

  // Fermer le swipe lorsqu'on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.transaction-row')) {
        setSwipedOperationId(null)
      }
    }

    if (swipedOperationId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [swipedOperationId])

  return (
    <div className="history-screen">
      <header className="history-top">
        <button className="bac" onClick={() => navigate(-1)}>←</button>
        <h1>Transactions</h1>
      </header>

      <div className="filter-bar">
        <div className="filter-label">Filtrer les transactions ▾</div>
        <div className="filter-tabs">
          <button className={`tab ${activeTab === TABS.LAST_30_DAYS ? 'active' : ''}`} onClick={() => setActiveTab(TABS.LAST_30_DAYS)}>{TAB_LABELS[TABS.LAST_30_DAYS]}</button>
          <button className={`tab ${activeTab === TABS.LAST_20 ? 'active' : ''}`} onClick={() => setActiveTab(TABS.LAST_20)}>{TAB_LABELS[TABS.LAST_20]}</button>
          <button className={`tab ${activeTab === TABS.LAST_6_MONTHS ? 'active' : ''}`} onClick={() => setActiveTab(TABS.LAST_6_MONTHS)}>{TAB_LABELS[TABS.LAST_6_MONTHS]}</button>
          <button className={`tab ${activeTab === TABS.AVENIR ? 'active' : ''}`} onClick={() => setActiveTab(TABS.AVENIR)}>{TAB_LABELS[TABS.AVENIR]}</button>
        </div>
        {lastDate && (
          <div className="filter-info">Jusqu'au {formatDate(lastDate)} ({filteredOperations.length} transactions)</div>
        )}
      </div>

      {loading && <div className="loading">Chargement…</div>}

      {!loading && Object.entries(groupedByYear)
        .sort((a, b) => b[0] - a[0])
        .map(([year, ops]) => (
          <section key={year}>
            <div className="year-label">{year}</div>
            {ops.map(op => (
              <div 
                key={op._id} 
                className={`transaction-row ${swipedOperationId === op._id ? 'swiped' : ''}`}
                onClick={() => handleOperationClick(op)}
                onTouchStart={(e) => handleTouchStart(e, op._id)}
                onMouseDown={(e) => handleMouseDown(e, op._id)}
              >
                <div className="transaction-content">
                  <div>
                    <div className="tx-title">
                      {op.clientId && typeof op.clientId === 'object' 
                        ? `${op.clientId.firstName || ''} ${op.clientId.lastName || ''}`.trim() || op.description || op.type
                        : op.description || op.type
                      }
                    </div>
                    <div className="tx-sub">{formatDate(op.createdAt)} {op.type.toUpperCase()}</div>
                  </div>
                  <div className="tx-amount">
                    <span>
                      CHF {op.type === 'deposit' ? '+' : op.type === 'transfer' ? '' : ''}{formatAmount(op.amount)}
                    </span>
                  </div>
                </div>
                <div className="delete-action">
                  <button 
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteOperation(op._id)
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </section>
        ))}
    </div>
  )
}

export default History
