import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Building2, Phone, Mail, MapPin } from 'lucide-react'
import { cxpApi } from '../../../api'
import { Card, CardBody } from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import EmptyState from '../../../components/ui/EmptyState'
import { useToast, errMsg } from '../../../context/ToastContext'

export default function ProveedoresPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ nombre: '', rnc: '', telefono: '', email: '', direccion: '' })

  const { data: proveedores = [] } = useQuery({
    queryKey: ['proveedores'],
    queryFn: cxpApi.proveedores.getAll,
  })

  const crear = useMutation({
    mutationFn: () => cxpApi.proveedores.create({
      nombre: form.nombre, rnc: form.rnc || null, telefono: form.telefono || null,
      email: form.email || null, direccion: form.direccion || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proveedores'] }); cerrar(); success('Proveedor creado') },
    onError: (e) => error(errMsg(e)),
  })

  const actualizar = useMutation({
    mutationFn: () => cxpApi.proveedores.update(editId!, {
      nombre: form.nombre, rnc: form.rnc || null, telefono: form.telefono || null,
      email: form.email || null, direccion: form.direccion || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proveedores'] }); cerrar(); success('Proveedor actualizado') },
    onError: (e) => error(errMsg(e)),
  })

  const eliminar = useMutation({
    mutationFn: (id: number) => cxpApi.proveedores.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proveedores'] }); success('Proveedor desactivado') },
    onError: (e) => error(errMsg(e)),
  })

  const cerrar = () => { setShowModal(false); setEditId(null); setForm({ nombre: '', rnc: '', telefono: '', email: '', direccion: '' }) }

  const abrirEditar = (p: typeof proveedores[0]) => {
    setForm({ nombre: p.nombre, rnc: p.rnc ?? '', telefono: p.telefono ?? '', email: p.email ?? '', direccion: p.direccion ?? '' })
    setEditId(p.id)
    setShowModal(true)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Proveedores</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestión de proveedores y cuentas por pagar</p>
        </div>
        <Button onClick={() => { setForm({ nombre: '', rnc: '', telefono: '', email: '', direccion: '' }); setEditId(null); setShowModal(true) }}>
          <Plus size={15} />Nuevo proveedor
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {proveedores.map(p => (
          <Card key={p.id}>
            <CardBody>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{p.nombre}</h3>
                  {p.rnc && <p className="text-xs text-slate-400 font-mono mt-0.5">RNC: {p.rnc}</p>}
                </div>
                <Building2 size={18} className="text-slate-400 shrink-0" />
              </div>
              <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                  {p.telefono && <p className="flex items-center gap-1"><Phone size={12} className="text-slate-400 shrink-0" />{p.telefono}</p>}
                  {p.email && <p className="flex items-center gap-1"><Mail size={12} className="text-slate-400 shrink-0" />{p.email}</p>}
                  {p.direccion && <p className="truncate flex items-center gap-1"><MapPin size={12} className="text-slate-400 shrink-0" />{p.direccion}</p>}
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="secondary" onClick={() => abrirEditar(p)}>
                  <Pencil size={12} />Editar
                </Button>
                <Button size="sm" variant="danger" onClick={() => eliminar.mutate(p.id)}>
                  <Trash2 size={12} />Eliminar
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {proveedores.length === 0 && (
        <EmptyState title="Sin proveedores" description="Agrega tu primer proveedor para comenzar." />
      )}

      <Modal open={showModal} onClose={cerrar} title={editId ? 'Editar Proveedor' : 'Nuevo Proveedor'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">RNC</label>
            <input value={form.rnc} onChange={e => setForm(f => ({ ...f, rnc: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label>
              <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Dirección</label>
            <textarea value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <Button onClick={() => (editId ? actualizar : crear).mutate()} loading={crear.isPending || actualizar.isPending} className="w-full">
            <Plus size={15} />{editId ? 'Actualizar' : 'Crear'} proveedor
          </Button>
        </div>
      </Modal>
    </div>
  )
}
