import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useQuery, useMutation } from '@tanstack/react-query'
import { X, Pencil } from 'lucide-react'
import { productosApi, categoriasApi } from '../../api'
import Input from '../../components/ui/Input'
import BarcodeInput from '../../components/ui/BarcodeInput'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { useToast, errMsg } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import type { CreateProductoDto, UpdateProductoDto, ProductoResponse, UnidadMedidaOption } from '../../types'

interface Props {
  producto: ProductoResponse | null
  onClose: () => void
  onSuccess: () => void
}

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
function Campo({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-sm text-slate-800 font-medium text-right">{valor ?? <span className="text-slate-400 font-normal">—</span>}</span>
    </div>
  )
}

export default function ProductoModal({ producto, onClose, onSuccess }: Props) {
  const [editando, setEditando] = useState(!producto)

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: categoriasApi.getAll,
  })

  const { data: unidades = [] } = useQuery<UnidadMedidaOption[]>({
    queryKey: ['unidades'],
    queryFn: productosApi.unidades,
  })

  const { register, handleSubmit, watch, reset, control, formState: { errors } } = useForm<CreateProductoDto & { activo: boolean }>({
    defaultValues: {
      tipo: 'Fisico',
      esMedible: false,
      aplicaImpuesto: true,
      porcentajeImpuesto: 18,
      stock: 0,
      stockMinimo: 0,
      unidadMedida: 'Unidad',
      activo: true,
    }
  })

  const tipo = watch('tipo')
  const { success, error } = useToast()
  const { puedeGestionarProductos } = useAuth()

  useEffect(() => {
    if (producto) reset({ ...producto })
    setEditando(!producto)
  }, [producto, reset])

  const crear = useMutation({
    mutationFn: (data: CreateProductoDto) => productosApi.create(data),
    onSuccess: () => { success('Producto creado correctamente'); onSuccess() },
    onError: (e) => error(errMsg(e)),
  })

  const actualizar = useMutation({
    mutationFn: (data: UpdateProductoDto) => productosApi.update(producto!.id, data),
    onSuccess: () => { success('Producto actualizado correctamente'); onSuccess() },
    onError: (e) => error(errMsg(e)),
  })

  const onSubmit = (data: any) => {
    // Asegurar que unidadMedida es string válido (no vacío)
    if (!data.unidadMedida) data.unidadMedida = 'Unidad'
    // contenido vacío → null
    if (!data.contenido) data.contenido = null
    // precio mayorista vacío → null
    if (!data.precioMayorista || isNaN(data.precioMayorista as unknown as number)) data.precioMayorista = undefined
    // precio costo vacío → null
    if (!data.precioCosto || isNaN(data.precioCosto as unknown as number)) data.precioCosto = undefined
    producto ? actualizar.mutate(data) : crear.mutate(data)
  }

  // Agrupar unidades por grupo
  const grupos = unidades.reduce((acc, u) => {
    (acc[u.grupo] ??= []).push(u)
    return acc
  }, {} as Record<string, UnidadMedidaOption[]>)

  const selectClass = "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              {!producto ? 'Nuevo producto' : editando ? 'Editar producto' : producto.nombre}
            </h3>
            {producto && !editando && <p className="text-xs text-slate-400 mt-0.5">Datos del registro</p>}
          </div>
          <div className="flex items-center gap-2">
            {producto && !editando && (
              <button onClick={() => setEditando(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                <Pencil size={12} /> Editar
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
        </div>

        {/* ── Modo vista ── */}
        {producto && !editando ? (
          <div className="px-6 py-4">
            <Campo label="Nombre"        valor={producto.nombre} />
            <Campo label="Descripción"   valor={producto.descripcion} />
            <Campo label="Tipo"          valor={<Badge color={producto.tipo === 'Fisico' ? 'blue' : 'purple'}>{producto.tipo === 'Fisico' ? 'Físico' : 'Servicio'}</Badge>} />
            <Campo label="Categoría"     valor={producto.nombreCategoria} />
            <Campo label="Precio menudeo"  valor={fmt(producto.precio)} />
            {producto.precioMayorista && <Campo label="Precio mayorista" valor={fmt(producto.precioMayorista)} />}
            {puedeGestionarProductos && producto.precioCosto && <Campo label="Precio costo" valor={fmt(producto.precioCosto)} />}
            <Campo label="Stock"         valor={producto.tipo === 'Fisico' ? `${producto.stock} / mín. ${producto.stockMinimo}` : null} />
            <Campo label="ITBIS"         valor={producto.aplicaImpuesto ? `${producto.porcentajeImpuesto}%` : 'No aplica'} />
            <Campo label="Presentación"  valor={producto.presentacion} />
            <Campo label="Código de barra" valor={producto.codigoBarra} />
            <Campo label="Estado"        valor={<Badge color={producto.activo ? 'green' : 'red'}>{producto.activo ? 'Activo' : 'Inactivo'}</Badge>} />
            <div className="flex justify-end pt-3">
              <Button variant="secondary" onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        ) : (

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">

            <div className="col-span-2">
              <Input label="Nombre *" error={errors.nombre?.message}
                {...register('nombre', { required: 'Requerido' })} />
            </div>

            <div className="col-span-2">
              <Input label="Descripción" {...register('descripcion')} />
            </div>

            {/* Tipo */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Tipo *</label>
              <select {...register('tipo')} className={selectClass}>
                <option value="Fisico">Físico</option>
                <option value="Servicio">Servicio</option>
              </select>
            </div>

            {/* Categoría */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Categoría *</label>
              <select {...register('categoriaId', { required: true, valueAsNumber: true })} className={selectClass}>
                <option value="">Seleccionar...</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {errors.categoriaId && <p className="text-xs text-red-600 mt-1">Requerido</p>}
            </div>

            <Input label="Precio menudeo (con ITBIS) *" type="number" step="0.01"
              error={errors.precio?.message}
              {...register('precio', { required: 'Requerido', valueAsNumber: true })} />

            <Input label="Precio mayorista (opcional)" type="number" step="0.01"
              placeholder="Dejar vacío si no aplica"
              {...register('precioMayorista', { valueAsNumber: true })} />

            {/* Precio de costo — solo Admin y Gerente */}
            {puedeGestionarProductos && (
              <Input label="Precio de costo (opcional)" type="number" step="0.01"
                placeholder="Precio de compra/adquisición"
                {...register('precioCosto', { valueAsNumber: true })} />
            )}

            <div className="col-span-2">
              <Controller
                name="codigoBarra"
                control={control}
                render={({ field }) => (
                  <BarcodeInput
                    label="Código de barra (opcional)"
                    placeholder="Ej: 7896543210123"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    inputRef={field.ref}
                  />
                )}
              />
            </div>

            {/* Unidad de medida */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Unidad de medida
                {unidades.length === 0 && <span className="text-xs text-slate-400 ml-2">(cargando...)</span>}
              </label>
              <select {...register('unidadMedida')} className={selectClass}>
                {unidades.length === 0
                  ? <option value="Unidad">Unidad (c/u)</option>
                  : Object.entries(grupos).map(([grupo, items]) => (
                      <optgroup key={grupo} label={grupo}>
                        {items.map(u => (
                          <option key={u.valor} value={u.valor}>{u.etiqueta}</option>
                        ))}
                      </optgroup>
                    ))
                }
              </select>
            </div>

            <Input label="Contenido (ej: 1, 500)" type="number" step="0.001"
              {...register('contenido', { valueAsNumber: true })} />

            {tipo === 'Fisico' && (
              <>
                <Input label="Stock" type="number"
                  {...register('stock', { valueAsNumber: true })} />
                <Input label="Stock mínimo" type="number"
                  {...register('stockMinimo', { valueAsNumber: true })} />
              </>
            )}

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">% Impuesto (ITBIS)</label>
              <Input type="number" step="0.01"
                {...register('porcentajeImpuesto', { valueAsNumber: true })} />
            </div>

            {/* Checkboxes */}
            <div className="col-span-2 flex gap-6 flex-wrap pt-1">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" {...register('aplicaImpuesto')} className="rounded" />
                Aplica impuesto
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" {...register('esMedible')} className="rounded" />
                Es medible (permite decimales al vender)
              </label>
              {producto && (
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" {...register('activo')} className="rounded" />
                  Activo
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="secondary" type="button" onClick={() => producto ? setEditando(false) : onClose()}>
              Cancelar
            </Button>
            <Button type="submit" loading={crear.isPending || actualizar.isPending}>
              {producto ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}
