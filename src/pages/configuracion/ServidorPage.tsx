import { useEffect, useState, useCallback } from 'react'
import {
  Activity, Cpu, HardDrive, MemoryStick, RefreshCw,
  Clock, Server, Loader2, CheckCircle, AlertTriangle, Link, Database,
} from 'lucide-react'
import api from '../../lib/axios'

const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : `${window.location.origin}/api`

// ── tipos ─────────────────────────────────────────────────────────────────

interface MemoriaDto {
  procesaMb:         number
  heapMb:            number
  sistemaDisponibleMb: number
  sistemaTotalMb:    number | null
  usoSistemaPct:     number | null
}

interface CpuDto {
  procesoPct: number
  nucleos:    number
}

interface DiscoDto {
  unidad:  string
  totalGb: number
  usadoGb: number
  libreGb: number
  usoPct:  number
}

interface DbDto {
  estado:     'saludable' | 'degradado' | 'no_disponible'
  latenciaMs: number | null
  error:      string | null
}

interface ServidorStatus {
  estado:         string
  uptime:         string
  uptimeSegundos: number
  fechaInicio:    string
  memoria:        MemoriaDto
  cpu:            CpuDto
  discos:         DiscoDto[]
  db:             DbDto
  entorno:        string
  version:        string
}

// ── helpers ────────────────────────────────────────────────────────────────

function colorBarra(pct: number) {
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 75) return 'bg-amber-500'
  return 'bg-blue-500'
}

function colorTexto(pct: number) {
  if (pct >= 90) return 'text-red-600'
  if (pct >= 75) return 'text-amber-600'
  return 'text-blue-600'
}

function Barra({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all duration-700 ${colorBarra(pct)}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

// ── componente ─────────────────────────────────────────────────────────────

export default function ServidorPage() {
  const [data,     setData]     = useState<ServidorStatus | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<ServidorStatus>('/health/status')
      setData(res.data)
      setLastSync(new Date())
    } catch {
      setError('No se pudo obtener el estado del servidor.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Carga inicial + auto-refresh cada 15 s
  useEffect(() => {
    cargar()
    const id = setInterval(cargar, 15_000)
    return () => clearInterval(id)
  }, [cargar])

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Server size={20} className="text-blue-600" />
            Estado del servidor
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Uso de recursos en tiempo real · actualiza cada 15 s
            {lastSync && (
              <span className="ml-2 text-gray-400">
                · última sync {lastSync.toLocaleTimeString('es-DO')}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* URL de la API */}
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
        <Link size={16} className="text-blue-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">URL de la API</p>
          <p className="text-sm font-mono text-gray-800 truncate">{API_URL}</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      {/* Spinner primera carga */}
      {loading && !data && (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-blue-600" />
        </div>
      )}

      {data && (
        <>
          {/* Fila superior — info general */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Estado"
              value={data.estado === 'ok' ? 'Operativo' : data.estado}
              icon={<CheckCircle size={18} className="text-green-500" />}
              sub={data.entorno}
            />
            <StatCard
              label="Versión"
              value={`v${data.version}`}
              icon={<Activity size={18} className="text-blue-500" />}
              sub="API POS"
            />
            <StatCard
              label="Uptime"
              value={data.uptime}
              icon={<Clock size={18} className="text-purple-500" />}
              sub={`desde ${new Date(data.fechaInicio).toLocaleDateString('es-DO')}`}
            />
            <StatCard
              label="CPU"
              value={`${data.cpu.nucleos} núcleo${data.cpu.nucleos !== 1 ? 's' : ''}`}
              icon={<Cpu size={18} className="text-orange-500" />}
              sub="lógicos"
            />
          </div>

          {/* CPU */}
          <MetricCard
            titulo="CPU del proceso"
            icon={<Cpu size={16} className="text-orange-500" />}
          >
            <div className="space-y-2">
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-gray-900">
                  {data.cpu.procesoPct}
                  <span className="text-lg text-gray-400">%</span>
                </span>
                <span className={`text-sm font-medium ${colorTexto(data.cpu.procesoPct)}`}>
                  {data.cpu.procesoPct >= 90 ? '⚠ alto' : data.cpu.procesoPct >= 75 ? '↑ elevado' : '✓ normal'}
                </span>
              </div>
              <Barra pct={data.cpu.procesoPct} />
              <p className="text-xs text-gray-400">Muestra de 200 ms sobre {data.cpu.nucleos} núcleo{data.cpu.nucleos !== 1 ? 's' : ''}</p>
            </div>
          </MetricCard>

          {/* Memoria */}
          <MetricCard
            titulo="Memoria"
            icon={<MemoryStick size={16} className="text-blue-500" />}
          >
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Proceso */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Proceso (Working Set)</p>
                <p className="text-3xl font-bold text-gray-900">
                  {data.memoria.procesaMb}
                  <span className="text-lg text-gray-400"> MB</span>
                </p>
                <p className="text-xs text-gray-400">
                  Heap .NET: <span className="font-medium text-gray-600">{data.memoria.heapMb} MB</span>
                </p>
              </div>

              {/* Sistema */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sistema</p>
                {data.memoria.sistemaTotalMb != null && data.memoria.usoSistemaPct != null ? (
                  <>
                    <div className="flex items-end justify-between">
                      <span className="text-3xl font-bold text-gray-900">
                        {data.memoria.usoSistemaPct}
                        <span className="text-lg text-gray-400">%</span>
                      </span>
                      <span className={`text-sm font-medium ${colorTexto(data.memoria.usoSistemaPct)}`}>
                        {(data.memoria.sistemaTotalMb - data.memoria.sistemaDisponibleMb).toFixed(0)} / {data.memoria.sistemaTotalMb} MB
                      </span>
                    </div>
                    <Barra pct={data.memoria.usoSistemaPct} />
                    <p className="text-xs text-gray-400">
                      Disponible: <span className="font-medium text-gray-600">{data.memoria.sistemaDisponibleMb} MB</span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-gray-900">
                      {data.memoria.sistemaDisponibleMb}
                      <span className="text-lg text-gray-400"> MB</span>
                    </p>
                    <p className="text-xs text-gray-400">RAM disponible para la app</p>
                  </>
                )}
              </div>
            </div>
          </MetricCard>

          {/* Discos */}
          <MetricCard
            titulo="Almacenamiento"
            icon={<HardDrive size={16} className="text-slate-500" />}
          >
            {data.discos.length === 0 ? (
              <p className="text-sm text-gray-400">Sin unidades detectadas.</p>
            ) : (
              <div className="space-y-5">
                {data.discos.map(d => (
                  <div key={d.unidad} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono font-medium text-gray-700">{d.unidad}</span>
                      <span className={`font-medium ${colorTexto(d.usoPct)}`}>
                        {d.usoPct}% usado
                      </span>
                    </div>
                    <Barra pct={d.usoPct} />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Usado: <b className="text-gray-600">{d.usadoGb} GB</b></span>
                      <span>Libre: <b className="text-gray-600">{d.libreGb} GB</b></span>
                      <span>Total: <b className="text-gray-600">{d.totalGb} GB</b></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </MetricCard>

          {/* Base de datos */}
          {data.db && <DbCard db={data.db} />}
        </>
      )}
    </div>
  )
}

// ── sub-componentes ────────────────────────────────────────────────────────

function StatCard({ label, value, icon, sub }: {
  label: string; value: string; icon: React.ReactNode; sub?: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span></div>
      <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function MetricCard({ titulo, icon, children }: {
  titulo: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
        {icon} {titulo}
      </h2>
      {children}
    </div>
  )
}

function DbCard({ db }: { db: DbDto }) {
  const cfg = {
    saludable:     { bar: 'bg-green-500',  text: 'text-green-600',  badge: 'bg-green-50 text-green-700 border-green-200',  label: 'Saludable'     },
    degradado:     { bar: 'bg-amber-500',  text: 'text-amber-600',  badge: 'bg-amber-50 text-amber-700 border-amber-200',  label: 'Degradado'     },
    no_disponible: { bar: 'bg-red-500',    text: 'text-red-600',    badge: 'bg-red-50 text-red-700 border-red-200',        label: 'No disponible' },
  }[db.estado] ?? { bar: 'bg-gray-400', text: 'text-gray-500', badge: 'bg-gray-50 text-gray-600 border-gray-200', label: db.estado }

  // Barra proporcional: 0 ms → 0 %, 500 ms → 100 %
  const pct = db.latenciaMs != null ? Math.min((db.latenciaMs / 500) * 100, 100) : 100

  return (
    <MetricCard titulo="Base de datos" icon={<Database size={16} className="text-indigo-500" />}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {/* Latencia grande */}
          <div>
            {db.latenciaMs != null ? (
              <p className="text-3xl font-bold text-gray-900">
                {db.latenciaMs}
                <span className="text-lg text-gray-400"> ms</span>
              </p>
            ) : (
              <p className="text-3xl font-bold text-red-500">—</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">Latencia · SELECT 1</p>
          </div>

          {/* Badge de estado */}
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>

        {/* Barra de latencia */}
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-700 ${cfg.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>0 ms</span>
          <span className={`font-medium ${cfg.text}`}>
            {db.estado === 'saludable' ? '&lt; 100 ms' : db.estado === 'degradado' ? '100 – 500 ms' : '&gt; 500 ms'}
          </span>
          <span>500 ms</span>
        </div>

        {/* Error si hay */}
        {db.error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mt-1">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span className="break-all">{db.error}</span>
          </div>
        )}
      </div>
    </MetricCard>
  )
}
