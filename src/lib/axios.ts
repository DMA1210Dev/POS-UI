import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Handlers globales (registrados por AppLayout) ─────────────────────────
let _onNetworkError:    (() => void) | null = null
let _onSessionExpired:  (() => void) | null = null

/** Dispara el evento global de licencia bloqueada */
function dispararBloqueoLicencia(data: { codigo: string; error: string; fechaVencimiento?: string }) {
  window.dispatchEvent(new CustomEvent('licencia-bloqueada', { detail: data }))
}

export const registerNetworkErrorHandler   = (fn: () => void) => { _onNetworkError   = fn }
export const unregisterNetworkErrorHandler = ()               => { _onNetworkError   = null }

export const registerSessionExpiredHandler   = (fn: () => void) => { _onSessionExpired = fn }
export const unregisterSessionExpiredHandler = ()               => { _onSessionExpired = null }

// ── Adjunta el token JWT en cada request ─────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Manejo global de respuestas ───────────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (!error.response) {
      _onNetworkError?.()
      return Promise.reject(error)
    }

    // Bloqueo de licencia: solo códigos que afectan toda la cuenta.
    // "plan_sin_acceso" es restricción de feature — no bloquea la app, solo esa sección.
    const CODIGOS_BLOQUEO = new Set(['mantenimiento', 'bloqueado_pago', 'bloqueado'])
    const { status, data } = error.response
    if ((status === 503 || status === 402 || status === 403) && data?.codigo) {
      if (CODIGOS_BLOQUEO.has(data.codigo)) {
        dispararBloqueoLicencia({
          codigo:           data.codigo,
          error:            data.error ?? '',
          fechaVencimiento: data.fechaVencimiento,
        })
      } else if (data.codigo === 'plan_sin_acceso') {
        window.dispatchEvent(new CustomEvent('plan-sin-acceso', {
          detail: { error: data.error ?? '', feature: data.feature ?? '' }
        }))
      }
      return Promise.reject(error)
    }

    if (error.response.status === 401) {
      const hadSession = !!localStorage.getItem('token')

      // Sin token previo → es un intento de login fallido (credenciales/bloqueado).
      // Dejamos que el catch local de LoginPage muestre el popup.
      if (!hadSession) return Promise.reject(error)

      // Había sesión activa → expiró o fue revocada.
      localStorage.removeItem('token')
      localStorage.removeItem('user')

      if (_onSessionExpired) {
        _onSessionExpired()
        return Promise.reject(error)
      }
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

export default api
