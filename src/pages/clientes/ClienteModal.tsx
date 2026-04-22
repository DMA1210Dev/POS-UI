import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X, Pencil } from 'lucide-react'
import { clientesApi, comprobantesApi } from '../../api'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { useToast, errMsg } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import type { ClienteResponse, CreateClienteDto } from '../../types'

interface Props { cliente: ClienteResponse | null; onClose: () => void; onSuccess: () => void; modoEdicion?: boolean }

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)

function Campo({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-sm text-slate-800 font-medium text-right">{valor ?? <span className="text-slate-400 font-normal">—</span>}</span>
    </div>
  )
}

export default function ClienteModal({ cliente, onClose, onSuccess, modoEdicion = false }: Props) {
  const { isAdmin } = useAuth()
  const { success, error } = useToast()
  // Nuevos registros abren directo en edición; registros existentes abren en vista (o edición si se pasa modoEdicion)
  const [editando, setEditando] = useState(!cliente || modoEdicion)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateClienteDto & { activo: boolean }>({
    defaultValues: { porcentajeDescuento: 0, esMayorista: false },
  })

  const { data: comprobantes = [] } = useQuery({
    queryKey: ['comprobantes', 'activos'],
    queryFn: () => comprobantesApi.getAll(true),
  })

  useEffect(() => {
    if (cliente) reset(cliente)
    setEditando(!cliente || modoEdicion)
  }, [cliente, modoEdicion, reset])

  const crear = useMutation({
    mutationFn: (d: CreateClienteDto) => clientesApi.create(d),
    onSuccess: () => { success('Cliente creado correctamente'); onSuccess() },
    onError: (e) => error(errMsg(e)),
  })
  const actualizar = useMutation({
    mutationFn: (d: any) => clientesApi.update(cliente!.id, d),
    onSuccess: () => { success('Cliente actualizado correctamente'); onSuccess() },
    onError: (e) => error(errMsg(e)),
  })

  const comprobante = comprobantes.find(c => c.id === cliente?.tipoComprobanteId)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="font-semibold text-slate-800">
              {!cliente ? 'Nuevo cliente' : editando ? 'Editar cliente' : cliente.nombre}
            </h3>
            {cliente && !editando && (
              <p className="text-xs text-slate-400 mt-0.5">Datos del registro</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {cliente && !editando && (
              <button
                onClick={() => setEditando(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Pencil size={12} /> Editar
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
        </div>

        {/* Modo vista */}
        {cliente && !editando ? (
          <div className="px-6 py-4">
            <Campo label="Nombre"    valor={cliente.nombre} />
            <Campo label="Cédula"    valor={cliente.cedula} />
            <Campo label="Teléfono"  valor={cliente.telefono} />
            <Campo label="Email"     valor={cliente.email} />
            <Campo label="Dirección" valor={cliente.direccion} />
            <Campo label="Tipo"      valor={
              <Badge color={cliente.esMayorista ? 'purple' : 'blue'}>
                {cliente.esMayorista ? 'Mayorista' : 'Minorista'}
              </Badge>
            } />
            <Campo label="Descuento" valor={cliente.porcentajeDescuento > 0 ? `${cliente.porcentajeDescuento}%` : null} />
            <Campo label="Comprobante" valor={
              comprobante ? `${comprobante.nombre} (${comprobante.codigo})` : cliente.nombreComprobante
            } />
            <Campo label="Deuda"     valor={cliente.totalDeuda > 0 ? <span className="text-red-600">{fmt(cliente.totalDeuda)}</span> : null} />
            <Campo label="Créditos"  valor={cliente.creditosActivos > 0 ? <span className="text-orange-600">{cliente.creditosActivos} activos</span> : null} />
            <Campo label="Estado"    valor={<Badge color={cliente.activo ? 'green' : 'red'}>{cliente.activo ? 'Activo' : 'Inactivo'}</Badge>} />
            <div className="flex justify-end pt-3">
              <Button variant="secondary" onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        ) : (
          /* Modo edición */
          <form onSubmit={handleSubmit(d => cliente ? actualizar.mutate(d) : crear.mutate(d as CreateClienteDto))} className="px-6 py-5 space-y-4">
            <Input label="Nombre *" error={errors.nombre?.message} {...register('nombre', { required: 'Requerido' })} />
            <Input label="Cédula (11 dígitos)" {...register('cedula')} />
            <Input label="Teléfono" {...register('telefono')} />
            <Input label="Email" type="email" {...register('email')} />
            <Input label="Dirección" {...register('direccion')} />

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Descuento automático (%)</label>
              <div className="relative">
                <input
                  type="number" step="0.5" min="0" max="100" placeholder="0"
                  className="w-full px-3 py-2 pr-8 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  {...register('porcentajeDescuento', { min: 0, max: 100, valueAsNumber: true })}
                />
                <span className="absolute right-3 top-2.5 text-slate-400 text-sm font-medium">%</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Se aplica automáticamente al seleccionar este cliente en una venta</p>
            </div>

            {/* Comprobante fiscal — obligatorio */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Comprobante fiscal <span className="text-red-500">*</span>
              </label>
              <select
                className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 bg-white transition-colors ${
                  errors.tipoComprobanteId
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-100'
                    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                }`}
                {...register('tipoComprobanteId', {
                  required: 'El comprobante fiscal es requerido',
                  setValueAs: v => v === '' ? undefined : Number(v),
                  validate: v => !!v || 'El comprobante fiscal es requerido',
                })}
              >
                <option value="">— Seleccionar comprobante —</option>
                {comprobantes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>
                ))}
              </select>
              {errors.tipoComprobanteId
                ? <p className="text-xs text-red-600 mt-1">{errors.tipoComprobanteId.message}</p>
                : <p className="text-xs text-slate-400 mt-1">Se cargará automáticamente al seleccionar este cliente en una venta</p>
              }
            </div>

            {isAdmin && (
              <div className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo de cliente</p>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                  <input type="checkbox" {...register('esMayorista')} className="rounded accent-purple-600" />
                  <span>Cliente <strong className="text-purple-700">Mayorista</strong></span>
                </label>
              </div>
            )}

            {cliente && (
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" {...register('activo')} /> Activo
              </label>
            )}
            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="secondary" type="button" onClick={() => cliente ? setEditando(false) : onClose()}>
                Cancelar
              </Button>
              <Button type="submit" loading={crear.isPending || actualizar.isPending}>
                {cliente ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
