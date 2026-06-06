import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Package, ArrowDown, Trash2 } from 'lucide-react'
import { almacenApi } from '../../api'
import { productosApi } from '../../api'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { errMsg } from '../../context/ToastContext'

interface ItemForm {
  productoId: number
  cantidad: number
  costoUnitario: number
}

export default function EntradasPage() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [concepto, setConcepto] = useState('')
  const [referencia, setReferencia] = useState('')
  const [items, setItems] = useState<ItemForm[]>([])
  const [selProdId, setSelProdId] = useState(0)
  const [selCant, setSelCant] = useState(0)
  const [selCosto, setSelCosto] = useState(0)
  const qc = useQueryClient()

  const { data: movimientos } = useQuery({
    queryKey: ['almacen', 'movimientos', 'Entrada'],
    queryFn: () => almacenApi.movimientos({ tipo: 'Entrada' }),
  })

  const { data: productos } = useQuery({
    queryKey: ['productos'],
    queryFn: () => productosApi.getAll({ soloActivos: true }),
  })

  const mutation = useMutation({
    mutationFn: (dto: Parameters<typeof almacenApi.entradaBatch>[0]) => almacenApi.entradaBatch(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['almacen'] })
      qc.invalidateQueries({ queryKey: ['productos'] })
      setShowModal(false)
      setItems([])
      setConcepto('')
      setReferencia('')
    },
  })

  const prodFisicos = (productos ?? []).filter(p => p.tipo === 'Fisico')
  const filtered = (movimientos ?? []).filter(m =>
    !search || m.nombreProducto.toLowerCase().includes(search.toLowerCase()) || m.codigoBarra?.includes(search))

  const addItem = () => {
    if (!selProdId || !selCant) return
    setItems(i => [...i, { productoId: selProdId, cantidad: selCant, costoUnitario: selCosto }])
    setSelProdId(0)
    setSelCant(0)
    setSelCosto(0)
  }

  const removeItem = (idx: number) => setItems(i => i.filter((_, k) => k !== idx))

  const prodName = (id: number) => prodFisicos.find(p => p.id === id)?.nombre ?? '?'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Entradas de Mercancía</h2>
        <Button onClick={() => setShowModal(true)}><Plus size={15} /> Nueva entrada</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Search size={16} className="text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por producto o código de barra…"
              className="flex-1 bg-transparent outline-none text-sm" />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-left">Producto</th>
                  <th className="px-4 py-2 text-left">Código</th>
                  <th className="px-4 py-2 text-right">Cantidad</th>
                  <th className="px-4 py-2 text-right">Costo Unit.</th>
                  <th className="px-4 py-2 text-left">Concepto</th>
                  <th className="px-4 py-2 text-left">Referencia</th>
                  <th className="px-4 py-2 text-left">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{new Date(m.fecha).toLocaleDateString('es-DO')}</td>
                    <td className="px-4 py-2 font-medium">{m.nombreProducto}</td>
                    <td className="px-4 py-2 text-slate-400">{m.codigoBarra ?? '—'}</td>
                    <td className="px-4 py-2 text-right font-semibold text-success-600">+{m.cantidad}</td>
                    <td className="px-4 py-2 text-right">{m.costoUnitario ? `RD$${m.costoUnitario.toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{m.concepto}</td>
                    <td className="px-4 py-2 text-slate-400">{m.referencia ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{m.nombreUsuario}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    <Package size={32} className="mx-auto mb-2 text-slate-300" />
                    No hay entradas registradas
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Registrar entrada de mercancía" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Concepto</label>
              <input value={concepto} onChange={e => setConcepto(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Referencia</label>
              <input value={referencia} onChange={e => setReferencia(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Productos</p>

            {items.length > 0 && (
              <div className="mb-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-1.5 text-left">Producto</th>
                      <th className="px-3 py-1.5 text-right">Cantidad</th>
                      <th className="px-3 py-1.5 text-right">Costo Unit.</th>
                      <th className="px-3 py-1.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 font-medium">{prodName(it.productoId)}</td>
                        <td className="px-3 py-1.5 text-right">{it.cantidad}</td>
                        <td className="px-3 py-1.5 text-right">{it.costoUnitario > 0 ? `RD$${it.costoUnitario.toFixed(2)}` : '—'}</td>
                        <td className="px-3 py-1.5 text-right">
                          <button onClick={() => removeItem(i)} className="text-danger-500 hover:text-danger-700"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <select value={selProdId} onChange={e => setSelProdId(parseInt(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
                  <option value={0}>Producto…</option>
                  {prodFisicos.map(p => <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.stock})</option>)}
                </select>
              </div>
              <div className="w-24">
                <input type="number" min={0} step="0.001" placeholder="Cant." value={selCant || ''}
                  onChange={e => setSelCant(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </div>
              <div className="w-28">
                <input type="number" min={0} step="0.01" placeholder="Costo RD$" value={selCosto || ''}
                  onChange={e => setSelCosto(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </div>
              <Button onClick={addItem} disabled={!selProdId || !selCant} variant="secondary" size="sm">
                <Plus size={14} /> Agregar
              </Button>
            </div>
          </div>

          {mutation.isError && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{errMsg(mutation.error)}</div>
          )}
          <Button onClick={() => mutation.mutate({
            concepto, referencia: referencia || undefined,
            items: items.map(i => ({ productoId: i.productoId, cantidad: i.cantidad, costoUnitario: i.costoUnitario || undefined })),
          })} loading={mutation.isPending} disabled={!items.length || !concepto} className="w-full">
            <ArrowDown size={15} /> Registrar {items.length} producto(s)
          </Button>
        </div>
      </Modal>
    </div>
  )
}
