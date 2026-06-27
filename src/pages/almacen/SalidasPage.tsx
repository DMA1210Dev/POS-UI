import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Package } from 'lucide-react'
import { almacenApi } from '../../api'
import type { SalidaResumenDto } from '../../types'

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })

export default function SalidasPage() {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const { data: salidas = [], isLoading, isError } = useQuery({
    queryKey: ['salidas', desde, hasta],
    queryFn: () => almacenApi.getSalidas({ desde: desde || undefined, hasta: hasta || undefined }),
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Salidas de Inventario</h1>
      </div>

      {/* Filtros */}
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

      {/* Tabla */}
      {isLoading && <p className="text-sm text-gray-500">Cargando salidas...</p>}
      {isError && <p className="text-sm text-red-500">Error al cargar las salidas.</p>}

      {!isLoading && salidas.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay salidas registradas.</p>
          <p className="text-xs mt-1">Las salidas se generan automáticamente al registrar una venta.</p>
        </div>
      )}

      {!isLoading && salidas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3 font-medium text-gray-600">Factura / NCF</th>
                <th className="px-4 py-3 font-medium text-gray-600">Cliente</th>
                <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Total Venta</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Unidades</th>
                <th className="px-4 py-3 font-medium text-gray-600">Registrado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {salidas.map((s: SalidaResumenDto) => (
                <>
                  <tr
                    key={s.ventaId}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => toggleExpand(s.ventaId)}
                  >
                    <td className="px-4 py-3 text-gray-400">
                      {expandedIds.has(s.ventaId)
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
                    <td className="px-4 py-3 text-gray-600 text-sm">{s.nombreUsuario}</td>
                  </tr>

                  {expandedIds.has(s.ventaId) && (
                    <tr key={`${s.ventaId}-detail`} className="bg-blue-50/40">
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
                          <tbody className="divide-y divide-blue-100">
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
    </div>
  )
}
