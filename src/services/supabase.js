import { PostgrestClient } from '@supabase/postgrest-js'

const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabaseConfigurationError = !url || !key
  ? 'Supabase n’est pas configuré. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY, puis relancez la compilation.'
  : null
// Auth is implemented by usb_users + SQL RPCs. Supabase Auth is not used.
export const supabase = supabaseConfigurationError ? null : new PostgrestClient(`${url}/rest/v1`, {
  headers: { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) },
  fetch: (input, init = {}) => {
    if (init.signal) return fetch(input, init)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
  },
})

export function revokeSession(token) {
  if (!token || !supabase) return
  // Start immediately and survive a normal document close where supported.
  // Local removal remains synchronous if the OS freezes the PWA or it is offline.
  fetch(`${url}/rest/v1/rpc/usb_logout`, {
    method: 'POST', keepalive: true,
    headers: { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_session_token: token }),
  }).catch(() => {})
}
