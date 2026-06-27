import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Package, Truck, CheckCircle } from 'lucide-react'
import { almacenApi } from '../../api'
import type { SalidaResumenDto, VentaPendienteDespachoDto } from '../../types'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })

type Tab = 'pendientes' | 'despachadas'

export default function SalidasPage() {
  const [tab, setTab] = useState<Tab>('pendientes')
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [confirmando, setConfirmando] = useState<VentaPendienteDespachoDto | null>(null)
  const [referencia, setReferencia] = useState('')

  const queryClient = useQueryClient()

  const { data: pendientes = [], isLoading: loadingPendientes } = useQuery({
    queryKey: ['salidas-pendientes'],
    queryFn: () => almacenApi.getPendientesDespacho(),
    enabled: tab === 'pendientes',
  })

  const { data: despachadas = [], isLoading: loadingDespachadas } = useQuery({
    queryKey: ['salidas', desde, hasta],
    queryFn: () => almacenApi.getSalidas({ desde: desde || undefined, hasta: hasta || undefined }),
    enabled: tab === 'despachadas',
  })

  const despachoMut = useMutation({
    mutationFn: (ventaId: number) =>
      almacenApi.registrarDespacho({ ventaId, referencia: referencia || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salidas-pendientes'] })
      queryClient.invalidateQueries({ queryKey: ['salidas'] })
      setConfirmando(null)
      setReferencia('')
    },
  })

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-gray-800">Salidas de Inventario</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('pendientes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'pendientes'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Truck size={15} />
          Pendientes de despacho
          {pendientes.length > 0 && (
            <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {pendientes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('despachadas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'despachadas'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckCircle size={15} />
          Despachadas
        </button>
      </div>

      {/* ── PENDIENTES ─────────────────────────────────────────────────────── */}
      {tab === 'pendientes' && (
        <>
          {loadingPendientes && <p className="text-sm text-gray-500">Cargando...</p>}

          {!loadingPendientes && pendientes.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <CheckCircle size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Todo despachado</p>
              <p className="text-xs mt-1">No hay ventas pendientes de despacho.</p>
            </div>
          )}

          {!loadingPendientes && pendientes.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    <th className="px-4 py-3 w-8" />
                    <th className="px-4 py-3 font-medium text-gray-600">Factura / NCF</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Cliente</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Fecha venta</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Registrado por</th>
                    <th className="px-4 py-3 font-medium text-gray-600" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendientes.map((v: VentaPendienteDespachoDto) => (
                    <>
                      <tr
                        key={v.ventaId}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => toggleExpand(v.ventaId)}
                      >
                        <td className="px-4 py-3 text-gray-400">
                          {expandedIds.has(v.ventaId)
                            ? <ChevronDown size={16} />
                            : <ChevronRight size={16} />}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">
                          {v.numeroFactura ?? `Venta #${v.ventaId}`}
                        </td>
                        <td className="px-4 py-3 text-gray-800">{v.clienteNombre}</td>
                        <td className="px-4 py-3 text-gray-600">{fmtDate(v.fecha)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">
                          {fmt(v.totalVenta)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{v.nombreUsuario}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setConfirmando(v)
                              setReferencia('')
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            <Truck size={13} />
                            Despachar
                          </button>
                        </td>
                      </tr>

                      {expandedIds.has(v.ventaId) && (
                        <tr key={`${v.ventaId}-det`} className="bg-orange-50/40">
                          <td colSpan={7} className="px-6 py-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500 border-b border-orange-100">
                                  <th className="text-left py-1.5 font-medium">Producto</th>
                                  <th className="text-left py-1.5 font-medium">Código</th>
                                  <th className="text-right py-1.5 font-medium">Cantidad</th>
                                </tr>
                              </thead>
                              <tbody>
                                {v.items.map(item => (
                                  <tr key={item.productoId} className="text-gray-700">
                                    <td className="py-1.5">{item.nombreProducto}</td>
                                    <td className="py-1.5 font-mono text-gray-500">{item.codigoBarra ?? '—'}</td>
                                    <td className="py-1.5 text-right">{item.cantidad}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── DESPACHADAS ────────────────────────────────────────────────────── */}
      {tab === 'despachadas' && (
        <>
          <div className="flex gap-3 items-end bg-white p-4 rounded-xl border border-gray-200">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Desde</label>
              <input
                type="date"
                value={desde}
                onChange={e => setDesde(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={e => setHasta(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <button
              onClick={() => { setDesde(''); setHasta('') }}
              className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5"
            >
              Limpiar
            </button>
          </div>

          {loadingDespachadas && <p className="text-sm text-gray-500">Cargando...</p>}

          {!loadingDespachadas && despachadas.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Package size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No hay salidas despachadas en el período.</p>
            </div>
          )}

          {!loadingDespachadas && despachadas.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    <th className="px-4 py-3 w-8" />
                    <th className="px-4 py-3 font-medium text-gray-600">Factura / NCF</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Cliente</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Fecha despacho</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">Total venta</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">Unidades</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Despachado por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {despachadas.map((s: SalidaResumenDto) => (
                    <>
                      <tr
                        key={s.ventaId}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => toggleExpand(s.ventaId + 100000)}
                      >
                        <td className="px-4 py-3 text-gray-400">
                          {expandedIds.has(s.ventaId + 100000)
                            ? <ChevronDown size={16} />
                            : <ChevronRight size={16} />}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">
                          {s.numeroFactura ?? `Venta #${s.ventaId}`}
                        </td>
                        <td className="px-4 py-3 text-gray-800">{s.clienteNombre}</td>
                        <td className="px-4 py-3 text-gray-600">{fmtDate(s.fecha)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">
                          {fmt(s.totalVenta)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {s.totalUnidades.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{s.nombreUsuario}</td>
                      </tr>

                      {expandedIds.has(s.ventaId + 100000) && (
                        <tr key={`${s.ventaId}-det`} className="bg-blue-50/40">
                          <td colSpan={7} className="px-6 py-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500 border-b border-blue-100">
                                  <th className="text-left py-1.5 font-medium">Producto</th>
                                  <th className="text-left py-1.5 font-medium">Código</th>
                                  <th className="text-right py-1.5 font-medium">Cantidad</th>
                                  <th className="text-right py-1.5 font-medium">Costo Unit.</th>
                                  <th className="text-right py-1.5 font-medium">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.items.map(item => (
                                  <tr key={item.id} className="text-gray-700">
                                    <td className="py-1.5">{item.nombreProducto}</td>
                                    <td className="py-1.5 font-mono text-gray-500">{item.codigoBarra ?? '—'}</td>
                                    <td className="py-1.5 text-right">{item.cantidad}</td>
                                    <td className="py-1.5 text-right">
                                      {item.costoUnitario != null ? fmt(item.costoUnitario) : '—'}
                                    </td>
                                    <td className="py-1.5 text-right">
                                      {item.costoUnitario != null
                                        ? fmt(item.costoUnitario * item.cantidad)
                                        : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── MODAL CONFIRMAR DESPACHO ────────────────────────────────────────── */}
      {confirmando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Truck size={20} className="text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-800">Confirmar despacho</h2>
                <p className="text-sm text-gray-500">
                  {confirmando.numeroFactura ?? `Venta #${confirmando.ventaId}`} · {confirmando.clienteNombre}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
              {confirmando.items.map(item => (
                <div key={item.productoId} className="flex justify-between text-gray-700">
                  <span>{item.nombreProducto}</span>
                  <span className="font-medium">{item.cantidad} uds</span>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Referencia (opcional)</label>
              <input
                type="text"
                value={referencia}
                onChange={e => setReferencia(e.target.value)}
                placeholder="Ej: Guía de despacho #123"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmando(null)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => despachoMut.mutate(confirmando.ventaId)}
                disabled={despachoMut.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
              >
                {despachoMut.isPending ? 'Registrando...' : 'Confirmar despacho'}
              </button>
            </div>

            {despachoMut.isError && (
              <p className="text-xs text-red-500 text-center">
                Error al registrar el despacho. Intenta de nuevo.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
