import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Plus, Pencil, Trash2, ShieldCheck, Lock } from 'lucide-react'
import { rolesApi } from '../../api'
import type { RolDefinicion, CreateRolDto, UpdateRolDto } from '../../types'
import { useToast, errMsg } from '../../context/ToastContext'
import Button from '../../components/ui/Button'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Input from '../../components/ui/Input'

// ── Roles base del sistema (opciones para herencia) ───────────────────────
const ROLES_BASE = [
  { value: 'AdminSistema',   label: 'Admin Sistema' },
  { value: 'GerenteGeneral', label: 'Gerente General' },
  { value: 'Cajero',         label: 'Cajero' },
  { value: 'Inventario',     label: 'Inventario' },
  { value: 'Finanzas',       label: 'Finanzas' },
]

// ── Paleta de colores disponibles ─────────────────────────────────────────
const COLORES = [
  { value: 'bg-red-600',     label: 'Rojo' },
  { value: 'bg-orange-500',  label: 'Naranja' },
  { value: 'bg-amber-500',   label: 'Ámbar' },
  { value: 'bg-yellow-500',  label: 'Amarillo' },
  { value: 'bg-lime-600',    label: 'Lima' },
  { value: 'bg-green-600',   label: 'Verde' },
  { value: 'bg-teal-600',    label: 'Teal' },
  { value: 'bg-cyan-600',    label: 'Cian' },
  { value: 'bg-sky-600',     label: 'Azul cielo' },
  { value: 'bg-blue-600',    label: 'Azul' },
  { value: 'bg-indigo-600',  label: 'Índigo' },
  { value: 'bg-violet-600',  label: 'Violeta' },
  { value: 'bg-purple-600',  label: 'Morado' },
  { value: 'bg-fuchsia-600', label: 'Fucsia' },
  { value: 'bg-pink-600',    label: 'Rosa' },
  { value: 'bg-rose-600',    label: 'Rosado' },
  { value: 'bg-slate-500',   label: 'Gris' },
]

const inputCls = "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"

// ── Burbuja de color ──────────────────────────────────────────────────────
function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-600 mb-1.5">Color</p>
      <div className="flex flex-wrap gap-1.5">
        {COLORES.map(c => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            onClick={() => onChange(c.value)}
            className={`w-6 h-6 rounded-full transition-all ${c.value} ${
              value === c.value ? 'ring-2 ring-offset-1 ring-slate-700 scale-110' : 'hover:scale-105'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

// ── Chip del rol ──────────────────────────────────────────────────────────
function RolChip({ rol }: { rol: RolDefinicion }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-white rounded-full ${rol.color}`}>
      {rol.esSistema ? <Lock size={10} /> : <Shield size={10} />}
      {rol.label}
    </span>
  )
}

// ── Página ────────────────────────────────────────────────────────────────
export default function RolesPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()

  const [crearModal, setCrearModal] = useState(false)
  const [editando, setEditando]     = useState<RolDefinicion | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState<RolDefinicion | null>(null)

  // Crear
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoLabel,  setNuevoLabel]  = useState('')
  const [nuevoBase,   setNuevoBase]   = useState('Cajero')
  const [nuevoColor,  setNuevoColor]  = useState('bg-slate-500')

  // Editar
  const [editLabel, setEditLabel] = useState('')
  const [editColor, setEditColor] = useState('bg-slate-500')

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: rolesApi.getAll,
  })

  const crear = useMutation({
    mutationFn: (dto: CreateRolDto) => rolesApi.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      success('Rol creado')
      setCrearModal(false)
      setNuevoNombre(''); setNuevoLabel(''); setNuevoBase('Cajero'); setNuevoColor('bg-slate-500')
    },
    onError: (e) => error(errMsg(e)),
  })

  const editar = useMutation({
    mutationFn: ({ nombre, dto }: { nombre: string; dto: UpdateRolDto }) =>
      rolesApi.update(nombre, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      success('Rol actualizado')
      setEditando(null)
    },
    onError: (e) => error(errMsg(e)),
  })

  const eliminar = useMutation({
    mutationFn: (nombre: string) => rolesApi.delete(nombre),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      success('Rol eliminado')
      setConfirmarEliminar(null)
    },
    onError: (e) => error(errMsg(e)),
  })

  const openEditar = (rol: RolDefinicion) => {
    setEditando(rol)
    setEditLabel(rol.label)
    setEditColor(rol.color)
  }

  const sistemaRoles  = roles.filter(r => r.esSistema)
  const customRoles   = roles.filter(r => !r.esSistema)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl">
            <ShieldCheck size={22} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Gestión de roles</h2>
            <p className="text-sm text-slate-400">Crea roles personalizados y ajusta sus etiquetas y colores</p>
          </div>
        </div>
        <Button icon={<Plus size={15} />} onClick={() => setCrearModal(true)}>
          Nuevo rol
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Roles del sistema ──────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-slate-500" />
              <h3 className="font-semibold text-slate-700">Roles del sistema</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">No se pueden eliminar. Solo puedes cambiar la etiqueta y el color.</p>
          </CardHeader>
          <CardBody className="divide-y divide-slate-100 py-0 px-0">
            {isLoading ? (
              <p className="p-4 text-sm text-slate-400">Cargando…</p>
            ) : sistemaRoles.map(rol => (
              <div key={rol.nombre} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${rol.color}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{rol.label}</p>
                    <p className="text-xs text-slate-400 font-mono">{rol.nombre}</p>
                  </div>
                </div>
                <button
                  onClick={() => openEditar(rol)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
                >
                  <Pencil size={14} />
                </button>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* ── Roles personalizados ────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-slate-500" />
              <h3 className="font-semibold text-slate-700">Roles personalizados</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Heredan la autorización de un rol base del sistema.</p>
          </CardHeader>
          <CardBody className="divide-y divide-slate-100 py-0 px-0">
            {isLoading ? (
              <p className="p-4 text-sm text-slate-400">Cargando…</p>
            ) : customRoles.length === 0 ? (
              <div className="p-6 text-center">
                <Shield size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">No hay roles personalizados</p>
                <p className="text-xs text-slate-400 mt-0.5">Crea uno con el botón "Nuevo rol"</p>
              </div>
            ) : customRoles.map(rol => (
              <div key={rol.nombre} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${rol.color}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{rol.label}</p>
                    <p className="text-xs text-slate-400 font-mono">{rol.nombre}</p>
                    <p className="text-xs text-slate-400">
                      Basado en: <span className="text-slate-600">{rol.rolBase}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditar(rol)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmarEliminar(rol)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* ── Modal: Crear rol ─────────────────────────────────────────────── */}
      {crearModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Crear rol personalizado</h3>
            </div>
            <div className="p-5 space-y-4">
              <Input
                label="Nombre interno *"
                placeholder="Ej: VendedorSenior (sin espacios)"
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value.replace(/\s/g, ''))}
              />
              <Input
                label="Etiqueta visible *"
                placeholder="Ej: Vendedor Senior"
                value={nuevoLabel}
                onChange={e => setNuevoLabel(e.target.value)}
              />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Rol base *</label>
                <select
                  className={inputCls}
                  value={nuevoBase}
                  onChange={e => setNuevoBase(e.target.value)}
                >
                  {ROLES_BASE.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">Determina qué puede hacer el rol a nivel de seguridad de la API.</p>
              </div>
              <ColorPicker value={nuevoColor} onChange={setNuevoColor} />
              <div className="pt-1">
                <p className="text-xs text-slate-500 mb-1">Vista previa</p>
                <RolChip rol={{ nombre: nuevoNombre || 'NuevoRol', label: nuevoLabel || 'Nuevo Rol', color: nuevoColor, esSistema: false, rolBase: nuevoBase }} />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCrearModal(false)}>Cancelar</Button>
              <Button
                loading={crear.isPending}
                disabled={!nuevoNombre || !nuevoLabel}
                onClick={() => crear.mutate({ nombre: nuevoNombre, label: nuevoLabel, rolBase: nuevoBase, color: nuevoColor })}
              >
                Crear rol
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Editar rol ────────────────────────────────────────────── */}
      {editando && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Editar rol</h3>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">{editando.nombre}</p>
            </div>
            <div className="p-5 space-y-4">
              <Input
                label="Etiqueta visible *"
                placeholder="Ej: Gerente de Tienda"
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
              />
              <ColorPicker value={editColor} onChange={setEditColor} />
              <div className="pt-1">
                <p className="text-xs text-slate-500 mb-1">Vista previa</p>
                <RolChip rol={{ ...editando, label: editLabel, color: editColor }} />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button
                loading={editar.isPending}
                disabled={!editLabel}
                onClick={() => editar.mutate({ nombre: editando.nombre, dto: { label: editLabel, color: editColor } })}
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar eliminar ────────────────────────────────────── */}
      {confirmarEliminar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-100 rounded-xl">
                  <Trash2 size={18} className="text-red-600" />
                </div>
                <h3 className="font-semibold text-slate-800">Eliminar rol</h3>
              </div>
              <p className="text-sm text-slate-600">
                ¿Eliminar el rol <span className="font-medium">{confirmarEliminar.label}</span>?
                Esta acción no se puede deshacer. Si hay usuarios con este rol, no se podrá eliminar.
              </p>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmarEliminar(null)}>Cancelar</Button>
              <Button
                loading={eliminar.isPending}
                onClick={() => eliminar.mutate(confirmarEliminar.nombre)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
