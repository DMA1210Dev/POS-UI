import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, ArrowDownLeft, Plus, Building2, DollarSign, Calendar } from 'lucide-react'
import { bancosApi } from '../../../api'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import Badge from '../../../components/ui/Badge'
import { useToast, errMsg } from '../../../context/ToastContext'

interface Props {
  cuentaBancoId: number
  onClose: () => void
}

const fmt = (n: number, s: string) => `${s} ${Math.abs(n).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`

export default function MovimientosBancoModal({ cuentaBancoId, onClose }: Props) {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [showRegistro, setShowRegistro] = useState(false)
  const [form, setForm] = useState({ tipo: 'Credito', monto: 0, concepto: '', referencia: '' })

  const { data: cuenta } = useQuery({
    queryKey: ['cuenta-banco', cuentaBancoId],
    queryFn: () => bancosApi.cuentas.getById(cuentaBancoId),
  })

  const { data: movimientos = [] } = useQuery({
    queryKey: ['movimientos-banco', cuentaBancoId],
    queryFn: () => bancosApi.movimientos.getAll(cuentaBancoId),
  })

  const registroMov = useMutation({
    mutationFn: () => bancosApi.movimientos.create(cuentaBancoId, {
      monto: form.monto, tipo: form.tipo, concepto: form.concepto, referencia: form.referencia || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movimientos-banco'] })
      qc.invalidateQueries({ queryKey: ['cuenta-banco'] })
      qc.invalidateQueries({ queryKey: ['cuentas-banco'] })
      setShowRegistro(false)
      success('Movimiento registrado')
    },
    onError: (e) => error(errMsg(e)),
  })

  return (
    <Modal open onClose={onClose} title={`Movimientos - ${cuenta?.nombre ?? ''}`} size="4xl">
      <div className="space-y-4">
        {cuenta && (
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-800">{cuenta.nombre}</p>
                {cuenta.numeroCuenta && <p className="text-xs text-slate-400 font-mono">{cuenta.numeroCuenta}</p>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Saldo Actual</p>
              <p className="text-lg font-bold text-slate-800">{fmt(cuenta.saldoActual, cuenta.monedaSimbolo)}</p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button size="sm" onClick={() => { setForm({ tipo: 'Credito', monto: 0, concepto: '', referencia: '' }); setShowRegistro(true) }}>
            <Plus size={14} />Registrar movimiento
          </Button>
        </div>

        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-left py-2 pr-3">Fecha</th>
                <th className="text-left py-2 pr-3">Tipo</th>
                <th className="text-right py-2 pr-3">Monto</th>
                <th className="text-right py-2 pr-3">Saldo</th>
                <th className="text-left py-2 pr-3">Concepto</th>
                <th className="text-left py-2 pr-3">Referencia</th>
                <th className="text-left py-2">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map(m => (
                <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">
                    <Calendar size={12} className="inline mr-1" />
                    {m.fecha.slice(0, 10)}
                  </td>
                  <td className="py-2 pr-3">
                    {m.tipo === 'Credito' ? (
                      <Badge color="green"><ArrowUpRight size={12} className="inline mr-0.5" />Crédito</Badge>
                    ) : m.tipo === 'Ajuste' ? (
                      <Badge color="purple"><DollarSign size={12} className="inline mr-0.5" />Ajuste</Badge>
                    ) : (
                      <Badge color="red"><ArrowDownLeft size={12} className="inline mr-0.5" />Débito</Badge>
                    )}
                  </td>
                  <td className={`py-2 pr-3 text-right font-mono font-medium ${m.tipo === 'Credito' || m.tipo === 'Ajuste' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmt(m.monto, m.tipo === 'Credito' || m.tipo === 'Ajuste' ? '+' : '-')}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-slate-600">{fmt(m.saldoDespues, '')}</td>
                  <td className="py-2 pr-3 text-slate-600 max-w-[200px] truncate">{m.concepto}</td>
                  <td className="py-2 pr-3 text-slate-400 text-xs">{m.referencia || '-'}</td>
                  <td className="py-2 text-slate-400 text-xs">{m.usuarioNombre}</td>
                </tr>
              ))}
              {movimientos.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Sin movimientos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showRegistro} onClose={() => setShowRegistro(false)} title="Registrar Movimiento">
        <div className="space-y-4">
          <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
                <option value="Credito">Crédito (ingreso)</option>
                <option value="Debito">Débito (egreso)</option>
                <option value="Ajuste">Ajuste (corrección)</option>
              </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Monto</label>
            <input type="number" step="0.01" min="0" value={form.monto || ''}
              onChange={e => setForm(f => ({ ...f, monto: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Concepto</label>
            <input value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Referencia (opcional)</label>
            <input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <Button onClick={() => registroMov.mutate()} loading={registroMov.isPending} className="w-full">
            <DollarSign size={15} />Registrar
          </Button>
        </div>
      </Modal>
    </Modal>
  )
}
