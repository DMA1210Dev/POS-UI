import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, DollarSign, RefreshCw, User, FileText, Calendar,
  Phone, CreditCard, CheckCircle, Clock, Printer, Receipt,
  ChevronRight, Circle, CircleCheckBig, Banknote,
} from 'lucide-react'
import { cobrosApi, bancosApi } from '../../api'
import { Card, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import { useToast, errMsg } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useComercio } from '../../context/ComercioContext'
import {
  fmt, fmtFecha, fmtDetalle, fmtEstado, estadoCreditoColor as estadoColor,
  metodoPagoLabel, METODOS_PAGO,
} from '../../lib/format'
import { imprimirReciboPagoCredito } from '../../lib/pdf'
import type {
  ClienteDeudaDto, FacturaCreditoDto, PagoFacturaRealizadoDto,
  MetodoPago,
} from '../../types'

function FacturaRow({
  factura,
  selected,
  montoAsignado,
  onToggle,
  onMontoChange,
  onVerPagos,
}: {
  factura: FacturaCreditoDto
  selected: boolean
  montoAsignado: string
  onToggle: () => void
  onMontoChange: (val: string) => void
  onVerPagos: () => void
}) {
  return (
    <div className={`border rounded-xl p-4 transition-colors ${selected ? 'border-brand-400 bg-brand-50/50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      <div className="flex items-start gap-3">
        <button onClick={onToggle} className="mt-0.5 shrink-0">
          {selected
            ? <CircleCheckBig size={20} className="text-brand-600" />
            : <Circle size={20} className="text-slate-300 hover:text-slate-400" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">Factura #{factura.ventaId}</span>
              <Badge color={estadoColor[factura.estado]}>{fmtEstado(factura.estado)}</Badge>
              {factura.vencida && <Badge color="red">Vencida</Badge>}
              <button
                onClick={onVerPagos}
                title="Ver historial de pagos"
                className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              >
                <Receipt size={15} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Calendar size={12} />
              <span>{fmtFecha(factura.fechaVenta)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <FileText size={12} />
              <span>Total: <strong className="text-slate-700">{fmt(factura.montoTotal)}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-danger-500">
              <DollarSign size={12} />
              <span>Adeuda: <strong>{fmt(factura.saldo)}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock size={12} />
              <span>{factura.diasCredito} días crédito</span>
            </div>
          </div>
          {selected && (
            <div className="mt-3 pt-3 border-t border-brand-200">
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Monto a pagar (máx. {fmt(factura.saldo)})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">RD$</span>
                <input
                  type="number" step="0.01" min="0.01" max={factura.saldo}
                  value={montoAsignado}
                  onChange={e => onMontoChange(e.target.value)}
                  className="w-full pl-11 pr-3 py-2 text-sm border border-brand-300 rounded-lg outline-none focus:border-brand-500 text-right font-mono"
                  onClick={e => e.stopPropagation()}
                />
              </div>
              <button
                onClick={e => { e.stopPropagation(); onMontoChange(String(factura.saldo)) }}
                className="text-[11px] text-brand-600 hover:text-brand-700 mt-1"
              >
                Pagar total ({fmt(factura.saldo)})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CobrosPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const { puedeRegistrarPagos, puedeAnularVentas, user } = useAuth()
  const { comercio } = useComercio()

  const [search, setSearch] = useState('')
  const [clienteSel, setClienteSel] = useState<ClienteDeudaDto | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [montos, setMontos] = useState<Record<number, string>>({})
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('Efectivo')
  const [cuentaBancoId, setCuentaBancoId] = useState<number | ''>('')
  const [observacion, setObservacion] = useState('')
  const [facturaDetalle, setFacturaDetalle] = useState<FacturaCreditoDto | null>(null)
  const [reciboData, setReciboData] = useState<{
    facturasPagadas: PagoFacturaRealizadoDto[]
    totalPagado: number
    metodoPago: MetodoPago
    observacion?: string
    nombreCliente: string
    facturasOrig: FacturaCreditoDto[]
  } | null>(null)

  const { data: _clientes, isLoading: loadClientes, isError: errClientes, refetch: refetchClientes } = useQuery({
    queryKey: ['cobros', 'clientes'],
    queryFn: cobrosApi.clientesConDeuda,
  })
  const clientes = Array.isArray(_clientes) ? _clientes : []

  const { data: _facturas, isLoading: loadFacturas, refetch: _refetchFacturas } = useQuery({
    queryKey: ['cobros', 'facturas', clienteSel?.id],
    queryFn: () => cobrosApi.facturasCliente(clienteSel!.id),
    enabled: !!clienteSel,
  })
  const facturas = Array.isArray(_facturas) ? _facturas : []

  const { data: cuentasBanco = [] } = useQuery({
    queryKey: ['cuentas-banco'],
    queryFn: bancosApi.cuentas.getAll,
  })

  const pagarMutation = useMutation({
    mutationFn: () => {
      const pagos = Array.from(selectedIds).map(id => ({
        creditoId: id,
        monto: parseFloat(montos[id] ?? '0'),
      }))
      return cobrosApi.pagar({
        clienteId: clienteSel!.id,
        pagos,
        metodoPago,
        cuentaBancoId: cuentaBancoId || null,
        observacion: observacion || undefined,
      })
    },
    onSuccess: (data) => {
      setReciboData({
        facturasPagadas: data.facturasPagadas,
        totalPagado: data.totalPagado,
        metodoPago: data.metodoPago,
        observacion: data.observacion,
        nombreCliente: data.nombreCliente,
        facturasOrig: facturas,
      })
      qc.invalidateQueries({ queryKey: ['cobros'] })
      success('Pago registrado correctamente')
      limpiarSeleccion()
    },
    onError: (e) => error(errMsg(e)),
  })

  const limpiarSeleccion = () => {
    setSelectedIds(new Set())
    setMontos({})
    setObservacion('')
  }

  const filtered = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.cedula?.includes(search) ?? false) ||
    (c.telefono?.includes(search) ?? false))

  const toggleFactura = (id: number, saldo: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        setMontos(m => { const r = { ...m }; delete r[id]; return r })
      } else {
        next.add(id)
        setMontos(m => ({ ...m, [id]: String(saldo) }))
      }
      return next
    })
  }

  const totalAPagar = Array.from(selectedIds).reduce((sum, id) => sum + (parseFloat(montos[id] ?? '0') || 0), 0)
  const puedePagar = selectedIds.size > 0 && totalAPagar > 0

  const comercioNombre = comercio?.nombre ?? 'POS Sistema'

  return (
    <div className="h-[calc(100vh-6rem)] flex gap-6">
      {/* Panel izquierdo: lista de clientes */}
      <div className="w-80 shrink-0 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-slate-700 mb-3">Clientes con deuda</h3>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-brand-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadClientes && (
            <div className="p-4 text-center text-slate-400 text-sm">Cargando...</div>
          )}
          {errClientes && (
            <div className="p-4">
              <EmptyState variant="error" onRetry={refetchClientes} />
            </div>
          )}
          {!loadClientes && !errClientes && filtered.length === 0 && (
            <div className="p-4">
              <EmptyState title="Sin resultados" description="No se encontraron clientes con deuda." />
            </div>
          )}
          {filtered.map(cl => {
            const isSel = clienteSel?.id === cl.id
            return (
              <button
                key={cl.id}
                onClick={() => { setClienteSel(cl); limpiarSeleccion() }}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                  isSel ? 'bg-brand-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <User size={14} className="text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{cl.nombre}</p>
                      <p className="text-[11px] text-slate-400">
                        {cl.facturasPendientes} pendiente{cl.facturasPendientes !== 1 ? 's' : ''}
                        {cl.facturasVencidas > 0 && ` · ${cl.facturasVencidas} vencida${cl.facturasVencidas !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={14} className={`shrink-0 ${isSel ? 'text-brand-500' : 'text-slate-300'}`} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="text-danger-500 font-semibold">{fmt(cl.totalAdeudado)}</span>
                  <span className="text-slate-400">Días: {cl.diasCredito}</span>
                </div>
              </button>
            )
          })}
        </div>
        {puedeAnularVentas && (
          <div className="p-3 border-t">
            <Button
              variant="ghost" size="sm"
              icon={<RefreshCw size={13} />}
              onClick={() => {
                import('../../api').then(m => m.creditosApi.actualizarVencidos().then(() => {
                  qc.invalidateQueries({ queryKey: ['cobros'] })
                  success('Vencidos actualizados')
                }).catch(e => error(errMsg(e))))
              }}
              className="w-full text-xs"
            >
              Actualizar vencidos
            </Button>
          </div>
        )}
      </div>

      {/* Panel derecho: facturas del cliente */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {!clienteSel ? (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center">
            <div className="text-center text-slate-400">
              <User size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">Selecciona un cliente</p>
              <p className="text-xs mt-1">para ver sus facturas pendientes</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header cliente */}
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                      <User size={18} className="text-brand-600" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-800 text-lg">{clienteSel.nombre}</h2>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        {clienteSel.cedula && <span className="flex items-center gap-1"><CreditCard size={11} /> {clienteSel.cedula}</span>}
                        {clienteSel.telefono && <span className="flex items-center gap-1"><Phone size={11} /> {clienteSel.telefono}</span>}
                        <span className="flex items-center gap-1"><Clock size={11} /> {clienteSel.diasCredito} días crédito</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-danger-600">{fmt(clienteSel.totalAdeudado)}</p>
                    <p className="text-xs text-slate-400">total adeudado</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Facturas */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {loadFacturas && (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                  Cargando facturas...
                </div>
              )}
              {!loadFacturas && facturas.length === 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-8">
                  <EmptyState title="Sin facturas pendientes" description="Este cliente no tiene facturas activas." />
                </div>
              )}
              {facturas.map(f => (
                <FacturaRow
                  key={f.creditoId}
                  factura={f}
                  selected={selectedIds.has(f.creditoId)}
                  montoAsignado={montos[f.creditoId] ?? ''}
                  onToggle={() => toggleFactura(f.creditoId, f.saldo)}
                  onMontoChange={(val) => setMontos(m => ({ ...m, [f.creditoId]: val }))}
                  onVerPagos={() => setFacturaDetalle(f)}
                />
              ))}
            </div>

            {/* Barra de pago */}
            {puedeRegistrarPagos && facturas.length > 0 && (
              <Card className="shrink-0">
                <CardBody>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2 flex-wrap flex-1">
                      <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-2">
                        <Banknote size={14} className="text-slate-500" />
                        <select
                          value={metodoPago}
                          onChange={e => setMetodoPago(e.target.value as MetodoPago)}
                          className="text-sm bg-transparent outline-none font-medium text-slate-700"
                        >
                          {METODOS_PAGO.map(m => (
                            <option key={m} value={m}>{metodoPagoLabel[m]}</option>
                          ))}
                        </select>
                      </div>
                      {(metodoPago === 'Transferencia' || metodoPago === 'Cheque') && (
                        <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-2">
                          <select
                            value={cuentaBancoId}
                            onChange={e => setCuentaBancoId(e.target.value ? parseInt(e.target.value) : '')}
                            className="text-sm bg-transparent outline-none font-medium text-slate-700"
                          >
                            <option value="">Seleccionar cuenta bancaria...</option>
                            {cuentasBanco.map(c => (
                              <option key={c.id} value={c.id}>{c.nombre} ({c.monedaCodigo})</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <input
                        value={observacion}
                        onChange={e => setObservacion(e.target.value)}
                        placeholder="Observación (opcional)"
                        className="px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-brand-500 w-full sm:w-48"
                      />
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      {selectedIds.size > 0 && (
                        <p className="text-sm whitespace-nowrap">
                          <span className="text-slate-500">{selectedIds.size} factura{selectedIds.size !== 1 ? 's' : ''}:</span>{' '}
                          <span className="font-bold text-brand-600">{fmt(totalAPagar)}</span>
                        </p>
                      )}
                      <Button
                        icon={<DollarSign size={15} />}
                        disabled={!puedePagar}
                        loading={pagarMutation.isPending}
                        onClick={() => pagarMutation.mutate()}
                        className="whitespace-nowrap"
                      >
                        {selectedIds.size === 0 ? 'Selecciona facturas' : `Cobrar ${fmt(totalAPagar)}`}
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Modal historial de pagos */}
      {facturaDetalle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-50">
                  <FileText size={18} className="text-brand-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Factura #{facturaDetalle.ventaId}</h3>
                  <p className="text-xs text-slate-400">Crédito #{facturaDetalle.creditoId} · {fmtEstado(facturaDetalle.estado)}</p>
                </div>
              </div>
              <button onClick={() => setFacturaDetalle(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Total</p>
                  <p className="font-bold text-slate-800 text-sm">{fmt(facturaDetalle.montoTotal)}</p>
                </div>
                <div className="bg-success-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-success-600 uppercase tracking-wide mb-1">Pagado</p>
                  <p className="font-bold text-success-700 text-sm">{fmt(facturaDetalle.montoPagado)}</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${facturaDetalle.saldo > 0 ? 'bg-danger-50' : 'bg-success-50'}`}>
                  <p className={`text-[10px] uppercase tracking-wide mb-1 ${facturaDetalle.saldo > 0 ? 'text-danger-500' : 'text-success-500'}`}>Saldo</p>
                  <p className={`font-bold text-sm ${facturaDetalle.saldo > 0 ? 'text-danger-700' : 'text-success-700'}`}>{fmt(facturaDetalle.saldo)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Clock size={12} /> Historial de pagos ({facturaDetalle.pagos.length})
                </p>
                {facturaDetalle.pagos.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-xl">
                    Sin pagos registrados
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      let saldoRestante = facturaDetalle.montoTotal
                      return facturaDetalle.pagos.map((pago) => {
                        saldoRestante -= pago.monto
                        return (
                          <div key={pago.id} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-success-100 flex items-center justify-center shrink-0">
                                  <CheckCircle size={14} className="text-success-600" />
                                </div>
                                <div>
                                  <p className="font-bold text-success-700 text-sm">{fmt(pago.monto)}</p>
                                  <p className="text-[11px] text-slate-400">{metodoPagoLabel[pago.metodoPago]}</p>
                                  {pago.observacion && (
                                    <p className="text-xs text-slate-400 italic mt-0.5">"{pago.observacion}"</p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs text-slate-400">
                              <span>{fmtDetalle(pago.fechaPago)} · {pago.nombreUsuario}</span>
                              <span>Saldo: <span className={saldoRestante > 0 ? 'text-danger-500 font-medium' : 'text-success-600 font-medium'}>{fmt(Math.max(0, saldoRestante))}</span></span>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 px-6 py-4 border-t flex justify-between items-center bg-slate-50 rounded-b-2xl">
              <Button variant="secondary" onClick={() => setFacturaDetalle(null)}>Cerrar</Button>
              {facturaDetalle.saldo > 0 && (
                <Button
                  icon={<DollarSign size={15} />}
                  onClick={() => {
                    const id = facturaDetalle.creditoId
                    if (!selectedIds.has(id)) toggleFactura(id, facturaDetalle.saldo)
                    setFacturaDetalle(null)
                  }}
                >
                  Pagar esta factura
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal recibo */}
      {reciboData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-success-50">
                  <CheckCircle size={18} className="text-success-600" />
                </div>
                <h3 className="font-semibold text-slate-800">Pago registrado</h3>
              </div>
              <button onClick={() => setReciboData(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-success-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-success-700">{fmt(reciboData.totalPagado)}</p>
                <p className="text-xs text-success-600 mt-1">Total cobrado a <strong>{reciboData.nombreCliente}</strong></p>
              </div>
              <div className="space-y-2 text-sm">
                {reciboData.facturasPagadas.map(fp => (
                  <div key={fp.creditoId} className="flex justify-between items-center bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-slate-600">Factura #{fp.ventaId}</span>
                    <div className="text-right">
                      <p className="font-mono font-medium text-slate-800">{fmt(fp.monto)}</p>
                      {fp.saldoRestante > 0 && (
                        <p className="text-[11px] text-slate-400">Saldo: {fmt(fp.saldoRestante)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 text-center">
                {metodoPagoLabel[reciboData.metodoPago]} · {fmtDetalle(new Date().toISOString())}
              </p>
            </div>
            <div className="px-6 py-4 border-t flex justify-between bg-slate-50 rounded-b-2xl">
              <Button variant="secondary" onClick={() => setReciboData(null)}>Cerrar</Button>
              <Button
                icon={<Printer size={15} />}
                onClick={() => {
                  imprimirReciboPagoCredito(
                    comercioNombre,
                    reciboData.nombreCliente,
                    reciboData.facturasPagadas.map(fp => {
                      const orig = reciboData.facturasOrig.find(f => f.creditoId === fp.creditoId)
                      return { ...fp, fechaVenta: orig?.fechaVenta }
                    }),
                    reciboData.totalPagado,
                    reciboData.metodoPago,
                    reciboData.observacion,
                    user?.nombre ?? 'Usuario',
                  )
                  setReciboData(null)
                }}
              >
                Imprimir recibo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
