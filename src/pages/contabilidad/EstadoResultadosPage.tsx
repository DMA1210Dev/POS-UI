import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportesContablesApi } from '../../api'
import { Card, CardBody } from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import EmptyState from '../../components/ui/EmptyState'

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
const fmtFechaISO = (d: Date) => d.toISOString().slice(0, 10)

export default function EstadoResultadosPage() {
  const [desde, setDesde] = useState(() => fmtFechaISO(new Date(new Date().getFullYear(), 0, 1)))
  const [hasta, setHasta] = useState(() => fmtFechaISO(new Date()))

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['estado-resultados', desde, hasta],
    queryFn: () => reportesContablesApi.estadoResultados({ desde, hasta }),
  })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-lg font-bold text-slate-800">Estado de Resultados</h1>

      <div className="flex items-center gap-3">
        <Input label="Desde" type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        <Input label="Hasta" type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
      </div>

      {isLoading && <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>}
      {isError && <EmptyState variant="error" onRetry={refetch} />}

      {data && (
        <>
          {/* ── Resumen ───────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-xs text-emerald-600 uppercase tracking-wide font-semibold">Ingresos</p>
              <p className="text-xl font-bold text-emerald-800 mt-1">{fmt(data.totalIngresos)}</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4">
              <p className="text-xs text-orange-600 uppercase tracking-wide font-semibold">Costos</p>
              <p className="text-xl font-bold text-orange-800 mt-1">{fmt(data.totalCostos)}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4">
              <p className="text-xs text-red-600 uppercase tracking-wide font-semibold">Gastos</p>
              <p className="text-xl font-bold text-red-800 mt-1">{fmt(data.totalGastos)}</p>
            </div>
            <div className="bg-brand-50 rounded-xl p-4">
              <p className="text-xs text-brand-600 uppercase tracking-wide font-semibold">Utilidad Neta</p>
              <p className={`text-xl font-bold mt-1 ${data.utilidadNeta >= 0 ? 'text-brand-800' : 'text-red-800'}`}>
                {fmt(data.utilidadNeta)}
              </p>
            </div>
          </div>

          {/* ── Ingresos ──────────────────────────────────── */}
          <Card>
            <CardBody className="!p-0">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-emerald-700">Ingresos</h3>
                <span className="text-sm font-bold text-emerald-700">{fmt(data.totalIngresos)}</span>
              </div>
              <RenderItems items={data.ingresos} />
            </CardBody>
          </Card>

          {/* ── Costos ────────────────────────────────────── */}
          <Card>
            <CardBody className="!p-0">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-orange-700">Costos</h3>
                <span className="text-sm font-bold text-orange-700">{fmt(data.totalCostos)}</span>
              </div>
              <RenderItems items={data.costos} />
            </CardBody>
          </Card>

          {/* ── Gastos ────────────────────────────────────── */}
          <Card>
            <CardBody className="!p-0">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-red-700">Gastos Operacionales</h3>
                <span className="text-sm font-bold text-red-700">{fmt(data.totalGastos)}</span>
              </div>
              <RenderItems items={data.gastos} />
            </CardBody>
          </Card>

          {/* ── Resultado final ────────────────────────────── */}
          <Card>
            <CardBody className="!p-0">
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">Utilidad Bruta</span>
                <span className="text-sm font-bold text-slate-800">{fmt(data.utilidadBruta)}</span>
              </div>
              <div className="px-4 pb-3 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm font-bold text-slate-900">Utilidad Neta del Período</span>
                <span className={`text-base font-bold ${data.utilidadNeta >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
                  {fmt(data.utilidadNeta)}
                </span>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}

function RenderItems({ items }: { items: { codigo: string; nombre: string; nivel: number; saldo: number }[] }) {
  if (items.length === 0) return <div className="px-4 py-6 text-sm text-slate-400 text-center">Sin movimientos</div>
  return (
    <div className="divide-y divide-slate-50">
      {items.map(item => (
        <div key={item.codigo} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-400">{item.codigo}</span>
            <span className={`text-sm ${item.nivel <= 2 ? 'font-semibold' : ''} text-slate-800`}>{item.nombre}</span>
          </div>
          <span className="text-sm font-mono font-medium text-slate-700">{fmt(item.saldo)}</span>
        </div>
      ))}
    </div>
  )
}
