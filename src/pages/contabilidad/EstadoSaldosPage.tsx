import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { reportesContablesApi } from '../../api'
import { Card, CardBody } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import EmptyState from '../../components/ui/EmptyState'
import type { TipoCuenta } from '../../types'

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
const fmtFechaISO = (d: Date) => d.toISOString().slice(0, 10)

const TIPO_COLOR: Record<TipoCuenta, 'green' | 'red' | 'blue' | 'yellow' | 'orange'> = {
  Activo: 'green',
  Pasivo: 'red',
  Patrimonio: 'blue',
  Ingreso: 'yellow',
  Gasto: 'orange',
}

export default function EstadoSaldosPage() {
  const [corte, setCorte] = useState(() => fmtFechaISO(new Date()))
  const [busqueda, setBusqueda] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['estado-saldos', corte],
    queryFn: () => reportesContablesApi.estadoSaldos({ fechaCorte: corte }),
  })

  const cuentas = data?.cuentas ?? []
  const filtradas = busqueda
    ? cuentas.filter(c => c.codigo.includes(busqueda) || c.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : cuentas

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Estado de Saldos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Trial balance — resumen de saldos por cuenta</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Input label="Fecha de corte" type="date" value={corte} onChange={e => setCorte(e.target.value)} />
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
              <span>Corte: {new Date(data.fechaCorte).toLocaleDateString('es-DO')}</span>
              <span>Total Debe: <strong className="text-slate-700">{fmt(data.totalDebe)}</strong> | Total Haber: <strong className="text-slate-700">{fmt(data.totalHaber)}</strong></span>
            </div>
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Cuenta</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3 text-right">Debe</th>
                    <th className="py-2.5 px-3 text-right">Haber</th>
                    <th className="py-2.5 px-3 text-right">Saldo Deudor</th>
                    <th className="py-2.5 px-3 text-right">Saldo Acreedor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtradas.map(c => (
                    <tr key={c.cuentaContableId} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-mono text-xs text-slate-400">{c.codigo}</td>
                      <td className={`py-2 px-3 text-slate-800 ${c.nivel <= 2 ? 'font-semibold' : ''}`}>{c.nombre}</td>
                      <td className="py-2 px-3"><Badge color={TIPO_COLOR[c.tipo]}>{c.tipo}</Badge></td>
                      <td className="py-2 px-3 text-right font-mono text-sm text-slate-700">{c.totalDebe > 0 ? fmt(c.totalDebe) : '-'}</td>
                      <td className="py-2 px-3 text-right font-mono text-sm text-slate-700">{c.totalHaber > 0 ? fmt(c.totalHaber) : '-'}</td>
                      <td className="py-2 px-3 text-right font-mono text-sm text-green-700">{c.saldoDeudor > 0 ? fmt(c.saldoDeudor) : '-'}</td>
                      <td className="py-2 px-3 text-right font-mono text-sm text-red-700">{c.saldoAcreedor > 0 ? fmt(c.saldoAcreedor) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 font-semibold text-slate-800 text-sm">
                    <td className="py-3 px-3" colSpan={3}>Totales</td>
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
