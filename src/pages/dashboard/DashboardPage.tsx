import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ShoppingCart, CreditCard, AlertTriangle, TrendingUp, Clock, CheckCircle2,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { reportesApi, productosApi, creditosApi, ventasApi } from '../../api'
import { Card, CardBody } from '../../components/ui/Card'
import { useAuth } from '../../context/AuthContext'
import type { VentaResponse } from '../../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)

const fmtShort = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}k`
      : String(n)

const fmtFecha = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })
}

const fmtMes = (year: number, month: number) => {
  const d = new Date(year, month - 1, 1)
  return d.toLocaleDateString('es-DO', { month: 'short', year: '2-digit' })
}

function rangoUltimosDias(n: number) {
  const hasta = new Date()
  const desde = new Date()
  desde.setDate(desde.getDate() - n + 1)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { desde: iso(desde), hasta: iso(hasta) }
}

function rangoMes(mesesAtras: number) {
  const now = new Date()
  const m    = now.getMonth() + 1 - mesesAtras
  const year  = now.getFullYear() + Math.floor((m - 1) / 12)
  const month = ((m - 1 + 120) % 12) + 1
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return {
    desde: iso(new Date(year, month - 1, 1)),
    hasta: iso(new Date(year, month, 0)),
    label: fmtMes(year, month),
  }
}

const isoHoy = () => new Date().toISOString().slice(0, 10)

const isoInicioSemana = () => {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay())   // domingo anterior
  return d.toISOString().slice(0, 10)
}

const isoInicioMes = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const COLORES_TOP = ['#3b82f6','#6366f1','#8b5cf6','#ec4899','#f97316','#eab308','#22c55e','#14b8a6']

// ── Sub-componentes ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: {
  label: string; value: string | number; icon: React.ReactNode; color: string
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
        </div>
      </CardBody>
    </Card>
  )
}

// Campos que son moneda vs. conteo puro
const CAMPOS_MONEDA = new Set(['Total', 'Ingreso neto', 'total', 'ingresos'])

function TooltipMixto({ active, payload, label }: {
  active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}:{' '}
          <span className="font-bold">
            {CAMPOS_MONEDA.has(p.name) ? fmt(p.value) : p.value}
          </span>
        </p>
      ))}
    </div>
  )
}

function TooltipMoneda({ active, payload, label }: {
  active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

function TooltipGenerico({ active, payload, label }: {
  active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// ── Vista Cajero ──────────────────────────────────────────────────────────────

// Excluye canceladas y devueltas completas; para DevueltaParcial usa monto neto
function filtra(ventas: VentaResponse[], desde: string) {
  return ventas.filter(
    v => v.estado !== 'Cancelada' &&
         v.estado !== 'Devuelta' &&
         v.fechaVenta.slice(0, 10) >= desde,
  )
}

// Monto neto de una venta descontando lo devuelto
const totalNeto = (v: VentaResponse) =>
  Math.max(0, v.total - (v.totalDevuelto ?? 0))

function VistaCajero({ ventas }: { ventas: VentaResponse[] }) {
  const hoy        = isoHoy()
  const inicioSem  = isoInicioSemana()
  const inicioMes  = isoInicioMes()

  const ventasHoy  = useMemo(() => filtra(ventas, hoy),       [ventas, hoy])
  const ventasSem  = useMemo(() => filtra(ventas, inicioSem), [ventas, inicioSem])
  const ventasMes  = useMemo(() => filtra(ventas, inicioMes), [ventas, inicioMes])

  const totalHoy   = ventasHoy.reduce((s, v) => s + totalNeto(v), 0)
  const totalSem   = ventasSem.reduce((s, v) => s + totalNeto(v), 0)
  const totalMes   = ventasMes.reduce((s, v) => s + totalNeto(v), 0)

  // Últimas 7 ventas (excluyendo canceladas y devueltas)
  const recientes  = [...ventas]
    .filter(v => v.estado !== 'Cancelada' && v.estado !== 'Devuelta')
    .sort((a, b) => b.fechaVenta.localeCompare(a.fechaVenta))
    .slice(0, 7)

  // Ventas por día de la semana actual (para la gráfica)
  const porDia = useMemo(() => {
    const map: Record<string, { fecha: string; cantidad: number; total: number }> = {}
    ventasSem.forEach(v => {
      const d = v.fechaVenta.slice(0, 10)
      if (!map[d]) map[d] = { fecha: fmtFecha(d), cantidad: 0, total: 0 }
      map[d].cantidad++
      map[d].total += totalNeto(v)
    })
    return Object.values(map).sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [ventasSem])

  return (
    <div className="space-y-6">
      {/* Stats personales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Vendido hoy"
          value={fmt(totalHoy)}
          icon={<ShoppingCart size={20} className="text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          label="Esta semana"
          value={fmt(totalSem)}
          icon={<TrendingUp size={20} className="text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          label="Este mes"
          value={fmt(totalMes)}
          icon={<CreditCard size={20} className="text-purple-600" />}
          color="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfica: ventas de la semana */}
        {porDia.length > 0 && (
          <Card>
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700">Mis ventas esta semana</h3>
              <p className="text-xs text-slate-400 mt-0.5">Total en RD$ por día</p>
            </div>
            <CardBody>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={porDia} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="fecha"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={fmtShort}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip content={<TooltipMoneda />} />
                  <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        )}

        {/* Últimas ventas */}
        <Card>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Clock size={16} className="text-slate-400" />
            <h3 className="font-semibold text-slate-700">Mis últimas ventas</h3>
          </div>
          {recientes.length === 0 ? (
            <CardBody>
              <p className="text-sm text-slate-400 text-center py-4">Sin ventas registradas aún.</p>
            </CardBody>
          ) : (
            <div className="divide-y divide-slate-100">
              {recientes.map(v => (
                <div key={v.id} className="px-6 py-3 flex justify-between items-center text-sm">
                  <div>
                    <p className="font-medium text-slate-700">
                      {new Date(v.fechaVenta).toLocaleString('es-DO', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                    <p className="text-xs text-slate-400">
                      {v.tipoPago} · {v.detalles.length} {v.detalles.length === 1 ? 'ítem' : 'ítems'}
                      {v.nombreCliente ? ` · ${v.nombreCliente}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                    <span className="font-semibold text-slate-800">{fmt(v.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ── Vista Admin ───────────────────────────────────────────────────────────────

function VistaAdmin() {
  const { data: rentabilidad } = useQuery({
    queryKey: ['reportes', 'rentabilidad'],
    queryFn: () => reportesApi.rentabilidad(),
  })

  const { data: stockBajo = [] } = useQuery({
    queryKey: ['productos', 'stock-bajo'],
    queryFn: productosApi.stockBajo,
  })

  const { data: resumenCreditos } = useQuery({
    queryKey: ['creditos', 'resumen'],
    queryFn: creditosApi.resumen,
  })

  const rango14 = rangoUltimosDias(14)
  const { data: ventas14 } = useQuery({
    queryKey: ['reportes', 'ventas', rango14.desde],
    queryFn: () => reportesApi.ventas(rango14),
  })

  const { data: topProductos = [] } = useQuery({
    queryKey: ['reportes', 'top-productos'],
    queryFn: () => reportesApi.productosMasVendidos({ top: 8 }),
  })

  const meses = [5, 4, 3, 2, 1, 0].map(n => rangoMes(n))
  const { data: mes0 } = useQuery({ queryKey: ['rent', meses[0].desde], queryFn: () => reportesApi.rentabilidad({ desde: meses[0].desde, hasta: meses[0].hasta }) })
  const { data: mes1 } = useQuery({ queryKey: ['rent', meses[1].desde], queryFn: () => reportesApi.rentabilidad({ desde: meses[1].desde, hasta: meses[1].hasta }) })
  const { data: mes2 } = useQuery({ queryKey: ['rent', meses[2].desde], queryFn: () => reportesApi.rentabilidad({ desde: meses[2].desde, hasta: meses[2].hasta }) })
  const { data: mes3 } = useQuery({ queryKey: ['rent', meses[3].desde], queryFn: () => reportesApi.rentabilidad({ desde: meses[3].desde, hasta: meses[3].hasta }) })
  const { data: mes4 } = useQuery({ queryKey: ['rent', meses[4].desde], queryFn: () => reportesApi.rentabilidad({ desde: meses[4].desde, hasta: meses[4].hasta }) })
  const { data: mes5 } = useQuery({ queryKey: ['rent', meses[5].desde], queryFn: () => reportesApi.rentabilidad({ desde: meses[5].desde, hasta: meses[5].hasta }) })

  const comparativoMensual = [
    { mes: meses[0].label, ventas: mes0?.totalVentas ?? 0, ingresos: mes0?.ingresoNeto ?? 0 },
    { mes: meses[1].label, ventas: mes1?.totalVentas ?? 0, ingresos: mes1?.ingresoNeto ?? 0 },
    { mes: meses[2].label, ventas: mes2?.totalVentas ?? 0, ingresos: mes2?.ingresoNeto ?? 0 },
    { mes: meses[3].label, ventas: mes3?.totalVentas ?? 0, ingresos: mes3?.ingresoNeto ?? 0 },
    { mes: meses[4].label, ventas: mes4?.totalVentas ?? 0, ingresos: mes4?.ingresoNeto ?? 0 },
    { mes: meses[5].label, ventas: mes5?.totalVentas ?? 0, ingresos: mes5?.ingresoNeto ?? 0 },
  ]

  const ventasPorDia = (ventas14?.porDia ?? []).map(d => ({
    ...d,
    fecha: fmtFecha(d.fecha),
  }))

  const topData = [...topProductos]
    .sort((a, b) => b.totalIngresado - a.totalIngresado)
    .map(p => ({
      nombre: p.nombre.length > 18 ? p.nombre.slice(0, 17) + '…' : p.nombre,
      cantidad: p.cantidadVendida,
      ingresos: p.totalIngresado,
    }))

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Ventas del mes"
          value={rentabilidad?.totalVentas ?? '—'}
          icon={<ShoppingCart size={20} className="text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          label="Ingresos netos"
          value={rentabilidad ? fmt(rentabilidad.ingresoNeto) : '—'}
          icon={<TrendingUp size={20} className="text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          label="Total en deudas"
          value={resumenCreditos ? fmt(resumenCreditos.totalDeuda) : '—'}
          icon={<CreditCard size={20} className="text-orange-600" />}
          color="bg-orange-50"
        />
        <StatCard
          label="Productos stock bajo"
          value={stockBajo.length}
          icon={<AlertTriangle size={20} className="text-red-600" />}
          color="bg-red-50"
        />
      </div>

      {/* Ventas por día */}
      {ventasPorDia.length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700">Ventas — últimos 14 días</h3>
            <p className="text-xs text-slate-400 mt-0.5">Total en RD$ por día</p>
          </div>
          <CardBody>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={ventasPorDia} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} />
                <Tooltip content={<TooltipMixto />} />
                <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="cantidad" name="Ventas" stroke="#a5f3fc" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}

      {/* Top productos + Comparativo mensual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {topData.length > 0 && (
          <Card>
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700">Top productos más vendidos</h3>
              <p className="text-xs text-slate-400 mt-0.5">Por cantidad vendida</p>
            </div>
            <CardBody>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart layout="vertical" data={topData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="nombre" width={120} tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<TooltipGenerico />} />
                  <Bar dataKey="cantidad" name="Cantidad" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {topData.map((_, i) => <Cell key={i} fill={COLORES_TOP[i % COLORES_TOP.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        )}

        <Card>
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700">Comparativo mensual</h3>
            <p className="text-xs text-slate-400 mt-0.5">Últimos 6 meses — ingreso neto vs. nº ventas</p>
          </div>
          <CardBody>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={comparativoMensual} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left"  tickFormatter={fmtShort} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={32} />
                <Tooltip content={<TooltipMixto />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left"  dataKey="ingresos" name="Ingreso neto" fill="#3b82f6" radius={[4,4,0,0]} maxBarSize={36} />
                <Bar yAxisId="right" dataKey="ventas"   name="Nº ventas"    fill="#a5b4fc" radius={[4,4,0,0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      {/* Stock bajo */}
      {stockBajo.length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <h3 className="font-semibold text-slate-700">Productos con stock bajo</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {stockBajo.slice(0, 5).map(p => (
              <div key={p.id} className="px-6 py-3 flex justify-between items-center text-sm">
                <span className="font-medium text-slate-700">{p.nombre}</span>
                <span className="text-red-600 font-semibold">{p.stock} / {p.stockMinimo} min</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Resumen financiero + Créditos */}
      {rentabilidad && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700">Resumen financiero del mes</h3>
            </div>
            <CardBody className="space-y-3 text-sm">
              {([
                ['Ingresos brutos', rentabilidad.ingresosBrutos],
                ['Total ITBIS',     rentabilidad.totalImpuestos],
                ['Descuentos',      rentabilidad.totalDescuentos],
                ['Ingreso neto',    rentabilidad.ingresoNeto],
              ] as [string, number][]).map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-semibold">{fmt(val)}</span>
                </div>
              ))}
              <div className="pt-2 border-t flex justify-between font-bold">
                <span>Promedio por venta</span>
                <span>{fmt(rentabilidad.promedioVenta)}</span>
              </div>
            </CardBody>
          </Card>

          {resumenCreditos && (
            <Card>
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-700">Estado de créditos</h3>
              </div>
              <CardBody className="space-y-3 text-sm">
                {([
                  ['Pendientes',     resumenCreditos.creditosPendientes,    'text-yellow-600'],
                  ['Pagado parcial', resumenCreditos.creditosPagadoParcial, 'text-blue-600'],
                  ['Vencidos',       resumenCreditos.creditosVencidos,      'text-red-600'],
                  ['Saldados',       resumenCreditos.creditosSaldados,      'text-green-600'],
                ] as [string, number, string][]).map(([label, val, color]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-slate-500">{label}</span>
                    <span className={`font-semibold ${color}`}>{val}</span>
                  </div>
                ))}
                <div className="pt-2 border-t flex justify-between font-bold text-red-700">
                  <span>Total por cobrar</span>
                  <span>{fmt(resumenCreditos.totalDeuda)}</span>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ── DashboardPage ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { isAdmin, isGerente, isCajero } = useAuth()

  // Vista admin-like: AdminSistema + GerenteGeneral + Finanzas
  const vistaAdmin = isAdmin || isGerente

  const { data: misVentas = [] } = useQuery({
    queryKey: ['ventas', 'mis-ventas'],
    queryFn: ventasApi.misVentas,
    enabled: isCajero,
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
        <p className="text-slate-500 text-sm mt-1">
          {vistaAdmin ? 'Resumen general del negocio' : 'Resumen de tus ventas'}
        </p>
      </div>

      {vistaAdmin ? <VistaAdmin /> : <VistaCajero ventas={misVentas} />}
    </div>
  )
}
