export const CURRENCIES = ['CHF', 'EUR', 'USD']
const preferenceKey = 'usb-preferred-currency'

export function normalizeCurrency(value) {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return CURRENCIES.includes(code) ? code : 'CHF'
}

export function getPreferredCurrency() {
  try { return normalizeCurrency(localStorage.getItem(preferenceKey)) }
  catch { return 'CHF' }
}

export function setPreferredCurrency(value) {
  const code = normalizeCurrency(value)
  try { localStorage.setItem(preferenceKey, code) } catch { /* Keep the current screen usable if storage is blocked. */ }
  return code
}
