import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, Eye, DollarSign, Calendar, ArrowUpRight, ArrowDownLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { bancosApi } from '../../../api'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import Badge from '../../../components/ui/Badge'
import EmptyState from '../../../components/ui/EmptyState'
import { useToast, errMsg } from '../../../context/ToastContext'
import MovimientosBancoModal from './MovimientosBancoModal'

const fmt = (n: number, s: string) => `${s} ${Math.abs(n).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`

export default function CuentasBancoPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [showCrear, setShowCrear] = useState(false)
  const [cuentaSel, setCuentaSel] = useState<number | null>(null)
  const [showMovs, setShowMovs] = useState(false)
  const [form, setForm] = useState({ nombre: '', numeroCuenta: '', monedaId: 1, saldoInicial: 0, fechaApertura: '' })

  // Filtro de movimientos generales
  const [desde, setDesde] = useState(new Date().toISOString().slice(0, 7) + '-01')
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10))
  const [cuentaActiva, setCuentaActiva] = useState<number | null>(null)

  const { data: cuentas = [] } = useQuery({
    queryKey: ['cuentas-banco'],
    queryFn: bancosApi.cuentas.getAll,
  })

  const { data: monedas = [] } = useQuery({
    queryKey: ['monedas'],
    queryFn: bancosApi.monedas.getAll,
  })

  const { data: movimientos = [] } = useQuery({
    queryKey: ['movimientos-generales', desde, hasta],
    queryFn: () => bancosApi.movimientos.getAllGenerales(desde, hasta),
  })

  const filtrados = useMemo(
    () => cuentaActiva ? movimientos.filter(m => m.cuentaBancoId === cuentaActiva) : movimientos,
    [movimientos, cuentaActiva]
  )

  const crearCuenta = useMutation({
    mutationFn: () => bancosApi.cuentas.create({
      nombre: form.nombre, numeroCuenta: form.numeroCuenta || null,
      monedaId: form.monedaId, saldoInicial: form.saldoInicial,
      fechaApertura: form.fechaApertura || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cuentas-banco'] }); setShowCrear(false); success('Cuenta creada') },
    onError: (e) => error(errMsg(e)),
  })

  const eliminarCuenta = useMutation({
    mutationFn: (id: number) => bancosApi.cuentas.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cuentas-banco'] }); success('Cuenta desactivada') },
    onError: (e) => error(errMsg(e)),
  })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Auxiliar de Bancos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cuentas bancarias, saldos y movimientos</p>
        </div>
        <Button onClick={() => { setForm({ nombre: '', numeroCuenta: '', monedaId: 1, saldoInicial: 0, fechaApertura: '' }); setShowCrear(true) }}>
          <Plus size={15} />Nueva cuenta
        </Button>
      </div>

      {/* ── Cuentas ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {cuentas.map(c => {
          const activa = cuentaActiva === c.id
          const movsCuenta = movimientos.filter(m => m.cuentaBancoId === c.id)
          const totIng = movsCuenta.filter(m => m.tipo === 'Credito' || m.tipo === 'Ajuste').reduce((s, m) => s + m.monto, 0)
          const totEgr = movsCuenta.filter(m => m.tipo === 'Debito').reduce((s, m) => s + m.monto, 0)
          return (
            <Card key={c.id}>
              <CardBody className="!p-3">
                <button onClick={() => setCuentaActiva(activa ? null : c.id)} className="w-full text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 size={16} className="text-slate-400 shrink-0" />
                      <span className={`text-sm font-semibold truncate ${activa ? 'text-brand-600' : 'text-slate-800'}`}>{c.nombre}</span>
                      <span className="text-xs font-mono text-slate-400 shrink-0">{c.monedaCodigo}</span>
                    </div>
                    {activa ? <ChevronUp size={16} className="text-brand-500 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                  </div>
                </button>
                <p className="text-lg font-bold text-slate-800 mt-1">{fmt(c.saldoActual, c.monedaSimbolo)}</p>
                <div className="flex gap-3 mt-1 text-xs">
                  <span className="text-emerald-600">+{fmt(totIng, '')}</span>
                  <span className="text-red-600">-{fmt(totEgr, '')}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="secondary" onClick={() => { setCuentaSel(c.id); setShowMovs(true) }}>
                    <Eye size={14} />Detalle
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => eliminarCuenta.mutate(c.id)}>
                    Desactivar
                  </Button>
                </div>
              </CardBody>
            </Card>
          )
        })}
        {cuentas.length === 0 && (
          <div className="col-span-full">
            <EmptyState title="Sin cuentas bancarias" description="Crea una cuenta bancaria para comenzar a registrar movimientos." />
          </div>
        )}
      </div>

      {/* ── Movimientos ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-slate-400" />
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
            </div>
            <span className="text-slate-400">—</span>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-slate-400" />
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
            </div>
            {cuentaActiva && (
              <button onClick={() => setCuentaActiva(null)} className="text-xs text-brand-600 hover:underline ml-2">
                Ver todas las cuentas
              </button>
            )}
            <span className="text-xs text-slate-400 ml-auto">{filtrados.length} movimientos</span>
          </div>
        </CardHeader>
        <CardBody className="!px-0 !py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left py-2 px-4">Fecha</th>
                  {!cuentaActiva && <th className="text-left py-2 pr-3">Cuenta</th>}
                  <th className="text-left py-2 pr-3">Tipo</th>
                  <th className="text-right py-2 pr-3">Monto</th>
                  <th className="text-left py-2 pr-3">Concepto</th>
                  <th className="text-left py-2 pr-3">Referencia</th>
                  <th className="text-left py-2 pr-4">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(m => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-4 text-slate-500 whitespace-nowrap">{m.fecha.slice(0, 10)}</td>
                    {!cuentaActiva && (
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={13} className="text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-700">{m.cuentaBancoNombre}</span>
                          <span className="text-xs text-slate-400 font-mono">{m.monedaCodigo}</span>
                        </div>
                      </td>
                    )}
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
                    <td className="py-2 pr-3 text-slate-600 max-w-[220px] truncate">{m.concepto}</td>
                    <td className="py-2 pr-3 text-slate-400 text-xs">{m.referencia || '-'}</td>
                    <td className="py-2 pr-4 text-slate-400 text-xs">{m.usuarioNombre}</td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={cuentaActiva ? 6 : 7} className="py-12"><EmptyState title="Sin movimientos" description="No hay movimientos en el rango seleccionado." /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* ── Modal: crear cuenta ─────────────────────────── */}
      <Modal open={showCrear} onClose={() => setShowCrear(false)} title="Nueva Cuenta Bancaria">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Número de Cuenta</label>
            <input value={form.numeroCuenta} onChange={e => setForm(f => ({ ...f, numeroCuenta: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Moneda</label>
            <select value={form.monedaId} onChange={e => setForm(f => ({ ...f, monedaId: parseInt(e.target.value) }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
              {monedas.map(m => <option key={m.id} value={m.id}>{m.codigo} - {m.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Saldo Inicial</label>
            <input type="number" step="0.01" value={form.saldoInicial || ''}
              onChange={e => setForm(f => ({ ...f, saldoInicial: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de Apertura</label>
            <input type="date" value={form.fechaApertura}
              onChange={e => setForm(f => ({ ...f, fechaApertura: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <Button onClick={() => crearCuenta.mutate()} loading={crearCuenta.isPending} className="w-full">
            <Plus size={15} />Crear cuenta
          </Button>
        </div>
      </Modal>

      {showMovs && cuentaSel && (
        <MovimientosBancoModal
          cuentaBancoId={cuentaSel}
          onClose={() => { setShowMovs(false); setCuentaSel(null) }}
        />
      )}
    </div>
  )
}
