import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Plus, Package, ArrowUp, FileText,
  ChevronRight, ChevronDown,
} from 'lucide-react'
import { almacenApi, cxpApi } from '../../api'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { errMsg, useToast } from '../../context/ToastContext'
import type { CuentaPagarDto, SalidaResumenDto } from '../../types'

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtHora = (d: string) => new Date(d).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
const fmtMoney = (n: number) => `RD$ ${n.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`

const estadoBadge = (e: SalidaResumenDto['estadoInventario']) => {
  const map = {
    Completo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Parcial: 'bg-amber-50 text-amber-700 border-amber-200',
    Pendiente: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[e]}`}>
      {e === 'Completo' ? 'Completado' : e === 'Parcial' ? 'Con pendientes' : 'Sin atender'}
    </span>
  )
}

// ── tipos internos ────────────────────────────────────────────────────────────

interface ItemFactura {
  detalleId: number
  productoId: number
  descripcion: string
  cantidadPendiente: number
  cantidadASalir: number
  incluir: boolean
}

// ── componente ────────────────────────────────────────────────────────────────

export default function SalidasPage() {
  const { error: toastError } = useToast()
  const qc = useQueryClient()

  // ── listado ──
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendientes' | 'completos'>('todos')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // ── modal nueva salida ──
  const [showModal, setShowModal] = useState(false)
  const [concepto, setConcepto] = useState('')
  const [referencia, setReferencia] = useState('')
  const [buscarFactura, setBuscarFactura] = useState('')
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<CuentaPagarDto | null>(null)
  const [itemsFactura, setItemsFactura] = useState<ItemFactura[]>([])

  // ── queries ──
  const { data: salidas = [], isLoading } = useQuery({
    queryKey: ['almacen', 'salidas'],
    queryFn: () => almacenApi.getSalidas(),
  })

  const { data: facturasPendientes = [] } = useQuery({
    queryKey: ['cxp', 'facturas-pendientes', buscarFactura],
    queryFn: () => cxpApi.facturas.pendientesInventario(buscarFactura || undefined),
    enabled: showModal,
  })

  // Pre-poblar ítems al seleccionar factura
  useEffect(() => {
    if (!facturaSeleccionada) { setItemsFactura([]); return }
    setItemsFactura(
      facturaSeleccionada.detalles
        .filter(d => d.cantidadPendiente > 0 && d.productoId !== null)
        .map(d => ({
          detalleId: d.id,
          productoId: d.productoId!,
          descripcion: d.descripcion,
          cantidadPendiente: d.cantidadPendiente,
          cantidadASalir: d.cantidadPendiente,
          incluir: true,
        }))
    )
    setConcepto(`Salida factura ${facturaSeleccionada.facturaNumero ?? facturaSeleccionada.id}`)
    setReferencia(facturaSeleccionada.facturaNumero ?? '')
  }, [facturaSeleccionada])

  const resetModal = () => {
    setShowModal(false)
    setConcepto('')
    setReferencia('')
    setBuscarFactura('')
    setFacturaSeleccionada(null)
    setItemsFactura([])
  }

  const mutation = useMutation({
    mutationFn: () => {
      const activos = itemsFactura.filter(i => i.incluir && i.cantidadASalir > 0)
      return almacenApi.salidaDesdeFactura({
        cuentaPagarId: facturaSeleccionada!.id,
        concepto,
        referencia: referencia || undefined,
        items: activos.map(i => ({
          cuentaPagarDetalleId: i.detalleId,
          productoId: i.productoId,
          cantidad: i.cantidadASalir,
        })),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['almacen'] })
      qc.invalidateQueries({ queryKey: ['productos'] })
      qc.invalidateQueries({ queryKey: ['cxp'] })
      resetModal()
    },
    onError: (e) => toastError(errMsg(e)),
  })

  // ── filtrado ──
  const filtradas = salidas.filter(s => {
    if (search) {
      const q = search.toLowerCase()
      if (!s.proveedorNombre.toLowerCase().includes(q) &&
        !(s.facturaNumero ?? '').toLowerCase().includes(q) &&
        !(s.referencia ?? '').toLowerCase().includes(q) &&
        !s.concepto.toLowerCase().includes(q)) return false
    }
    if (filtroEstado === 'pendientes' && s.estadoInventario === 'Completo') return false
    if (filtroEstado === 'completos' && s.estadoInventario !== 'Completo') return false
    return true
  })

  // ── expansión ──
  const rowKey = (s: SalidaResumenDto) => `${s.cuentaPagarId}-${s.fecha}-${s.usuarioId}`
  const toggleRow = (key: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  // ── modal helpers ──
  const updateCant = (detalleId: number, val: number) =>
    setItemsFactura(prev => prev.map(i =>
      i.detalleId === detalleId
        ? { ...i, cantidadASalir: Math.min(Math.max(0, val), i.cantidadPendiente) }
        : i
    ))
  const toggleIncluir = (detalleId: number) =>
    setItemsFactura(prev => prev.map(i =>
      i.detalleId === detalleId ? { ...i, incluir: !i.incluir } : i
    ))
  const itemsActivos = itemsFactura.filter(i => i.incluir && i.cantidadASalir > 0)
  const canSubmit = !!facturaSeleccionada && !!concepto && itemsActivos.length > 0

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── encabezado ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Salidas de Mercancía</h2>
        <Button onClick={() => setShowModal(true)}><Plus size={15} /> Nueva salida</Button>
      </div>

      {/* ── filtros ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por proveedor, factura, referencia o concepto…"
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </div>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl text-xs shrink-0">
              {(['todos', 'pendientes', 'completos'] as const).map(v => (
                <button key={v}
                  onClick={() => setFiltroEstado(v)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors capitalize ${filtroEstado === v ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                  {v === 'todos' ? 'Todos' : v === 'pendientes' ? 'Con pendientes' : 'Completados'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 w-8" />
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-left">Proveedor</th>
                  <th className="px-4 py-2 text-left">Factura</th>
                  <th className="px-4 py-2 text-left">Referencia</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-left">Completado por</th>
                  <th className="px-4 py-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">Cargando…</td></tr>
                )}
                {!isLoading && filtradas.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    <Package size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-medium">No hay salidas registradas</p>
                    <p className="text-xs mt-1">Las salidas se generan al atender ítems de una factura pendiente.</p>
                  </td></tr>
                )}
                {filtradas.map(s => {
                  const key = rowKey(s)
                  const isOpen = expanded.has(key)
                  return (
                    <>
                      <tr
                        key={key}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => toggleRow(key)}
                      >
                        <td className="px-4 py-3 text-slate-400">
                          {isOpen
                            ? <ChevronDown size={15} />
                            : <ChevronRight size={15} />}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium text-slate-700">{fmt(s.fecha)}</p>
                          <p className="text-xs text-slate-400">{fmtHora(s.fecha)}</p>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{s.proveedorNombre}</td>
                        <td className="px-4 py-3">
                          {s.facturaNumero
                            ? <span className="inline-flex items-center gap-1 text-brand-600 font-medium">
                                <FileText size={13} />{s.facturaNumero}
                              </span>
                            : <span className="text-slate-400">Fact. #{s.cuentaPagarId}</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{s.referencia ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {s.totalCosto > 0 ? fmtMoney(s.totalCosto) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{s.nombreUsuario}</td>
                        <td className="px-4 py-3">{estadoBadge(s.estadoInventario)}</td>
                      </tr>

                      {/* ── fila expandida: detalle de ítems ── */}
                      {isOpen && (
                        <tr key={`${key}-detail`} className="bg-slate-50">
                          <td colSpan={8} className="px-8 py-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                              {s.totalItems} producto(s) en esta salida
                            </p>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-slate-400 uppercase border-b border-slate-200">
                                  <th className="pb-1.5 text-left pr-4">Producto</th>
                                  <th className="pb-1.5 text-left pr-4">Código de barra</th>
                                  <th className="pb-1.5 text-right pr-4">Cantidad</th>
                                  <th className="pb-1.5 text-right pr-4">Costo unit.</th>
                                  <th className="pb-1.5 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {s.items.map(item => (
                                  <tr key={item.id}>
                                    <td className="py-1.5 pr-4 font-medium text-slate-700">{item.nombreProducto}</td>
                                    <td className="py-1.5 pr-4 text-slate-400">{item.codigoBarra ?? '—'}</td>
                                    <td className="py-1.5 pr-4 text-right">{item.cantidad}</td>
                                    <td className="py-1.5 pr-4 text-right text-slate-500">
                                      {item.costoUnitario != null ? fmtMoney(item.costoUnitario) : '—'}
                                    </td>
                                    <td className="py-1.5 text-right font-medium">
                                      {item.costoUnitario != null
                                        ? fmtMoney(item.cantidad * item.costoUnitario)
                                        : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              {s.totalCosto > 0 && (
                                <tfoot>
                                  <tr className="border-t border-slate-200">
                                    <td colSpan={4} className="pt-2 text-right text-xs text-slate-500 font-medium pr-4">Total</td>
                                    <td className="pt-2 text-right font-bold text-slate-800">{fmtMoney(s.totalCosto)}</td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Modal nueva salida                                                  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Modal open={showModal} onClose={resetModal} title="Registrar salida desde factura" size="xl">
        <div className="space-y-4">

          {/* Buscador de facturas */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Buscar factura pendiente</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={buscarFactura}
                onChange={e => { setBuscarFactura(e.target.value); setFacturaSeleccionada(null) }}
                placeholder="Número de factura, NCF o proveedor…"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand-500"
              />
            </div>

            {facturasPendientes.length > 0 && !facturaSeleccionada && (
              <div className="mt-1 border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-44 overflow-y-auto">
                {facturasPendientes.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFacturaSeleccionada(f)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">{f.proveedorNombre}</span>
                        <span className="text-slate-400 text-xs ml-2">{f.facturaNumero ?? f.ncf ?? `#${f.id}`}</span>
                      </div>
                      <span className="text-xs text-amber-600 font-medium">
                        {f.detalles.filter(d => d.cantidadPendiente > 0).length} pendiente(s)
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {buscarFactura && facturasPendientes.length === 0 && (
              <p className="text-xs text-slate-400 mt-1 px-1">No hay facturas con ítems pendientes para esa búsqueda.</p>
            )}
          </div>

          {/* Factura seleccionada */}
          {facturaSeleccionada && (
            <div className="border border-brand-200 bg-brand-50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-slate-800">{facturaSeleccionada.proveedorNombre}</p>
                  <p className="text-xs text-slate-500">
                    {facturaSeleccionada.facturaNumero ?? facturaSeleccionada.ncf ?? `Factura #${facturaSeleccionada.id}`}
                    {' · '}{facturaSeleccionada.fechaEmision}
                  </p>
                </div>
                <button
                  onClick={() => { setFacturaSeleccionada(null); setItemsFactura([]) }}
                  className="text-xs text-slate-400 hover:text-slate-600 underline">
                  Cambiar
                </button>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                    <th className="text-left pb-1.5 pr-2">
                      <input type="checkbox"
                        checked={itemsFactura.every(i => i.incluir)}
                        onChange={e => setItemsFactura(prev => prev.map(i => ({ ...i, incluir: e.target.checked })))}
                        className="mr-1.5" />
                      Producto
                    </th>
                    <th className="text-right pb-1.5 pr-2">Pendiente</th>
                    <th className="text-right pb-1.5">A salir ahora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemsFactura.map(item => (
                    <tr key={item.detalleId} className={item.incluir ? '' : 'opacity-40'}>
                      <td className="py-1.5 pr-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={item.incluir}
                            onChange={() => toggleIncluir(item.detalleId)} />
                          <span className="font-medium">{item.descripcion}</span>
                        </label>
                      </td>
                      <td className="py-1.5 pr-2 text-right text-slate-500">{item.cantidadPendiente}</td>
                      <td className="py-1.5 text-right">
                        <input
                          type="number" min={0} max={item.cantidadPendiente} step="0.001"
                          value={item.cantidadASalir || ''}
                          onChange={e => updateCant(item.detalleId, parseFloat(e.target.value) || 0)}
                          disabled={!item.incluir}
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm text-right outline-none focus:border-brand-500 disabled:bg-slate-50"
                        />
                      </td>
                    </tr>
                  ))}
                  {itemsFactura.length === 0 && (
                    <tr><td colSpan={3} className="py-3 text-center text-slate-400 text-xs">
                      Esta factura no tiene ítems con producto asignado y cantidad pendiente.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Campos comunes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Concepto *</label>
              <input value={concepto} onChange={e => setConcepto(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Referencia</label>
              <input value={referencia} onChange={e => setReferencia(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
          </div>

          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!canSubmit}
            className="w-full">
            <ArrowUp size={15} />
            Registrar {itemsActivos.length > 0 ? `${itemsActivos.length} ítem(s)` : 'salida'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
