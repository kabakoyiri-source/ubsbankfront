export function formatAmount(value, decimals = 2) {
  const amount = Number(value)
  const safe = Number.isFinite(amount) ? amount : 0
  const [integer, fraction] = Math.abs(safe).toFixed(decimals).split('.')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, "'")
  return `${safe < 0 ? '-' : ''}${grouped}${decimals ? ',' + fraction : ''}`
}

export function normalizeAmountInput(value) {
  const raw = value.replace(/['’´\u2032\s]/g, '').replace(',', '.')
  return /^\d*(?:\.\d{0,2})?$/.test(raw) ? raw : null
}

export function formatAmountInput(value) {
  if (!value) return ''
  const [integer, fraction] = value.split('.')
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, "'") + (fraction === undefined ? '' : ',' + fraction)
}
