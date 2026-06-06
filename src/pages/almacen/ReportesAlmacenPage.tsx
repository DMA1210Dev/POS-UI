import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Package, TrendingUp, TrendingDown, DollarSign, AlertTriangle, Search } from 'lucide-react'
import { almacenApi } from '../../api'
import { productosApi } from '../../api'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'

export default function ReportesAlmacenPage() {
  const today = new Date().toISOString().split('T')[0]
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const [desde, setDesde] = useState(firstDay)
  const [hasta, setHasta] = useState(today)
  const [kardexProdId, setKardexProdId] = useState<number | null>(null)

  const { data: reporte } = useQuery({
    queryKey: ['almacen', 'reportes', desde, hasta],
    queryFn: () => almacenApi.reportes({ desde, hasta }),
  })

  const { data: productos } = useQuery({
    queryKey: ['productos'],
    queryFn: () => productosApi.getAll({ soloActivos: true }),
  })

  const { data: kardex } = useQuery({
    queryKey: ['almacen', 'kardex', kardexProdId],
    queryFn: () => almacenApi.kardex(kardexProdId!),
    enabled: !!kardexProdId,
  })

  const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Reportes de Almacén</h2>

      {/* Filtros */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-brand-500" />
            </div>
            <div>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-brand-500" />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* KPI Cards */}
      {reporte && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardBody>
            <div className="flex items-center gap-2 text-success-600 mb-1">
              <TrendingDown size={16} />
              <span className="text-xs uppercase font-semibold tracking-wide">Entradas</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{reporte.totalEntradas}</p>
            <p className="text-xs text-slate-400">{reporte.totalUnidadesEntrada} unidades</p>
          </CardBody></Card>
          <Card><CardBody>
            <div className="flex items-center gap-2 text-danger-600 mb-1">
              <TrendingUp size={16} />
              <span className="text-xs uppercase font-semibold tracking-wide">Salidas</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{reporte.totalSalidas}</p>
            <p className="text-xs text-slate-400">{reporte.totalUnidadesSalida} unidades</p>
          </CardBody></Card>
          <Card><CardBody>
            <div className="flex items-center gap-2 text-brand-600 mb-1">
              <DollarSign size={16} />
              <span className="text-xs uppercase font-semibold tracking-wide">Valor inventario</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{fmt(reporte.valorTotalInventario)}</p>
            <p className="text-xs text-slate-400">a precio de costo</p>
          </CardBody></Card>
          <Card><CardBody>
            <div className="flex items-center gap-2 text-warning-600 mb-1">
              <AlertTriangle size={16} />
              <span className="text-xs uppercase font-semibold tracking-wide">Stock bajo</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{reporte.productosConStockBajo}</p>
            <p className="text-xs text-slate-400">productos por debajo del mínimo</p>
          </CardBody></Card>
        </div>
      )}

      {/* Kardex */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-700">Kardex de producto</h3>
        </CardHeader>
        <CardBody>
          <div className="flex items-center gap-3 mb-4">
            <Search size={16} className="text-slate-400" />
            <select value={kardexProdId ?? ''} onChange={e => setKardexProdId(e.target.value ? parseInt(e.target.value) : null)}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
              <option value="">Seleccionar producto…</option>
              {(productos ?? []).filter(p => p.tipo === 'Fisico').map(p => (
                <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.stock})</option>
              ))}
            </select>
          </div>

          {kardex && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Fecha</th>
                    <th className="px-4 py-2 text-left">Tipo</th>
                    <th className="px-4 py-2 text-left">Concepto</th>
                    <th className="px-4 py-2 text-right">Entrada</th>
                    <th className="px-4 py-2 text-right">Salida</th>
                    <th className="px-4 py-2 text-right font-bold">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kardex.map((k, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-500">{new Date(k.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-4 py-2">
                        <Badge color={k.tipo === 'Entrada' ? 'green' : 'red'}>{k.tipo}</Badge>
                      </td>
                      <td className="px-4 py-2">{k.concepto}</td>
                      <td className="px-4 py-2 text-right text-success-600 font-semibold">{k.entrada > 0 ? k.entrada : '—'}</td>
                      <td className="px-4 py-2 text-right text-danger-600 font-semibold">{k.salida > 0 ? k.salida : '—'}</td>
                      <td className="px-4 py-2 text-right font-bold text-slate-800">{k.saldo}</td>
                    </tr>
                  ))}
                  {kardex.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin movimientos para este producto</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Últimos movimientos */}
      {reporte && reporte.ultimosMovimientos.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-700">
              Últimos movimientos <span className="text-xs text-slate-400 font-normal">({reporte.totalMovimientos} total)</span>
            </h3>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Fecha</th>
                    <th className="px-4 py-2 text-left">Producto</th>
                    <th className="px-4 py-2 text-left">Tipo</th>
                    <th className="px-4 py-2 text-right">Cantidad</th>
                    <th className="px-4 py-2 text-left">Concepto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reporte.ultimosMovimientos.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-500">{new Date(m.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-4 py-2 font-medium">{m.nombreProducto}</td>
                      <td className="px-4 py-2">
                        <Badge color={m.tipo === 'Entrada' ? 'green' : 'red'}>{m.tipo}</Badge>
                      </td>
                      <td className={`px-4 py-2 text-right font-semibold ${m.tipo === 'Entrada' ? 'text-success-600' : 'text-danger-600'}`}>
                        {m.tipo === 'Entrada' ? '+' : '-'}{m.cantidad}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{m.concepto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
