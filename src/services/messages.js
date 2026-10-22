import englishMessages from './englishMessages.json'

// Existing Supabase installations may still return the original French errors.
export function toEnglishMessage(value) {
  if (typeof value !== 'string') return value
  if (Object.prototype.hasOwnProperty.call(englishMessages, value)) return englishMessages[value]
  const funds = value.match(/^Solde insuffisant sur le compte (CHF|EUR|USD)\. Ajoutez des fonds dans les paramètres\.$/)
  if (funds) return `Insufficient funds in the ${funds[1]} account. Add funds in Settings.`
  const limit = value.match(/^Le montant maximum pour un virement instantané est de (.+)\.$/)
  if (limit) return `The maximum amount for an instant transfer is ${limit[1]}.`
  return value
}

const generatedDescriptions = new Set(['Ajout de fonds', 'Ajout de fonds depuis les paramètres', 'Rechargement de solde', 'Transfert manuel'])
export function transactionInEnglish(operation) {
  if (!operation) return operation
  return {
    ...operation,
    description: generatedDescriptions.has(operation.description) ? toEnglishMessage(operation.description) : operation.description,
    reason: generatedDescriptions.has(operation.reason) ? toEnglishMessage(operation.reason) : operation.reason,
    adminAccountName: /^Compte (CHF|EUR|USD)$/.test(operation.adminAccountName || '') ? toEnglishMessage(operation.adminAccountName) : operation.adminAccountName,
  }
}
