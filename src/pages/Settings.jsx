import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiPlusCircle } from 'react-icons/fi'
import api from '../services/api'
import { calculateBalances } from '../services/balances'
import { formatAmount as format } from '../services/money'
import AmountInput from '../components/AmountInput'
import './Settings.css'
import { getPreferredCurrency, setPreferredCurrency } from '../services/currency'
import { useAuth } from '../contexts/AuthContext'

const currencies = ['CHF', 'EUR', 'USD']

export default function Settings() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const submitting = useRef(false)
  const [balances, setBalances] = useState(null)
  const [currency, setCurrency] = useState(getPreferredCurrency)
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
      setError("Unable to load your balances. Check your connection and try again.")
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
      setError("Enter a positive amount with no more than two decimal places.")
      return
    }
    submitting.current = true
    setSaving(true)
    try {
      const response = await api.post('/operations', {
        type: 'deposit', amount: cents / 100, currency,
        description: "Funds added from Settings"
      })
      if (!response.data.success) throw new Error(response.data.message || "Unable to add funds.")
      // The deposit is already persisted. Update locally without a second
      // request that could fail and incorrectly invite another deposit.
      setBalances(previous => response.data.balances
        ? Object.fromEntries(currencies.map(code => [code.toLowerCase(), response.data.balances[code]]))
        : { ...previous, [currency.toLowerCase()]: Math.round((previous[currency.toLowerCase()] * 100) + cents) / 100 })
      setAmount('')
      setPreferredCurrency(currency)
      if (response.data.balances) setUser(previous => previous ? { ...previous, balances: response.data.balances } : previous)
      setSuccess(`${format(cents / 100)} ${currency} added to your account.`)
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to add funds. Try again.")
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button type="button" className="back-button" aria-label="Back to More" onClick={() => navigate('/more')}><FiArrowLeft size={22} /></button>
        <h1>Settings</h1>
      </header>
      <section className="settings-panel" aria-labelledby="funds-title">
        <div className="settings-title"><FiPlusCircle size={24} /><h2 id="funds-title">Add funds</h2></div>
        <p className="settings-description">Add funds to your accounts to make transfers to your beneficiaries.</p>
        <p className="settings-demo">Personal project · Demo funds</p>
        {error && <p className="error-message" role="alert">{error}</p>}
        {success && <p className="settings-success" role="status">{success}</p>}
        {loading ? <p role="status">Loading balances…</p> : !balances ?
          <button type="button" className="btn btn-primary" onClick={loadBalances}>Try again</button> : <>
            <dl className="settings-balances">
              {currencies.map(code => <div key={code}><dt>{code} account</dt><dd>{format(balances[code.toLowerCase()])} {code}</dd></div>)}
            </dl>
            <form onSubmit={addFunds}>
              <div className="form-group">
                <label htmlFor="funds-currency">Account to fund</label>
                <select id="funds-currency" value={currency} onChange={event => { setCurrency(setPreferredCurrency(event.target.value)); setSuccess(''); setError('') }} disabled={saving}>
                  {currencies.map(code => <option key={code} value={code}>{code} account</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="funds-amount">Amount ({currency})</label>
                <AmountInput id="funds-amount" placeholder="0.00" value={amount} onValueChange={value => { setAmount(value); setSuccess('') }} required disabled={saving} />
              </div>
              <button className="btn btn-primary settings-add" type="submit" disabled={saving}>{saving ? "Adding funds…" : "Add funds"}</button>
            </form>
            <Link to="/operations/new" className="settings-transfer">Make a transfer</Link>
          </>}
      </section>
    </div>
  )
}
