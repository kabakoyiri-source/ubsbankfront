export function calculateBalances(operations) {
  const cents = { chf: 0, eur: 0, usd: 0 }
  for (const operation of operations) {
    const currency = (operation.currency || 'CHF').toLowerCase()
    if (!(currency in cents)) continue
    const amount = Math.round(Number(operation.amount || 0) * 100)
    if (!Number.isFinite(amount)) continue
    if (operation.status === 'completed') cents[currency] += amount
    else if (operation.status === 'pending') cents[currency] -= Math.abs(amount)
  }
  return Object.fromEntries(Object.entries(cents).map(([currency, amount]) => [currency, amount / 100]))
}
