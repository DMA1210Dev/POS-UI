import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Search, Package, Wrench, Layers, Tag } from 'lucide-react'
import { productosApi } from '../../api'
import { Card, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import ProductoModal from './ProductoModal'
import CategoriasModal from './CategoriasModal'
import { useToast, errMsg } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import type { ProductoResponse } from '../../types'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)

export default function ProductosPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const { puedeGestionarProductos, isInventario } = useAuth()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [categoriasOpen, setCategoriasOpen] = useState(false)
  const [editando, setEditando] = useState<ProductoResponse | null>(null)
  const [stockModal, setStockModal] = useState<ProductoResponse | null>(null)
  const [nuevoStock, setNuevoStock] = useState('')

  const { data: productos = [], isLoading } = useQuery({
    queryKey: ['productos', search],
    queryFn: () => productosApi.getAll({ search: search || undefined }),
  })

  const eliminar = useMutation({
    mutationFn: (id: number) => productosApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['productos'] }); success('Producto desactivado') },
    onError: (e) => error(errMsg(e)),
  })

  const ajustarStock = useMutation({
    mutationFn: () => productosApi.adjustStock(stockModal!.id, parseInt(nuevoStock, 10)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['productos'] })
      setStockModal(null)
      setNuevoStock('')
      success('Stock actualizado correctamente')
    },
    onError: (e) => error(errMsg(e)),
  })

  const handleEditarProducto = (p: ProductoResponse) => {
    if (isInventario) {
      setStockModal(p)
      setNuevoStock(String(p.stock))
    } else {
      setEditando(p)
      setModalOpen(true)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Productos</h2>
        <div className="flex items-center gap-2">
          {puedeGestionarProductos && (
            <Button
              variant="secondary"
              icon={<Tag size={16} />}
              onClick={() => setCategoriasOpen(true)}
            >
              Categorías
            </Button>
          )}
          {puedeGestionarProductos && (
            <Button icon={<Plus size={16} />} onClick={() => { setEditando(null); setModalOpen(true) }}>
              Nuevo producto
            </Button>
          )}
        </div>
      </div>
      <Card>
        <CardHeader>
          <div className="relative max-w-xs">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input placeholder="Buscar por nombre o código..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                {['Producto','Tipo','Precio','Stock','Categoría','Estado',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Cargando...</td></tr>}
              {productos.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => handleEditarProducto(p)}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{p.nombre}</p>
                    <p className="text-xs text-slate-400">{p.presentacion}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-slate-600 text-xs">
                      {p.tipo === 'Fisico' ? <Package size={13} /> : <Wrench size={13} />}
                      {p.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">{fmt(p.precio)}</td>
                  <td className="px-4 py-3">
                    {p.tipo === 'Fisico'
                      ? <span className={p.stock <= p.stockMinimo ? 'text-red-600 font-bold' : ''}>{p.stock}</span>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.nombreCategoria}</td>
                  <td className="px-4 py-3"><Badge color={p.activo ? 'green' : 'red'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      {isInventario ? (
                        p.tipo === 'Fisico' && (
                          <Button variant="ghost" size="sm" icon={<Layers size={14} />}
                            className="text-orange-600 hover:bg-orange-50"
                            onClick={() => handleEditarProducto(p)}>
                            Ajustar stock
                          </Button>
                        )
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" icon={<Pencil size={14} />}
                            onClick={() => handleEditarProducto(p)} />
                          <Button variant="ghost" size="sm" icon={<Trash2 size={14} />}
                            className="text-red-500 hover:bg-red-50"
                            onClick={() => eliminar.mutate(p.id)} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && productos.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No hay productos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {modalOpen && (
        <ProductoModal producto={editando} onClose={() => setModalOpen(false)}
          onSuccess={() => { setModalOpen(false); qc.invalidateQueries({ queryKey: ['productos'] }) }} />
      )}

      {categoriasOpen && (
        <CategoriasModal onClose={() => setCategoriasOpen(false)} />
      )}

      {/* Modal ajuste de stock para Inventario */}
      {stockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="font-semibold text-slate-800">Ajustar stock</h3>
              <button onClick={() => setStockModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm space-y-1">
                <p><span className="text-slate-500">Producto:</span> <strong>{stockModal.nombre}</strong></p>
                <p><span className="text-slate-500">Stock actual:</span> <strong>{stockModal.stock}</strong></p>
                <p><span className="text-slate-500">Stock mínimo:</span> <strong>{stockModal.stockMinimo}</strong></p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Nuevo stock</label>
                <input
                  type="number"
                  min="0"
                  value={nuevoStock}
                  onChange={e => setNuevoStock(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <Button variant="secondary" onClick={() => setStockModal(null)}>Cancelar</Button>
                <Button
                  loading={ajustarStock.isPending}
                  disabled={!nuevoStock || parseInt(nuevoStock, 10) < 0}
                  onClick={() => ajustarStock.mutate()}
                >
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
