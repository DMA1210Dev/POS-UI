import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { comercioApi, type ComercioResponse } from '../api'

interface ComercioContextValue {
  comercio: ComercioResponse | null
  isLoading: boolean
  facturacionElectronicaHabilitada: boolean
}

const CACHE_KEY = 'pos_comercio_branding'

function leerCache(): ComercioResponse | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : undefined
  } catch { return undefined }
}

function guardarCache(data: ComercioResponse) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* noop */ }
}

const ComercioContext = createContext<ComercioContextValue>({ comercio: null, isLoading: true, facturacionElectronicaHabilitada: false })

export function ComercioProvider({ children }: { children: ReactNode }) {
  const { data: comercio = null, isLoading } = useQuery({
    queryKey:    ['comercio'],
    queryFn:     comercioApi.get,
    staleTime:   1000 * 60 * 10, // 10 minutos — no cambia frecuentemente
    initialData: leerCache(),    // ← muestra el logo inmediatamente desde caché
  })

  // Persiste en localStorage cada vez que la API devuelve datos frescos
  useEffect(() => {
    if (comercio) guardarCache(comercio)
  }, [comercio])

  // Actualiza el favicon del navegador cuando cambia logoTagUrl
  useEffect(() => {
    const url = comercio?.logoTagUrl ?? null
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = url ?? '/favicon.ico'
  }, [comercio?.logoTagUrl])

  // Aplica los colores como variables CSS globales
  useEffect(() => {
    document.documentElement.style.setProperty('--color-menu',       comercio?.colorMenu      ?? '#1e293b')
    document.documentElement.style.setProperty('--color-menu-fin',   comercio?.colorMenuFin   ?? '#1e293b')
    document.documentElement.style.setProperty('--color-login',      comercio?.colorLogin     ?? '#0f172a')
    document.documentElement.style.setProperty('--color-login-fin',  comercio?.colorLoginFin  ?? '#1e3a8a')
  }, [comercio?.colorMenu, comercio?.colorMenuFin, comercio?.colorLogin, comercio?.colorLoginFin])

  return (
    <ComercioContext.Provider value={{
      comercio,
      isLoading,
      facturacionElectronicaHabilitada: comercio?.facturacionElectronicaHabilitada ?? false,
    }}>
      {children}
    </ComercioContext.Provider>
  )
}

export function useComercio() {
  return useContext(ComercioContext)
}
