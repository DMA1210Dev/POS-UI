import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Search, Eye } from 'lucide-react'
import { clientesApi } from '../../api'
import { Card, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import ClienteModal from './ClienteModal'
import { useAuth } from '../../context/AuthContext'
import { useComercio } from '../../context/ComercioContext'
import type { ClienteResponse } from '../../types'

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)

export default function ClientesPage() {
  const qc = useQueryClient()
  const { puedeGestionarClientes, user } = useAuth()
  const { comercio } = useComercio()
  // "*" = todos; de lo contrario solo si el rol del usuario está en la lista
  const rolesMayoristas = comercio?.rolesMayoristas ?? []
  const verMayoristas = rolesMayoristas.includes('*') || (!!user?.rol && rolesMayoristas.includes(user.rol))
  const [search, setSearch] = useState('')
  const [soloDeuda, setSoloDeuda] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'mayorista' | 'minorista'>('todos')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<ClienteResponse | null>(null)
  const [modoEdicion, setModoEdicion] = useState(false)

  const esMayoristaParam = filtroTipo === 'mayorista' ? true : filtroTipo === 'minorista' ? false : undefined
  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes', search, soloDeuda, filtroTipo],
    queryFn: () => clientesApi.getAll({
      search: search || undefined,
      soloConDeuda: soloDeuda || undefined,
      esMayorista: esMayoristaParam,
    }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Clientes</h2>
        {puedeGestionarClientes && (
          <Button icon={<Plus size={16} />} onClick={() => { setEditando(null); setModal(true) }}>Nuevo cliente</Button>
        )}
      </div>
      <Card>
        <CardHeader>
          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input placeholder="Buscar por nombre, cédula o teléfono..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
            {/* Filtro mayorista/minorista — visible según configuración del comercio */}
            {verMayoristas && (
              <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm">
                {(['todos', 'minorista', 'mayorista'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setFiltroTipo(t)}
                    className={`px-3 py-1.5 capitalize transition-colors ${
                      filtroTipo === t
                        ? t === 'mayorista'
                          ? 'bg-purple-600 text-white'
                          : 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}>
                    {t === 'todos' ? 'Todos' : t === 'minorista' ? 'Minoristas' : 'Mayoristas'}
                  </button>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={soloDeuda} onChange={e => setSoloDeuda(e.target.checked)} />
              Solo con deuda
            </label>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>{['Nombre', ...(verMayoristas ? ['Tipo'] : []), 'Cédula','Teléfono','Créditos activos','Deuda total','Estado',''].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && <tr><td colSpan={verMayoristas ? 8 : 7} className="px-4 py-8 text-center text-slate-400">Cargando...</td></tr>}
              {clientes.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => { setEditando(c); setModoEdicion(false); setModal(true) }}>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.nombre}</td>
                  {verMayoristas && (
                    <td className="px-4 py-3">
                      <Badge color={c.esMayorista ? 'purple' : 'blue'}>
                        {c.esMayorista ? 'Mayorista' : 'Minorista'}
                      </Badge>
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-600">{c.cedula ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.telefono ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge color={c.creditosActivos > 0 ? 'orange' : 'gray'}>{c.creditosActivos}</Badge>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    <span className={c.totalDeuda > 0 ? 'text-red-600' : 'text-slate-400'}>
                      {c.totalDeuda > 0 ? fmt(c.totalDeuda) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3"><Badge color={c.activo ? 'green' : 'red'}>{c.activo ? 'Activo' : 'Inactivo'}</Badge></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" icon={<Eye size={14} />}
                        onClick={() => { setEditando(c); setModoEdicion(false); setModal(true) }} />
                      {puedeGestionarClientes && (
                        <Button variant="ghost" size="sm" icon={<Pencil size={14} />}
                          onClick={() => { setEditando(c); setModoEdicion(true); setModal(true) }} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && clientes.length === 0 && (
                <tr><td colSpan={verMayoristas ? 8 : 7} className="px-4 py-8 text-center text-slate-400">No hay clientes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {modal && <ClienteModal cliente={editando} modoEdicion={modoEdicion} onClose={() => setModal(false)}
        onSuccess={() => { setModal(false); qc.invalidateQueries({ queryKey: ['clientes'] }) }} />}
    </div>
  )
}
