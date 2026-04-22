import { createContext, useContext, useState, type ReactNode } from 'react'
import type { AuthResponse, AuthUser, PermisosEfectivos } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  login: (data: AuthResponse) => void
  logout: () => void
  updateUser: (partial: Partial<Pick<AuthUser, 'nombre' | 'email' | 'twoFactorEnabled' | 'twoFactorMethod'>>) => void
  isAuthenticated: boolean
  // Rol como string libre (puede ser personalizado)
  rol: string | null
  // Helpers de roles de sistema (basados en claims del JWT)
  isAdmin: boolean
  isGerente: boolean
  isCajero: boolean
  isInventario: boolean
  isFinanzas: boolean
  // Permisos efectivos (calculados en el backend: rol base + overrides individuales)
  puedeGestionarProductos: boolean
  puedeCrearVentas:        boolean
  puedeVerTodasVentas:     boolean
  puedeEditarVentas:       boolean
  puedeAprobarVentas:      boolean
  puedeAnularVentas:       boolean
  puedeGestionarClientes:  boolean
  puedeVerClientes:        boolean
  puedeGestionarCreditos:  boolean
  puedeRegistrarPagos:     boolean
  puedeVerReportes:        boolean
  puedeVerStockBajo:       boolean
  puedeGestionarUsuarios:  boolean
  puedeVerDashboard:       boolean
  tieneAccesoProductos:    boolean
  puedeGestionarCaja:        boolean
  puedeGestionarComprobantes: boolean
  puedeGestionarEmpleados:   boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Permisos vacíos para cuando no hay sesión */
const PERMISOS_VACIOS: PermisosEfectivos = {
  puedeGestionarProductos: false, puedeCrearVentas: false,   puedeVerTodasVentas: false,
  puedeEditarVentas: false,       puedeAprobarVentas: false, puedeAnularVentas: false,
  puedeGestionarClientes: false,  puedeVerClientes: false,   puedeGestionarCreditos: false,
  puedeRegistrarPagos: false,     puedeVerReportes: false,   puedeVerStockBajo: false,
  puedeGestionarUsuarios: false,  puedeVerDashboard: false,  tieneAccesoProductos: false,
  puedeGestionarCaja: false,
  puedeGestionarComprobantes: false,
  puedeGestionarEmpleados: false,
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  const login = (data: AuthResponse) => {
    const authUser: AuthUser = {
      id:                data.usuario.id,
      nombre:            data.usuario.nombre,
      email:             data.usuario.email,
      rol:               data.usuario.rol,
      token:             data.token,
      permisos:          data.usuario.permisos,
      twoFactorEnabled:  data.usuario.twoFactorEnabled ?? false,
      twoFactorMethod:   data.usuario.twoFactorMethod,
    }
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(authUser))
    setUser(authUser)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const updateUser = (partial: Partial<Pick<AuthUser, 'nombre' | 'email' | 'twoFactorEnabled' | 'twoFactorMethod'>>) => {
    setUser(prev => {
      if (!prev) return prev
      const updated = { ...prev, ...partial }
      localStorage.setItem('user', JSON.stringify(updated))
      return updated
    })
  }

  const rol = user?.rol ?? null
  const p   = user?.permisos ?? PERMISOS_VACIOS

  // Roles de sistema: basamos en permisos (backend ya mergea rol base)
  const isAdmin      = p.puedeGestionarUsuarios
  const isGerente    = !isAdmin && p.puedeAnularVentas
  const isCajero     = p.puedeCrearVentas && !p.puedeGestionarUsuarios && !p.puedeAnularVentas
  const isInventario = p.tieneAccesoProductos && !p.puedeCrearVentas
  const isFinanzas   = p.puedeVerReportes && !p.puedeCrearVentas && !p.tieneAccesoProductos

  return (
    <AuthContext.Provider value={{
      user, login, logout, updateUser,
      isAuthenticated: !!user,
      rol,
      isAdmin,
      isGerente,
      isCajero,
      isInventario,
      isFinanzas,
      // Permisos efectivos directamente del backend
      puedeGestionarProductos: p.puedeGestionarProductos,
      puedeCrearVentas:        p.puedeCrearVentas,
      puedeVerTodasVentas:     p.puedeVerTodasVentas,
      puedeEditarVentas:       p.puedeEditarVentas,
      puedeAprobarVentas:      p.puedeAprobarVentas,
      puedeAnularVentas:       p.puedeAnularVentas,
      puedeGestionarClientes:  p.puedeGestionarClientes,
      puedeVerClientes:        p.puedeVerClientes,
      puedeGestionarCreditos:  p.puedeGestionarCreditos,
      puedeRegistrarPagos:     p.puedeRegistrarPagos,
      puedeVerReportes:        p.puedeVerReportes,
      puedeVerStockBajo:       p.puedeVerStockBajo,
      puedeGestionarUsuarios:  p.puedeGestionarUsuarios,
      puedeVerDashboard:       p.puedeVerDashboard,
      tieneAccesoProductos:     p.tieneAccesoProductos,
      puedeGestionarCaja:       p.puedeGestionarCaja,
      puedeGestionarComprobantes: p.puedeGestionarComprobantes,
      puedeGestionarEmpleados:  p.puedeGestionarEmpleados,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
