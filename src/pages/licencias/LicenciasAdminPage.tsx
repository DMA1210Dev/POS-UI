import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, RefreshCw, X, CheckCircle, Clock, CreditCard, Lock, Loader2 } from 'lucide-react'
import { licenciasAdminApi, type LicenciaAdmin, type CreateLicenciaDto, type UpdateLicenciaDto } from '../../api'

// ── Helpers de estado ─────────────────────────────────────────────────────────
const ESTADOS = [
  { value: 'activo',         label: 'Activo',             badge: 'bg-green-100 text-green-700',  icon: CheckCircle },
  { value: 'mantenimiento',  label: 'Mantenimiento',      badge: 'bg-amber-100 text-amber-700',  icon: Clock },
  { value: 'bloqueado_pago', label: 'Bloqueado por pago', badge: 'bg-orange-100 text-orange-700', icon: CreditCard },
  { value: 'bloqueado',      label: 'Bloqueado',          badge: 'bg-red-100 text-red-700',      icon: Lock },
] as const

type EstadoValue = typeof ESTADOS[number]['value']

function EstadoBadge({ estado }: { estado: EstadoValue }) {
  const def = ESTADOS.find(e => e.value === estado) ?? ESTADOS[3]
  const Icon = def.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${def.badge}`}>
      <Icon size={12} />
      {def.label}
    </span>
  )
}

// ── Modal crear / editar ──────────────────────────────────────────────────────
interface ModalProps {
  licencia: LicenciaAdmin | null   // null = crear
  onClose: () => void
  onSaved: () => void
}

function LicenciaModal({ licencia, onClose, onSaved }: ModalProps) {
  const [sistemaKey,       setSistemaKey]       = useState(licencia?.sistemaKey       ?? '')
  const [nombreCliente,    setNombreCliente]    = useState(licencia?.nombreCliente    ?? '')
  const [estado,           setEstado]           = useState<EstadoValue>(licencia?.estado ?? 'activo')
  const [mensaje,          setMensaje]          = useState(licencia?.mensaje          ?? '')
  const [fechaVencimiento, setFechaVencimiento] = useState(
    licencia?.fechaVencimiento ? licencia.fechaVencimiento.slice(0, 10) : ''
  )
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (licencia) {
        const dto: UpdateLicenciaDto = {
          nombreCliente,
          estado,
          mensaje:          mensaje || null,
          fechaVencimiento: fechaVencimiento || null,
        }
        await licenciasAdminApi.actualizar(licencia.sistemaKey, dto)
      } else {
        const dto: CreateLicenciaDto = {
          sistemaKey,
          nombreCliente,
          estado,
          mensaje:          mensaje || null,
          fechaVencimiento: fechaVencimiento || null,
        }
        await licenciasAdminApi.crear(dto)
      }
      onSaved()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error ?? 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-slate-800">
            {licencia ? 'Editar licencia' : 'Nueva licencia'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {!licencia && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SistemaKey *</label>
              <input
                value={sistemaKey}
                onChange={e => setSistemaKey(e.target.value.toUpperCase().replace(/\s/g, '-'))}
                placeholder="POS-CLIENTE-01"
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">Identificador único que va en el appsettings.json del deployment.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del cliente *</label>
            <input
              value={nombreCliente}
              onChange={e => setNombreCliente(e.target.value)}
              placeholder="Farmacia San José"
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
            <select
              value={estado}
              onChange={e => setEstado(e.target.value as EstadoValue)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ESTADOS.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Fecha de vencimiento
            </label>
            <input
              type="date"
              value={fechaVencimiento}
              onChange={e => setFechaVencimiento(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Mensaje personalizado <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              rows={2}
              placeholder="Mensaje que verá el usuario al estar bloqueado..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {licencia ? 'Guardar cambios' : 'Crear licencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function LicenciasAdminPage() {
  const [licencias, setLicencias] = useState<LicenciaAdmin[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [modal,     setModal]     = useState<'crear' | LicenciaAdmin | null>(null)
  const [deleting,  setDeleting]  = useState<string | null>(null)

  const cargar = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await licenciasAdminApi.listar()
      setLicencias(data)
    } catch {
      setError('No se pudo conectar a la base de datos de licencias. Verifica la configuración.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const handleDelete = async (key: string) => {
    if (!confirm(`¿Eliminar la licencia "${key}"? Esta acción no se puede deshacer.`)) return
    setDeleting(key)
    try {
      await licenciasAdminApi.eliminar(key)
      setLicencias(prev => prev.filter(l => l.sistemaKey !== key))
    } catch {
      alert('Error al eliminar')
    } finally {
      setDeleting(null)
    }
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Gestión de Licencias</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Administra el acceso de cada deployment del sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={cargar}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={14} />
            Actualizar
          </button>
          <button
            onClick={() => setModal('crear')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={14} />
            Nueva licencia
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={cargar} className="mt-3 text-sm text-red-600 hover:underline">Reintentar</button>
        </div>
      ) : licencias.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-slate-500 text-sm">No hay licencias registradas.</p>
          <button
            onClick={() => setModal('crear')}
            className="mt-3 text-sm text-blue-600 hover:underline"
          >
            Crear la primera licencia
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">SistemaKey</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Vencimiento</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Actualizado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {licencias.map(l => (
                <tr key={l.sistemaKey} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-700 text-xs">{l.sistemaKey}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">{l.nombreCliente}</td>
                  <td className="px-4 py-3">
                    <EstadoBadge estado={l.estado} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(l.fechaVencimiento)}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(l.ultimaActualizacion)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setModal(l)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(l.sistemaKey)}
                        disabled={deleting === l.sistemaKey}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                        title="Eliminar"
                      >
                        {deleting === l.sistemaKey
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">¿Cómo funciona?</p>
        <p>Cada deployment del API usa su <code className="bg-blue-100 px-1 rounded text-xs">SistemaKey</code> configurada en <code className="bg-blue-100 px-1 rounded text-xs">appsettings.json → Licencia:SistemaKey</code>.</p>
        <p>Al cambiar el estado aquí, el cambio se refleja en el deployment correspondiente dentro de los minutos configurados en caché.</p>
      </div>

      {/* Modal */}
      {modal && (
        <LicenciaModal
          licencia={modal === 'crear' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargar() }}
        />
      )}
    </div>
  )
}
