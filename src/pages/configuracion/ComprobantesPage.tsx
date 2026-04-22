import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, FlaskConical, Layers, Upload, ChevronDown } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { comprobantesApi } from '../../api'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import { useToast, errMsg } from '../../context/ToastContext'
import type {
  TipoComprobanteResponse, CreateTipoComprobanteDto, UpdateTipoComprobanteDto,
  ValidarNcfResponse, NcfSecuenciaResponse, NcfPoolResumenResponse, CargarNcfLoteDto,
} from '../../types'

// ── Modal de crear / editar ───────────────────────────────────────────────────
interface ModalProps {
  inicial?: TipoComprobanteResponse
  onClose: () => void
  onSaved: () => void
}
function ComprobanteModal({ inicial, onClose, onSaved }: ModalProps) {
  const { success, error } = useToast()
  const esEdicion = !!inicial

  const { register, handleSubmit, formState: { errors } } = useForm<UpdateTipoComprobanteDto>({
    defaultValues: inicial
      ? { codigo: inicial.codigo, nombre: inicial.nombre, descripcion: inicial.descripcion ?? '', requiereNcf: inicial.requiereNcf, aplicaItbis: inicial.aplicaItbis, activo: inicial.activo }
      : { codigo: '', nombre: '', descripcion: '', requiereNcf: false, aplicaItbis: true, activo: true },
  })

  const crear  = useMutation({ mutationFn: (d: CreateTipoComprobanteDto) => comprobantesApi.create(d) })
  const editar = useMutation({ mutationFn: (d: UpdateTipoComprobanteDto) => comprobantesApi.update(inicial!.id, d) })

  const onSubmit = async (data: UpdateTipoComprobanteDto) => {
    try {
      if (esEdicion) await editar.mutateAsync(data)
      else           await crear.mutateAsync(data)
      success(esEdicion ? 'Comprobante actualizado' : 'Comprobante creado')
      onSaved()
    } catch (e) { error(errMsg(e)) }
  }

  const loading = crear.isPending || editar.isPending

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="font-semibold text-slate-800">{esEdicion ? 'Editar' : 'Nuevo'} tipo de comprobante</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Código *" placeholder="B01, E31…" error={errors.codigo?.message}
              {...register('codigo', { required: 'Requerido', maxLength: { value: 10, message: 'Máx 10 chars' } })} />
            <Input label="Nombre *" placeholder="Crédito fiscal" error={errors.nombre?.message}
              {...register('nombre', { required: 'Requerido' })} />
          </div>
          <Input label="Descripción (opcional)" placeholder="Para qué aplica este comprobante"
            {...register('descripcion')} />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50">
              <input type="checkbox" {...register('requiereNcf')} className="w-4 h-4 rounded" />
              <div>
                <p className="font-medium text-slate-700">Requiere NCF</p>
                <p className="text-xs text-slate-400">Valida el número fiscal</p>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50">
              <input type="checkbox" {...register('aplicaItbis')} className="w-4 h-4 rounded" />
              <div>
                <p className="font-medium text-slate-700">Aplica ITBIS</p>
                <p className="text-xs text-slate-400">Reporta impuesto fiscal</p>
              </div>
            </label>
          </div>

          {esEdicion && (
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" {...register('activo')} className="w-4 h-4 rounded" />
              <span className="text-slate-700 font-medium">Activo</span>
            </label>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1 justify-center" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 justify-center" loading={loading}>
              {esEdicion ? 'Guardar cambios' : 'Crear'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal de prueba NCF ───────────────────────────────────────────────────────
function NcfTestModal({ onClose }: { onClose: () => void }) {
  const [ncf, setNcf]         = useState('')
  const [rnc, setRnc]         = useState('')
  const [resultado, setResult] = useState<ValidarNcfResponse | null>(null)
  const [loading, setLoading]  = useState(false)
  const { error } = useToast()

  const { data: estado } = useQuery({
    queryKey: ['ncf-estado'],
    queryFn:  comprobantesApi.ncfEstado,
  })

  const validar = async () => {
    if (!ncf.trim()) return
    setLoading(true)
    try {
      const r = await comprobantesApi.validarNcf(ncf.trim(), rnc.trim() || undefined)
      setResult(r)
    } catch (e) { error(errMsg(e)) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-purple-600" />
            <h3 className="font-semibold text-slate-800">Probar validación NCF</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {/* Estado de la API */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
            estado?.habilitado ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${estado?.habilitado ? 'bg-green-500' : 'bg-amber-400'}`} />
            {estado?.mensaje ?? 'Verificando…'}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">NCF *</label>
              <input value={ncf} onChange={e => setNcf(e.target.value.toUpperCase())}
                placeholder="Ej: B0100000001" maxLength={19}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-mono" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">RNC Emisor (opcional)</label>
              <input value={rnc} onChange={e => setRnc(e.target.value)}
                placeholder="Ej: 1-01-12345-6"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500" />
            </div>
          </div>

          <Button className="w-full justify-center" onClick={validar} loading={loading} disabled={!ncf.trim()}>
            Validar NCF
          </Button>

          {resultado && (
            <div className={`rounded-xl border p-4 space-y-2 text-sm ${
              resultado.valido ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Resultado</span>
                <div className="flex items-center gap-2">
                  {resultado.simulado && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Simulado</span>
                  )}
                  <Badge color={resultado.valido ? 'green' : 'red'}>{resultado.estado}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-slate-500">NCF</span>
                <span className="font-mono font-medium">{resultado.ncf}</span>
                {resultado.nombreEmisor && <>
                  <span className="text-slate-500">Emisor</span>
                  <span className="font-medium">{resultado.nombreEmisor}</span>
                </>}
                {resultado.mensaje && <>
                  <span className="text-slate-500">Mensaje</span>
                  <span>{resultado.mensaje}</span>
                </>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal de cargar lote NCF ──────────────────────────────────────────────────
interface CargarLoteModalProps {
  tiposB: TipoComprobanteResponse[]
  onClose: () => void
  onSaved: () => void
}
function CargarLoteModal({ tiposB, onClose, onSaved }: CargarLoteModalProps) {
  const { success, error } = useToast()
  const [tipoId, setTipoId] = useState<number>(tiposB[0]?.id ?? 0)
  const [desde,  setDesde]  = useState('')
  const [hasta,  setHasta]  = useState('')

  const cargar = useMutation({ mutationFn: (d: CargarNcfLoteDto) => comprobantesApi.cargarNcfLote(d) })

  const onSubmit = async () => {
    const d = Number(desde)
    const h = Number(hasta)
    if (!tipoId || !d || !h || d > h) { error('Verifica los campos'); return }
    if (h - d > 9999) { error('El lote no puede superar 10,000 NCF'); return }
    try {
      const r = await cargar.mutateAsync({ tipoComprobanteId: tipoId, desde: d, hasta: h })
      success(`${r.creados} NCF cargados correctamente`)
      onSaved()
    } catch (e) { error(errMsg(e)) }
  }

  const tipo = tiposB.find(t => t.id === tipoId)
  const preview = tipo && desde && hasta
    ? `${tipo.codigo}${String(Number(desde)).padStart(8, '0')} → ${tipo.codigo}${String(Number(hasta)).padStart(8, '0')}`
    : null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-800">Cargar lote de NCF</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Tipo de comprobante (B)</label>
            <select
              value={tipoId}
              onChange={e => setTipoId(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white"
            >
              {tiposB.map(t => (
                <option key={t.id} value={t.id}>{t.codigo} — {t.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Desde (número)</label>
              <input
                type="number" min={1} value={desde}
                onChange={e => setDesde(e.target.value)}
                placeholder="Ej: 1"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Hasta (número)</label>
              <input
                type="number" min={1} value={hasta}
                onChange={e => setHasta(e.target.value)}
                placeholder="Ej: 1000"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {preview && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2.5 text-xs text-indigo-700 font-mono">
              {preview}
              <span className="ml-2 font-sans text-indigo-500">({Number(hasta) - Number(desde) + 1} NCF)</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1 justify-center" onClick={onClose}>
              Cancelar
            </Button>
            <Button className="flex-1 justify-center" onClick={onSubmit} loading={cargar.isPending}
              disabled={!tipoId || !desde || !hasta}>
              Cargar lote
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Colores de estado NCF ─────────────────────────────────────────────────────
const estadoNcfColor: Record<string, string> = {
  Disponible: 'bg-emerald-100 text-emerald-700',
  Reservado:  'bg-blue-100 text-blue-700',
  Usado:      'bg-slate-100 text-slate-600',
  Anulado:    'bg-red-100 text-red-600',
}

// ── Panel de pool NCF por tipo B ──────────────────────────────────────────────
function NcfPoolPanel({ tipo }: { tipo: TipoComprobanteResponse }) {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [filtroEstado, setFiltroEstado] = useState<string>('Disponible')
  const [expanded, setExpanded]         = useState(false)

  const { data: resumen } = useQuery<NcfPoolResumenResponse>({
    queryKey: ['ncf-pool-resumen', tipo.id],
    queryFn:  () => comprobantesApi.ncfPoolResumen(tipo.id),
    staleTime: 10_000,
  })

  const { data: secuencias = [], isLoading: loadingSeq } = useQuery<NcfSecuenciaResponse[]>({
    queryKey: ['ncf-pool', tipo.id, filtroEstado],
    queryFn:  () => comprobantesApi.ncfPool(tipo.id, filtroEstado),
    enabled:  expanded,
    staleTime: 10_000,
  })

  const eliminar = useMutation({
    mutationFn: (id: number) => comprobantesApi.eliminarNcf(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ncf-pool', tipo.id] })
      qc.invalidateQueries({ queryKey: ['ncf-pool-resumen', tipo.id] })
      qc.invalidateQueries({ queryKey: ['ncf-proximo', tipo.id] })
      success('NCF eliminado')
    },
    onError: (e) => error(errMsg(e)),
  })

  const stats = [
    { label: 'Disponibles', val: resumen?.disponibles ?? 0, color: 'text-emerald-600' },
    { label: 'Reservados',  val: resumen?.reservados  ?? 0, color: 'text-blue-600' },
    { label: 'Usados',      val: resumen?.usados      ?? 0, color: 'text-slate-500' },
    { label: 'Anulados',    val: resumen?.anulados    ?? 0, color: 'text-red-500' },
  ]

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header del panel */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded text-sm">{tipo.codigo}</span>
          <span className="text-sm font-medium text-slate-700">{tipo.nombre}</span>
          {(resumen?.disponibles ?? 0) === 0 && (
            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Sin disponibles</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-4">
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-base font-bold ${s.color}`}>{s.val}</p>
                <p className="text-[10px] text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Stats en mobile */}
      <div className="sm:hidden flex gap-4 px-4 py-2 bg-slate-50 border-t border-slate-100">
        {stats.map(s => (
          <div key={s.label} className="text-center">
            <p className={`text-sm font-bold ${s.color}`}>{s.val}</p>
            <p className="text-[10px] text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Contenido expandido */}
      {expanded && (
        <div className="px-4 py-3 space-y-3">
          {/* Filtro de estado */}
          <div className="flex gap-1.5 flex-wrap">
            {['Disponible', 'Reservado', 'Usado', 'Anulado'].map(e => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  filtroEstado === e
                    ? estadoNcfColor[e] + ' ring-1 ring-current'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Tabla de secuencias */}
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-400 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">NCF</th>
                  <th className="px-3 py-2 text-left font-medium">Estado</th>
                  <th className="px-3 py-2 text-left font-medium">Fecha carga</th>
                  <th className="px-3 py-2 text-left font-medium">Fecha uso</th>
                  <th className="px-3 py-2 text-left font-medium">Venta</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loadingSeq && (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">Cargando…</td></tr>
                )}
                {!loadingSeq && secuencias.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">Sin registros para "{filtroEstado}"</td></tr>
                )}
                {secuencias.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono font-semibold text-slate-800">{s.ncf}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${estadoNcfColor[s.estado] ?? 'bg-slate-100 text-slate-500'}`}>
                        {s.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{new Date(s.fechaCarga).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-slate-500">{s.fechaUso ? new Date(s.fechaUso).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{s.ventaId ?? '—'}</td>
                    <td className="px-3 py-2">
                      {s.estado === 'Disponible' && (
                        <Button variant="ghost" size="sm" icon={<Trash2 size={12} />}
                          className="text-red-400 hover:bg-red-50 !p-1"
                          loading={eliminar.isPending}
                          onClick={() => { if (window.confirm(`¿Eliminar NCF ${s.ncf}?`)) eliminar.mutate(s.id) }} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ComprobantesPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [modal,      setModal]      = useState<'crear' | TipoComprobanteResponse | null>(null)
  const [testNcf,    setTestNcf]    = useState(false)
  const [cargarLote, setCargarLote] = useState(false)

  const { data: comprobantes = [], isLoading } = useQuery({
    queryKey: ['comprobantes'],
    queryFn:  () => comprobantesApi.getAll(),
  })

  const tiposB = comprobantes.filter(c => c.codigo.startsWith('B') && c.activo)

  const eliminar = useMutation({
    mutationFn: (id: number) => comprobantesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comprobantes'] }); success('Comprobante eliminado') },
    onError:   (e) => error(errMsg(e)),
  })

  const refresh = () => { qc.invalidateQueries({ queryKey: ['comprobantes'] }); setModal(null) }

  const onLoteSaved = () => {
    qc.invalidateQueries({ queryKey: ['ncf-pool-resumen'] })
    qc.invalidateQueries({ queryKey: ['ncf-pool'] })
    qc.invalidateQueries({ queryKey: ['ncf-proximo'] })
    setCargarLote(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tipos de comprobante</h2>
          <p className="text-sm text-slate-400 mt-0.5">Gestiona los tipos fiscales y la validación de NCF</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<FlaskConical size={16} />} onClick={() => setTestNcf(true)}>
            Probar NCF
          </Button>
          <Button icon={<Plus size={16} />} onClick={() => setModal('crear')}>
            Nuevo tipo
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                {['Código', 'Nombre', 'Descripción', 'NCF', 'ITBIS', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Cargando…</td></tr>
              )}
              {comprobantes.map(c => (
                <tr key={c.id} className={`hover:bg-slate-50 ${!c.activo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{c.codigo}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.nombre}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">{c.descripcion ?? '—'}</td>
                  <td className="px-4 py-3">
                    {c.requiereNcf
                      ? <CheckCircle2 size={16} className="text-emerald-500" />
                      : <XCircle     size={16} className="text-slate-300" />}
                  </td>
                  <td className="px-4 py-3">
                    {c.aplicaItbis
                      ? <Badge color="blue">Sí</Badge>
                      : <Badge color="gray">No</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={c.activo ? 'green' : 'red'}>{c.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" icon={<Pencil size={14} />}
                        onClick={() => setModal(c)} />
                      <Button variant="ghost" size="sm" icon={<Trash2 size={14} />}
                        className="text-red-400 hover:bg-red-50"
                        loading={eliminar.isPending}
                        onClick={() => { if (window.confirm(`¿Eliminar "${c.nombre}"?`)) eliminar.mutate(c.id) }} />
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && comprobantes.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No hay tipos de comprobante</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Pool de NCF (solo tipos B) ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-800">Pool de NCF (tipos B)</h3>
          </div>
          {tiposB.length > 0 && (
            <Button variant="secondary" icon={<Upload size={15} />} onClick={() => setCargarLote(true)}>
              Cargar lote
            </Button>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400 px-1">Cargando…</p>
        ) : tiposB.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-8 text-center text-slate-400 text-sm">
            No hay tipos de comprobante tipo B activos. Crea uno para gestionar el pool de NCF.
          </div>
        ) : (
          <div className="space-y-2">
            {tiposB.map(t => <NcfPoolPanel key={t.id} tipo={t} />)}
          </div>
        )}
      </div>

      {/* ── Info NCF API ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader><h3 className="font-semibold text-slate-700">Integración con API fiscal (NCF)</h3></CardHeader>
        <CardBody className="space-y-3 text-sm text-slate-600">
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <FlaskConical size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-800">Modo simulado activo</p>
              <p className="text-amber-700 text-xs mt-0.5">
                La validación de NCF está en modo maqueta. El flujo completo está habilitado pero los resultados son simulados.
                Para conectar con la API real (DGII u otro organismo), configura <code className="bg-amber-100 px-1 rounded">NcfApi:Habilitado = true</code> en <code className="bg-amber-100 px-1 rounded">appsettings.json</code>.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {[
              { label: 'Endpoint',      val: 'POST /api/comprobantes/validar-ncf' },
              { label: 'Configuración', val: 'appsettings.json → NcfApi' },
              { label: 'Estado',        val: 'GET /api/comprobantes/ncf-estado' },
            ].map(i => (
              <div key={i.label} className="bg-slate-50 rounded-lg p-3">
                <p className="text-slate-400 mb-0.5">{i.label}</p>
                <p className="font-mono text-slate-700 break-all">{i.val}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {modal === 'crear' && (
        <ComprobanteModal onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal && modal !== 'crear' && (
        <ComprobanteModal inicial={modal} onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {testNcf    && <NcfTestModal onClose={() => setTestNcf(false)} />}
      {cargarLote && tiposB.length > 0 && (
        <CargarLoteModal tiposB={tiposB} onClose={() => setCargarLote(false)} onSaved={onLoteSaved} />
      )}
    </div>
  )
}
