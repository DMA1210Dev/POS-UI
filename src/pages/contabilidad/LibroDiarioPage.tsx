import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportesContablesApi } from '../../api'
import { Card, CardBody } from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import EmptyState from '../../components/ui/EmptyState'

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtFechaISO = (d: Date) => d.toISOString().slice(0, 10)

export default function LibroDiarioPage() {
  const [desde, setDesde] = useState(() => fmtFechaISO(new Date(new Date().getFullYear(), 0, 1)))
  const [hasta, setHasta] = useState(() => fmtFechaISO(new Date()))

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['libro-diario', desde, hasta],
    queryFn: () => reportesContablesApi.libroDiario({ desde, hasta }),
  })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-lg font-bold text-slate-800">Libro Diario</h1>

      <div className="flex items-center gap-3">
        <Input label="Desde" type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        <Input label="Hasta" type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
      </div>

      {isLoading && <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>}
      {isError && <EmptyState variant="error" onRetry={refetch} />}

      {data && (
        <Card>
          <CardBody className="!p-0">
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 text-xs text-slate-500">
              <span>Período: {fmtFecha(data.fechaDesde)} — {fmtFecha(data.fechaHasta)}</span>
              <span>Total Debe: <strong className="text-slate-700">{fmt(data.totalDebe)}</strong> | Total Haber: <strong className="text-slate-700">{fmt(data.totalHaber)}</strong> | Saldo: <strong className="text-slate-700">{fmt(data.saldoFinal)}</strong></span>
            </div>
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Asiento</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Concepto</th>
                    <th className="py-2.5 px-3">Cuenta</th>
                    <th className="py-2.5 px-3 text-right">Debe</th>
                    <th className="py-2.5 px-3 text-right">Haber</th>
                    <th className="py-2.5 px-3 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.lineas.map((l, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="py-1.5 px-3 text-xs text-slate-400 font-mono">{l.asientoId}</td>
                      <td className="py-1.5 px-3 text-xs text-slate-500 whitespace-nowrap">{fmtFecha(l.fecha)}</td>
                      <td className="py-1.5 px-3 text-xs text-slate-700 max-w-[200px] truncate" title={l.concepto}>{l.concepto}</td>
                      <td className="py-1.5 px-3">
                        <span className="font-mono text-xs text-slate-400">{l.codigoCuenta}</span>
                        <span className="text-xs text-slate-700 ml-1">{l.nombreCuenta}</span>
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-xs text-slate-700">{l.debe > 0 ? fmt(l.debe) : '-'}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-xs text-slate-700">{l.haber > 0 ? fmt(l.haber) : '-'}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-xs text-slate-600">{fmt(l.saldoAcumulado)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 font-semibold text-slate-800 text-sm">
                    <td className="py-3 px-3" colSpan={4}>Totales</td>
                    <td className="py-3 px-3 text-right font-mono">{fmt(data.totalDebe)}</td>
                    <td className="py-3 px-3 text-right font-mono">{fmt(data.totalHaber)}</td>
                    <td className="py-3 px-3 text-right font-mono">{fmt(data.saldoFinal)}</td>
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
