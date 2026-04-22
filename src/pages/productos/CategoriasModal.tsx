import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Pencil, Trash2, Search, Tag, Check } from 'lucide-react'
import { categoriasApi } from '../../api'
import Button from '../../components/ui/Button'
import { useToast, errMsg } from '../../context/ToastContext'
import type { CategoriaResponse } from '../../types'

interface Props {
  onClose: () => void
}

export default function CategoriasModal({ onClose }: Props) {
  const qc = useQueryClient()
  const { success, error } = useToast()

  const [search, setSearch]     = useState('')
  const [nombre, setNombre]     = useState('')
  const [editando, setEditando] = useState<CategoriaResponse | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  // Focus el input de nombre al abrir o al iniciar edición
  useEffect(() => {
    inputRef.current?.focus()
  }, [editando])

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ['categorias'],
    queryFn: categoriasApi.getAll,
  })

  const categoriasFiltradas = categorias.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase())
  )

  const crear = useMutation({
    mutationFn: () => categoriasApi.create({ nombre: nombre.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorias'] })
      setNombre('')
      success('Categoría creada')
    },
    onError: (e) => error(errMsg(e)),
  })

  const actualizar = useMutation({
    mutationFn: () => categoriasApi.update(editando!.id, { nombre: nombre.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorias'] })
      setEditando(null)
      setNombre('')
      success('Categoría actualizada')
    },
    onError: (e) => error(errMsg(e)),
  })

  const eliminar = useMutation({
    mutationFn: (id: number) => categoriasApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorias'] })
      setConfirmEliminar(null)
      success('Categoría eliminada')
    },
    onError: () => {
      setConfirmEliminar(null)
      error('No puedes eliminar una categoría con productos asignados')
    },
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return
    editando ? actualizar.mutate() : crear.mutate()
  }

  const iniciarEdicion = (cat: CategoriaResponse) => {
    setEditando(cat)
    setNombre(cat.nombre)
    setSearch('')
  }

  const cancelarEdicion = () => {
    setEditando(null)
    setNombre('')
  }

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Tag size={16} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Categorías</h3>
              <p className="text-xs text-slate-400">{categorias.length} categorías en total</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario crear / editar */}
        <div className="px-6 py-4 border-b border-slate-100 shrink-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            {editando ? `Editando: ${editando.nombre}` : 'Nueva categoría'}
          </p>
          <form onSubmit={onSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Nombre de la categoría..."
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
            />
            <Button
              type="submit"
              size="sm"
              loading={crear.isPending || actualizar.isPending}
              disabled={!nombre.trim()}
              icon={editando ? <Check size={14} /> : <Plus size={14} />}
            >
              {editando ? 'Guardar' : 'Agregar'}
            </Button>
            {editando && (
              <Button type="button" size="sm" variant="secondary" onClick={cancelarEdicion}>
                Cancelar
              </Button>
            )}
          </form>
        </div>

        {/* Buscador */}
        <div className="px-6 pt-4 pb-2 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrar categorías..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 px-6 pb-4 space-y-1 mt-2">
          {isLoading && (
            <p className="text-sm text-slate-400 text-center py-6">Cargando...</p>
          )}

          {!isLoading && categoriasFiltradas.length === 0 && (
            <div className="text-center py-8">
              <Tag size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">
                {search ? 'Sin resultados para tu búsqueda' : 'No hay categorías aún'}
              </p>
            </div>
          )}

          {categoriasFiltradas.map(cat => (
            <div
              key={cat.id}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                editando?.id === cat.id
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  editando?.id === cat.id ? 'bg-blue-500' : 'bg-slate-300'
                }`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{cat.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {cat.totalProductos === 1
                      ? '1 producto'
                      : `${cat.totalProductos} productos`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-2">
                {confirmEliminar === cat.id ? (
                  <>
                    <span className="text-xs text-red-500 mr-1">¿Eliminar?</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 text-xs px-2"
                      loading={eliminar.isPending}
                      onClick={() => eliminar.mutate(cat.id)}
                    >
                      Sí
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs px-2"
                      onClick={() => setConfirmEliminar(null)}
                    >
                      No
                    </Button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => iniciarEdicion(cat)}
                      className="w-7 h-7 rounded-lg hover:bg-blue-100 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmEliminar(cat.id)}
                      className="w-7 h-7 rounded-lg hover:bg-red-100 flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
