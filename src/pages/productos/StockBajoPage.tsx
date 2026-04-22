import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { productosApi } from '../../api'
import { Card } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)

export default function StockBajoPage() {
  const { data: productos = [], isLoading } = useQuery({
    queryKey: ['productos', 'stock-bajo'],
    queryFn: productosApi.stockBajo,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle size={24} className="text-red-500" />
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Stock Bajo</h2>
          <p className="text-slate-500 text-sm">Productos con stock igual o menor al mínimo configurado</p>
        </div>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>{['Producto','Categoría','Precio','Stock actual','Mínimo','Estado'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Cargando...</td></tr>}
              {productos.map(p => (
                <tr key={p.id} className="hover:bg-red-50">
                  <td className="px-4 py-3"><p className="font-medium">{p.nombre}</p><p className="text-xs text-slate-400">{p.presentacion}</p></td>
                  <td className="px-4 py-3 text-slate-600">{p.nombreCategoria}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(p.precio)}</td>
                  <td className="px-4 py-3 font-bold text-red-600">{p.stock}</td>
                  <td className="px-4 py-3 text-slate-600">{p.stockMinimo}</td>
                  <td className="px-4 py-3"><Badge color={p.stock === 0 ? 'red' : 'yellow'}>{p.stock === 0 ? 'Sin stock' : 'Stock bajo'}</Badge></td>
                </tr>
              ))}
              {!isLoading && productos.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-green-600 font-medium">✓ Todos los productos tienen stock suficiente</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
