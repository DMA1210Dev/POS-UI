import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Minus, Trash2, Search, FileText, X, Save } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { productosApi, clientesApi, cotizacionesApi } from '../../api'
import { useToast, errMsg } from '../../context/ToastContext'
import type { ProductoResponse, ClienteResponse, CotizacionResponse } from '../../types'
import type { ComercioResponse } from '../../api'

// ── Tipos internos ────────────────────────────────────────────────────────────
interface ItemCot {
  productoId:         number
  nombre:             string
  precio:             number
  precioMayorista?:   number
  unidadMedida:       string
  esMedible:          boolean
  cantidad:           number
}

interface CotizacionModalProps {
  comercio: ComercioResponse | null
  onClose:  () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtM  = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
const fmtDM = (d: Date)   => d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })

// ── Generadores PDF ───────────────────────────────────────────────────────────
function buildPdf80mm(items: ItemCot[], descuento: number, clienteNombre: string | undefined, esMayorista: boolean, validezDias: number, comercio: ComercioResponse | null) {
  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const total    = subtotal - descuento
  const hoy      = new Date(); const vence = new Date(hoy); vence.setDate(hoy.getDate() + validezDias)
  const doc = new jsPDF({ unit: 'mm', format: [80, 297] }); const W = 80; let y = 8
  const center = (text: string, size = 10) => { doc.setFontSize(size); doc.text(text, W / 2, y, { align: 'center' }); y += size * 0.5 + 1 }
  const line   = () => { doc.setDrawColor(180); doc.line(4, y, W - 4, y); y += 3 }
  const row    = (left: string, right: string, bold = false, size = 8) => { doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.text(left, 4, y); doc.text(right, W - 4, y, { align: 'right' }); y += size * 0.45 + 2 }
  doc.setFont('helvetica', 'bold'); center((comercio?.nombre ?? 'POS Sistema').toUpperCase(), 13)
  doc.setFont('helvetica', 'normal')
  if (comercio?.slogan)   center(comercio.slogan, 8)
  if (comercio?.telefono) center(`Tel: ${comercio.telefono}`, 8)
  if (comercio?.rnc)      center(`RNC: ${comercio.rnc}`, 8)
  y += 1; doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 90, 200); center('COTIZACION', 12)
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal')
  center(`Fecha: ${fmtDM(hoy)}`, 8); center(`Valida hasta: ${fmtDM(vence)}`, 8)
  y += 1; line()
  if (clienteNombre) row('Cliente:', clienteNombre)
  if (esMayorista) { doc.setTextColor(120, 40, 180); doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text('-- PRECIOS MAYORISTAS --', W / 2, y, { align: 'center' }); y += 5; doc.setTextColor(0,0,0); doc.setFont('helvetica', 'normal') }
  line(); doc.setFont('helvetica', 'bold'); row('Producto', 'Subtotal'); doc.setFont('helvetica', 'normal'); y += 1
  for (const item of items) {
    const nombre = item.nombre.length > 24 ? item.nombre.substring(0, 23) + '…' : item.nombre
    doc.setFontSize(8); doc.text(nombre, 4, y); y += 4
    row(`  ${item.cantidad} ${item.unidadMedida} × ${fmtM(item.precio)}`, fmtM(item.precio * item.cantidad))
  }
  line(); row('Subtotal:', fmtM(subtotal))
  if (descuento > 0) row('Descuento:', `-${fmtM(descuento)}`)
  y += 1; line(); y += 3
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('TOTAL:', 4, y); doc.text(fmtM(total), W - 4, y, { align: 'right' }); y += 9
  line(); doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text(`Cotizacion valida por ${validezDias} dias.`, W / 2, y, { align: 'center' }); y += 3.5
  doc.text('Precios sujetos a cambio sin previo aviso.', W / 2, y, { align: 'center' })
  doc.autoPrint(); window.open(URL.createObjectURL(doc.output('blob')), '_blank')
}

function buildPdf58mm(items: ItemCot[], descuento: number, clienteNombre: string | undefined, _esMayorista: boolean, validezDias: number, comercio: ComercioResponse | null) {
  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const total    = subtotal - descuento
  const hoy      = new Date(); const vence = new Date(hoy); vence.setDate(hoy.getDate() + validezDias)
  const doc = new jsPDF({ unit: 'mm', format: [58, 297] }); const W = 58; const M = 3; let y = 7
  const center = (text: string, size = 9) => { doc.setFontSize(size); doc.text(text, W / 2, y, { align: 'center' }); y += size * 0.5 + 1 }
  const line   = () => { doc.setDrawColor(180); doc.line(M, y, W - M, y); y += 3 }
  const row    = (left: string, right: string, bold = false, size = 7) => { doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.text(left, M, y); doc.text(right, W - M, y, { align: 'right' }); y += size * 0.45 + 1.8 }
  doc.setFont('helvetica', 'bold'); center((comercio?.nombre ?? 'POS Sistema').toUpperCase(), 11)
  doc.setFont('helvetica', 'normal')
  if (comercio?.slogan)   center(comercio.slogan, 7)
  if (comercio?.telefono) center(`Tel: ${comercio.telefono}`, 7)
  if (comercio?.rnc)      center(`RNC: ${comercio.rnc}`, 7)
  y += 1; doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 90, 200); center('COTIZACION', 10)
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  center(`Fecha: ${fmtDM(hoy)}`, 7); center(`Valida hasta: ${fmtDM(vence)}`, 7)
  y += 1; line()
  if (clienteNombre) row('Cliente:', clienteNombre)
  line(); doc.setFont('helvetica', 'bold'); row('Producto', 'Total'); doc.setFont('helvetica', 'normal'); y += 1
  for (const item of items) {
    const nombre = item.nombre.length > 18 ? item.nombre.substring(0, 17) + '…' : item.nombre
    doc.setFontSize(7); doc.text(nombre, M, y); y += 3.5
    row(`  ${item.cantidad} ${item.unidadMedida} x ${fmtM(item.precio)}`, fmtM(item.precio * item.cantidad))
  }
  line(); row('Subtotal:', fmtM(subtotal))
  if (descuento > 0) row('Descuento:', `-${fmtM(descuento)}`)
  y += 1; line(); y += 2
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.text('TOTAL:', W / 2, y, { align: 'center' }); y += 4.5
  doc.setFontSize(12); doc.text(fmtM(total), W / 2, y, { align: 'center' }); y += 7
  line(); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
  doc.text(`Valida por ${validezDias} dias.`, W / 2, y, { align: 'center' })
  doc.autoPrint(); window.open(URL.createObjectURL(doc.output('blob')), '_blank')
}

function buildPdfA4(items: ItemCot[], descuento: number, clienteNombre: string | undefined, clienteRnc: string | undefined, esMayorista: boolean, validezDias: number, comercio: ComercioResponse | null) {
  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const total    = subtotal - descuento
  const hoy      = new Date(); const vence = new Date(hoy); vence.setDate(hoy.getDate() + validezDias)
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' }); const W = 210; const ML = 15; const MR = 15; const UW = W - ML - MR; let y = 20
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text((comercio?.nombre ?? 'POS Sistema').toUpperCase(), ML, y); y += 8
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  if (comercio?.slogan) { doc.text(comercio.slogan, ML, y); y += 5 }
  const info: string[] = []; if (comercio?.telefono) info.push(`Tel: ${comercio.telefono}`); if (comercio?.rnc) info.push(`RNC: ${comercio.rnc}`)
  if (info.length > 0) { doc.text(info.join('  |  '), ML, y); y += 5 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(30, 90, 200); doc.text('COTIZACION', W - MR, 20, { align: 'right' })
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Fecha: ${fmtDM(hoy)}`, W - MR, 32, { align: 'right' }); doc.text(`Valida hasta: ${fmtDM(vence)}`, W - MR, 38, { align: 'right' })
  y += 3; doc.setDrawColor(200); doc.line(ML, y, W - MR, y); y += 6
  const col2 = ML + UW / 2 + 5
  if (clienteNombre) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('Cliente:', ML, y); doc.setFont('helvetica', 'normal'); doc.text(clienteNombre, ML + 22, y)
    if (clienteRnc) { doc.setFont('helvetica', 'bold'); doc.text('RNC:', col2, y); doc.setFont('helvetica', 'normal'); doc.text(clienteRnc, col2 + 12, y) }
    y += 6
  }
  if (esMayorista) { doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(120, 40, 180); doc.text('PRECIOS MAYORISTAS APLICADOS', ML, y); doc.setTextColor(0, 0, 0); y += 6 }
  const tableBody = items.map((item, i) => [String(i + 1), item.nombre, `${item.cantidad} ${item.unidadMedida}`, fmtM(item.precio), fmtM(item.precio * item.cantidad)])
  autoTable(doc, {
    startY: y, margin: { left: ML, right: MR },
    head: [['#', 'Producto', 'Cantidad', 'Precio unitario', 'Subtotal']],
    body: tableBody,
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 90, 200], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [245, 248, 255] },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6
  const totX = W - MR - 70
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.text('Subtotal:', totX, y); doc.text(fmtM(subtotal), W - MR, y, { align: 'right' }); y += 5.5
  if (descuento > 0) { doc.text('Descuento:', totX, y); doc.text(`-${fmtM(descuento)}`, W - MR, y, { align: 'right' }); y += 5.5 }
  doc.setDrawColor(180); doc.line(totX, y, W - MR, y); y += 4
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(30, 90, 200); doc.text('TOTAL:', totX, y); doc.text(fmtM(total), W - MR, y, { align: 'right' })
  doc.setTextColor(0, 0, 0); y += 12
  doc.setFillColor(240, 245, 255); doc.roundedRect(ML, y, UW, 14, 2, 2, 'F')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 80, 180)
  doc.text(`Esta cotizacion es valida por ${validezDias} dias (hasta ${fmtDM(vence)}).`, W / 2, y + 5, { align: 'center' })
  doc.text('Los precios estan sujetos a cambio sin previo aviso.', W / 2, y + 10, { align: 'center' })
  doc.setTextColor(0, 0, 0); y += 20
  doc.setFontSize(9); doc.setDrawColor(200); doc.line(ML, y, W - MR, y); y += 5
  doc.text('¡Gracias por su preferencia!', W / 2, y, { align: 'center' })
  doc.autoPrint(); window.open(URL.createObjectURL(doc.output('blob')), '_blank')
}

export function generarPdfCotizacion(items: ItemCot[], descuento: number, cliente: ClienteResponse | undefined, validezDias: number, comercio: ComercioResponse | null) {
  const formato     = (localStorage.getItem('pos_formato') ?? '80mm') as 'A4' | '80mm' | '58mm'
  const esMayorista = cliente?.esMayorista ?? false
  if (formato === '58mm') return buildPdf58mm(items, descuento, cliente?.nombre, esMayorista, validezDias, comercio)
  if (formato === 'A4')   return buildPdfA4(items, descuento, cliente?.nombre, cliente?.cedula ?? undefined, esMayorista, validezDias, comercio)
  return buildPdf80mm(items, descuento, cliente?.nombre, esMayorista, validezDias, comercio)
}

// También funciona desde una CotizacionResponse guardada
export function generarPdfDesdeCotizacion(cot: CotizacionResponse, comercio: ComercioResponse | null) {
  const items: ItemCot[] = cot.detalles.map(d => ({
    productoId: d.productoId, nombre: d.nombreProducto,
    precio: d.precio, unidadMedida: d.unidadMedida,
    esMedible: false, cantidad: d.cantidad,
  }))
  const diasRestantes = Math.max(1, cot.diasRestantes)
  const formato = (localStorage.getItem('pos_formato') ?? '80mm') as 'A4' | '80mm' | '58mm'
  if (formato === '58mm') return buildPdf58mm(items, cot.descuento, cot.nombreCliente, false, diasRestantes, comercio)
  if (formato === 'A4')   return buildPdfA4(items, cot.descuento, cot.nombreCliente, undefined, false, diasRestantes, comercio)
  return buildPdf80mm(items, cot.descuento, cot.nombreCliente, false, diasRestantes, comercio)
}

// ── Componente modal ──────────────────────────────────────────────────────────
export function CotizacionModal({ comercio, onClose }: CotizacionModalProps) {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const searchRef = useRef<HTMLInputElement>(null)

  const [search,    setSearch]    = useState('')
  const [items,     setItems]     = useState<ItemCot[]>([])
  const [clienteId, setClienteId] = useState<number | undefined>()
  const [descuento, setDescuento] = useState(0)
  const [validez,   setValidez]   = useState(15)

  const { data: productos = [] } = useQuery({
    queryKey: ['productos', 'cot', search],
    queryFn:  () => productosApi.getAll({ search: search || undefined, soloActivos: true }),
    enabled:  search.length > 1,
  })

  const { data: clientes = [] } = useQuery<ClienteResponse[]>({
    queryKey: ['clientes', 'cot'],
    queryFn:  () => clientesApi.getAll(),
  })

  const clienteSeleccionado = clientes.find(c => c.id === clienteId)
  const esMayorista = clienteSeleccionado?.esMayorista ?? false

  const guardarMut = useMutation({
    mutationFn: () => cotizacionesApi.create({
      clienteId,
      descuento,
      validezDias: validez,
      detalles: items.map(i => ({
        productoId:     i.productoId,
        nombreProducto: i.nombre,
        unidadMedida:   i.unidadMedida,
        precio:         i.precio,
        cantidad:       i.cantidad,
      })),
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
      generarPdfDesdeCotizacion(data, comercio)
      success(`Cotización #${data.id} guardada`)
      onClose()
    },
    onError: (e) => error(errMsg(e)),
  })

  const agregarProducto = useCallback((p: ProductoResponse) => {
    setSearch('')
    const precio = esMayorista && p.precioMayorista ? p.precioMayorista : p.precio
    setItems(prev => {
      const existe = prev.find(i => i.productoId === p.id)
      if (existe) return prev.map(i => i.productoId === p.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { productoId: p.id, nombre: p.nombre, precio, precioMayorista: p.precioMayorista ?? undefined, unidadMedida: p.unidadMedida, esMedible: p.esMedible, cantidad: 1 }]
    })
    searchRef.current?.focus()
  }, [esMayorista])

  const actualizarCantidad = (id: number, val: string) => {
    const num = parseFloat(val) || 0
    setItems(prev => prev.map(i => i.productoId === id ? { ...i, cantidad: num } : i).filter(i => i.cantidad > 0))
  }

  const actualizarPrecio = (id: number, val: string) => {
    const num = parseFloat(val) || 0
    setItems(prev => prev.map(i => i.productoId === id ? { ...i, precio: num } : i))
  }

  const handleClienteChange = (id: number | undefined) => {
    const nuevo = clientes.find(c => c.id === id)
    const nuevoEsMayorista = nuevo?.esMayorista ?? false
    setClienteId(id)
    setItems(prev => prev.map(item => ({
      ...item,
      precio: nuevoEsMayorista && item.precioMayorista ? item.precioMayorista : item.precio,
    })))
  }

  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const total    = subtotal - descuento

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-[70] p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100">
              <FileText size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Nueva cotización</h2>
              <p className="text-xs text-slate-400">Se guardará y podrá concretarse antes de su vencimiento</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-0 divide-x divide-slate-100">

          {/* ── Izquierda: buscador + ítems ───────────────────── */}
          <div className="md:col-span-3 p-5 space-y-4">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar producto por nombre o código…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 transition-colors" />
            </div>

            {search.length > 1 && productos.length > 0 && (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-48 overflow-y-auto shadow-sm">
                {productos.map(p => {
                  const precio = esMayorista && p.precioMayorista ? p.precioMayorista : p.precio
                  return (
                    <button key={p.id} onClick={() => agregarProducto(p)}
                      className="w-full px-4 py-2.5 text-left hover:bg-blue-50 flex justify-between items-center text-sm transition-colors">
                      <div>
                        <p className="font-medium text-slate-800">{p.nombre}</p>
                        <p className="text-xs text-slate-400">{p.presentacion} · {p.nombreCategoria}</p>
                      </div>
                      <p className={`font-semibold ${esMayorista && p.precioMayorista ? 'text-purple-600' : 'text-blue-600'}`}>{fmtM(precio)}</p>
                    </button>
                  )
                })}
              </div>
            )}
            {search.length > 1 && productos.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">Sin resultados para "{search}"</p>
            )}

            {items.length === 0
              ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                  <FileText size={28} className="text-slate-300" />
                  <p className="text-sm">Busca y agrega productos a la cotización</p>
                </div>
              )
              : (
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {items.map(item => (
                    <div key={item.productoId} className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{item.nombre}</p>
                        <p className="text-xs text-slate-400">{item.unidadMedida}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <label className="text-[10px] text-slate-400">Precio</label>
                        <input type="number" step="0.01" min="0" value={item.precio}
                          onChange={e => actualizarPrecio(item.productoId, e.target.value)}
                          className="w-24 px-2 py-1 text-xs text-right border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white" />
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!item.esMedible
                          ? <>
                              <button onClick={() => actualizarCantidad(item.productoId, String(item.cantidad - 1))} className="w-6 h-6 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center"><Minus size={10} /></button>
                              <span className="w-6 text-center text-sm font-semibold">{item.cantidad}</span>
                              <button onClick={() => actualizarCantidad(item.productoId, String(item.cantidad + 1))} className="w-6 h-6 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center"><Plus size={10} /></button>
                            </>
                          : <input type="number" step="0.001" value={item.cantidad} onChange={e => actualizarCantidad(item.productoId, e.target.value)} className="w-16 px-1 py-1 text-xs text-center border border-slate-300 rounded-lg outline-none focus:border-blue-500" />
                        }
                      </div>
                      <p className="text-sm font-semibold text-slate-800 w-20 text-right flex-shrink-0">{fmtM(item.precio * item.cantidad)}</p>
                      <button onClick={() => setItems(prev => prev.filter(i => i.productoId !== item.productoId))} className="text-red-400 hover:text-red-600 flex-shrink-0 p-1 rounded-lg hover:bg-red-50"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )
            }
          </div>

          {/* ── Derecha: opciones ─────────────────────────────── */}
          <div className="md:col-span-2 p-5 space-y-4 bg-slate-50/50">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Cliente (opcional)</label>
              <select value={clienteId ?? ''} onChange={e => handleClienteChange(Number(e.target.value) || undefined)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white">
                <option value="">Sin cliente</option>
                {clientes.map(c => (<option key={c.id} value={c.id}>{c.nombre}{c.esMayorista ? ' [Mayorista]' : ''}</option>))}
              </select>
              {esMayorista && <p className="text-xs text-purple-600 mt-1 font-medium">Precios mayoristas activos</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Descuento (RD$)</label>
              <input type="number" step="0.01" min="0" value={descuento} onChange={e => setDescuento(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Validez</label>
              <div className="flex gap-1.5 mb-2">
                {[7, 15, 30].map(d => (
                  <button key={d} onClick={() => setValidez(d)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${validez === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-300 text-slate-600 hover:border-blue-400'}`}>
                    {d}d
                  </button>
                ))}
              </div>
              <input type="number" min="1" max="365" value={validez} onChange={e => setValidez(Math.max(1, parseInt(e.target.value) || 15))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white text-center" placeholder="Días personalizados" />
            </div>

            {items.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{fmtM(subtotal)}</span></div>
                {descuento > 0 && <div className="flex justify-between text-green-600 font-medium"><span>Descuento</span><span>-{fmtM(descuento)}</span></div>}
                <div className="flex justify-between font-bold text-blue-700 text-base border-t pt-1.5"><span>Total</span><span>{fmtM(total)}</span></div>
              </div>
            )}

            <button disabled={items.length === 0 || guardarMut.isPending} onClick={() => guardarMut.mutate()}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {guardarMut.isPending
                ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Save size={16} />
              }
              Guardar e imprimir
            </button>

            <button onClick={onClose} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
