import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, FileText } from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { reportesApi } from '../../api'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'

const fmt    = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
const today  = new Date().toISOString().split('T')[0]
const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

// ── Helpers de exportación ────────────────────────────────────────────────
function exportExcel(sheetName: string, rows: object[], fileName: string) {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}

function exportPDF(title: string, columns: string[], rows: (string | number)[][], fileName: string) {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text(title, 14, 15)
  doc.setFontSize(9)
  doc.text(`Generado: ${new Date().toLocaleString('es-DO')}`, 14, 22)
  autoTable(doc, { head: [columns], body: rows.map(r => r.map(String)), startY: 27, styles: { fontSize: 8 } })
  doc.save(`${fileName}.pdf`)
}

export default function ReportesPage() {
  const [desde, setDesde] = useState(firstDay)
  const [hasta, setHasta] = useState(today)
  const [tab, setTab]     = useState<'ventas' | 'itbis' | 'productos' | 'rentabilidad'>('ventas')

  const params = { desde, hasta }

  const ventas       = useQuery({ queryKey: ['reportes', 'ventas',    params], queryFn: () => reportesApi.ventas(params) })
  const itbis        = useQuery({ queryKey: ['reportes', 'itbis',     params], queryFn: () => reportesApi.itbis(params) })
  const productos    = useQuery({ queryKey: ['reportes', 'productos', params], queryFn: () => reportesApi.productosMasVendidos(params) })
  const rentabilidad = useQuery({ queryKey: ['reportes', 'rent',      params], queryFn: () => reportesApi.rentabilidad(params) })

  // ── Exportar ventas por día ───────────────────────────────────────────────
  const exportarVentas = (tipo: 'xlsx' | 'pdf') => {
    const data = ventas.data
    if (!data) return
    const rows = data.porDia.map(d => ({ Fecha: d.fecha, Cantidad: d.cantidad, Total: fmt(d.total) }))
    if (tipo === 'xlsx') exportExcel('Ventas', rows, `Ventas_${desde}_${hasta}`)
    else exportPDF(`Reporte de ventas (${desde} – ${hasta})`, ['Fecha', 'Cantidad', 'Total'], data.porDia.map(d => [d.fecha, d.cantidad, fmt(d.total)]), `Ventas_${desde}_${hasta}`)
  }

  // ── Exportar ITBIS ────────────────────────────────────────────────────────
  const exportarItbis = (tipo: 'xlsx' | 'pdf') => {
    const data = itbis.data
    if (!data) return
    const rows = data.porProducto.map(p => ({ Producto: p.nombreProducto, Cantidad: p.cantidadVendida, 'Base imponible': fmt(p.baseImponible), ITBIS: fmt(p.impuesto), Total: fmt(p.totalVendido) }))
    if (tipo === 'xlsx') exportExcel('ITBIS', rows, `ITBIS_${desde}_${hasta}`)
    else exportPDF(`Reporte ITBIS (${desde} – ${hasta})`, ['Producto', 'Cantidad', 'Base', 'ITBIS', 'Total'], data.porProducto.map(p => [p.nombreProducto, p.cantidadVendida, fmt(p.baseImponible), fmt(p.impuesto), fmt(p.totalVendido)]), `ITBIS_${desde}_${hasta}`)
  }

  // ── Exportar productos más vendidos ──────────────────────────────────────
  const exportarProductos = (tipo: 'xlsx' | 'pdf') => {
    const data = productos.data
    if (!data) return
    const rows = data.map(p => ({
      Producto: p.nombre, Tipo: p.tipo,
      'Cantidad vendida': p.cantidadVendida, '# Ventas': p.numVentas,
      'Total ingresado': fmt(p.totalIngresado),
      'Costo total': p.costoTotal > 0 ? fmt(p.costoTotal) : '—',
      'Margen bruto': p.costoTotal > 0 ? fmt(p.margenBruto) : '—',
      'Margen %': p.costoTotal > 0 ? `${p.porcentajeMargen}%` : '—',
    }))
    if (tipo === 'xlsx') exportExcel('Productos', rows, `ProductosMasVendidos_${desde}_${hasta}`)
    else exportPDF(
      `Productos más vendidos (${desde} – ${hasta})`,
      ['Producto', 'Tipo', 'Cant.', '# Ventas', 'Total', 'Costo', 'Margen', 'Margen%'],
      data.map(p => [p.nombre, p.tipo, p.cantidadVendida, p.numVentas, fmt(p.totalIngresado),
        p.costoTotal > 0 ? fmt(p.costoTotal) : '—',
        p.costoTotal > 0 ? fmt(p.margenBruto) : '—',
        p.costoTotal > 0 ? `${p.porcentajeMargen}%` : '—']),
      `ProductosMasVendidos_${desde}_${hasta}`)
  }

  // ── Exportar rentabilidad ─────────────────────────────────────────────────
  const exportarRentabilidad = (tipo: 'xlsx' | 'pdf') => {
    const data = rentabilidad.data
    if (!data) return
    const rows = [
      { Concepto: 'Total de ventas',    Valor: data.totalVentas },
      { Concepto: 'Ingresos brutos',    Valor: fmt(data.ingresosBrutos) },
      { Concepto: 'Total ITBIS',        Valor: fmt(data.totalImpuestos) },
      { Concepto: 'Total descuentos',   Valor: fmt(data.totalDescuentos) },
      { Concepto: 'Ingreso neto',       Valor: fmt(data.ingresoNeto) },
      { Concepto: 'Promedio por venta', Valor: fmt(data.promedioVenta) },
      ...(data.tieneCostos ? [
        { Concepto: 'Costo total',      Valor: fmt(data.costoTotal) },
        { Concepto: 'Ganancia bruta',   Valor: fmt(data.gananciaBruta) },
        { Concepto: 'Margen de ganancia', Valor: `${data.porcentajeMargen}%` },
      ] : []),
    ]
    if (tipo === 'xlsx') exportExcel('Rentabilidad', rows, `Rentabilidad_${desde}_${hasta}`)
    else exportPDF(`Rentabilidad (${desde} – ${hasta})`, ['Concepto', 'Valor'], rows.map(r => [r.Concepto, String(r.Valor)]), `Rentabilidad_${desde}_${hasta}`)
  }

  const tabs = [
    { key: 'ventas',       label: 'Ventas' },
    { key: 'itbis',        label: 'ITBIS' },
    { key: 'productos',    label: 'Más vendidos' },
    { key: 'rentabilidad', label: 'Rentabilidad' },
  ] as const

  const exportButtons = (onExcel: () => void, onPDF: () => void) => (
    <div className="flex gap-2">
      <button onClick={onExcel} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-lg transition-colors">
        <FileSpreadsheet size={14} /> Excel
      </button>
      <button onClick={onPDF} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg transition-colors">
        <FileText size={14} /> PDF
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Reportes</h2>

      {/* Filtro de fechas */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Desde</label>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Hasta</label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500" />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ── Ventas ─────────────────────────────────────────────────────── */}
      {tab === 'ventas' && ventas.data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total ventas',   val: ventas.data.totalVentas },
            { label: 'Monto total',    val: fmt(ventas.data.montoTotal) },
            { label: 'Ventas contado', val: ventas.data.ventasContado },
            { label: 'Ventas crédito', val: ventas.data.ventasCredito },
          ].map(s => (
            <Card key={s.label}><CardBody>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{s.val}</p>
            </CardBody></Card>
          ))}
          <Card className="col-span-2 lg:col-span-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-700">Ventas por día</h3>
                {exportButtons(() => exportarVentas('xlsx'), () => exportarVentas('pdf'))}
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>{['Fecha', 'Cantidad', 'Total'].map(h => <th key={h} className="px-4 py-2 text-left">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ventas.data.porDia.map(d => (
                    <tr key={d.fecha} className="hover:bg-slate-50">
                      <td className="px-4 py-2">{d.fecha}</td>
                      <td className="px-4 py-2">{d.cantidad}</td>
                      <td className="px-4 py-2 font-semibold">{fmt(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── ITBIS ──────────────────────────────────────────────────────── */}
      {tab === 'itbis' && itbis.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              { label: 'Total ITBIS cobrado', val: fmt(itbis.data.totalItbis),       color: 'text-blue-600' },
              { label: 'Base gravada',         val: fmt(itbis.data.totalBaseGravada), color: 'text-slate-800' },
              { label: 'Base exenta',          val: fmt(itbis.data.totalBaseExenta),  color: 'text-green-600' },
            ].map(s => (
              <Card key={s.label}><CardBody>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.val}</p>
              </CardBody></Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-700">Desglose por producto</h3>
                {exportButtons(() => exportarItbis('xlsx'), () => exportarItbis('pdf'))}
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>{['Producto', 'Cantidad vendida', 'Base imponible', 'ITBIS', 'Total'].map(h => <th key={h} className="px-4 py-2 text-left">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itbis.data.porProducto.map(p => (
                    <tr key={p.nombreProducto} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium">{p.nombreProducto}</td>
                      <td className="px-4 py-2">{p.cantidadVendida}</td>
                      <td className="px-4 py-2">{fmt(p.baseImponible)}</td>
                      <td className="px-4 py-2 text-blue-600 font-semibold">{fmt(p.impuesto)}</td>
                      <td className="px-4 py-2 font-bold">{fmt(p.totalVendido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── Productos más vendidos ──────────────────────────────────────── */}
      {tab === 'productos' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">Top 10 productos más vendidos</h3>
              {exportButtons(() => exportarProductos('xlsx'), () => exportarProductos('pdf'))}
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  {['#', 'Producto', 'Tipo', 'Cantidad vendida', '# Ventas', 'Total ingresado', 'Costo total', 'Margen bruto', 'Margen %'].map(h => (
                    <th key={h} className="px-4 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(productos.data ?? []).map((p, i) => {
                  const tieneCosto = p.costoTotal > 0
                  const margenPositivo = p.margenBruto >= 0
                  return (
                    <tr key={p.productoId} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-400 font-bold">{i + 1}</td>
                      <td className="px-4 py-2 font-medium">{p.nombre}</td>
                      <td className="px-4 py-2 text-slate-500">{p.tipo}</td>
                      <td className="px-4 py-2">{p.cantidadVendida} {p.unidadMedida}</td>
                      <td className="px-4 py-2">{p.numVentas}</td>
                      <td className="px-4 py-2 font-bold text-green-700">{fmt(p.totalIngresado)}</td>
                      <td className="px-4 py-2 text-slate-500">{tieneCosto ? fmt(p.costoTotal) : <span className="text-slate-300">—</span>}</td>
                      <td className={`px-4 py-2 font-semibold ${tieneCosto ? (margenPositivo ? 'text-emerald-600' : 'text-red-600') : 'text-slate-300'}`}>
                        {tieneCosto ? fmt(p.margenBruto) : '—'}
                      </td>
                      <td className={`px-4 py-2 font-semibold ${tieneCosto ? (margenPositivo ? 'text-emerald-600' : 'text-red-600') : 'text-slate-300'}`}>
                        {tieneCosto ? `${p.porcentajeMargen}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Rentabilidad ────────────────────────────────────────────────── */}
      {tab === 'rentabilidad' && rentabilidad.data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Resumen financiero */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-700">Resumen financiero</h3>
                {exportButtons(() => exportarRentabilidad('xlsx'), () => exportarRentabilidad('pdf'))}
              </div>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              {[
                ['Total de ventas',    rentabilidad.data.totalVentas,                ''],
                ['Ingresos brutos',    fmt(rentabilidad.data.ingresosBrutos),        ''],
                ['Total ITBIS',        fmt(rentabilidad.data.totalImpuestos),        'text-blue-600'],
                ['Total descuentos',   fmt(rentabilidad.data.totalDescuentos),       'text-orange-600'],
              ].map(([label, val, color]) => (
                <div key={String(label)} className="flex justify-between">
                  <span className="text-slate-500">{label}</span>
                  <span className={`font-semibold ${color}`}>{String(val)}</span>
                </div>
              ))}
              <div className="pt-3 border-t flex justify-between text-base font-bold">
                <span>Ingreso neto</span>
                <span className="text-green-700">{fmt(rentabilidad.data.ingresoNeto)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Promedio por venta</span>
                <span className="font-semibold">{fmt(rentabilidad.data.promedioVenta)}</span>
              </div>
            </CardBody>
          </Card>

          {/* Análisis de costos y margen */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-700">Análisis de costos y margen</h3>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              {!rentabilidad.data.tieneCostos ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
                  <p className="text-slate-400 text-xs">
                    Ningún producto en este período tiene precio de costo registrado.<br />
                    Agrega el <span className="font-semibold">precio de costo</span> a tus productos para ver el margen real de ganancia.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ingreso neto</span>
                    <span className="font-semibold text-green-700">{fmt(rentabilidad.data.ingresoNeto)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Costo total</span>
                    <span className="font-semibold text-red-600">{fmt(rentabilidad.data.costoTotal)}</span>
                  </div>
                  <div className="pt-3 border-t flex justify-between text-base font-bold">
                    <span>Ganancia bruta</span>
                    <span className={rentabilidad.data.gananciaBruta >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {fmt(rentabilidad.data.gananciaBruta)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Margen de ganancia</span>
                    <span className={`text-lg font-bold ${rentabilidad.data.porcentajeMargen >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {rentabilidad.data.porcentajeMargen}%
                    </span>
                  </div>
                  {/* Barra visual del margen */}
                  <div className="pt-1">
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${rentabilidad.data.porcentajeMargen >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(Math.abs(rentabilidad.data.porcentajeMargen), 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      * Solo incluye productos con precio de costo registrado
                    </p>
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          {/* Cards de resumen rápido (si hay costos) */}
          {rentabilidad.data.tieneCostos && (
            <>
              <Card className="lg:col-span-2">
                <CardBody>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    {[
                      { label: 'Ingresos brutos', val: fmt(rentabilidad.data.ingresosBrutos), color: 'text-slate-800' },
                      { label: 'Costo total',      val: fmt(rentabilidad.data.costoTotal),     color: 'text-red-600' },
                      { label: 'Ganancia bruta',   val: fmt(rentabilidad.data.gananciaBruta),  color: rentabilidad.data.gananciaBruta >= 0 ? 'text-emerald-600' : 'text-red-600' },
                      { label: 'Margen %',         val: `${rentabilidad.data.porcentajeMargen}%`, color: rentabilidad.data.porcentajeMargen >= 0 ? 'text-emerald-600' : 'text-red-600' },
                    ].map(s => (
                      <div key={s.label}>
                        <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                        <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
}
