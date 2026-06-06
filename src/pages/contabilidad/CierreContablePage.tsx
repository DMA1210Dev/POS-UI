import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Lock, AlertTriangle, CheckCircle, Calendar } from 'lucide-react'
import { reportesContablesApi } from '../../api'
import { Card, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import { useToast, errMsg } from '../../context/ToastContext'
import { useQuery } from '@tanstack/react-query'
import { asientosApi } from '../../api'

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)

export default function CierreContablePage() {
  const { success, error } = useToast()
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [resultado, setResultado] = useState<{ asientoCierreId: number; utilidadNeta: number; cuentasCerradas: number } | null>(null)

  // Verificar si ya hay cierre para este período
  const { data: asientosExistentes } = useQuery({
    queryKey: ['asientos-cierre', anio, mes],
    queryFn: () => asientosApi.getAll({ referenciaTipo: 'Cierre', referenciaId: anio * 100 + mes }),
    enabled: true,
  })

  const yaCerrado = (asientosExistentes?.length ?? 0) > 0

  const cierreMutation = useMutation({
    mutationFn: () => reportesContablesApi.cierreContable({ anio, mes }),
    onSuccess: (res) => {
      success(res.mensaje)
      setResultado(res)
    },
    onError: (e) => error(errMsg(e)),
  })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Cierre Contable</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cierra las cuentas de resultado del período y traslada la utilidad/pérdida al patrimonio</p>
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <select
                value={anio}
                onChange={e => { setAnio(parseInt(e.target.value)); setResultado(null) }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={mes}
                onChange={e => { setMes(parseInt(e.target.value)); setResultado(null) }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                {[
                  { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' },
                  { v: 4, l: 'Abril' }, { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' },
                  { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' }, { v: 9, l: 'Septiembre' },
                  { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' },
                ].map(m => (
                  <option key={m.v} value={m.v}>{m.l}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              {yaCerrado && (
                <Badge color="green"><CheckCircle size={12} className="inline mr-1" />Cerrado</Badge>
              )}
              <Button
                onClick={() => cierreMutation.mutate()}
                loading={cierreMutation.isPending}
                disabled={yaCerrado}
                variant={yaCerrado ? 'secondary' : 'primary'}
              >
                <Lock size={15} />
                {yaCerrado ? 'Período ya cerrado' : 'Ejecutar cierre'}
              </Button>
            </div>
          </div>

          {cierreMutation.isError && (
            <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
              <AlertTriangle size={16} />
              {errMsg(cierreMutation.error)}
            </div>
          )}

          {resultado && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
                <CheckCircle size={18} />
                <span className="font-medium">Cierre completado</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-brand-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-brand-600 uppercase tracking-wide font-semibold">Asiento de Cierre</p>
                  <p className="text-xl font-bold text-brand-800 mt-1">#{resultado.asientoCierreId}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-emerald-600 uppercase tracking-wide font-semibold">Utilidad Neta</p>
                  <p className={`text-xl font-bold mt-1 ${resultado.utilidadNeta >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                    {fmt(resultado.utilidadNeta)}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Cuentas Cerradas</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">{resultado.cuentasCerradas}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                <Calendar size={12} className="inline mr-1" />
                Período: {mes}/{anio}
              </p>
            </div>
          )}

          {!resultado && !cierreMutation.isError && (
            <div className="mt-6">
              <EmptyState
                title="Selecciona un período"
                description="Elige el año y mes, luego presiona 'Ejecutar cierre' para cerrar las cuentas de resultado."
              />
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Explicación ──────────────────────────────────── */}
      <Card>
        <CardBody>
          <h3 className="text-sm font-semibold text-slate-800 mb-2">¿Qué hace el cierre contable?</h3>
          <ul className="space-y-1 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="text-brand-500 mt-0.5">•</span>
              Toma todas las cuentas de <strong>Ingreso</strong> y <strong>Gasto</strong> del período
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-500 mt-0.5">•</span>
              Las lleva a cero (débito las de ingreso, crédito las de gasto)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-500 mt-0.5">•</span>
              La diferencia va a la cuenta <strong>Utilidad del Ejercicio</strong> (3.2.01)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-500 mt-0.5">•</span>
              Una vez cerrado un período, <strong>no se puede cerrar de nuevo</strong>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-500 mt-0.5">•</span>
              El nuevo período empieza con saldo cero en cuentas de resultado
            </li>
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}
