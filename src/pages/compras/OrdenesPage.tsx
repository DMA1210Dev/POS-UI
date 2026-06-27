import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, ChevronRight, ChevronDown,
  ShoppingCart, Trash2, X,
} from 'lucide-react'
import { ordenesCompraApi, cxpApi, productosApi } from '../../api'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { errMsg, useToast } from '../../context/ToastContext'
import type { OrdenCompraCreateDto, OrdenCompraDetalleCreateDto } from '../../types'

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtMoney = (n: number) => `RD$ ${n.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`

const estadoBadge = (e: string) => {
  const map: Record<string, string> = {
    Pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
    Parcial:   'bg-blue-50 text-blue-700 border-blue-200',
    Completa:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    Cancelada: 'bg-slate-100 text-slate-500 border-slate-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[e] ?? map['Pendiente']}`}>
      {e}
    </span>
  )
}

// ── tipos internos ────────────────────────────────────────────────────────────

interface DetalleForm extends OrdenCompraDetalleCreateDto {
  _key: number
}

let _key = 0
const newDetalle = (): DetalleForm => ({
  _key: ++_key, productoId: null, descripcion: '', cantidad: 1, precioUnitario: null,
})

// ── componente ────────────────────────────────────────────────────────────────

export default function OrdenesPage() {
  const { error: toastError } = useToast()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  // modal
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [proveedorId, setProveedorId] = useState(0)
  const [numeroOrden, setNumeroOrden] = useState('')
  const [fechaOrden, setFechaOrden] = useState(new Date().toISOString().slice(0, 10))
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [concepto, setConcepto] = useState('')
  const [detalles, setDetalles] = useState<DetalleForm[]>([newDetalle()])

  // queries
  const { data: ordenes = [], isLoading } = useQuery({
    queryKey: ['ordenes-compra'],
    queryFn: () => ordenesCompraApi.getAll(),
  })

  const { data: proveedores = [] } = useQuery({
    queryKey: ['proveedores'],
    queryFn: () => cxpApi.proveedores.getAll(),
    enabled: showModal,
  })

  const { data: productos = [] } = useQuery({
    queryKey: ['productos'],
    queryFn: () => productosApi.getAll({ soloActivos: true }),
    enabled: showModal,
  })

  const prodFisicos = productos.filter(p => p.tipo === 'Fisico')

  // populate form when editing
  useEffect(() => {
    if (editId === null) return
    const o = ordenes.find(o => o.id === editId)
    if (!o) return
    setProveedorId(o.proveedorId)
    setNumeroOrden(o.numeroOrden ?? '')
    setFechaOrden(o.fechaOrden)
    setFechaEntrega(o.fechaEntregaEstimada ?? '')
    setConcepto(o.concepto ?? '')
    setDetalles(o.detalles.map(d => ({
      _key: ++_key,
      productoId: d.productoId,
      descripcion: d.descripcion,
      cantidad: d.cantidad,
      precioUnitario: d.precioUnitario,
    })))
  }, [editId])

  const resetModal = () => {
    setShowModal(false)
    setEditId(null)
    setProveedorId(0)
    setNumeroOrden('')
    setFechaOrden(new Date().toISOString().slice(0, 10))
    setFechaEntrega('')
    setConcepto('')
    setDetalles([newDetalle()])
  }

  const mutation = useMutation({
    mutationFn: () => {
      const dto: OrdenCompraCreateDto = {
        proveedorId,
        numeroOrden: numeroOrden || null,
        fechaOrden,
        fechaEntregaEstimada: fechaEntrega || null,
        concepto: concepto || null,
        detalles: detalles.filter(d => d.descripcion || d.productoId),
      }
      return editId ? ordenesCompraApi.update(editId, dto) : ordenesCompraApi.create(dto)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ordenes-compra'] }); resetModal() },
    onError: (e) => toastError(errMsg(e)),
  })

  const mutCancelar = useMutation({
    mutationFn: (id: number) => ordenesCompraApi.cancelar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordenes-compra'] }),
    onError: (e) => toastError(errMsg(e)),
  })

  // filtrado
  const filtradas = ordenes.filter(o => {
    if (filtroEstado !== 'todos' && o.estado !== filtroEstado) return false
    if (search) {
      const q = search.toLowerCase()
      return o.proveedorNombre.toLowerCase().includes(q) ||
        (o.numeroOrden ?? '').toLowerCase().includes(q) ||
        (o.concepto ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const toggleRow = (id: number) => setExpanded(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  // detalles helpers
  const updateDetalle = (key: number, patch: Partial<DetalleForm>) =>
    setDetalles(prev => prev.map(d => d._key === key ? { ...d, ...patch } : d))
  const removeDetalle = (key: number) =>
    setDetalles(prev => prev.filter(d => d._key !== key))

  const onProductoChange = (key: number, prodId: number) => {
    const p = prodFisicos.find(p => p.id === prodId)
    updateDetalle(key, {
      productoId: prodId || null,
      descripcion: p?.nombre ?? '',
      precioUnitario: p?.precioCosto ?? null,
    })
  }

  const totalOrden = detalles.reduce((s, d) => s + d.cantidad * (d.precioUnitario ?? 0), 0)
  const canSubmit = proveedorId > 0 && detalles.some(d => d.descripcion || d.productoId)

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Órdenes de Compra</h2>
        <Button onClick={() => setShowModal(true)}><Plus size={15} /> Nueva orden</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por proveedor, número o concepto…"
                className="flex-1 bg-transparent outline-none text-sm" />
            </div>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl text-xs shrink-0">
              {(['todos', 'Pendiente', 'Parcial', 'Completa', 'Cancelada'] as const).map(v => (
                <button key={v} onClick={() => setFiltroEstado(v)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${filtroEstado === v ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                  {v === 'todos' ? 'Todos' : v}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 w-8" />
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-left">Proveedor</th>
                  <th className="px-4 py-2 text-left">N° Orden</th>
                  <th className="px-4 py-2 text-left">Entrega est.</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-left">Estado</th>
                  <th className="px-4 py-2 text-left">Creado por</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">Cargando…</td></tr>
                )}
                {!isLoading && filtradas.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    <ShoppingCart size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-medium">No hay órdenes de compra</p>
                    <p className="text-xs mt-1">Crea una orden para registrar compras a tus suplidores.</p>
                  </td></tr>
                )}
                {filtradas.map(o => {
                  const isOpen = expanded.has(o.id)
                  const total = o.detalles.reduce((s, d) => s + d.cantidad * (d.precioUnitario ?? 0), 0)
                  return (
                    <>
                      <tr key={o.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleRow(o.id)}>
                        <td className="px-4 py-3 text-slate-400">
                          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium text-slate-700">{fmt(o.fechaOrden)}</p>
                          <p className="text-xs text-slate-400">{o.creadoEn.slice(11, 16)}</p>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{o.proveedorNombre}</td>
                        <td className="px-4 py-3 text-slate-500">{o.numeroOrden ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{o.fechaEntregaEstimada ? fmt(o.fechaEntregaEstimada) : '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {total > 0 ? fmtMoney(total) : '—'}
                        </td>
                        <td className="px-4 py-3">{estadoBadge(o.estado)}</td>
                        <td className="px-4 py-3 text-slate-500">{o.creadoPorNombre}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                            {o.estado !== 'Cancelada' && o.estado !== 'Completa' && (
                              <>
                                <button onClick={() => { setEditId(o.id); setShowModal(true) }}
                                  className="text-xs text-brand-600 hover:underline px-2 py-1">
                                  Editar
                                </button>
                                <button onClick={() => mutCancelar.mutate(o.id)}
                                  className="text-xs text-red-500 hover:text-red-700 px-1 py-1">
                                  <X size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr key={`${o.id}-d`} className="bg-slate-50">
                          <td colSpan={9} className="px-8 py-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                              {o.detalles.length} ítem(s) · {o.concepto ?? 'Sin concepto'}
                            </p>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-slate-400 uppercase border-b border-slate-200">
                                  <th className="pb-1.5 text-left pr-4">Producto / Descripción</th>
                                  <th className="pb-1.5 text-right pr-4">Cantidad</th>
                                  <th className="pb-1.5 text-right pr-4">Recibido</th>
                                  <th className="pb-1.5 text-right pr-4">Pendiente</th>
                                  <th className="pb-1.5 text-right pr-4">Precio unit.</th>
                                  <th className="pb-1.5 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {o.detalles.map(d => (
                                  <tr key={d.id}>
                                    <td className="py-1.5 pr-4 font-medium text-slate-700">
                                      {d.nombreProducto ?? d.descripcion}
                                    </td>
                                    <td className="py-1.5 pr-4 text-right">{d.cantidad}</td>
                                    <td className="py-1.5 pr-4 text-right text-emerald-600">{d.cantidadRecibida}</td>
                                    <td className="py-1.5 pr-4 text-right text-amber-600">{d.cantidadPendiente}</td>
                                    <td className="py-1.5 pr-4 text-right text-slate-500">
                                      {d.precioUnitario != null ? fmtMoney(d.precioUnitario) : '—'}
                                    </td>
                                    <td className="py-1.5 text-right font-medium">
                                      {d.precioUnitario != null ? fmtMoney(d.cantidad * d.precioUnitario) : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              {total > 0 && (
                                <tfoot>
                                  <tr className="border-t border-slate-200">
                                    <td colSpan={5} className="pt-2 text-right text-xs text-slate-500 font-medium pr-4">Total estimado</td>
                                    <td className="pt-2 text-right font-bold text-slate-800">{fmtMoney(total)}</td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* ── Modal ── */}
      <Modal open={showModal} onClose={resetModal}
        title={editId ? 'Editar orden de compra' : 'Nueva orden de compra'} size="xl">
        <div className="space-y-4">

          {/* Cabecera */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Proveedor *</label>
              <select value={proveedorId} onChange={e => setProveedorId(+e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
                <option value={0}>Seleccionar proveedor…</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">N° de orden</label>
              <input value={numeroOrden} onChange={e => setNumeroOrden(e.target.value)}
                placeholder="OC-001"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de orden</label>
              <input type="date" value={fechaOrden} onChange={e => setFechaOrden(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Entrega estimada</label>
              <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Concepto</label>
              <input value={concepto} onChange={e => setConcepto(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
          </div>

          {/* Ítems */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Productos</p>
              <button onClick={() => setDetalles(d => [...d, newDetalle()])}
                className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                <Plus size={12} /> Agregar ítem
              </button>
            </div>

            <div className="space-y-2">
              {detalles.map(d => (
                <div key={d._key} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <select value={d.productoId ?? 0}
                      onChange={e => onProductoChange(d._key, +e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500">
                      <option value={0}>Producto (opcional)</option>
                      {prodFisicos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input value={d.descripcion}
                      onChange={e => updateDetalle(d._key, { descripcion: e.target.value })}
                      placeholder="Descripción *"
                      className="w-full rounded-xl border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min={0.001} step="0.001" value={d.cantidad || ''}
                      onChange={e => updateDetalle(d._key, { cantidad: parseFloat(e.target.value) || 1 })}
                      placeholder="Cant."
                      className="w-full rounded-xl border border-slate-200 px-2 py-1.5 text-sm text-right outline-none focus:border-brand-500" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min={0} step="0.01" value={d.precioUnitario ?? ''}
                      onChange={e => updateDetalle(d._key, { precioUnitario: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="Precio"
                      className="w-full rounded-xl border border-slate-200 px-2 py-1.5 text-sm text-right outline-none focus:border-brand-500" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button onClick={() => removeDetalle(d._key)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {totalOrden > 0 && (
              <div className="flex justify-end mt-3 pt-3 border-t">
                <span className="text-sm font-bold text-slate-800">
                  Total estimado: {fmtMoney(totalOrden)}
                </span>
              </div>
            )}
          </div>

          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!canSubmit} className="w-full">
            {editId ? 'Guardar cambios' : 'Crear orden de compra'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
