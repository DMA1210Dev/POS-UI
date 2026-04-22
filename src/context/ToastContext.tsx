import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  toasts: ToastItem[]
  success: (msg: string) => void
  error:   (msg: string) => void
  warning: (msg: string) => void
  info:    (msg: string) => void
  dismiss: (id: string)  => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DURATION = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const add = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), DURATION)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{
      toasts,
      success: msg => add('success', msg),
      error:   msg => add('error',   msg),
      warning: msg => add('warning', msg),
      info:    msg => add('info',    msg),
      dismiss,
    }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}

/**
 * Convierte un error de axios en un mensaje legible para el usuario final.
 * Prioriza el mensaje del backend cuando es descriptivo;
 * si no, usa un texto genérico según el código HTTP.
 */
export const errMsg = (e: unknown): string => {
  const err = e as any
  const status: number | undefined = err?.response?.status
  const backendMsg: string | undefined = err?.response?.data?.error

  // Sin respuesta = sin conexión / servidor caído
  if (!err?.response) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión.'
  }

  switch (status) {
    case 400:
      return backendMsg ?? 'Los datos enviados no son válidos. Revisa los campos e intenta de nuevo.'
    case 401:
      return 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.'
    case 403:
      return 'No tienes permiso para realizar esta acción.'
    case 404:
      return backendMsg ?? 'El recurso solicitado no fue encontrado.'
    case 409:
      return backendMsg ?? 'Ya existe un registro con esos datos.'
    case 422:
      return backendMsg ?? 'Los datos enviados no cumplen las validaciones requeridas.'
    case 500:
      return 'Ocurrió un error interno en el servidor. Intenta más tarde.'
    case 503:
      return 'El servicio no está disponible en este momento. Intenta más tarde.'
    default:
      return backendMsg ?? `Error inesperado (${status ?? 'desconocido'}). Intenta nuevamente.`
  }
}
