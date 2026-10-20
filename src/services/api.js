import { supabase, supabaseConfigurationError } from './supabase'

function requestError(message, status = 500) {
  return Object.assign(new Error(message), { response: { status, data: { success: false, message } } })
}
function errorStatus(error, fallback) {
  if (/^PT\d{3}$/.test(error?.code)) return Number(error.code.slice(2))
  if (error?.code === '23505') return 409
  if (/^(22|23)/.test(error?.code || '')) return 400
  return fallback >= 400 ? fallback : 500
}
async function rpc(name, payload) {
  if (!supabase) throw requestError(supabaseConfigurationError, 503)
  const { data, error, status } = await supabase.rpc(name, payload)
  if (error) throw requestError(error.message || 'Impossible de joindre Supabase. Réessayez.', errorStatus(error, status))
  if (!data?.success) throw requestError(data?.message || 'La demande a échoué.', data?.status || 500)
  return { data }
}

// Keep the pages' data shape while sending all requests directly to Supabase.
async function request(method, path, body = {}) {
  const url = new URL(path, 'https://app.invalid')
  if (method === 'POST' && url.pathname === '/auth/login') return rpc('usb_login', { p_email: body.email, p_password: body.password })
  if (method === 'POST' && url.pathname === '/auth/register') return rpc('usb_register', { p_payload: body })
  const token = localStorage.getItem('token')
  if (!token) throw requestError('Veuillez vous connecter.', 401)
  let action
  const payload = { ...Object.fromEntries(url.searchParams), ...body }
  const segments = url.pathname.split('/').filter(Boolean)
  if (url.pathname === '/auth/me' && method === 'GET') action = 'profile.get'
  else if (url.pathname === '/auth/updatedetails' && method === 'PUT') action = 'profile.update'
  else if (segments[0] === 'clients') {
    payload.id = segments[1]
    action = 'clients.' + ({ GET: segments[1] ? 'get' : 'list', POST: 'create', PUT: 'update', DELETE: 'delete' }[method])
  } else if (segments[0] === 'operations') {
    payload.id = segments[1]
    if (method === 'POST') action = segments[1] === 'transfer' ? 'operations.transfer' : 'operations.create'
    else if (method === 'PUT' && segments[2] === 'status') action = 'operations.status'
    else if (method === 'DELETE') action = 'operations.delete'
    else if (segments[1] === 'history') { action = 'operations.history'; payload.clientId = segments[2] }
    else action = segments[1] ? 'operations.get' : 'operations.list'
  }
  if (!action) throw requestError('Action introuvable.', 404)
  try {
    return await rpc('usb_api', { p_action: action, p_payload: payload, p_session_token: token })
  } catch (error) {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('selectedOperation')
      window.dispatchEvent(new Event('usb-session-expired'))
    }
    throw error
  }
}
export default {
  get: path => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: path => request('DELETE', path),
}
