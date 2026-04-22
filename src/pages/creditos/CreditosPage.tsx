import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, RefreshCw, ChevronDown, ChevronUp, Clock, History } from 'lucide-react'
import { creditosApi } from '../../api'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { useToast, errMsg } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import type { CreditoResponse } from '../../types'

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-DO')
const fmtFechaHora = (d: string) =>
  new Date(d).toLocaleString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const estadoColor: Record<string, 'yellow' | 'blue' | 'green' | 'red' | 'gray'> = {
  Pendiente: 'yellow', PagadoParcial: 'blue', Saldado: 'green', Vencido: 'red', Cancelado: 'gray',
}

// ── Fila de crédito con historial de abonos ───────────────────────────────────
function FilaCredito({
  credito,
  puedeRegistrarPagos,
  onAbonar,
}: {
  credito: CreditoResponse
  puedeRegistrarPagos: boolean
  onAbonar: (c: CreditoResponse) => void
}) {
  const [expandido, setExpandido] = useState(false)
  const tienePagos = credito.pagos && credito.pagos.length > 0

  return (
    <>
      {/* Fila principal */}
      <tr
        className="hover:bg-slate-50 cursor-pointer"
        onClick={() => tienePagos && setExpandido(v => !v)}
      >
        <td className="px-4 py-3">
          {tienePagos && (
            <span className="mr-2 text-slate-400">
              {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          )}
          <span className="font-medium text-slate-800">{credito.nombreCliente}</span>
        </td>
        <td className="px-4 py-3">{fmt(credito.montoTotal)}</td>
        <td className="px-4 py-3 text-green-600">{fmt(credito.montoPagado)}</td>
        <td className="px-4 py-3 font-bold text-red-600">{fmt(credito.saldo)}</td>
        <td className="px-4 py-3 text-slate-600">
          {credito.fechaVencimiento ? fmtFecha(credito.fechaVencimiento) : '—'}
        </td>
        <td className="px-4 py-3">
          <Badge color={estadoColor[credito.estado]}>{credito.estado}</Badge>
        </td>
        {/* Columna abonos */}
        <td className="px-4 py-3">
          {tienePagos ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
              <Clock size={11} /> {credito.pagos.length}
            </span>
          ) : (
            <span className="text-slate-300 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          {puedeRegistrarPagos && credito.saldo > 0 && (
            <Button
              variant="ghost" size="sm"
              icon={<DollarSign size={14} />}
              className="text-green-600 hover:bg-green-50"
              onClick={() => onAbonar(credito)}
            >
              Abonar
            </Button>
          )}
        </td>
      </tr>

      {/* Historial de abonos expandible */}
      {expandido && tienePagos && (
        <tr className="bg-slate-50/70">
          <td colSpan={8} className="px-6 py-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Clock size={12} /> Historial de abonos
            </p>
            <div className="space-y-1.5">
              {credito.pagos.map(pago => (
                <div
                  key={pago.id}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 bg-white rounded-lg px-4 py-2 text-sm border border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <DollarSign size={12} className="text-green-600" />
                    </span>
                    <div>
                      <p className="font-semibold text-emerald-700">{fmt(pago.monto)}</p>
                      {pago.observacion && (
                        <p className="text-xs text-slate-400 italic">{pago.observacion}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">{fmtFechaHora(pago.fechaPago)}</p>
                    <p className="text-xs text-slate-400">Registrado por: {pago.nombreUsuario}</p>
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function CreditosPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const { puedeRegistrarPagos, puedeAnularVentas } = useAuth()
  const [pagoModal, setPagoModal]   = useState<CreditoResponse | null>(null)
  const [montoPago, setMontoPago]   = useState('')
  const [obsv, setObsv]             = useState('')
  const [mostrarTodos, setMostrarTodos] = useState(false)

  const { data: creditos = [], isLoading } = useQuery({
    queryKey: ['creditos'],
    queryFn: creditosApi.getAll,
  })

  const { data: resumen } = useQuery({
    queryKey: ['creditos', 'resumen'],
    queryFn: creditosApi.resumen,
  })

  const actualizarVencidos = useMutation({
    mutationFn: creditosApi.actualizarVencidos,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['creditos'] })
      success('Créditos vencidos actualizados')
    },
    onError: (e) => error(errMsg(e)),
  })

  const registrarPago = useMutation({
    mutationFn: () =>
      creditosApi.registrarPago(pagoModal!.id, { monto: parseFloat(montoPago), observacion: obsv }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['creditos'] })
      setPagoModal(null); setMontoPago(''); setObsv('')
      success('Abono registrado correctamente')
    },
    onError: (e) => error(errMsg(e)),
  })

  const activos  = creditos.filter(c => c.estado !== 'Saldado' && c.estado !== 'Cancelado')
  const visibles = mostrarTodos ? creditos : activos

  const handleAbonar = (c: CreditoResponse) => {
    setPagoModal(c)
    setMontoPago(String(c.saldo))
    setObsv('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Créditos</h2>
        {puedeAnularVentas && (
          <Button
            variant="secondary"
            icon={<RefreshCw size={16} />}
            loading={actualizarVencidos.isPending}
            onClick={() => actualizarVencidos.mutate()}
          >
            Actualizar vencidos
          </Button>
        )}
      </div>

      {/* Resumen */}
      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total por cobrar',   val: fmt(resumen.totalDeuda),        color: 'text-red-600'    },
            { label: 'Total cobrado',      val: fmt(resumen.totalCobrado),      color: 'text-green-600'  },
            { label: 'Créditos vencidos',  val: resumen.creditosVencidos,       color: 'text-orange-600' },
            { label: 'Clientes con deuda', val: resumen.cantidadClientes,       color: 'text-blue-600'   },
          ].map(s => (
            <Card key={s.label}>
              <CardBody>
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Tabla de créditos activos con historial de abonos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h3 className="font-semibold text-slate-700">
              {mostrarTodos ? `Todos los créditos (${creditos.length})` : `Créditos activos (${activos.length})`}
            </h3>
            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-400 hidden sm:block">
                Haz clic en una fila para ver el historial de abonos
              </p>
              {/* Toggle Todos / Solo activos */}
              <button
                onClick={() => setMostrarTodos(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  mostrarTodos
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <History size={13} />
                {mostrarTodos ? 'Ver solo activos' : 'Ver historial completo'}
              </button>
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                {['Cliente', 'Total', 'Pagado', 'Saldo', 'Vencimiento', 'Estado', 'Abonos', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">Cargando...</td>
                </tr>
              )}
              {visibles.map(c => (
                <FilaCredito
                  key={c.id}
                  credito={c}
                  puedeRegistrarPagos={puedeRegistrarPagos}
                  onAbonar={handleAbonar}
                />
              ))}
              {!isLoading && visibles.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No hay créditos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal para registrar abono */}
      {pagoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <div>
                <h3 className="font-semibold text-slate-800">Registrar abono</h3>
                <p className="text-xs text-slate-400 mt-0.5">{pagoModal.nombreCliente}</p>
              </div>
              <button onClick={() => setPagoModal(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Resumen del crédito */}
              <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Monto total</span>
                  <span className="font-mono font-medium">{fmt(pagoModal.montoTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ya pagado</span>
                  <span className="font-mono text-green-600">{fmt(pagoModal.montoPagado)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-medium text-slate-700">Saldo pendiente</span>
                  <span className="font-mono font-bold text-red-600">{fmt(pagoModal.saldo)}</span>
                </div>
              </div>

              {/* Historial de abonos previos (compacto) */}
              {pagoModal.pagos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Abonos anteriores ({pagoModal.pagos.length})
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {pagoModal.pagos.map(p => (
                      <div key={p.id} className="flex justify-between text-xs bg-slate-50 rounded-lg px-3 py-1.5">
                        <span className="text-emerald-600 font-semibold">{fmt(p.monto)}</span>
                        <span className="text-slate-400">{fmtFecha(p.fechaPago)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Monto a abonar (RD$) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" step="0.01" min="0.01"
                  value={montoPago}
                  onChange={e => setMontoPago(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-right font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Observación (opcional)
                </label>
                <input
                  value={obsv}
                  onChange={e => setObsv(e.target.value)}
                  placeholder="Ej: Pago en efectivo"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <Button variant="secondary" onClick={() => setPagoModal(null)}>Cancelar</Button>
                <Button
                  loading={registrarPago.isPending}
                  disabled={!montoPago || parseFloat(montoPago) <= 0}
                  onClick={() => registrarPago.mutate()}
                  icon={<DollarSign size={15} />}
                >
                  Registrar abono
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
