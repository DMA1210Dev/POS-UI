import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, XCircle } from 'lucide-react'
import { reportesContablesApi } from '../../api'
import { Card, CardBody } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import EmptyState from '../../components/ui/EmptyState'

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
const fmtFechaISO = (d: Date) => d.toISOString().slice(0, 10)

export default function BalanceGeneralPage() {
  const [corte, setCorte] = useState(() => fmtFechaISO(new Date()))

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['balance-general', corte],
    queryFn: () => reportesContablesApi.balanceGeneral({ fechaCorte: corte }),
  })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Balance General</h1>
          <p className="text-sm text-slate-500 mt-0.5">Estado de situación financiera</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Input label="Fecha de corte" type="date" value={corte} onChange={e => setCorte(e.target.value)} />
      </div>

      {isLoading && <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>}
      {isError && <EmptyState variant="error" onRetry={refetch} />}

      {data && (
        <>
          {/* ── Resumen ───────────────────────────────────── */}
          <Card>
            <CardBody>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-semibold text-slate-800">¿Cuadra?</span>
                {data.cuadra
                  ? <Badge color="green"><CheckCircle size={12} className="inline mr-1" />Sí</Badge>
                  : <Badge color="red"><XCircle size={12} className="inline mr-1" />No</Badge>
                }
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">Total Activo</p>
                  <p className="text-xl font-bold text-green-800 mt-1">{fmt(data.totalActivo)}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-xs text-red-600 uppercase tracking-wide font-semibold">Total Pasivo</p>
                  <p className="text-xl font-bold text-red-800 mt-1">{fmt(data.totalPasivo)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Total Patrimonio</p>
                  <p className="text-xl font-bold text-blue-800 mt-1">{fmt(data.totalPatrimonio)}</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500 text-center">
                Activo ({fmt(data.totalActivo)}) = Pasivo ({fmt(data.totalPasivo)}) + Patrimonio ({fmt(data.totalPatrimonio)})
                {' '}= {fmt(data.totalPasivo + data.totalPatrimonio)}
              </div>
            </CardBody>
          </Card>

          {/* ── Activo ───────────────────────────────────── */}
          <Card>
            <CardBody className="!p-0">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-green-700">Activo</h3>
                <span className="text-sm font-bold text-green-700">{fmt(data.totalActivo)}</span>
              </div>
              <RenderItems items={data.activos} />
            </CardBody>
          </Card>

          {/* ── Pasivo ────────────────────────────────────── */}
          <Card>
            <CardBody className="!p-0">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-red-700">Pasivo</h3>
                <span className="text-sm font-bold text-red-700">{fmt(data.totalPasivo)}</span>
              </div>
              <RenderItems items={data.pasivos} />
            </CardBody>
          </Card>

          {/* ── Patrimonio ────────────────────────────────── */}
          <Card>
            <CardBody className="!p-0">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-blue-700">Patrimonio</h3>
                <span className="text-sm font-bold text-blue-700">{fmt(data.totalPatrimonio)}</span>
              </div>
              <RenderItems items={data.patrimonios} />
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
