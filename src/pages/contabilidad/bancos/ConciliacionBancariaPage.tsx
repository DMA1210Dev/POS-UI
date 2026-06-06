import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Plus } from 'lucide-react'
import { bancosApi } from '../../../api'
import { Card, CardBody } from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import Badge from '../../../components/ui/Badge'
import { useToast, errMsg } from '../../../context/ToastContext'

const fmt = (n: number) => n.toLocaleString('es-DO', { minimumFractionDigits: 2 })

const estadoBadge = (e: string) => {
  if (e === 'Conciliado') return <Badge color="green">Conciliado</Badge>
  if (e === 'Diferencia') return <Badge color="red">Diferencia</Badge>
  return <Badge color="yellow">Pendiente</Badge>
}

export default function ConciliacionBancariaPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [cuentaSel, setCuentaSel] = useState<number | ''>('')
  const [showModal, setShowModal] = useState(false)
  const [showDetalle, setShowDetalle] = useState<number | null>(null)
  const [form, setForm] = useState({
    cuentaBancoId: 0, periodo: '', fechaInicio: '', fechaFin: '',
    saldoInicialBanco: 0, saldoFinalBanco: 0,
  })

  const { data: cuentas = [] } = useQuery({
    queryKey: ['cuentas-banco'],
    queryFn: bancosApi.cuentas.getAll,
  })

  const { data: conciliaciones = [] } = useQuery({
    queryKey: ['conciliaciones', cuentaSel],
    queryFn: () => bancosApi.conciliaciones.getAll(cuentaSel as number),
    enabled: !!cuentaSel,
  })

  const { data: detalle } = useQuery({
    queryKey: ['conciliacion', showDetalle],
    queryFn: () => bancosApi.conciliaciones.getById(showDetalle!),
    enabled: !!showDetalle,
  })

  const crearConciliacion = useMutation({
    mutationFn: () => bancosApi.conciliaciones.create({
      cuentaBancoId: form.cuentaBancoId, periodo: form.periodo,
      fechaInicio: form.fechaInicio, fechaFin: form.fechaFin,
      saldoInicialBanco: form.saldoInicialBanco, saldoFinalBanco: form.saldoFinalBanco,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conciliaciones'] }); setShowModal(false); success('Conciliación iniciada') },
    onError: (e) => error(errMsg(e)),
  })

  const conciliar = useMutation({
    mutationFn: (id: number) => bancosApi.conciliaciones.conciliar(id),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ['conciliaciones'] }); success(`Conciliación ${data.diferencia === 0 ? 'completada' : 'con diferencia de ' + fmt(data.diferencia)}`) },
    onError: (e) => error(errMsg(e)),
  })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Conciliaciones Bancarias</h1>
          <p className="text-sm text-slate-500 mt-0.5">Verifica que los saldos contables coincidan con los estados bancarios</p>
        </div>
        <Button onClick={() => {
          const now = new Date()
          const mes = String(now.getMonth() + 1).padStart(2, '0')
          const inicio = new Date(now.getFullYear(), now.getMonth(), 1)
          const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          setForm({
            cuentaBancoId: cuentas[0]?.id ?? 0, periodo: `${now.getFullYear()}-${mes}`,
            fechaInicio: inicio.toISOString().slice(0, 10), fechaFin: fin.toISOString().slice(0, 10),
            saldoInicialBanco: 0, saldoFinalBanco: 0,
          })
          setShowModal(true)
        }} disabled={cuentas.length === 0}>
          <Plus size={15} />Nueva conciliación
        </Button>
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium text-slate-600">Cuenta Bancaria:</label>
            <select
              value={cuentaSel}
              onChange={e => setCuentaSel(e.target.value ? parseInt(e.target.value) : '')}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
            >
              <option value="">Seleccionar...</option>
              {cuentas.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.monedaCodigo})</option>
              ))}
            </select>
          </div>

          {cuentaSel && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
                    <th className="text-left py-2 pr-3">Período</th>
                    <th className="text-left py-2 pr-3">Desde</th>
                    <th className="text-left py-2 pr-3">Hasta</th>
                    <th className="text-right py-2 pr-3">Saldo Libros</th>
                    <th className="text-right py-2 pr-3">Saldo Banco</th>
                    <th className="text-right py-2 pr-3">Diferencia</th>
                    <th className="text-center py-2 pr-3">Estado</th>
                    <th className="text-center py-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {conciliaciones.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 pr-3 font-medium">{c.periodo}</td>
                      <td className="py-2 pr-3 text-slate-500">{c.fechaInicio}</td>
                      <td className="py-2 pr-3 text-slate-500">{c.fechaFin}</td>
                      <td className="py-2 pr-3 text-right font-mono">{fmt(c.saldoFinalLibros)}</td>
                      <td className="py-2 pr-3 text-right font-mono">{fmt(c.saldoFinalBanco)}</td>
                      <td className={`py-2 pr-3 text-right font-mono ${c.diferencia === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fmt(c.diferencia)}
                      </td>
                      <td className="py-2 pr-3 text-center">{estadoBadge(c.estado)}</td>
                      <td className="py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <Button size="sm" variant="secondary" onClick={() => setShowDetalle(c.id)}>
                            Ver
                          </Button>
                          {c.estado === 'Pendiente' && (
                            <Button size="sm" onClick={() => conciliar.mutate(c.id)} loading={conciliar.isPending}>
                              Conciliar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {conciliaciones.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-slate-400">Sin conciliaciones para esta cuenta</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Iniciar Conciliación Bancaria">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cuenta Bancaria</label>
            <select value={form.cuentaBancoId}
              onChange={e => setForm(f => ({ ...f, cuentaBancoId: parseInt(e.target.value) }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.monedaCodigo})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Período (YYYY-MM)</label>
            <input value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Inicio</label>
              <input type="date" value={form.fechaInicio}
                onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Fin</label>
              <input type="date" value={form.fechaFin}
                onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Saldo Inicial (según banco)</label>
              <input type="number" step="0.01" value={form.saldoInicialBanco || ''}
                onChange={e => setForm(f => ({ ...f, saldoInicialBanco: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Saldo Final (según banco)</label>
              <input type="number" step="0.01" value={form.saldoFinalBanco || ''}
                onChange={e => setForm(f => ({ ...f, saldoFinalBanco: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
          </div>
          <Button onClick={() => crearConciliacion.mutate()} loading={crearConciliacion.isPending} className="w-full">
            <Plus size={15} />Iniciar conciliación
          </Button>
        </div>
      </Modal>

      <Modal open={!!showDetalle} onClose={() => setShowDetalle(null)} title="Detalle de Conciliación" size="4xl">
        {detalle && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Saldo Final Libros</p>
                <p className="text-lg font-bold">{fmt(detalle.saldoFinalLibros)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Saldo Final Banco</p>
                <p className="text-lg font-bold">{fmt(detalle.saldoFinalBanco)}</p>
              </div>
            </div>
            <div className={`p-3 rounded-xl ${detalle.diferencia === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              <p className="text-sm font-medium">Diferencia: {fmt(detalle.diferencia)}</p>
            </div>

            <h3 className="text-sm font-semibold text-slate-800">Partidas</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
                    <th className="text-left py-2 pr-3">Tipo</th>
                    <th className="text-right py-2 pr-3">Monto</th>
                    <th className="text-left py-2 pr-3">Concepto</th>
                    <th className="text-center py-2">Concilia</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.partidas.map(p => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{p.tipo === 'Propio' ? 'En libros' : 'En banco'}</td>
                      <td className="py-2 pr-3 text-right font-mono">{fmt(p.monto)}</td>
                      <td className="py-2 pr-3 text-slate-600">{p.concepto}</td>
                      <td className="py-2 text-center">{p.concilia ? <CheckCircle size={14} className="text-emerald-500 inline" /> : '-'}</td>
                    </tr>
                  ))}
                  {detalle.partidas.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-slate-400">Sin partidas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
