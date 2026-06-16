import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Package, ArrowUp, Trash2, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { almacenApi, cxpApi } from '../../api'
import { productosApi } from '../../api'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { errMsg, useToast } from '../../context/ToastContext'
import type { CuentaPagarDto, CuentaPagarDetalleDto } from '../../types'

interface ItemLibre { productoId: number; cantidad: number }

interface ItemFactura {
  detalleId: number
  productoId: number
  descripcion: string
  cantidadPendiente: number
  cantidadASalir: number
  incluir: boolean
}

export default function SalidasPage() {
  const { error: toastError } = useToast()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [modoFactura, setModoFactura] = useState(false)
  const [concepto, setConcepto] = useState('')
  const [referencia, setReferencia] = useState('')

  // Modo libre
  const [items, setItems] = useState<ItemLibre[]>([])
  const [selProdId, setSelProdId] = useState(0)
  const [selCant, setSelCant] = useState(0)

  // Modo factura
  const [buscarFactura, setBuscarFactura] = useState('')
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<CuentaPagarDto | null>(null)
  const [itemsFactura, setItemsFactura] = useState<ItemFactura[]>([])
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  const qc = useQueryClient()

  const { data: movimientos } = useQuery({
    queryKey: ['almacen', 'movimientos', 'Salida'],
    queryFn: () => almacenApi.movimientos({ tipo: 'Salida' }),
  })

  const { data: productos } = useQuery({
    queryKey: ['productos'],
    queryFn: () => productosApi.getAll({ soloActivos: true }),
  })

  const { data: facturasPendientes = [] } = useQuery({
    queryKey: ['cxp', 'facturas-pendientes', buscarFactura],
    queryFn: () => cxpApi.facturas.pendientesInventario(buscarFactura || undefined),
    enabled: modoFactura,
  })

  // Cuando se selecciona una factura, pre-poblar los ítems
  useEffect(() => {
    if (!facturaSeleccionada) { setItemsFactura([]); return }
    setItemsFactura(
      facturaSeleccionada.detalles
        .filter(d => d.cantidadPendiente > 0 && d.productoId !== null)
        .map(d => ({
          detalleId: d.id,
          productoId: d.productoId!,
          descripcion: d.descripcion,
          cantidadPendiente: d.cantidadPendiente,
          cantidadASalir: d.cantidadPendiente,
          incluir: true,
        }))
    )
    setConcepto(`Salida factura ${facturaSeleccionada.facturaNumero ?? facturaSeleccionada.id}`)
    setReferencia(facturaSeleccionada.facturaNumero ?? '')
  }, [facturaSeleccionada])

  const resetModal = () => {
    setShowModal(false)
    setModoFactura(false)
    setConcepto('')
    setReferencia('')
    setItems([])
    setSelProdId(0)
    setSelCant(0)
    setBuscarFactura('')
    setFacturaSeleccionada(null)
    setItemsFactura([])
  }

  const mutationLibre = useMutation({
    mutationFn: () => almacenApi.salidaBatch({
      concepto,
      referencia: referencia || undefined,
      items: items.map(i => ({ productoId: i.productoId, cantidad: i.cantidad })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['almacen'] })
      qc.invalidateQueries({ queryKey: ['productos'] })
      resetModal()
    },
    onError: (e) => toastError(errMsg(e)),
  })

  const mutationFactura = useMutation({
    mutationFn: () => {
      const activos = itemsFactura.filter(i => i.incluir && i.cantidadASalir > 0)
      return almacenApi.salidaDesdeFactura({
        cuentaPagarId: facturaSeleccionada!.id,
        concepto,
        referencia: referencia || undefined,
        items: activos.map(i => ({
          cuentaPagarDetalleId: i.detalleId,
          productoId: i.productoId,
          cantidad: i.cantidadASalir,
        })),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['almacen'] })
      qc.invalidateQueries({ queryKey: ['productos'] })
      qc.invalidateQueries({ queryKey: ['cxp'] })
      resetModal()
    },
    onError: (e) => toastError(errMsg(e)),
  })

  const prodFisicos = (productos ?? []).filter(p => p.tipo === 'Fisico')
  const filtered = (movimientos ?? []).filter(m =>
    !search || m.nombreProducto.toLowerCase().includes(search.toLowerCase()) || m.codigoBarra?.includes(search))

  const addItemLibre = () => {
    if (!selProdId || !selCant) return
    setItems(i => [...i, { productoId: selProdId, cantidad: selCant }])
    setSelProdId(0)
    setSelCant(0)
  }
  const removeItemLibre = (idx: number) => setItems(i => i.filter((_, k) => k !== idx))
  const prodName = (id: number) => prodFisicos.find(p => p.id === id)?.nombre ?? '?'

  const updateCantFactura = (detalleId: number, val: number) => {
    setItemsFactura(prev => prev.map(i =>
      i.detalleId === detalleId
        ? { ...i, cantidadASalir: Math.min(Math.max(0, val), i.cantidadPendiente) }
        : i
    ))
  }
  const toggleIncluir = (detalleId: number) => {
    setItemsFactura(prev => prev.map(i =>
      i.detalleId === detalleId ? { ...i, incluir: !i.incluir } : i
    ))
  }

  const itemsActivosFactura = itemsFactura.filter(i => i.incluir && i.cantidadASalir > 0)
  const canSubmitFactura = !!facturaSeleccionada && !!concepto && itemsActivosFactura.length > 0

  // Obtener nombre de factura para mostrar en tabla de movimientos
  const facturaLabel = (cuentaPagarId: number | null) => {
    if (!cuentaPagarId) return null
    return `Factura #${cuentaPagarId}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Salidas de Mercancía</h2>
        <Button onClick={() => setShowModal(true)}><Plus size={15} /> Nueva salida</Button>
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
                  <th className="px-4 py-2 text-left">Concepto</th>
                  <th className="px-4 py-2 text-left">Referencia / Factura</th>
                  <th className="px-4 py-2 text-left">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{new Date(m.fecha).toLocaleDateString('es-DO')}</td>
                    <td className="px-4 py-2 font-medium">{m.nombreProducto}</td>
                    <td className="px-4 py-2 text-slate-400">{m.codigoBarra ?? '—'}</td>
                    <td className="px-4 py-2 text-right font-semibold text-red-500">-{m.cantidad}</td>
                    <td className="px-4 py-2 text-slate-600">{m.concepto}</td>
                    <td className="px-4 py-2 text-slate-400">
                      {m.cuentaPagarId
                        ? <span className="inline-flex items-center gap-1 text-brand-600 font-medium">
                            <FileText size={12} />{facturaLabel(m.cuentaPagarId)}
                          </span>
                        : (m.referencia ?? '—')}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{m.nombreUsuario}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    <Package size={32} className="mx-auto mb-2 text-slate-300" />
                    No hay salidas registradas
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal open={showModal} onClose={resetModal} title="Registrar salida de mercancía" size="xl">
        <div className="space-y-4">

          {/* Toggle modo */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
            <button
              onClick={() => setModoFactura(false)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${!modoFactura ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              Salida libre
            </button>
            <button
              onClick={() => setModoFactura(true)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${modoFactura ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              <FileText size={14} className="inline mr-1" />Desde factura
            </button>
          </div>

          {/* ── MODO FACTURA ─────────────────────────── */}
          {modoFactura && (
            <div className="space-y-3">
              {/* Buscador de facturas */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Buscar factura pendiente</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={buscarFactura}
                    onChange={e => { setBuscarFactura(e.target.value); setFacturaSeleccionada(null) }}
                    placeholder="Número de factura, NCF o proveedor…"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand-500"
                  />
                </div>

                {/* Lista de facturas */}
                {facturasPendientes.length > 0 && !facturaSeleccionada && (
                  <div className="mt-1 border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {facturasPendientes.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setFacturaSeleccionada(f)}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-sm">{f.proveedorNombre}</span>
                            <span className="text-slate-400 text-xs ml-2">{f.facturaNumero ?? f.ncf ?? `#${f.id}`}</span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {f.detalles.filter(d => d.cantidadPendiente > 0).length} ítem(s) pendiente(s)
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {buscarFactura && facturasPendientes.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">No hay facturas pendientes con esa búsqueda.</p>
                )}
              </div>

              {/* Factura seleccionada */}
              {facturaSeleccionada && (
                <div className="border border-brand-200 bg-brand-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-800">{facturaSeleccionada.proveedorNombre}</p>
                      <p className="text-xs text-slate-500">
                        {facturaSeleccionada.facturaNumero ?? facturaSeleccionada.ncf ?? `Factura #${facturaSeleccionada.id}`}
                        {' · '}{facturaSeleccionada.fechaEmision}
                      </p>
                    </div>
                    <button
                      onClick={() => { setFacturaSeleccionada(null); setItemsFactura([]) }}
                      className="text-xs text-slate-400 hover:text-slate-600 underline">
                      Cambiar
                    </button>
                  </div>

                  {/* Ítems de la factura */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                          <th className="text-left pb-1.5 pr-2">
                            <input type="checkbox"
                              checked={itemsFactura.every(i => i.incluir)}
                              onChange={e => setItemsFactura(prev => prev.map(i => ({ ...i, incluir: e.target.checked })))}
                              className="mr-1" />
                            Producto
                          </th>
                          <th className="text-right pb-1.5 pr-2">Pendiente</th>
                          <th className="text-right pb-1.5">A salir ahora</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {itemsFactura.map(item => (
                          <tr key={item.detalleId} className={item.incluir ? '' : 'opacity-40'}>
                            <td className="py-1.5 pr-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={item.incluir}
                                  onChange={() => toggleIncluir(item.detalleId)} />
                                <span className="font-medium">{item.descripcion}</span>
                              </label>
                            </td>
                            <td className="py-1.5 pr-2 text-right text-slate-500">{item.cantidadPendiente}</td>
                            <td className="py-1.5 text-right">
                              <input
                                type="number" min={0} max={item.cantidadPendiente} step="0.001"
                                value={item.cantidadASalir || ''}
                                onChange={e => updateCantFactura(item.detalleId, parseFloat(e.target.value) || 0)}
                                disabled={!item.incluir}
                                className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm text-right outline-none focus:border-brand-500 disabled:bg-slate-50"
                              />
                            </td>
                          </tr>
                        ))}
                        {itemsFactura.length === 0 && (
                          <tr><td colSpan={3} className="py-3 text-center text-slate-400 text-xs">
                            Esta factura no tiene ítems con producto asignado y cantidad pendiente.
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── CAMPOS COMUNES ───────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Concepto *</label>
              <input value={concepto} onChange={e => setConcepto(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Referencia</label>
              <input value={referencia} onChange={e => setReferencia(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
          </div>

          {/* ── MODO LIBRE ───────────────────────────── */}
          {!modoFactura && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Productos</p>

              {items.length > 0 && (
                <div className="mb-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                      <tr>
                        <th className="px-3 py-1.5 text-left">Producto</th>
                        <th className="px-3 py-1.5 text-right">Cantidad</th>
                        <th className="px-3 py-1.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((it, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 font-medium">{prodName(it.productoId)}</td>
                          <td className="px-3 py-1.5 text-right">{it.cantidad}</td>
                          <td className="px-3 py-1.5 text-right">
                            <button onClick={() => removeItemLibre(i)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
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
                <Button onClick={addItemLibre} disabled={!selProdId || !selCant} variant="secondary" size="sm">
                  <Plus size={14} /> Agregar
                </Button>
              </div>
            </div>
          )}

          {/* ── BOTÓN SUBMIT ─────────────────────────── */}
          {modoFactura ? (
            <Button
              onClick={() => mutationFactura.mutate()}
              loading={mutationFactura.isPending}
              disabled={!canSubmitFactura}
              className="w-full">
              <ArrowUp size={15} />
              Registrar {itemsActivosFactura.length} ítem(s) desde factura
            </Button>
          ) : (
            <Button
              onClick={() => mutationLibre.mutate()}
              loading={mutationLibre.isPending}
              disabled={!items.length || !concepto}
              className="w-full">
              <ArrowUp size={15} /> Registrar {items.length} producto(s)
            </Button>
          )}
        </div>
      </Modal>
    </div>
  )
}
