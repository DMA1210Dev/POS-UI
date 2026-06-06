import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, FileText, DollarSign } from 'lucide-react'
import { cxpApi, bancosApi } from '../../../api'
import { Card, CardBody } from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import Badge from '../../../components/ui/Badge'
import { useToast, errMsg } from '../../../context/ToastContext'

const fmt = (n: number) => n.toLocaleString('es-DO', { minimumFractionDigits: 2 })

const estadoBadge = (e: string) => {
  if (e === 'Pagado') return <Badge color="green">Pagado</Badge>
  if (e === 'PagadoParcial') return <Badge color="yellow">Parcial</Badge>
  if (e === 'Vencido') return <Badge color="red">Vencido</Badge>
  if (e === 'Anulado') return <Badge color="gray">Anulado</Badge>
  return <Badge color="blue">{e}</Badge>
}

export default function CuentasPagarPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [proveedorFiltro, setProveedorFiltro] = useState<number | ''>('')
  const [showFactura, setShowFactura] = useState(false)
  const [showPago, setShowPago] = useState<number | null>(null)
  const [showPagosHist, setShowPagosHist] = useState<number | null>(null)
  const [formF, setFormF] = useState({
    proveedorId: 0, facturaNumero: '', ncf: '', fechaEmision: new Date().toISOString().slice(0, 10),
    fechaVencimiento: '', montoTotal: 0, concepto: ''
  })
  const [formP, setFormP] = useState({ monto: 0, metodoPago: 'Efectivo', referencia: '', cuentaBancoId: '', observacion: '' })

  const { data: proveedores = [] } = useQuery({
    queryKey: ['proveedores'],
    queryFn: cxpApi.proveedores.getAll,
  })

  const { data: facturas = [] } = useQuery({
    queryKey: ['facturas-cxp', proveedorFiltro],
    queryFn: () => cxpApi.facturas.getAll(proveedorFiltro || undefined),
  })

  const { data: resumen } = useQuery({
    queryKey: ['resumen-cxp'],
    queryFn: cxpApi.resumen,
  })

  const { data: cuentasBanco = [] } = useQuery({
    queryKey: ['cuentas-banco'],
    queryFn: bancosApi.cuentas.getAll,
  })

  const { data: pagosHist = [] } = useQuery({
    queryKey: ['pagos-cxp', showPagosHist],
    queryFn: () => cxpApi.pagos.getAll(showPagosHist!),
    enabled: !!showPagosHist,
  })

  const crearFactura = useMutation({
    mutationFn: () => cxpApi.facturas.create({
      proveedorId: formF.proveedorId, facturaNumero: formF.facturaNumero || null,
      ncf: formF.ncf || null, fechaEmision: formF.fechaEmision,
      fechaVencimiento: formF.fechaVencimiento || null, montoTotal: formF.montoTotal, concepto: formF.concepto || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['facturas-cxp'] }); qc.invalidateQueries({ queryKey: ['resumen-cxp'] }); setShowFactura(false); success('Factura registrada') },
    onError: (e) => error(errMsg(e)),
  })

  const registrarPago = useMutation({
    mutationFn: () => cxpApi.pagos.create(showPago!, {
      monto: formP.monto, metodoPago: formP.metodoPago,
      referencia: formP.referencia || null,
      cuentaBancoId: formP.cuentaBancoId ? parseInt(formP.cuentaBancoId) : null,
      observacion: formP.observacion || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['facturas-cxp'] }); qc.invalidateQueries({ queryKey: ['resumen-cxp'] }); setShowPago(null); success('Pago registrado') },
    onError: (e) => error(errMsg(e)),
  })

  const anular = useMutation({
    mutationFn: (id: number) => cxpApi.facturas.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['facturas-cxp'] }); qc.invalidateQueries({ queryKey: ['resumen-cxp'] }); success('Factura anulada') },
    onError: (e) => error(errMsg(e)),
  })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Cuentas por Pagar</h1>
          <p className="text-sm text-slate-500 mt-0.5">Facturas de proveedores y pagos</p>
        </div>
        <Button onClick={() => { setFormF({ ...formF, proveedorId: proveedores[0]?.id ?? 0 }); setShowFactura(true) }}>
          <Plus size={15} />Nueva factura
        </Button>
      </div>

      {resumen && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-brand-50 rounded-xl p-4">
            <p className="text-xs text-brand-600 uppercase tracking-wide font-semibold">Total Pendiente</p>
            <p className="text-xl font-bold text-brand-800 mt-1">{fmt(resumen.totalPendiente)}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4">
            <p className="text-xs text-red-600 uppercase tracking-wide font-semibold">Total Vencido</p>
            <p className="text-xl font-bold text-red-800 mt-1">{fmt(resumen.totalVencido)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Facturas / Proveedores</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{resumen.cantidadFacturas} / {resumen.cantidadProveedores}</p>
          </div>
        </div>
      )}

      <Card>
        <CardBody>
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium text-slate-600">Proveedor:</label>
            <select value={proveedorFiltro}
              onChange={e => setProveedorFiltro(e.target.value ? parseInt(e.target.value) : '')}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500">
              <option value="">Todos</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left py-2 pr-3">Proveedor</th>
                  <th className="text-left py-2 pr-3">Factura</th>
                  <th className="text-left py-2 pr-3">Emisión</th>
                  <th className="text-left py-2 pr-3">Vcto</th>
                  <th className="text-right py-2 pr-3">Total</th>
                  <th className="text-right py-2 pr-3">Pagado</th>
                  <th className="text-right py-2 pr-3">Saldo</th>
                  <th className="text-center py-2 pr-3">Estado</th>
                  <th className="text-center py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map(f => (
                  <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 pr-3 font-medium">{f.proveedorNombre}</td>
                    <td className="py-2 pr-3 text-slate-600">{f.facturaNumero || f.ncf || '—'}</td>
                    <td className="py-2 pr-3 text-slate-500">{f.fechaEmision}</td>
                    <td className="py-2 pr-3 text-slate-500">{f.fechaVencimiento || '—'}</td>
                    <td className="py-2 pr-3 text-right font-mono">{fmt(f.montoTotal)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-emerald-600">{fmt(f.montoPagado)}</td>
                    <td className="py-2 pr-3 text-right font-mono font-bold">{fmt(f.saldo)}</td>
                    <td className="py-2 pr-3 text-center">{estadoBadge(f.estado)}</td>
                    <td className="py-2 text-center">
                      <div className="flex gap-1 justify-center">
                        {f.estado !== 'Pagado' && f.estado !== 'Anulado' && (
                          <Button size="sm" onClick={() => { setShowPago(f.id); setFormP({ monto: f.saldo, metodoPago: 'Efectivo', referencia: '', cuentaBancoId: '', observacion: '' }) }}>
                            <DollarSign size={12} />Pagar
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => setShowPagosHist(f.id)}>
                          <FileText size={12} />Pagos
                        </Button>
                        {f.estado !== 'Anulado' && (
                          <Button size="sm" variant="danger" onClick={() => anular.mutate(f.id)}>
                            Anular
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {facturas.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-slate-400">Sin facturas registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal open={showFactura} onClose={() => setShowFactura(false)} title="Nueva Factura">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Proveedor</label>
            <select value={formF.proveedorId}
              onChange={e => setFormF(f => ({ ...f, proveedorId: parseInt(e.target.value) }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
              <option value="">Seleccionar...</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Factura #</label>
              <input value={formF.facturaNumero} onChange={e => setFormF(f => ({ ...f, facturaNumero: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">NCF</label>
              <input value={formF.ncf} onChange={e => setFormF(f => ({ ...f, ncf: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Emisión</label>
              <input type="date" value={formF.fechaEmision}
                onChange={e => setFormF(f => ({ ...f, fechaEmision: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Vencimiento</label>
              <input type="date" value={formF.fechaVencimiento}
                onChange={e => setFormF(f => ({ ...f, fechaVencimiento: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Monto Total</label>
            <input type="number" step="0.01" min="0" value={formF.montoTotal || ''}
              onChange={e => setFormF(f => ({ ...f, montoTotal: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Concepto</label>
            <textarea value={formF.concepto} onChange={e => setFormF(f => ({ ...f, concepto: e.target.value }))} rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <Button onClick={() => crearFactura.mutate()} loading={crearFactura.isPending} className="w-full">
            <Plus size={15} />Registrar factura
          </Button>
        </div>
      </Modal>

      <Modal open={!!showPago} onClose={() => setShowPago(null)} title="Registrar Pago">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Monto</label>
            <input type="number" step="0.01" min="0" value={formP.monto || ''}
              onChange={e => setFormP(f => ({ ...f, monto: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Método de Pago</label>
            <select value={formP.metodoPago} onChange={e => setFormP(f => ({ ...f, metodoPago: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
              <option value="Efectivo">Efectivo</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Cheque">Cheque</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cuenta Bancaria (opcional)</label>
            <select value={formP.cuentaBancoId} onChange={e => setFormP(f => ({ ...f, cuentaBancoId: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
              <option value="">Sin cuenta bancaria</option>
              {cuentasBanco.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.monedaCodigo})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Referencia</label>
            <input value={formP.referencia} onChange={e => setFormP(f => ({ ...f, referencia: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Observación</label>
            <textarea value={formP.observacion} onChange={e => setFormP(f => ({ ...f, observacion: e.target.value }))} rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <Button onClick={() => registrarPago.mutate()} loading={registrarPago.isPending} className="w-full">
            <DollarSign size={15} />Registrar pago
          </Button>
        </div>
      </Modal>

      <Modal open={!!showPagosHist} onClose={() => setShowPagosHist(null)} title="Historial de Pagos" size="2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-left py-2 pr-3">Fecha</th>
                <th className="text-right py-2 pr-3">Monto</th>
                <th className="text-left py-2 pr-3">Método</th>
                <th className="text-left py-2 pr-3">Referencia</th>
                <th className="text-left py-2 pr-3">Cuenta</th>
                <th className="text-left py-2 pr-3">Usuario</th>
                <th className="text-left py-2">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {pagosHist.map(p => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-500">{p.fechaPago}</td>
                  <td className="py-2 pr-3 text-right font-mono font-medium">{fmt(p.monto)}</td>
                  <td className="py-2 pr-3">{p.metodoPago}</td>
                  <td className="py-2 pr-3 text-slate-400">{p.referencia || '—'}</td>
                  <td className="py-2 pr-3 text-slate-400">{p.cuentaBancoNombre || '—'}</td>
                  <td className="py-2 pr-3 text-slate-400">{p.usuarioNombre}</td>
                  <td className="py-2 text-slate-400 text-xs">{p.observacion || ''}</td>
                </tr>
              ))}
              {pagosHist.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Sin pagos registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  )
}
