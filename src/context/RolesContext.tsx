import { createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { rolesApi } from '../api'
import type { RolDefinicion } from '../types'

// ── Defaults para roles de sistema ────────────────────────────────────────
const DEFAULTS: Record<string, { label: string; color: string }> = {
  AdminSistema:   { label: 'Admin Sistema',   color: 'bg-red-600' },
  GerenteGeneral: { label: 'Gerente General', color: 'bg-purple-600' },
  Cajero:         { label: 'Cajero',          color: 'bg-blue-600' },
  Inventario:     { label: 'Inventario',      color: 'bg-orange-600' },
  Finanzas:       { label: 'Finanzas',        color: 'bg-green-600' },
}

interface RolesCtx {
  roles: RolDefinicion[]
  getLabelForRol: (nombre: string) => string
  getColorForRol: (nombre: string) => string
}

const Ctx = createContext<RolesCtx>({
  roles: [],
  getLabelForRol: n => DEFAULTS[n]?.label ?? n,
  getColorForRol: n => DEFAULTS[n]?.color ?? 'bg-slate-500',
})

export function RolesProvider({ children }: { children: React.ReactNode }) {
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: rolesApi.getAll,
    staleTime: 5 * 60_000, // 5 min — los roles cambian poco
  })

  const map = Object.fromEntries(roles.map(r => [r.nombre, r]))

  const getLabelForRol = (nombre: string) =>
    map[nombre]?.label ?? DEFAULTS[nombre]?.label ?? nombre

  const getColorForRol = (nombre: string) =>
    map[nombre]?.color ?? DEFAULTS[nombre]?.color ?? 'bg-slate-500'

  return (
    <Ctx.Provider value={{ roles, getLabelForRol, getColorForRol }}>
      {children}
    </Ctx.Provider>
  )
}

export const useRoles = () => useContext(Ctx)
