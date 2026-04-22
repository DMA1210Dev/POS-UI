import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, User, Save, RotateCcw, Check, X, Users, Shield, Pencil } from 'lucide-react'
import { usuariosApi, permisosApi, permisosRolApi } from '../../api'
import type { PermisosUsuario, PermisosRol } from '../../types'
import { useToast, errMsg } from '../../context/ToastContext'
import { useRoles } from '../../context/RolesContext'
import Button from '../../components/ui/Button'

// ── Meta de permisos ──────────────────────────────────────────────────────

type PermisoKey = Exclude<keyof PermisosRol, 'rol'>

interface PermisoMeta { key: PermisoKey; label: string; grupo: string }

const PERMISOS: PermisoMeta[] = [
  { key: 'puedeCrearVentas',        label: 'Crear ventas',           grupo: 'Ventas' },
  { key: 'puedeVerTodasVentas',     label: 'Ver todas las ventas',   grupo: 'Ventas' },
  { key: 'puedeEditarVentas',       label: 'Editar ventas',          grupo: 'Ventas' },
  { key: 'puedeAprobarVentas',      label: 'Aprobar ventas',         grupo: 'Ventas' },
  { key: 'puedeAnularVentas',       label: 'Anular ventas',          grupo: 'Ventas' },
  { key: 'puedeVerClientes',        label: 'Ver clientes',           grupo: 'Clientes' },
  { key: 'puedeGestionarClientes',  label: 'Gestionar clientes',     grupo: 'Clientes' },
  { key: 'puedeGestionarCreditos',  label: 'Ver créditos',           grupo: 'Cobros' },
  { key: 'puedeRegistrarPagos',     label: 'Registrar pagos',        grupo: 'Cobros' },
  { key: 'puedeGestionarCaja',      label: 'Gestionar caja',         grupo: 'Cobros' },
  { key: 'tieneAccesoProductos',    label: 'Ver productos',          grupo: 'Almacén' },
  { key: 'puedeGestionarProductos', label: 'Gestionar productos',    grupo: 'Almacén' },
  { key: 'puedeVerStockBajo',       label: 'Ver stock bajo',         grupo: 'Almacén' },
  { key: 'puedeVerReportes',        label: 'Ver reportes',           grupo: 'Reportes' },
  { key: 'puedeVerDashboard',       label: 'Ver dashboard',          grupo: 'Reportes' },
  { key: 'puedeGestionarComprobantes', label: 'Gestionar comprobantes', grupo: 'Contabilidad' },
  { key: 'puedeGestionarUsuarios',     label: 'Gestionar usuarios',     grupo: 'Administración' },
  { key: 'puedeGestionarEmpleados',    label: 'Gestionar empleados',    grupo: 'Administración' },
]

const GRUPOS = ['Ventas', 'Clientes', 'Cobros', 'Almacén', 'Contabilidad', 'Reportes', 'Administración']

// ── Helpers ───────────────────────────────────────────────────────────────

type TriState = 'rol' | 'si' | 'no'

type PermisosFlags = Partial<Record<PermisoKey, boolean | null | undefined>>

function getPermisoValue(source: PermisosFlags | undefined, key: PermisoKey): boolean {
  return source?.[key] === true
}

function toTriState(v: boolean | null | undefined): TriState {
  if (v === true) return 'si'
  if (v === false) return 'no'
  return 'rol'
}

function fromTriState(t: TriState): boolean | null {
  return t === 'si' ? true : t === 'no' ? false : null
}

function emptyDraft(): Record<PermisoKey, TriState> {
  return Object.fromEntries(PERMISOS.map(p => [p.key, 'rol'])) as Record<PermisoKey, TriState>
}

function buildDraft(data: PermisosUsuario): Record<PermisoKey, TriState> {
  return Object.fromEntries(
    PERMISOS.map(p => [p.key, toTriState(data[p.key as keyof PermisosUsuario] as boolean | null | undefined)])
  ) as Record<PermisoKey, TriState>
}

// ── Celda ✓/✗ ─────────────────────────────────────────────────────────────

function Celda({ value, onClick }: { value: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={onClick ? (value ? 'Quitar permiso' : 'Dar permiso') : undefined}
      className={`mx-auto w-7 h-7 rounded-full flex items-center justify-center transition-all
        ${onClick ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-default'}
        ${value ? 'bg-emerald-100 hover:bg-emerald-200' : 'bg-slate-100 hover:bg-red-100'}`}
    >
      {value
        ? <Check size={13} className="text-emerald-600" strokeWidth={2.5} />
        : <X size={13} className="text-slate-400" strokeWidth={2.5} />
      }
    </button>
  )
}

// ── Celda override (tri-state compacto) ───────────────────────────────────

function CeldaOverride({
  value, rolDefault, onChange,
}: {
  value: TriState
  rolDefault: boolean
  onChange: (v: TriState) => void
}) {
  const efectivo = value === 'rol' ? rolDefault : value === 'si'

  return (
    <div className="flex flex-col items-center gap-1">
      <Celda value={efectivo} />
      <div className="flex rounded overflow-hidden border border-slate-200 text-[9px] divide-x divide-slate-200">
        {(['rol', 'si', 'no'] as TriState[]).map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-1.5 py-0.5 font-semibold transition-colors ${
              value === opt
                ? opt === 'rol'
                  ? 'bg-slate-600 text-white'
                  : opt === 'si'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-red-500 text-white'
                : 'bg-white text-slate-400 hover:bg-slate-50'
            }`}
          >
            {opt === 'rol' ? 'Rol' : opt === 'si' ? 'Sí' : 'No'}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Tipo de modo ──────────────────────────────────────────────────────────

type Modo = 'roles' | 'usuario'

// ── Página principal ──────────────────────────────────────────────────────

export default function PermisosPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const { getLabelForRol, getColorForRol } = useRoles()
  const [modo, setModo] = useState<Modo>('roles')

  // ── Estado modo Roles ─────────────────────────────────────────────────

  const [rolEditing, setRolEditing] = useState<string | null>(null)
  const [rolDraft, setRolDraft] = useState<Record<PermisoKey, boolean>>({} as Record<PermisoKey, boolean>)

  const { data: permisosRoles = [], isLoading: loadingRoles } = useQuery({
    queryKey: ['permisos-rol'],
    queryFn: () => permisosRolApi.getAll(),
  })

  const rolMap = Object.fromEntries(permisosRoles.map(r => [r.rol, r])) as Record<string, PermisosRol>

  const startEdit = (rol: string) => {
    const current = rolMap[rol]
    if (!current) return

    setRolDraft(
      Object.fromEntries(
        PERMISOS.map(p => [p.key, getPermisoValue(current, p.key)])
      ) as Record<PermisoKey, boolean>
    )

    setRolEditing(rol)
  }

  const cancelEdit = () => setRolEditing(null)

  const guardarRol = useMutation({
    mutationFn: () => permisosRolApi.update(rolEditing!, rolDraft as Omit<PermisosRol, 'rol'>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permisos-rol'] })
      setRolEditing(null)
      success('Permisos del rol actualizados')
    },
    onError: (e) => error(errMsg(e)),
  })

  // ── Estado modo Usuario ───────────────────────────────────────────────

  const [usuarioId, setUsuarioId] = useState<number | null>(null)
  const [userDraft, setUserDraft] = useState<Record<PermisoKey, TriState>>(emptyDraft)

  const { data: usuarios = [], isLoading: loadingUsuarios } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => usuariosApi.getAll(),
  })

  const { data: permisosActuales, isLoading: loadingPermisos } = useQuery({
    queryKey: ['permisos', usuarioId],
    queryFn: () => permisosApi.get(usuarioId!),
    enabled: !!usuarioId,
  })

  useEffect(() => {
    if (permisosActuales) setUserDraft(buildDraft(permisosActuales))
    else if (usuarioId) setUserDraft(emptyDraft())
  }, [permisosActuales, usuarioId])

  const guardarUsuario = useMutation({
    mutationFn: () => {
      const dto: PermisosUsuario = {}

      PERMISOS.forEach(p => {
        dto[p.key as keyof PermisosUsuario] = fromTriState(userDraft[p.key]) as PermisosUsuario[keyof PermisosUsuario]
      })

      return permisosApi.update(usuarioId!, dto)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permisos', usuarioId] })
      success('Permisos del usuario actualizados')
    },
    onError: (e) => error(errMsg(e)),
  })

  const resetearUsuario = useMutation({
    mutationFn: () => permisosApi.reset(usuarioId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permisos', usuarioId] })
      setUserDraft(emptyDraft())
      success('Overrides eliminados — el usuario usa los permisos de su rol')
    },
    onError: (e) => error(errMsg(e)),
  })

  const usuarioSel = usuarios.find(u => u.id === usuarioId)
  const rolDelUser = usuarioSel?.rol ?? ''
  const rolBaseUser = rolMap[rolDelUser] as PermisosRol | undefined
  const hayOverrides = Object.values(userDraft).some(v => v !== 'rol')

  return (
    <div className="space-y-5">
      {/* Header + tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <ShieldCheck size={22} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Permisos</h2>
            <p className="text-sm text-slate-400">Configura el acceso por rol o ajusta overrides individuales por usuario</p>
          </div>
        </div>

        <div className="flex rounded-xl overflow-hidden border border-slate-200 text-sm shadow-sm">
          <button
            onClick={() => setModo('roles')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
              modo === 'roles' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Shield size={15} /> Por Rol
          </button>

          <button
            onClick={() => setModo('usuario')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-l border-slate-200 ${
              modo === 'usuario' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Users size={15} /> Por Usuario
          </button>
        </div>
      </div>

      {/* ═══ MODO: Por Rol ══════════════════════════════════════════════════ */}
      {modo === 'roles' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loadingRoles ? (
            <div className="p-16 text-center text-slate-400 text-sm">Cargando permisos…</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left px-5 py-3 bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wide w-52 sticky left-0 z-10 border-r border-slate-200">
                        Permiso
                      </th>

                      {permisosRoles.map(({ rol }) => (
                        <th key={rol} className="px-3 py-3 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              {getLabelForRol(rol)}
                            </span>

                            {rolEditing === rol ? (
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => guardarRol.mutate()}
                                  disabled={guardarRol.isPending}
                                  className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors"
                                >
                                  {guardarRol.isPending ? '…' : 'Guardar'}
                                </button>

                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="text-[10px] font-semibold px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full hover:bg-slate-300 transition-colors"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEdit(rol)}
                                className="text-[10px] font-medium px-2 py-0.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors flex items-center gap-1"
                              >
                                <Pencil size={9} /> Editar
                              </button>
                            )}
                          </div>
                        </th>
                      ))}

                    </tr>
                  </thead>

                  <tbody>
                    {GRUPOS.map((grupo, gi) => {
                      const items = PERMISOS.filter(p => p.grupo === grupo)

                      return [
                        <tr key={`g-${grupo}`} className={gi > 0 ? 'border-t-2 border-slate-100' : ''}>
                          <td colSpan={permisosRoles.length + 1} className="px-5 py-1.5 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-widest sticky left-0">
                            {grupo}
                          </td>
                        </tr>,

                        ...items.map((perm, pi) => (
                          <tr
                            key={perm.key}
                            className={`border-t border-slate-100 ${pi % 2 === 0 ? '' : 'bg-slate-50/40'} hover:bg-blue-50/20 transition-colors`}
                          >
                            <td className="px-5 py-2.5 text-slate-700 font-medium sticky left-0 bg-white border-r border-slate-100 text-sm">
                              {perm.label}
                            </td>

                            {permisosRoles.map(({ rol }) => {
                              const isEditing = rolEditing === rol
                              const val = isEditing
                                ? rolDraft[perm.key]
                                : getPermisoValue(rolMap[rol], perm.key)

                              return (
                                <td
                                  key={rol}
                                  className={`px-3 py-2.5 text-center ${isEditing ? 'bg-indigo-50/30 ring-1 ring-inset ring-indigo-200' : ''}`}
                                >
                                  <Celda
                                    value={val}
                                    onClick={isEditing ? () => setRolDraft(prev => ({ ...prev, [perm.key]: !prev[perm.key] })) : undefined}
                                  />
                                </td>
                              )
                            })}
                          </tr>
                        )),
                      ]
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center gap-5 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 inline-flex items-center justify-center">
                    <Check size={9} className="text-emerald-600" strokeWidth={2.5} />
                  </span>
                  Tiene acceso
                </span>

                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-slate-100 inline-flex items-center justify-center">
                    <X size={9} className="text-slate-400" strokeWidth={2.5} />
                  </span>
                  Sin acceso
                </span>

                {!rolEditing && (
                  <span className="ml-auto text-slate-400 italic flex items-center gap-1">
                    <Pencil size={10} /> Haz clic en "Editar" bajo el nombre del rol para modificarlo
                  </span>
                )}

                {rolEditing && (
                  <span className="ml-auto text-indigo-600 font-medium flex items-center gap-1">
                    Editando <span className={`px-1.5 py-0.5 rounded-full text-[10px] text-white ${getColorForRol(rolEditing)}`}>{getLabelForRol(rolEditing)}</span>
                    — haz clic en las celdas para alternar
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ MODO: Por Usuario ══════════════════════════════════════════════ */}
      {modo === 'usuario' && (
        <div className="flex gap-5 items-start">
          {/* Lista de usuarios */}
          <div className="w-56 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Usuarios</p>
            </div>

            {loadingUsuarios ? (
              <div className="p-4 text-sm text-slate-400">Cargando…</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {usuarios.filter(u => u.activo).map(u => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setUsuarioId(u.id)
                        setUserDraft(emptyDraft())
                      }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors ${usuarioId === u.id ? 'bg-indigo-50' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${usuarioId === u.id ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                          <User size={12} className={usuarioId === u.id ? 'text-white' : 'text-slate-500'} />
                        </div>

                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${usuarioId === u.id ? 'text-indigo-700' : 'text-slate-700'}`}>
                            {u.nombre}
                          </p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white ${getColorForRol(u.rol)}`}>
                            {getLabelForRol(u.rol)}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tabla */}
          <div className="flex-1 min-w-0">
            {!usuarioId ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center text-slate-400">
                <Users size={36} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Selecciona un usuario</p>
                <p className="text-xs mt-1">para ver y ajustar sus permisos individuales</p>
              </div>
            ) : loadingPermisos ? (
              <div className="rounded-2xl border border-slate-200 p-16 text-center text-slate-400 text-sm">Cargando…</div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
                      <User size={15} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{usuarioSel?.nombre}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white ${getColorForRol(usuarioSel?.rol ?? '')}`}>
                        {getLabelForRol(usuarioSel?.rol ?? '')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {hayOverrides && (
                      <Button variant="ghost" size="sm" onClick={() => resetearUsuario.mutate()} loading={resetearUsuario.isPending}>
                        <RotateCcw size={12} /> Quitar overrides
                      </Button>
                    )}

                    <Button size="sm" onClick={() => guardarUsuario.mutate()} loading={guardarUsuario.isPending}>
                      <Save size={12} /> Guardar
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs">
                        <th className="text-left px-5 py-2.5 text-slate-500 font-semibold uppercase tracking-wide sticky left-0 bg-slate-50 border-r border-slate-200 w-52">
                          Permiso
                        </th>

                        {permisosRoles.map(({ rol: r }) => (
                          <th key={r} className={`px-3 py-2.5 text-center ${r === rolDelUser ? 'border-x border-slate-300' : 'opacity-50'}`}>
                            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full text-white ${getColorForRol(r)}`}>
                              {getLabelForRol(r)}{r === rolDelUser ? ' ★' : ''}
                            </span>
                          </th>
                        ))}

                        <th className="px-4 py-2.5 text-center bg-indigo-50 border-l border-indigo-200 min-w-[110px]">
                          <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">Override</span>
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {GRUPOS.map((grupo, gi) => {
                        const items = PERMISOS.filter(p => p.grupo === grupo)

                        return [
                          <tr key={`g-${grupo}`} className={gi > 0 ? 'border-t-2 border-slate-100' : ''}>
                            <td colSpan={permisosRoles.length + 2} className="px-5 py-1.5 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-widest sticky left-0">
                              {grupo}
                            </td>
                          </tr>,

                          ...items.map((perm, pi) => {
                            const rolBase = getPermisoValue(rolBaseUser, perm.key)

                            return (
                              <tr
                                key={perm.key}
                                className={`border-t border-slate-100 ${pi % 2 === 0 ? '' : 'bg-slate-50/30'} hover:bg-indigo-50/10 transition-colors`}
                              >
                                <td className="px-5 py-2.5 text-slate-700 font-medium sticky left-0 bg-white border-r border-slate-100">
                                  {perm.label}
                                </td>

                                {permisosRoles.map(({ rol: r }) => {
                                  const val = getPermisoValue(rolMap[r], perm.key)

                                  return (
                                    <td key={r} className={`px-3 py-2.5 text-center ${r === rolDelUser ? 'border-x border-slate-200 bg-slate-50/50' : 'opacity-40'}`}>
                                      <Celda value={val} />
                                    </td>
                                  )
                                })}

                                <td className="px-4 py-2.5 text-center bg-indigo-50/40 border-l border-indigo-100">
                                  <CeldaOverride
                                    value={userDraft[perm.key] ?? 'rol'}
                                    rolDefault={rolBase}
                                    onChange={v => setUserDraft(prev => ({ ...prev, [perm.key]: v }))}
                                  />
                                </td>
                              </tr>
                            )
                          }),
                        ]
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center gap-5 text-xs text-slate-500 flex-wrap">
                  <span className="font-semibold text-slate-600">Override:</span>
                  <span><span className="font-mono bg-slate-600 text-white px-1.5 rounded text-[10px]">Rol</span> — usa el permiso del rol ★</span>
                  <span><span className="font-mono bg-emerald-500 text-white px-1.5 rounded text-[10px]">Sí</span> — forzar acceso</span>
                  <span><span className="font-mono bg-red-500 text-white px-1.5 rounded text-[10px]">No</span> — denegar acceso</span>
                  <span className="ml-auto text-slate-400">★ = rol del usuario seleccionado</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}