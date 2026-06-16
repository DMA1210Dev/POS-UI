import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { comercioApi, type ComercioResponse } from '../api'
import { parseColoresJson, aplicarColores } from '../lib/colores'

interface ComercioContextValue {
  comercio: ComercioResponse | null
  isLoading: boolean
  facturacionElectronicaHabilitada: boolean
  camaraHabilitada: boolean
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

const ComercioContext = createContext<ComercioContextValue>({ comercio: null, isLoading: true, facturacionElectronicaHabilitada: false, camaraHabilitada: true })

export function ComercioProvider({ children }: { children: ReactNode }) {
  const { data: comercio = null, isLoading } = useQuery({
    queryKey:    ['comercio'],
    queryFn:     comercioApi.get,
    staleTime:   1000 * 60 * 30, // 30 minutos — casi nunca cambia
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialData: leerCache(),
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

  // Aplica los colores como variables CSS globales — solo cuando cambian
  const coloresPrev = useRef('')
  useEffect(() => {
    const colorMenu    = comercio?.colorMenu    ?? '#1e293b'
    const colorMenuFin = comercio?.colorMenuFin ?? '#1e293b'
    const colorLogin   = comercio?.colorLogin   ?? '#0f172a'
    const colorLoginFin= comercio?.colorLoginFin?? '#1e3a8a'
    const coloresJson  = comercio?.coloresJson  ?? ''
    const firma = `${colorMenu}|${colorMenuFin}|${colorLogin}|${colorLoginFin}|${coloresJson}`
    if (firma === coloresPrev.current) return
    coloresPrev.current = firma

    document.documentElement.style.setProperty('--color-menu',      colorMenu)
    document.documentElement.style.setProperty('--color-menu-fin',  colorMenuFin)
    document.documentElement.style.setProperty('--color-login',     colorLogin)
    document.documentElement.style.setProperty('--color-login-fin', colorLoginFin)
    if (coloresJson)
      aplicarColores(parseColoresJson(coloresJson))
  }, [comercio?.colorMenu, comercio?.colorMenuFin, comercio?.colorLogin, comercio?.colorLoginFin, comercio?.coloresJson])

  return (
    <ComercioContext.Provider value={{
      comercio,
      isLoading,
      facturacionElectronicaHabilitada: comercio?.facturacionElectronicaHabilitada ?? false,
      camaraHabilitada: comercio?.camaraHabilitada ?? true,
    }}>
      {children}
    </ComercioContext.Provider>
  )
}

export function useComercio() {
  return useContext(ComercioContext)
}
