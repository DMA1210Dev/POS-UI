import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { reportesContablesApi } from '../../api'
import { Card, CardBody } from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import EmptyState from '../../components/ui/EmptyState'

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtFechaISO = (d: Date) => d.toISOString().slice(0, 10)

export default function MayorGeneralPage() {
  const [desde, setDesde] = useState(() => fmtFechaISO(new Date(new Date().getFullYear(), 0, 1)))
  const [hasta, setHasta] = useState(() => fmtFechaISO(new Date()))
  const [busqueda, setBusqueda] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['mayor-general', desde, hasta],
    queryFn: () => reportesContablesApi.mayorGeneral({ desde, hasta }),
  })

  const cuentas = data?.cuentas ?? []
  const filtradas = busqueda
    ? cuentas.filter(c => c.codigo.includes(busqueda) || c.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : cuentas

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-lg font-bold text-slate-800">Mayor General</h1>

      <div className="flex items-center gap-3 flex-wrap">
        <Input label="Desde" type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        <Input label="Hasta" type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
        <div className="relative min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar cuenta..."
            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-brand-500" />
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>}
      {isError && <EmptyState variant="error" onRetry={refetch} />}

      {data && (
        <Card>
          <CardBody className="!p-0">
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 text-xs text-slate-500">
              <span>Período: {fmtFecha(data.fechaDesde)} — {fmtFecha(data.fechaHasta)}</span>
              <span>Total Debe: <strong className="text-slate-700">{fmt(data.totalDebe)}</strong> | Total Haber: <strong className="text-slate-700">{fmt(data.totalHaber)}</strong></span>
            </div>
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Cuenta</th>
                    <th className="py-2.5 px-3 text-right">Total Debe</th>
                    <th className="py-2.5 px-3 text-right">Total Haber</th>
                    <th className="py-2.5 px-3 text-right">Saldo Deudor</th>
                    <th className="py-2.5 px-3 text-right">Saldo Acreedor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtradas.map(c => (
                    <tr key={c.cuentaContableId} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-mono text-xs text-slate-400">{c.codigo}</td>
                      <td className={`py-2 px-3 text-slate-800 ${c.nivel <= 2 ? 'font-semibold' : ''}`}>{c.nombre}</td>
                      <td className="py-2 px-3 text-right font-mono text-sm text-slate-700">{fmt(c.totalDebe)}</td>
                      <td className="py-2 px-3 text-right font-mono text-sm text-slate-700">{fmt(c.totalHaber)}</td>
                      <td className="py-2 px-3 text-right font-mono text-sm text-slate-700">{c.saldoDeudor > 0 ? fmt(c.saldoDeudor) : '-'}</td>
                      <td className="py-2 px-3 text-right font-mono text-sm text-slate-700">{c.saldoAcreedor > 0 ? fmt(c.saldoAcreedor) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 font-semibold text-slate-800 text-sm">
                    <td className="py-3 px-3" colSpan={2}>Totales</td>
                    <td className="py-3 px-3 text-right font-mono">{fmt(data.totalDebe)}</td>
                    <td className="py-3 px-3 text-right font-mono">{fmt(data.totalHaber)}</td>
                    <td className="py-3 px-3 text-right font-mono" colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
