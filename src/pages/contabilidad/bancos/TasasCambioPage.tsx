import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Plus, Calendar, Trash2 } from 'lucide-react'
import { bancosApi } from '../../../api'
import { Card, CardBody } from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import { useToast, errMsg } from '../../../context/ToastContext'

const fmt = (n: number) => n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 4 })

export default function TasasCambioPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [monedaSel, setMonedaSel] = useState<number | ''>('')
  const [showTasaModal, setShowTasaModal] = useState(false)
  const [showMonedaModal, setShowMonedaModal] = useState(false)
  const [form, setForm] = useState({ monedaId: 2, tasa: 0, fecha: new Date().toISOString().slice(0, 10) })
  const [monedaForm, setMonedaForm] = useState({ codigo: '', nombre: '', simbolo: '' })

  const { data: monedas = [] } = useQuery({
    queryKey: ['monedas'],
    queryFn: bancosApi.monedas.getAll,
  })

  const { data: tasas = [] } = useQuery({
    queryKey: ['tasas', monedaSel],
    queryFn: () => bancosApi.tasas.getAll(monedaSel || undefined),
  })

  const createTasa = useMutation({
    mutationFn: () => bancosApi.tasas.create({ monedaId: form.monedaId, tasa: form.tasa, fecha: form.fecha }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasas'] }); setShowTasaModal(false); success('Tasa registrada') },
    onError: (e) => error(errMsg(e)),
  })

  const createMoneda = useMutation({
    mutationFn: () => bancosApi.monedas.create({ codigo: monedaForm.codigo, nombre: monedaForm.nombre, simbolo: monedaForm.simbolo }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['monedas'] }); setShowMonedaModal(false); setMonedaForm({ codigo: '', nombre: '', simbolo: '' }); success('Moneda creada') },
    onError: (e) => error(errMsg(e)),
  })

  const deleteMoneda = useMutation({
    mutationFn: (id: number) => bancosApi.monedas.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['monedas'] }); success('Moneda eliminada') },
    onError: (e) => error(errMsg(e)),
  })

  const monedasFiltro = monedas.filter(m => m.codigo !== 'DOP')

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Tasas de Cambio</h1>
          <p className="text-sm text-slate-500 mt-0.5">Registro de tasas del día para monedas extranjeras</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => { setMonedaForm({ codigo: '', nombre: '', simbolo: '' }); setShowMonedaModal(true) }}>
            <Plus size={15} />Moneda
          </Button>
          <Button onClick={() => { setForm({ monedaId: 2, tasa: 0, fecha: new Date().toISOString().slice(0, 10) }); setShowTasaModal(true) }}>
            <Plus size={15} />Nueva tasa
          </Button>
        </div>
      </div>

      {/* Monedas */}
      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Monedas</h2>
          <div className="flex flex-wrap gap-3">
            {monedas.map(m => (
              <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm">
                <span className="font-bold text-slate-700">{m.simbolo}</span>
                <span>{m.codigo} <span className="text-slate-400">- {m.nombre}</span></span>
                {m.codigo !== 'DOP' && (
                  <button onClick={() => { if (confirm(`¿Eliminar ${m.nombre}?`)) deleteMoneda.mutate(m.id) }}
                    className="text-danger-500 hover:text-danger-700 ml-1"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium text-slate-600">Moneda:</label>
            <select
              value={monedaSel}
              onChange={e => setMonedaSel(e.target.value ? parseInt(e.target.value) : '')}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
            >
              <option value="">Todas</option>
              {monedasFiltro.map(m => (
                <option key={m.id} value={m.id}>{m.codigo} - {m.nombre}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left py-2 pr-4">Moneda</th>
                  <th className="text-left py-2 pr-4">Tasa (1 → DOP)</th>
                  <th className="text-left py-2 pr-4">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {tasas.map(t => (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 pr-4 font-medium">{t.monedaCodigo} <span className="text-slate-400 font-normal">- {t.monedaNombre}</span></td>
                    <td className="py-2 pr-4 font-mono">{fmt(t.tasa)}</td>
                    <td className="py-2 pr-4 text-slate-500"><Calendar size={13} className="inline mr-1" />{t.fecha}</td>
                  </tr>
                ))}
                {tasas.length === 0 && (
                  <tr><td colSpan={3} className="py-8 text-center text-slate-400">No hay tasas registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal open={showTasaModal} onClose={() => setShowTasaModal(false)} title="Registrar Tasa del Día">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Moneda</label>
            <select
              value={form.monedaId}
              onChange={e => setForm(f => ({ ...f, monedaId: parseInt(e.target.value) }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              {monedasFiltro.map(m => (
                <option key={m.id} value={m.id}>{m.codigo} - {m.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tasa (1 {monedas.find(m => m.id === form.monedaId)?.codigo} → DOP)</label>
            <input
              type="number" step="0.0001" min="0"
              value={form.tasa || ''}
              onChange={e => setForm(f => ({ ...f, tasa: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
            <input
              type="date"
              value={form.fecha}
              onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <Button onClick={() => createTasa.mutate()} loading={createTasa.isPending} className="w-full">
            <DollarSign size={15} />Guardar tasa
          </Button>
        </div>
      </Modal>

      <Modal open={showMonedaModal} onClose={() => setShowMonedaModal(false)} title="Nueva Moneda">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Código <span className="text-danger-500">*</span></label>
            <input
              value={monedaForm.codigo}
              onChange={e => setMonedaForm(f => ({ ...f, codigo: e.target.value.toUpperCase().slice(0, 3) }))}
              placeholder="USD"
              maxLength={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre <span className="text-danger-500">*</span></label>
            <input
              value={monedaForm.nombre}
              onChange={e => setMonedaForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Dólar estadounidense"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Símbolo</label>
            <input
              value={monedaForm.simbolo}
              onChange={e => setMonedaForm(f => ({ ...f, simbolo: e.target.value }))}
              placeholder="US$"
              maxLength={5}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <Button onClick={() => createMoneda.mutate()} loading={createMoneda.isPending} className="w-full">
            <Plus size={15} />Crear moneda
          </Button>
        </div>
      </Modal>
    </div>
  )
}
