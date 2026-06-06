import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { activosFijosApi, cxpApi, cuentasContablesApi } from '../../../api'
import { Card, CardBody } from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import Badge from '../../../components/ui/Badge'
import EmptyState from '../../../components/ui/EmptyState'
import { useToast, errMsg } from '../../../context/ToastContext'
import type { ActivoFijoDto, ActivoFijoCreateDto } from '../../../types'

const fmt = (n: number) => n.toLocaleString('es-DO', { minimumFractionDigits: 2 })
const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })

const estadoBadge = (activo: boolean) =>
  activo ? <Badge color="green">Activo</Badge> : <Badge color="red">Inactivo</Badge>

const emptyForm: ActivoFijoCreateDto = {
  nombre: '', codigo: '', descripcion: '', ubicacion: '',
  fechaAdquisicion: new Date().toISOString().slice(0, 10),
  numeroFactura: '', costoAdquisicion: 0, tasaDepreciacion: 0,
  valorResidual: 0, proveedorId: undefined, cuentaContableId: undefined,
}

export default function ActivosFijosPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<ActivoFijoCreateDto>({ ...emptyForm })

  const { data: activos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['activos-fijos'],
    queryFn: activosFijosApi.getAll,
  })

  const { data: proveedores = [] } = useQuery({
    queryKey: ['proveedores'],
    queryFn: cxpApi.proveedores.getAll,
  })

  const { data: cuentas = [] } = useQuery({
    queryKey: ['cuentas-contables', 'solo-activas'],
    queryFn: () => cuentasContablesApi.getAll({ soloActivas: true }),
  })

  const createMutation = useMutation({
    mutationFn: () => activosFijosApi.create(form),
    onSuccess: () => {
      success('Activo fijo creado correctamente')
      cerrar()
      qc.invalidateQueries({ queryKey: ['activos-fijos'] })
    },
    onError: (e) => error(errMsg(e)),
  })

  const updateMutation = useMutation({
    mutationFn: () => activosFijosApi.update(editId!, form),
    onSuccess: () => {
      success('Activo fijo actualizado correctamente')
      cerrar()
      qc.invalidateQueries({ queryKey: ['activos-fijos'] })
    },
    onError: (e) => error(errMsg(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => activosFijosApi.delete(id),
    onSuccess: () => {
      success('Activo fijo desactivado')
      qc.invalidateQueries({ queryKey: ['activos-fijos'] })
    },
    onError: (e) => error(errMsg(e)),
  })

  function cerrar() {
    setModalOpen(false)
    setEditId(null)
    setForm({ ...emptyForm, fechaAdquisicion: new Date().toISOString().slice(0, 10) })
  }

  function abrirCrear() {
    setForm({ ...emptyForm, fechaAdquisicion: new Date().toISOString().slice(0, 10) })
    setEditId(null)
    setModalOpen(true)
  }

  function abrirEditar(a: ActivoFijoDto) {
    setForm({
      nombre: a.nombre, codigo: a.codigo ?? '', descripcion: a.descripcion ?? '',
      ubicacion: a.ubicacion ?? '', fechaAdquisicion: a.fechaAdquisicion.slice(0, 10),
      numeroFactura: a.numeroFactura ?? '', costoAdquisicion: a.costoAdquisicion,
      tasaDepreciacion: a.tasaDepreciacion, valorResidual: a.valorResidual ?? 0,
      proveedorId: a.proveedorId ?? undefined, cuentaContableId: a.cuentaContableId ?? undefined,
    })
    setEditId(a.id)
    setModalOpen(true)
  }

  function guardar() {
    if (!form.nombre.trim()) return
    if (editId) {
      updateMutation.mutate()
    } else {
      createMutation.mutate()
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Activos Fijos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestión de activos fijos y depreciaciones</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw size={15} />
          </Button>
          <Button onClick={abrirCrear}>
            <Plus size={15} /> Nuevo activo
          </Button>
        </div>
      </div>

      {/* ── Loading / Error ──────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {isError && (
        <EmptyState variant="error" title="Error al cargar activos fijos" onRetry={refetch} />
      )}

      {/* ── Table ────────────────────────────────────────────── */}
      {!isLoading && !isError && (
        <Card>
          <CardBody className="!p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Nombre</th>
                    <th className="py-2.5 px-3">Descripción</th>
                    <th className="py-2.5 px-3">Fecha Adq.</th>
                    <th className="py-2.5 px-3 text-right">Costo</th>
                    <th className="py-2.5 px-3 text-right">Tasa Dep.</th>
                    <th className="py-2.5 px-3 text-right">Dep. Acum.</th>
                    <th className="py-2.5 px-3 text-right">Valor Libro</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {activos.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12">
                        <EmptyState
                          title="Sin activos fijos"
                          description="Agrega tu primer activo fijo para comenzar."
                        />
                      </td>
                    </tr>
                  ) : (
                    activos.map(a => (
                      <tr key={a.id} className="group hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-mono text-xs text-slate-500">{a.codigo ?? '—'}</td>
                        <td className="py-2 px-3 font-medium text-slate-800">{a.nombre}</td>
                        <td className="py-2 px-3 text-xs text-slate-500 max-w-[180px] truncate">{a.descripcion ?? '—'}</td>
                        <td className="py-2 px-3 text-xs text-slate-500 whitespace-nowrap">{fmtFecha(a.fechaAdquisicion)}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-slate-600">{fmt(a.costoAdquisicion)}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-slate-600">{a.tasaDepreciacion}%</td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-slate-600">{fmt(a.depreciacionAcumulada)}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-slate-600">{fmt(a.valorLibro)}</td>
                        <td className="py-2 px-3">{estadoBadge(a.activo)}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => abrirEditar(a)} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-brand-600" title="Editar">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => deleteMutation.mutate(a.id)} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-red-600" title="Desactivar">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Modal Crear / Editar ─────────────────────────────── */}
      <Modal open={modalOpen} onClose={cerrar} title={editId ? 'Editar Activo Fijo' : 'Nuevo Activo Fijo'} size="3xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
            <input
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="Nombre del activo"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Código</label>
            <input
              value={form.codigo}
              onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="Código interno"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ubicación</label>
            <input
              value={form.ubicacion}
              onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="Ubicación física"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de Adquisición</label>
            <input
              type="date"
              value={form.fechaAdquisicion}
              onChange={e => setForm(f => ({ ...f, fechaAdquisicion: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Número de Factura</label>
            <input
              value={form.numeroFactura}
              onChange={e => setForm(f => ({ ...f, numeroFactura: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="Factura de compra"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Costo de Adquisición (RD$)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.costoAdquisicion}
              onChange={e => setForm(f => ({ ...f, costoAdquisicion: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tasa de Depreciación (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.tasaDepreciacion}
              onChange={e => setForm(f => ({ ...f, tasaDepreciacion: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Valor Residual (RD$)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.valorResidual}
              onChange={e => setForm(f => ({ ...f, valorResidual: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Proveedor</label>
            <select
              value={form.proveedorId ?? ''}
              onChange={e => setForm(f => ({ ...f, proveedorId: e.target.value ? parseInt(e.target.value) : undefined }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              <option value="">— Seleccionar —</option>
              {proveedores.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cuenta Contable</label>
            <select
              value={form.cuentaContableId ?? ''}
              onChange={e => setForm(f => ({ ...f, cuentaContableId: e.target.value ? parseInt(e.target.value) : undefined }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              <option value="">— Seleccionar —</option>
              {cuentas.map(c => (
                <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 resize-none"
              rows={3}
              placeholder="Descripción del activo"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
          <Button onClick={guardar} loading={createMutation.isPending || updateMutation.isPending}>
            {editId ? 'Guardar cambios' : 'Crear activo'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
