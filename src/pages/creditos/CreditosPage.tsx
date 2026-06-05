import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign, RefreshCw, History, Eye, Printer,
  CreditCard, CheckCircle, AlertTriangle, Clock, User, FileText,
  Receipt,
} from 'lucide-react'
import jsPDF from 'jspdf'
import { creditosApi } from '../../api'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import { useToast, errMsg } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useComercio } from '../../context/ComercioContext'
import type { CreditoResponse, PagoCreditoResponse, MetodoPago } from '../../types'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt       = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
const fmtFecha  = (d: string) => new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtDetalle = (d: string) => new Date(d).toLocaleString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const estadoColor: Record<string, 'yellow' | 'blue' | 'green' | 'red' | 'gray'> = {
  Pendiente: 'yellow', PagadoParcial: 'blue', Saldado: 'green', Vencido: 'red', Cancelado: 'gray',
}

// ── Labels de método de pago ──────────────────────────────────────────────────
const metodoPagoLabel: Record<MetodoPago, string> = {
  Efectivo:      'Efectivo',
  Tarjeta:       'Tarjeta de crédito/débito',
  Transferencia: 'Transferencia bancaria',
  Cheque:        'Cheque',
  Otro:          'Otro',
}

// ── Impresión recibo de abono individual ──────────────────────────────────────
function imprimirReciboAbono(
  pago: PagoCreditoResponse,
  credito: CreditoResponse,
  comercioNombre: string,
  saldoAntesDePago: number,
) {
  const doc  = new jsPDF({ unit: 'mm', format: [80, 140] })
  const W    = 80
  const ML   = 4
  const MR   = 4
  let y      = 5

  const center = (txt: string, yy: number, sz = 9) => {
    doc.setFontSize(sz); doc.text(txt, W / 2, yy, { align: 'center' }); return yy + sz * 0.45
  }
  const line = (yy: number) => { doc.setDrawColor(200); doc.line(ML, yy, W - MR, yy); return yy + 3 }
  const row  = (lbl: string, val: string, yy: number, bold = false) => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal'); doc.text(lbl, ML, yy)
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.text(val, W - MR, yy, { align: 'right' })
    return yy + 4
  }

  // Cabecera
  doc.setFont('helvetica', 'bold')
  y = center(comercioNombre, y, 11) + 2
  doc.setFont('helvetica', 'normal')
  y = center('COMPROBANTE DE ABONO', y, 8) + 1
  y = line(y)

  // Info del crédito
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  y = row('Crédito #:', `${credito.id}`, y)
  y = row('Factura #:', `${credito.ventaId}`, y)
  y = row('Cliente:', credito.nombreCliente, y)
  y = line(y)

  // Detalles del pago
  y = row('Fecha pago:', fmtDetalle(pago.fechaPago), y)
  y = row('Registrado por:', pago.nombreUsuario, y)
  if (pago.observacion) {
    doc.setFontSize(7.5); doc.setFont('helvetica', 'italic')
    doc.text(`"${pago.observacion}"`, ML, y); y += 3.5
    doc.setFont('helvetica', 'normal')
  }
  y = line(y)

  // Montos
  y = row('Monto total crédito:', fmt(credito.montoTotal), y)
  y = row('Saldo anterior:', fmt(saldoAntesDePago), y)

  doc.setFontSize(10); doc.setFont('helvetica', 'bold')
  doc.text('ABONO:', ML, y)
  doc.text(fmt(pago.monto), W - MR, y, { align: 'right' })
  y += 5
  y = line(y)

  const saldoRestante = saldoAntesDePago - pago.monto
  doc.setFontSize(9); doc.setFont('helvetica', 'bold')
  doc.text('Saldo restante:', ML, y)
  doc.text(fmt(Math.max(0, saldoRestante)), W - MR, y, { align: 'right' })
  y += 5
  y = line(y)

  // Pie
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal')
  doc.text('¡Gracias por su pago!', W / 2, y, { align: 'center' }); y += 3.5
  doc.text(new Date().toLocaleString('es-DO'), W / 2, y, { align: 'center' })

  doc.autoPrint()
  window.open(URL.createObjectURL(doc.output('blob')), '_blank')
}

// ── Modal detalle de crédito ──────────────────────────────────────────────────
function CreditoDetalleModal({
  credito,
  comercioNombre,
  puedeRegistrarPagos,
  onAbonar,
  onClose,
}: {
  credito: CreditoResponse
  comercioNombre: string
  puedeRegistrarPagos: boolean
  onAbonar: () => void
  onClose: () => void
}) {
  const pct   = credito.montoTotal > 0 ? Math.round((credito.montoPagado / credito.montoTotal) * 100) : 0
  const vencido = credito.estado === 'Vencido'

  // Calcula el saldo ANTES de cada pago para el recibo
  const saldoAntesDePago = (idx: number) => {
    let saldo = credito.montoTotal
    for (let i = 0; i < idx; i++) saldo -= credito.pagos[i].monto
    return saldo
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-50">
              <CreditCard size={18} className="text-brand-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Crédito #{credito.id}</h3>
              <p className="text-xs text-slate-400">Factura #{credito.ventaId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={estadoColor[credito.estado]}>{credito.estado}</Badge>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg ml-2">✕</button>
          </div>
        </div>

        {/* Cuerpo scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* Cliente */}
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <User size={14} className="text-slate-400" />
            <span className="font-medium">{credito.nombreCliente}</span>
          </div>

          {/* Resumen de montos */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Total</p>
              <p className="font-bold text-slate-800 text-sm">{fmt(credito.montoTotal)}</p>
            </div>
            <div className="bg-success-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-success-600 uppercase tracking-wide mb-1">Pagado</p>
              <p className="font-bold text-success-700 text-sm">{fmt(credito.montoPagado)}</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${credito.saldo > 0 ? 'bg-danger-50' : 'bg-success-50'}`}>
              <p className={`text-[10px] uppercase tracking-wide mb-1 ${credito.saldo > 0 ? 'text-danger-500' : 'text-success-500'}`}>Saldo</p>
              <p className={`font-bold text-sm ${credito.saldo > 0 ? 'text-danger-700' : 'text-success-700'}`}>{fmt(credito.saldo)}</p>
            </div>
          </div>

          {/* Barra de progreso */}
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Progreso de pago</span>
              <span className="font-semibold">{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-success-500' : pct > 50 ? 'bg-brand-500' : 'bg-warning-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Fechas */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-slate-500">
              <FileText size={13} />
              <span>Creado: <strong>{fmtFecha(credito.fechaCreacion)}</strong></span>
            </div>
            {credito.fechaVencimiento && (
              <div className={`flex items-center gap-1.5 ${vencido ? 'text-danger-500' : 'text-slate-500'}`}>
                {vencido ? <AlertTriangle size={13} /> : <Clock size={13} />}
                <span>Vence: <strong>{fmtFecha(credito.fechaVencimiento)}</strong></span>
              </div>
            )}
          </div>

          {/* Historial de pagos */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <History size={12} /> Historial de cobros ({credito.pagos.length})
            </p>

            {credito.pagos.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-xl">
                Sin pagos registrados
              </div>
            ) : (
              <div className="space-y-2">
                {credito.pagos.map((pago, idx) => {
                  const saldoPrev = saldoAntesDePago(idx)
                  const saldoDespues = Math.max(0, saldoPrev - pago.monto)
                  return (
                    <div key={pago.id} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-success-100 flex items-center justify-center shrink-0">
                            <CheckCircle size={14} className="text-success-600" />
                          </div>
                          <div>
                            <p className="font-bold text-success-700 text-sm">{fmt(pago.monto)}</p>
                            {pago.observacion && (
                              <p className="text-xs text-slate-400 italic mt-0.5">"{pago.observacion}"</p>
                            )}
                          </div>
                        </div>
                        {/* Botón imprimir recibo */}
                        <button
                          onClick={() => imprimirReciboAbono(pago, credito, comercioNombre, saldoPrev)}
                          title="Imprimir recibo de este pago"
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition-colors shrink-0"
                        >
                          <Printer size={11} /> Recibo
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs text-slate-400">
                        <span>{fmtDetalle(pago.fechaPago)} · {pago.nombreUsuario}</span>
                        <span>Saldo: <span className={saldoDespues > 0 ? 'text-danger-500 font-medium' : 'text-success-600 font-medium'}>{fmt(saldoDespues)}</span></span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t flex justify-between items-center bg-slate-50">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          {puedeRegistrarPagos && credito.saldo > 0 && (
            <Button icon={<DollarSign size={15} />} onClick={onAbonar}>
              Registrar abono
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function CreditosPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const { puedeRegistrarPagos, puedeAnularVentas } = useAuth()
  const { comercio } = useComercio()

  const [detalle,     setDetalle]     = useState<CreditoResponse | null>(null)
  const [pagoModal,   setPagoModal]   = useState<CreditoResponse | null>(null)
  const [montoPago,   setMontoPago]   = useState('')
  const [obsv,        setObsv]        = useState('')
  const [mostrarTodos, setMostrarTodos] = useState(false)

  const { data: _creditos, isLoading, isError, refetch } = useQuery({
    queryKey: ['creditos'],
    queryFn: creditosApi.getAll,
  })
  const creditos = Array.isArray(_creditos) ? _creditos : []

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
      creditosApi.registrarPago(pagoModal!.id, { monto: parseFloat(montoPago), observacion: obsv, metodoPago: 'Efectivo' }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['creditos'] })
      // Actualiza el detalle si está abierto
      if (detalle?.id === pagoModal?.id) setDetalle(data)
      setPagoModal(null); setMontoPago(''); setObsv('')
      success('Abono registrado correctamente')
    },
    onError: (e) => error(errMsg(e)),
  })

  const activos  = creditos.filter(c => c.estado !== 'Saldado' && c.estado !== 'Cancelado')
  const visibles = mostrarTodos ? creditos : activos

  const abrirAbonar = (c: CreditoResponse) => {
    setPagoModal(c)
    setMontoPago(String(c.saldo))
    setObsv('')
  }

  const comercioNombre = comercio?.nombre ?? 'POS Sistema'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Cobros</h2>
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

      {/* Tarjetas de resumen */}
      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total por cobrar',   val: fmt(resumen.totalDeuda),    color: 'text-danger-600'    },
            { label: 'Total cobrado',      val: fmt(resumen.totalCobrado),  color: 'text-success-600'  },
            { label: 'Créditos vencidos',  val: resumen.creditosVencidos,   color: 'text-warning-600' },
            { label: 'Clientes con deuda', val: resumen.cantidadClientes,   color: 'text-brand-600'   },
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

      {/* Tabla */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h3 className="font-semibold text-slate-700">
              {mostrarTodos
                ? `Todos los créditos (${creditos.length})`
                : `Créditos activos (${activos.length})`}
            </h3>
            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-400 hidden sm:block">
                Haz clic en <Eye size={11} className="inline" /> para ver el detalle y el historial
              </p>
              <button
                onClick={() => setMostrarTodos(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  mostrarTodos
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <History size={13} />
                {mostrarTodos ? 'Solo activos' : 'Ver todos'}
              </button>
            </div>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                {['Cliente', 'Total', 'Pagado', 'Saldo', 'Vencimiento', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Cargando...</td></tr>
              )}
              {visibles.map(c => {
                const vencido = c.estado === 'Vencido'
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{c.nombreCliente}</p>
                      <p className="text-[11px] text-slate-400">Fac. #{c.ventaId}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{fmt(c.montoTotal)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-success-600">{fmt(c.montoPagado)}</td>
                    <td className="px-4 py-3 font-mono font-bold text-sm text-danger-600">{fmt(c.saldo)}</td>
                    <td className={`px-4 py-3 text-sm ${vencido ? 'text-danger-500 font-medium' : 'text-slate-500'}`}>
                      {c.fechaVencimiento ? fmtFecha(c.fechaVencimiento) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={estadoColor[c.estado]}>{c.estado}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost" size="sm"
                          icon={<Eye size={14} />}
                          title="Ver detalle y historial"
                          onClick={() => setDetalle(c)}
                        />
                        {puedeRegistrarPagos && c.saldo > 0 && (
                          <Button
                            variant="ghost" size="sm"
                            icon={<DollarSign size={14} />}
                            className="text-success-600 hover:bg-success-50"
                            title="Registrar abono"
                            onClick={() => abrirAbonar(c)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {isError && <EmptyState colSpan={8} variant="error" onRetry={refetch} />}
              {!isLoading && !isError && visibles.length === 0 && (
                <EmptyState colSpan={8} title="No hay créditos" description="No se encontraron créditos." />
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal detalle */}
      {detalle && (
        <CreditoDetalleModal
          credito={detalle}
          comercioNombre={comercioNombre}
          puedeRegistrarPagos={puedeRegistrarPagos}
          onAbonar={() => abrirAbonar(detalle)}
          onClose={() => setDetalle(null)}
        />
      )}

      {/* Modal registrar abono */}
      {pagoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <div>
                <h3 className="font-semibold text-slate-800">Registrar abono</h3>
                <p className="text-xs text-slate-400 mt-0.5">{pagoModal.nombreCliente} · Fac. #{pagoModal.ventaId}</p>
              </div>
              <button onClick={() => setPagoModal(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Resumen */}
              <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total crédito</span>
                  <span className="font-mono">{fmt(pagoModal.montoTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ya pagado</span>
                  <span className="font-mono text-success-600">{fmt(pagoModal.montoPagado)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-700">Saldo pendiente</span>
                  <span className="font-mono font-bold text-danger-600">{fmt(pagoModal.saldo)}</span>
                </div>
              </div>

              {/* Monto */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Monto a abonar (RD$) <span className="text-danger-500">*</span>
                </label>
                <input
                  type="number" step="0.01" min="0.01"
                  value={montoPago}
                  onChange={e => setMontoPago(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-brand-500 text-right font-mono text-lg"
                  autoFocus
                />
              </div>

              {/* Observación */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Observación (opcional)
                </label>
                <input
                  value={obsv}
                  onChange={e => setObsv(e.target.value)}
                  placeholder="Ej: Pago en efectivo"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-brand-500"
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
