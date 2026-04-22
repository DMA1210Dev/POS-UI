import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Plus, Minus, Trash2, ShoppingCart, ArrowLeft } from 'lucide-react'
import { productosApi, clientesApi, ventasApi } from '../../api'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import BarcodeInput from '../../components/ui/BarcodeInput'
import Badge from '../../components/ui/Badge'
import { ComprobanteSelector } from '../../components/ventas/ComprobanteSelector'
import { useToast, errMsg } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import type { ProductoResponse, CreateDetalleDto, ClienteResponse } from '../../types'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)

interface ItemCarrito extends CreateDetalleDto {
  nombre: string
  precio: number
  precioMinorista: number
  precioMayorista?: number
  esMedible: boolean
  unidadMedida: string
}

export default function EditarVentaPage() {
  const { id } = useParams<{ id: string }>()
  const ventaId = Number(id)
  const navigate = useNavigate()
  const { success, error } = useToast()
  const { isCajero, puedeGestionarProductos } = useAuth()
  const searchRef = useRef<HTMLInputElement>(null)

  const [search,    setSearch]    = useState('')
  const [carrito,   setCarrito]   = useState<ItemCarrito[]>([])
  const [descuento, setDescuento] = useState(0)
  const [tipoPago,  setTipoPago]  = useState<'Contado' | 'Credito'>('Contado')
  const [clienteId, setClienteId] = useState<number | undefined>()
  const [fechaVenc, setFechaVenc] = useState('')
  const [inicializado,       setInicializado]       = useState(false)
  const [tipoComprobanteId,  setTipoComprobanteId]  = useState<number | undefined>()

  // ── Cargar venta existente ────────────────────────────────────────────────
  const { data: venta, isLoading: loadingVenta } = useQuery({
    queryKey: ['ventas', ventaId],
    queryFn:  () => ventasApi.getById(ventaId),
    enabled:  !!ventaId,
  })

  // ── Clientes ──────────────────────────────────────────────────────────────
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', 'venta'],
    queryFn:  () => clientesApi.getAll(),
  })

  // ── Productos de los detalles de la venta ─────────────────────────────────
  const productoIds = venta?.detalles.map(d => d.productoId) ?? []
  const { data: productosVenta = [] } = useQuery({
    queryKey: ['productos', 'editar', productoIds],
    queryFn:  async () => {
      const results = await Promise.all(productoIds.map(pid => productosApi.getById(pid)))
      return results
    },
    enabled: productoIds.length > 0 && !inicializado,
  })

  // ── Inicializar el carrito con los datos de la venta ──────────────────────
  useEffect(() => {
    if (!venta || productosVenta.length === 0 || inicializado) return
    if (productoIds.length !== productosVenta.length) return

    setTipoPago(venta.tipoPago)
    setClienteId(venta.clienteId ?? undefined)
    setDescuento(venta.descuento)

    const items: ItemCarrito[] = venta.detalles.map(d => {
      const prod = productosVenta.find(p => p.id === d.productoId)
      return {
        productoId:      d.productoId,
        cantidad:        d.cantidad,
        nombre:          d.nombreProducto,
        precio:          d.precioConImpuesto,
        precioMinorista: prod?.precio ?? d.precioConImpuesto,
        precioMayorista: prod?.precioMayorista ?? undefined,
        esMedible:       prod?.esMedible ?? false,
        unidadMedida:    d.unidadMedida,
      }
    })
    setCarrito(items)
    setTipoComprobanteId(venta.tipoComprobanteId ?? undefined)
    setInicializado(true)
  }, [venta, productosVenta, inicializado, productoIds.length])

  const clienteSeleccionado: ClienteResponse | undefined =
    clientes.find(c => c.id === clienteId)

  const esMayorista = clienteSeleccionado?.esMayorista ?? false

  // Cuando cambia el modo actualizar precios del carrito
  const prevEsMayoristaRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (!inicializado) return
    if (prevEsMayoristaRef.current === null) {
      prevEsMayoristaRef.current = esMayorista
      return
    }
    if (prevEsMayoristaRef.current !== esMayorista) {
      prevEsMayoristaRef.current = esMayorista
      setCarrito(prev => prev.map(item => ({
        ...item,
        precio: esMayorista && item.precioMayorista
          ? item.precioMayorista
          : item.precioMinorista,
      })))
      setSearch('')
    }
  }, [esMayorista, inicializado])

  // ── Búsqueda de productos ─────────────────────────────────────────────────
  const { data: productos = [] } = useQuery({
    queryKey: ['productos', 'venta', search],
    queryFn:  () => productosApi.getAll({ search: search || undefined, soloActivos: true }),
    enabled:  search.length > 1,
  })

  const agregarProducto = useCallback((p: ProductoResponse) => {
    setSearch('')
    const precio = esMayorista && p.precioMayorista ? p.precioMayorista : p.precio
    setCarrito(prev => {
      const existe = prev.find(i => i.productoId === p.id)
      if (existe) return prev.map(i =>
        i.productoId === p.id ? { ...i, cantidad: i.cantidad + 1 } : i
      )
      return [...prev, {
        productoId: p.id, cantidad: 1, nombre: p.nombre, precio,
        precioMinorista: p.precio,
        precioMayorista: p.precioMayorista ?? undefined,
        esMedible: p.esMedible, unidadMedida: p.unidadMedida,
      }]
    })
    searchRef.current?.focus()
  }, [esMayorista])

  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const val = (e.target as HTMLInputElement).value.trim()
    if (!val) return
    e.preventDefault()
    try {
      const res = await productosApi.getAll({ search: val, soloActivos: true })
      if (res.length === 1)      agregarProducto(res[0])
      else if (res.length === 0) error('Producto no encontrado.')
    } catch { error('Error al buscar el producto.') }
  }

  const handleScannerValue = useCallback((val: string) => setSearch(val), [])

  // ── Auto-descuento ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!inicializado) return
    if (!clienteId) { setDescuento(0); return }
    const cliente = clientes.find(c => c.id === clienteId)
    if (cliente && cliente.porcentajeDescuento > 0) {
      const sub = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0)
      setDescuento(parseFloat((sub * cliente.porcentajeDescuento / 100).toFixed(2)))
    } else {
      setDescuento(0)
    }
  }, [clienteId, clientes, carrito, inicializado])

  // ── Guardar edición ───────────────────────────────────────────────────────
  const guardar = useMutation({
    mutationFn: () => ventasApi.update(ventaId, {
      items:    carrito.map(i => ({ productoId: i.productoId, cantidad: i.cantidad })),
      descuento,
      tipoPago,
      clienteId,
      esMayorista,
      fechaVencimientoCredito: tipoPago === 'Credito' && fechaVenc ? fechaVenc : undefined,
      tipoComprobanteId,
    }),
    onSuccess: () => { success('Venta actualizada correctamente'); navigate('/ventas') },
    onError:   (e) => error(errMsg(e)),
  })

  const actualizarCantidad = (id: number, val: string) => {
    const num = parseFloat(val) || 0
    setCarrito(prev =>
      prev.map(i => i.productoId === id ? { ...i, cantidad: num } : i)
          .filter(i => i.cantidad > 0)
    )
  }

  const subtotal = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const total    = subtotal - descuento

  // Permiso: cajero solo puede editar si está Pendiente
  const puedeEditar = venta
    ? (!isCajero || venta.estado === 'Pendiente') && venta.estado !== 'Cancelada'
    : false

  if (loadingVenta || !inicializado) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!venta || !puedeEditar) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-500">
        <p className="text-lg font-medium">No tienes permiso para editar esta venta.</p>
        <Button variant="secondary" icon={<ArrowLeft size={16}/>} onClick={() => navigate('/ventas')}>
          Volver
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/ventas')}
          className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Editar Venta #{ventaId}</h2>
          <p className="text-sm text-slate-400">Estado actual: <Badge color={venta.estado === 'Pendiente' ? 'yellow' : 'green'}>{venta.estado}</Badge></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Buscador ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-700">Agregar productos</h3>
                {esMayorista && <Badge color="purple">Precios mayoristas</Badge>}
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <BarcodeInput
                label=""
                placeholder="Buscar por nombre, código o escanear…"
                value={search}
                onChange={handleScannerValue}
                onKeyDown={handleSearchKeyDown}
                inputRef={searchRef}
              />
              {search.length > 1 && productos.length > 0 && (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-52 overflow-y-auto shadow-sm">
                  {productos.map(p => {
                    const precioMostrar = esMayorista && p.precioMayorista ? p.precioMayorista : p.precio
                    const tieneMayorista = p.precioMayorista != null
                    return (
                      <button key={p.id} onClick={() => agregarProducto(p)}
                        className="w-full px-4 py-2.5 text-left hover:bg-blue-50 flex justify-between items-center text-sm">
                        <div>
                          <p className="font-medium text-slate-800">{p.nombre}</p>
                          <p className="text-xs text-slate-400">{p.presentacion} · {p.nombreCategoria}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${esMayorista && tieneMayorista ? 'text-purple-600' : 'text-blue-600'}`}>
                            {fmt(precioMostrar)}
                          </p>
                          {esMayorista && tieneMayorista && (
                            <p className="text-xs text-slate-400 line-through">{fmt(p.precio)}</p>
                          )}
                          {puedeGestionarProductos && p.precioMayorista && !esMayorista && (
                            <p className="text-xs text-purple-400">May: {fmt(p.precioMayorista)}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* ── Carrito ────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <ShoppingCart size={16} /> Carrito ({carrito.length} ítems)
              </h3>
            </CardHeader>
            {carrito.length === 0
              ? <CardBody><p className="text-center text-slate-400 py-4">Agrega productos para comenzar</p></CardBody>
              : (
                <div className="divide-y divide-slate-100">
                  {carrito.map(item => (
                    <div key={item.productoId} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-sm truncate">{item.nombre}</p>
                        <div className="flex items-center gap-2">
                          <p className={`text-xs ${esMayorista && item.precioMayorista ? 'text-purple-600 font-medium' : 'text-slate-400'}`}>
                            {fmt(item.precio)} c/u
                          </p>
                          {esMayorista && item.precioMayorista && (
                            <p className="text-xs text-slate-300 line-through">{fmt(item.precioMinorista)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!item.esMedible
                          ? <>
                              <button onClick={() => actualizarCantidad(item.productoId, String(item.cantidad - 1))}
                                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                                <Minus size={12} />
                              </button>
                              <span className="w-8 text-center font-semibold text-sm">{item.cantidad}</span>
                              <button onClick={() => actualizarCantidad(item.productoId, String(item.cantidad + 1))}
                                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                                <Plus size={12} />
                              </button>
                            </>
                          : <input type="number" step="0.001" value={item.cantidad}
                              onChange={e => actualizarCantidad(item.productoId, e.target.value)}
                              className="w-20 px-2 py-1 text-sm border border-slate-300 rounded-lg text-center outline-none focus:border-blue-500" />
                        }
                        <span className="text-xs text-slate-400 w-8">{item.unidadMedida}</span>
                      </div>
                      <p className="font-semibold text-slate-800 w-20 text-right text-sm flex-shrink-0">
                        {fmt(item.precio * item.cantidad)}
                      </p>
                      <button
                        onClick={() => setCarrito(prev => prev.filter(i => i.productoId !== item.productoId))}
                        className="text-red-400 hover:text-red-600 flex-shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
          </Card>
        </div>

        {/* ── Resumen ────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><h3 className="font-semibold text-slate-700">Resumen</h3></CardHeader>
            <CardBody className="space-y-4">

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Tipo de pago</label>
                <div className="flex gap-2">
                  {(['Contado', 'Credito'] as const).map(t => (
                    <button key={t} onClick={() => setTipoPago(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        tipoPago === t
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-slate-300 text-slate-600 hover:border-blue-400'
                      }`}>{t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Cliente {tipoPago === 'Credito' && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={clienteId ?? ''}
                  onChange={e => setClienteId(Number(e.target.value) || undefined)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                >
                  <option value="">Sin cliente / Mostrador</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                      {c.esMayorista ? ' [Mayorista]' : ''}
                      {c.porcentajeDescuento > 0 ? ` — ${c.porcentajeDescuento}% desc.` : ''}
                    </option>
                  ))}
                </select>
                {esMayorista ? (
                  <p className="text-xs text-purple-600 mt-1 font-medium">
                    Usando precios mayoristas para {clienteSeleccionado?.nombre}
                  </p>
                ) : clienteSeleccionado ? (
                  <p className="text-xs text-blue-600 mt-1 font-medium">Usando precios minoristas</p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">Sin cliente — precios minoristas</p>
                )}
              </div>

              {tipoPago === 'Credito' && (
                <Input label="Fecha vencimiento (opcional)" type="date" value={fechaVenc}
                  onChange={e => setFechaVenc(e.target.value)} />
              )}

              <ComprobanteSelector
                tipoComprobanteId={tipoComprobanteId}
                onChange={setTipoComprobanteId}
              />

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Descuento (RD$)</label>
                <input type="number" step="0.01" min="0" value={descuento}
                  onChange={e => setDescuento(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500" />
              </div>

              <div className="pt-2 border-t space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span><span>{fmt(subtotal)}</span>
                </div>
                {descuento > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>Descuento</span><span>-{fmt(descuento)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-slate-800 pt-2 border-t">
                  <span>Total</span><span>{fmt(total)}</span>
                </div>
              </div>

              <Button
                className="w-full justify-center py-3"
                loading={guardar.isPending}
                disabled={carrito.length === 0 || (tipoPago === 'Credito' && !clienteId)}
                onClick={() => guardar.mutate()}
              >
                Guardar cambios
              </Button>

              <Button variant="secondary" className="w-full justify-center"
                onClick={() => navigate('/ventas')}>
                Cancelar
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
