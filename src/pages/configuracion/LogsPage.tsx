import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, XCircle, AlertOctagon, RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { logsApi } from '../../api'
import type { LogEntryDto } from '../../types'

const LEVELS = ['Warning', 'Error', 'Critical'] as const

const levelConfig = {
  Warning:  { icon: <AlertTriangle size={13} />,  bg: 'bg-yellow-50', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
  Error:    { icon: <XCircle size={13} />,         bg: 'bg-red-50',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700' },
  Critical: { icon: <AlertOctagon size={13} />,    bg: 'bg-red-100',   text: 'text-red-900',    badge: 'bg-red-200 text-red-900' },
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })

export default function LogsPage() {
  const [level, setLevel]   = useState('')
  const [search, setSearch] = useState('')
  const [desde, setDesde]   = useState('')
  const [hasta, setHasta]   = useState('')
  const [page, setPage]     = useState(1)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [confirmClear, setConfirmClear] = useState(false)

  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['logs', level, search, desde, hasta, page],
    queryFn: () => logsApi.getLogs({
      level: level || undefined,
      search: search || undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
      page,
      pageSize: 50,
    }),
    refetchInterval: 30_000, // auto-refresh cada 30s
  })

  const clearMut = useMutation({
    mutationFn: () => logsApi.clearLogs(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] })
      setConfirmClear(false)
    },
  })

  const toggleExpand = (id: number) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Logs del Sistema</h1>
          <p className="text-sm text-gray-500">{data?.total ?? 0} registros — actualiza cada 30s</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw size={14} /> Actualizar
          </button>
          <button onClick={() => setConfirmClear(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50">
            <Trash2 size={14} /> Limpiar logs
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        {/* Nivel */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nivel</label>
          <select value={level} onChange={e => { setLevel(e.target.value); setPage(1) }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">Todos</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {/* Búsqueda */}
        <div className="flex-1 min-w-48">
          <label className="block text-xs text-gray-500 mb-1">Buscar</label>
          <input type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Mensaje, categoría, excepción..."
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>

        {/* Fechas */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Desde</label>
          <input type="datetime-local" value={desde}
            onChange={e => { setDesde(e.target.value); setPage(1) }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hasta</label>
          <input type="datetime-local" value={hasta}
            onChange={e => { setHasta(e.target.value); setPage(1) }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <button onClick={() => { setLevel(''); setSearch(''); setDesde(''); setHasta(''); setPage(1) }}
          className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1.5">
          Limpiar
        </button>
      </div>

      {/* Tabla */}
      {isLoading && <p className="text-sm text-gray-500">Cargando logs...</p>}

      {!isLoading && data?.items.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No hay logs con los filtros seleccionados.</p>
        </div>
      )}

      {!isLoading && (data?.items.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {data!.items.map((log: LogEntryDto) => {
              const cfg = levelConfig[log.level] ?? levelConfig.Warning
              const isOpen = expanded.has(log.id)
              return (
                <div key={log.id} className={`${cfg.bg} transition-colors`}>
                  <button
                    onClick={() => toggleExpand(log.id)}
                    className="w-full text-left px-4 py-3 flex items-start gap-3"
                  >
                    <span className="mt-0.5 shrink-0">{cfg.icon}</span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${cfg.badge}`}>
                          {log.level}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">{fmtDate(log.timestamp)}</span>
                        <span className="text-xs text-gray-400 truncate">{log.category}</span>
                      </div>
                      <p className={`text-sm mt-0.5 ${cfg.text} font-medium line-clamp-2`}>
                        {log.message}
                      </p>
                    </div>

                    <span className="shrink-0 text-gray-400 mt-0.5">
                      {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-2">
                      {log.requestPath && (
                        <p className="text-xs text-gray-500">
                          <span className="font-medium">Path:</span> {log.requestPath}
                        </p>
                      )}
                      <p className="text-xs text-gray-700 font-medium">Mensaje completo:</p>
                      <pre className="text-xs bg-white/70 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap break-words">
                        {log.message}
                      </pre>
                      {log.exception && (
                        <>
                          <p className="text-xs text-red-700 font-medium">Excepción:</p>
                          <pre className="text-xs bg-red-50 border border-red-200 rounded-lg p-3 whitespace-pre-wrap break-words text-red-800 max-h-60 overflow-y-auto">
                            {log.exception}
                          </pre>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">
            ← Anterior
          </button>
          <span className="text-sm text-gray-600">Página {page} de {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">
            Siguiente →
          </button>
        </div>
      )}

      {/* Modal confirmar limpiar */}
      {confirmClear && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">¿Limpiar todos los logs?</h2>
            <p className="text-sm text-gray-500">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmClear(false)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={() => clearMut.mutate()} disabled={clearMut.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-60">
                {clearMut.isPending ? 'Limpiando...' : 'Sí, limpiar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
