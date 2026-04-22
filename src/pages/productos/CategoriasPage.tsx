import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { categoriasApi } from '../../api'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useToast, errMsg } from '../../context/ToastContext'
import type { CategoriaResponse } from '../../types'

export default function CategoriasPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [nombre, setNombre] = useState('')
  const [editando, setEditando] = useState<CategoriaResponse | null>(null)

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ['categorias'],
    queryFn: categoriasApi.getAll,
  })

  const crear = useMutation({
    mutationFn: () => categoriasApi.create({ nombre }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorias'] })
      setNombre('')
      success('Categoría creada correctamente')
    },
    onError: (e) => error(errMsg(e)),
  })

  const actualizar = useMutation({
    mutationFn: () => categoriasApi.update(editando!.id, { nombre }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorias'] })
      setEditando(null)
      setNombre('')
      success('Categoría actualizada correctamente')
    },
    onError: (e) => error(errMsg(e)),
  })

  const eliminar = useMutation({
    mutationFn: (id: number) => categoriasApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorias'] })
      success('Categoría eliminada')
    },
    onError: () => error('No puedes eliminar una categoría con productos asignados'),
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return
    editando ? actualizar.mutate() : crear.mutate()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Categorías</h2>
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-700">{editando ? 'Editar categoría' : 'Nueva categoría'}</h3>
        </CardHeader>
        <CardBody>
          <form onSubmit={onSubmit} className="flex gap-3">
            <Input placeholder="Nombre de la categoría" value={nombre} onChange={e => setNombre(e.target.value)} className="flex-1" />
            <Button type="submit" loading={crear.isPending || actualizar.isPending} icon={<Plus size={16} />}>
              {editando ? 'Guardar' : 'Agregar'}
            </Button>
            {editando && (
              <Button variant="secondary" type="button" onClick={() => { setEditando(null); setNombre('') }}>Cancelar</Button>
            )}
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader><h3 className="font-semibold text-slate-700">Categorías ({categorias.length})</h3></CardHeader>
        <div className="divide-y divide-slate-100">
          {isLoading && <p className="px-6 py-4 text-slate-500 text-sm">Cargando...</p>}
          {categorias.map(cat => (
            <div key={cat.id} className="px-6 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800">{cat.nombre}</p>
                <p className="text-xs text-slate-400">{cat.totalProductos} productos</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => { setEditando(cat); setNombre(cat.nombre) }}>Editar</Button>
                <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} className="text-red-500 hover:bg-red-50" onClick={() => eliminar.mutate(cat.id)}>Eliminar</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
