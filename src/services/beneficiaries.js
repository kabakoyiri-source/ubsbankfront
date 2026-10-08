export function removeBeneficiaryFavorite(id) {
  try {
    const saved = JSON.parse(localStorage.getItem('beneficiaryFavorites') || '[]')
    if (Array.isArray(saved)) localStorage.setItem('beneficiaryFavorites', JSON.stringify(saved.filter(value => value !== id)))
  } catch { /* Device preferences must not prevent a successful removal. */ }
}
