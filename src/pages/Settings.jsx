import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiPlusCircle } from 'react-icons/fi'
import api from '../services/api'
import { calculateBalances } from '../services/balances'
import { formatAmount as format } from '../services/money'
import AmountInput from '../components/AmountInput'
import './Settings.css'

const currencies = ['CHF', 'EUR', 'USD']

export default function Settings() {
  const navigate = useNavigate()
  const submitting = useRef(false)
  const [balances, setBalances] = useState(null)
  const [currency, setCurrency] = useState('CHF')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadBalances = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/operations')
      if (!response.data.success) throw new Error()
      setBalances(calculateBalances(response.data.data || []))
    } catch {
      setError('Impossible de charger vos soldes. Vérifiez Internet puis réessayez.')
    } finally { setLoading(false) }
  }
  useEffect(() => { loadBalances() }, [])

  const addFunds = async event => {
    event.preventDefault()
    if (submitting.current) return
    setError('')
    setSuccess('')
    const numericAmount = Number(amount.replace(',', '.'))
    const cents = Math.round(numericAmount * 100)
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(amount.trim()) || !Number.isSafeInteger(cents) || cents <= 0 || Math.abs(numericAmount * 100 - cents) > .000001) {
      setError('Saisissez un montant positif avec deux décimales au maximum.')
      return
    }
    submitting.current = true
    setSaving(true)
    try {
      const response = await api.post('/operations', {
        type: 'deposit', amount: cents / 100, currency,
        description: 'Ajout de fonds depuis les paramètres'
      })
      if (!response.data.success) throw new Error(response.data.message || 'Ajout impossible.')
      // The deposit is already persisted. Update locally without a second
      // request that could fail and incorrectly invite another deposit.
      setBalances(previous => response.data.balances
        ? Object.fromEntries(currencies.map(code => [code.toLowerCase(), response.data.balances[code]]))
        : { ...previous, [currency.toLowerCase()]: Math.round((previous[currency.toLowerCase()] * 100) + cents) / 100 })
      setAmount('')
      setSuccess(`${format(cents / 100)} ${currency} ajoutés à votre compte.`)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Impossible d’ajouter les fonds. Réessayez.')
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button type="button" className="back-button" aria-label="Retour à Plus" onClick={() => navigate('/more')}><FiArrowLeft size={22} /></button>
        <h1>Paramètres</h1>
      </header>
      <section className="settings-panel" aria-labelledby="funds-title">
        <div className="settings-title"><FiPlusCircle size={24} /><h2 id="funds-title">Ajouter des fonds</h2></div>
        <p className="settings-description">Alimentez vos comptes pour effectuer des virements vers vos bénéficiaires.</p>
        <p className="settings-demo">Projet personnel · Fonds de démonstration</p>
        {error && <p className="error-message" role="alert">{error}</p>}
        {success && <p className="settings-success" role="status">{success}</p>}
        {loading ? <p role="status">Chargement des soldes…</p> : !balances ?
          <button type="button" className="btn btn-primary" onClick={loadBalances}>Réessayer</button> : <>
            <dl className="settings-balances">
              {currencies.map(code => <div key={code}><dt>Compte {code}</dt><dd>{format(balances[code.toLowerCase()])} {code}</dd></div>)}
            </dl>
            <form onSubmit={addFunds}>
              <div className="form-group">
                <label htmlFor="funds-currency">Compte à alimenter</label>
                <select id="funds-currency" value={currency} onChange={event => { setCurrency(event.target.value); setSuccess('') }} disabled={saving}>
                  {currencies.map(code => <option key={code} value={code}>Compte {code}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="funds-amount">Montant ({currency})</label>
                <AmountInput id="funds-amount" placeholder="0,00" value={amount} onValueChange={value => { setAmount(value); setSuccess('') }} required disabled={saving} />
              </div>
              <button className="btn btn-primary settings-add" type="submit" disabled={saving}>{saving ? 'Ajout en cours…' : 'Ajouter les fonds'}</button>
            </form>
            <Link to="/operations/new" className="settings-transfer">Effectuer un virement</Link>
          </>}
      </section>
    </div>
  )
}
