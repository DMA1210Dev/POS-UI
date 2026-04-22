import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Search, X, Edit2, Trash2, User, Building2,
  Briefcase, DollarSign, CalendarDays, MapPin, Umbrella,
  ChevronDown, ChevronUp, UserCheck, UserX, Loader2,
} from 'lucide-react'
import api from '../../lib/axios'
import type { EmpleadoListDto, EmpleadoDetailDto, SaveEmpleadoDto, UsuarioOpcionDto } from '../../types'

// ── helpers ───────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 })
const fmtSalario = (v?: number | null) => v != null ? fmt.format(v) : '—'

function fmtFecha(iso?: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function proximoCumple(iso?: string | null): string | null {
  if (!iso) return null
  const [, m, d] = iso.split('-').map(Number)
  const hoy = new Date()
  let anio = hoy.getFullYear()
  let fecha = new Date(anio, m - 1, d)
  if (fecha < hoy) fecha = new Date(anio + 1, m - 1, d)
  const dias = Math.ceil((fecha.getTime() - hoy.getTime()) / 86_400_000)
  return dias <= 30 ? `🎂 en ${dias}d` : null
}

// ── types ─────────────────────────────────────────────────────────────────

type SortField = 'nombre' | 'posicion' | 'departamento' | 'salario'
type SortDir   = 'asc' | 'desc'

interface FormState {
  nombre:          string
  posicion:        string
  departamento:    string
  salario:         string
  direccion:       string
  vacacionesDias:  string
  fechaCumpleanos: string
  usuarioId:       string
  activo:          boolean
}

const FORM_VACIO: FormState = {
  nombre: '', posicion: '', departamento: '', salario: '',
  direccion: '', vacacionesDias: '', fechaCumpleanos: '', usuarioId: '', activo: true,
}

// ── componente principal ──────────────────────────────────────────────────

export default function EmpleadosPage() {
  const [empleados,  setEmpleados]  = useState<EmpleadoListDto[]>([])
  const [usuarios,   setUsuarios]   = useState<UsuarioOpcionDto[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [busqueda,   setBusqueda]   = useState('')
  const [soloActivos, setSoloActivos] = useState(true)
  const [sort,       setSort]       = useState<{ field: SortField; dir: SortDir }>({ field: 'nombre', dir: 'asc' })

  // Modal: null = cerrado, 'nuevo' = crear, number = ver/editar empleado
  const [modal,      setModal]      = useState<null | 'nuevo' | number>(null)
  const [detalle,    setDetalle]    = useState<EmpleadoDetailDto | null>(null)
  const [editando,   setEditando]   = useState(false)
  const [form,       setForm]       = useState<FormState>(FORM_VACIO)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')

  // ── carga inicial ────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [empRes, usrRes] = await Promise.all([
        api.get<EmpleadoListDto[]>('/empleados', { params: { soloActivos } }),
        api.get<UsuarioOpcionDto[]>('/empleados/usuarios-disponibles'),
      ])
      setEmpleados(empRes.data)
      setUsuarios(usrRes.data)
    } catch {
      setError('No se pudo cargar la lista de empleados.')
    } finally {
      setLoading(false)
    }
  }, [soloActivos])

  useEffect(() => { cargar() }, [cargar])

  // ── filtrar y ordenar ─────────────────────────────────────────────────────
  const filtrados = empleados
    .filter(e => {
      const q = busqueda.toLowerCase()
      return (
        e.nombre.toLowerCase().includes(q) ||
        (e.posicion?.toLowerCase().includes(q) ?? false) ||
        (e.departamento?.toLowerCase().includes(q) ?? false)
      )
    })
    .sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1
      const va = (a[sort.field] ?? '') as string | number
      const vb = (b[sort.field] ?? '') as string | number
      return va < vb ? -dir : va > vb ? dir : 0
    })

  // ── abrir popup detalle ────────────────────────────────────────────────
  const abrirDetalle = async (id: number) => {
    setModal(id)
    setEditando(false)
    setDetalle(null)
    setFormError('')
    try {
      const res = await api.get<EmpleadoDetailDto>(`/empleados/${id}`)
      setDetalle(res.data)
    } catch {
      setFormError('No se pudo cargar el detalle.')
    }
  }

  // ── abrir formulario nuevo ────────────────────────────────────────────────
  const abrirNuevo = () => {
    setModal('nuevo')
    setEditando(true)
    setDetalle(null)
    setForm(FORM_VACIO)
    setFormError('')
  }

  // ── activar edición en popup ───────────────────────────────────────────
  const activarEdicion = () => {
    if (!detalle) return
    setForm({
      nombre:          detalle.nombre,
      posicion:        detalle.posicion ?? '',
      departamento:    detalle.departamento ?? '',
      salario:         detalle.salario != null ? String(detalle.salario) : '',
      direccion:       detalle.direccion ?? '',
      vacacionesDias:  detalle.vacacionesDias != null ? String(detalle.vacacionesDias) : '',
      fechaCumpleanos: detalle.fechaCumpleanos ?? '',
      usuarioId:       detalle.usuarioId != null ? String(detalle.usuarioId) : '',
      activo:          detalle.activo,
    })
    setFormError('')
    setEditando(true)
  }

  // ── guardar ────────────────────────────────────────────────────────────
  const guardar = async () => {
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio.'); return }
    setSaving(true)
    setFormError('')
    const payload: SaveEmpleadoDto = {
      nombre:          form.nombre.trim(),
      posicion:        form.posicion.trim() || undefined,
      departamento:    form.departamento.trim() || undefined,
      salario:         form.salario !== '' ? Number(form.salario) : null,
      direccion:       form.direccion.trim() || undefined,
      vacacionesDias:  form.vacacionesDias !== '' ? Number(form.vacacionesDias) : null,
      fechaCumpleanos: form.fechaCumpleanos || null,
      usuarioId:       form.usuarioId !== '' ? Number(form.usuarioId) : null,
      activo:          form.activo,
    }
    try {
      if (modal === 'nuevo') {
        await api.post('/empleados', payload)
      } else {
        await api.put(`/empleados/${modal}`, payload)
      }
      await cargar()
      setModal(null)
    } catch (err: any) {
      setFormError(err.response?.data?.error ?? 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  // ── desactivar ────────────────────────────────────────────────────────
  const desactivar = async (id: number) => {
    if (!confirm('¿Desactivar este empleado?')) return
    try {
      await api.delete(`/empleados/${id}`)
      await cargar()
      setModal(null)
    } catch {
      alert('No se pudo desactivar.')
    }
  }

  // ── sort helper ────────────────────────────────────────────────────────
  const toggleSort = (field: SortField) =>
    setSort(prev =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' }
    )

  const SortIcon = ({ field }: { field: SortField }) =>
    sort.field === field
      ? sort.dir === 'asc' ? <ChevronUp size={13} className="inline ml-0.5" /> : <ChevronDown size={13} className="inline ml-0.5" />
      : null

  // ── render ────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Empleados</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión del personal del comercio</p>
        </div>
        <button
          onClick={abrirNuevo}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nuevo empleado
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, posición, departamento…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={e => setSoloActivos(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Solo activos
        </label>
        <span className="text-xs text-gray-400">{filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Error global */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-blue-600" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Briefcase size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay empleados que mostrar.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th
                    className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 whitespace-nowrap"
                    onClick={() => toggleSort('nombre')}
                  >
                    Nombre <SortIcon field="nombre" />
                  </th>
                  <th
                    className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 whitespace-nowrap"
                    onClick={() => toggleSort('posicion')}
                  >
                    Posición <SortIcon field="posicion" />
                  </th>
                  <th
                    className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 whitespace-nowrap"
                    onClick={() => toggleSort('departamento')}
                  >
                    Departamento <SortIcon field="departamento" />
                  </th>
                  <th
                    className="text-right px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 whitespace-nowrap"
                    onClick={() => toggleSort('salario')}
                  >
                    Salario <SortIcon field="salario" />
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Vacaciones</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Cumpleaños</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Usuario</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.map(emp => {
                  const cumple = proximoCumple(emp.fechaCumpleanos)
                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                      onClick={() => abrirDetalle(emp.id)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{emp.nombre}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{emp.posicion ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{emp.departamento ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700 whitespace-nowrap">
                        {fmtSalario(emp.salario)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">
                        {emp.vacacionesDias != null ? `${emp.vacacionesDias}d` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {emp.fechaCumpleanos ? (
                          <span className="text-gray-600">
                            {fmtFecha(emp.fechaCumpleanos)}
                            {cumple && <span className="ml-1 text-orange-500 text-xs font-medium">{cumple}</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {emp.nombreUsuario ? (
                          <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-xs font-medium">
                            <User size={11} />
                            {emp.nombreUsuario}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Sin usuario</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {emp.activo ? (
                          <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs font-medium">
                            <UserCheck size={11} />Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full text-xs font-medium">
                            <UserX size={11} />Inactivo
                          </span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={() => abrirDetalle(emp.id)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded transition-colors"
                          title="Ver detalle"
                        >
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL ─────────────────────────────────────────────────────────── */}
      {modal !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Header del modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {modal === 'nuevo' ? 'Nuevo empleado' : editando ? 'Editar empleado' : 'Detalle del empleado'}
              </h2>
              <button
                onClick={() => setModal(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">

              {/* ── Vista detalle (no editando) ──────────────────────────── */}
              {!editando && detalle && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoField icon={<User size={14} />}       label="Nombre"       value={detalle.nombre} />
                    <InfoField icon={<Briefcase size={14} />}  label="Posición"     value={detalle.posicion} />
                    <InfoField icon={<Building2 size={14} />}  label="Departamento" value={detalle.departamento} />
                    <InfoField icon={<DollarSign size={14} />} label="Salario"      value={fmtSalario(detalle.salario)} />
                    <InfoField icon={<Umbrella size={14} />}   label="Vacaciones"   value={detalle.vacacionesDias != null ? `${detalle.vacacionesDias} días/año` : undefined} />
                    <InfoField icon={<CalendarDays size={14} />} label="Cumpleaños" value={fmtFecha(detalle.fechaCumpleanos)} />
                  </div>
                  {detalle.direccion && (
                    <InfoField icon={<MapPin size={14} />} label="Dirección" value={detalle.direccion} full />
                  )}
                  {detalle.nombreUsuario ? (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Usuario del sistema</p>
                      <p className="text-sm font-medium text-blue-900">{detalle.nombreUsuario}</p>
                      {detalle.emailUsuario && (
                        <p className="text-xs text-blue-600 mt-0.5">{detalle.emailUsuario}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Sin usuario del sistema asociado</p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-400">
                      Creado: {new Date(detalle.fechaCreacion).toLocaleDateString('es-DO')}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      detalle.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {detalle.activo ? <UserCheck size={11} /> : <UserX size={11} />}
                      {detalle.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </>
              )}

              {/* Spinner mientras carga detalle */}
              {!editando && !detalle && modal !== 'nuevo' && (
                <div className="flex justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-blue-600" />
                </div>
              )}

              {/* ── Formulario ──────────────────────────────────────────── */}
              {editando && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Nombre *" full>
                      <input
                        value={form.nombre}
                        onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Juan Pérez"
                      />
                    </FormField>

                    <FormField label="Posición">
                      <input
                        value={form.posicion}
                        onChange={e => setForm(f => ({ ...f, posicion: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Vendedor"
                      />
                    </FormField>

                    <FormField label="Departamento">
                      <input
                        value={form.departamento}
                        onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ventas"
                      />
                    </FormField>

                    <FormField label="Salario (RD$)">
                      <input
                        type="number"
                        min="0"
                        value={form.salario}
                        onChange={e => setForm(f => ({ ...f, salario: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="25000"
                      />
                    </FormField>

                    <FormField label="Vacaciones (días/año)">
                      <input
                        type="number"
                        min="0"
                        value={form.vacacionesDias}
                        onChange={e => setForm(f => ({ ...f, vacacionesDias: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="14"
                      />
                    </FormField>

                    <FormField label="Fecha de cumpleaños">
                      <input
                        type="date"
                        value={form.fechaCumpleanos}
                        onChange={e => setForm(f => ({ ...f, fechaCumpleanos: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </FormField>
                  </div>

                  <FormField label="Dirección" full>
                    <input
                      value={form.direccion}
                      onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Calle 5, Sto. Dgo."
                    />
                  </FormField>

                  <FormField label="Asociar usuario del sistema" full>
                    <select
                      value={form.usuarioId}
                      onChange={e => setForm(f => ({ ...f, usuarioId: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">— Sin usuario —</option>
                      {usuarios.map(u => (
                        <option key={u.id} value={u.id}>{u.nombre} ({u.email})</option>
                      ))}
                    </select>
                  </FormField>

                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.activo}
                      onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Empleado activo
                  </label>
                </div>
              )}

              {/* Error de formulario */}
              {formError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
              )}
            </div>

            {/* Footer del modal */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl gap-3">
              {/* Acciones izquierda */}
              <div>
                {!editando && detalle?.activo && (
                  <button
                    onClick={() => desactivar(detalle.id)}
                    className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                    Desactivar
                  </button>
                )}
              </div>
              {/* Acciones derecha */}
              <div className="flex gap-2">
                {!editando && detalle && (
                  <>
                    <button
                      onClick={() => setModal(null)}
                      className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cerrar
                    </button>
                    <button
                      onClick={activarEdicion}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      <Edit2 size={13} />
                      Editar
                    </button>
                  </>
                )}
                {editando && (
                  <>
                    <button
                      onClick={() => modal === 'nuevo' ? setModal(null) : setEditando(false)}
                      disabled={saving}
                      className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={guardar}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {saving && <Loader2 size={13} className="animate-spin" />}
                      {saving ? 'Guardando…' : 'Guardar'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── sub-componentes ────────────────────────────────────────────────────────

function InfoField({ icon, label, value, full }: {
  icon: React.ReactNode
  label: string
  value?: string | null
  full?: boolean
}) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="flex items-center gap-1 text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">
        {icon} {label}
      </p>
      <p className="text-sm text-gray-800 font-medium">{value ?? '—'}</p>
    </div>
  )
}

function FormField({ label, children, full }: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
