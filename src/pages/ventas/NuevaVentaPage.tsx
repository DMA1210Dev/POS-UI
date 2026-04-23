import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Minus, Trash2, ShoppingCart, XCircle, AlertTriangle, FileText, Tag, ChevronDown } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { productosApi, clientesApi, ventasApi, comprobantesApi, cotizacionesApi, categoriasApi } from '../../api'
import { Card, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import BarcodeInput from '../../components/ui/BarcodeInput'
import Badge from '../../components/ui/Badge'
import { ComprobanteSelector } from '../../components/ventas/ComprobanteSelector'
import { useToast, errMsg } from '../../context/ToastContext'
import { useComercio } from '../../context/ComercioContext'
import type { ProductoResponse, CreateDetalleDto, ClienteResponse } from '../../types'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)

// ── Persistencia del carrito ──────────────────────────────────────────────────
const CART_KEY = 'pos_carrito_v1'

interface ItemCarrito extends CreateDetalleDto {
  nombre: string
  precio: number           // precio activo según modo mayorista/minorista (ITBIS incluido)
  precioMinorista: number  // siempre guardado para poder volver
  precioMayorista?: number // undefined si el producto no tiene precio mayorista
  esMedible: boolean
  unidadMedida: string
  aplicaImpuesto: boolean
  porcentajeImpuesto: number
}

interface CartGuardado {
  carrito: ItemCarrito[]
  descuento: number
  tipoPago: 'Contado' | 'Credito'
  clienteId?: number
  fechaVenc: string
  tipoComprobanteId?: number
  ncfReservadoId?: number
  ncfReservado?: string
}

function leerCartGuardado(): CartGuardado | null {
  try {
    const raw = localStorage.getItem(CART_KEY)
    return raw ? (JSON.parse(raw) as CartGuardado) : null
  } catch { return null }
}

// ── Cotización ────────────────────────────────────────────────────────────────
interface CotizacionData {
  items:             ItemCarrito[]
  descuento:         number
  clienteNombre?:    string
  validezDias:       number
  nombreComercio:    string
  sloganComercio?:   string
  telefonoComercio?: string
  rncComercio?:      string
}

const fmtCot  = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
const fmtDia  = (d: Date)   => d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })

function imprimirCotizacion80mm(d: CotizacionData) {
  const subtotal   = d.items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const total      = subtotal - d.descuento
  const hoy        = new Date()
  const vence      = new Date(hoy); vence.setDate(hoy.getDate() + d.validezDias)
  const doc = new jsPDF({ unit: 'mm', format: [80, 297] })
  const W = 80; let y = 8

  const center = (text: string, size = 10) => {
    doc.setFontSize(size); doc.text(text, W / 2, y, { align: 'center' }); y += size * 0.5 + 1
  }
  const line = () => { doc.setDrawColor(180); doc.line(4, y, W - 4, y); y += 3 }
  const row  = (left: string, right: string, bold = false, size = 8) => {
    doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(left, 4, y); doc.text(right, W - 4, y, { align: 'right' }); y += size * 0.45 + 2
  }

  doc.setFont('helvetica', 'bold'); center(d.nombreComercio.toUpperCase(), 13)
  doc.setFont('helvetica', 'normal')
  if (d.sloganComercio)   center(d.sloganComercio, 8)
  if (d.telefonoComercio) center(`Tel: ${d.telefonoComercio}`, 8)
  if (d.rncComercio)      center(`RNC: ${d.rncComercio}`, 8)
  y += 1

  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30, 90, 200)
  center('COTIZACION', 12); doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  center(`Fecha: ${fmtDia(hoy)}`, 8)
  center(`Valida hasta: ${fmtDia(vence)}`, 8)
  y += 1; line()

  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  if (d.clienteNombre) row('Cliente:', d.clienteNombre)
  line()

  doc.setFont('helvetica', 'bold'); row('Producto', 'Subtotal')
  doc.setFont('helvetica', 'normal'); y += 1

  for (const item of d.items) {
    const nombre = item.nombre.length > 24 ? item.nombre.substring(0, 23) + '…' : item.nombre
    doc.setFontSize(8); doc.text(nombre, 4, y); y += 4
    row(`  ${item.cantidad} ${item.unidadMedida} × ${fmtCot(item.precio)}`, fmtCot(item.precio * item.cantidad))
  }

  line()
  row('Subtotal:', fmtCot(subtotal))
  if (d.descuento > 0) row('Descuento:', `-${fmtCot(d.descuento)}`)
  y += 1; line(); y += 3

  doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
  doc.text('TOTAL:', 4, y); doc.text(fmtCot(total), W - 4, y, { align: 'right' }); y += 9

  line()
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text(`Cotizacion valida por ${d.validezDias} dias.`, W / 2, y, { align: 'center' }); y += 3.5
  doc.text('Precios sujetos a cambio sin previo aviso.', W / 2, y, { align: 'center' })

  doc.autoPrint(); window.open(URL.createObjectURL(doc.output('blob')), '_blank')
}

function imprimirCotizacion58mm(d: CotizacionData) {
  const subtotal = d.items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const total    = subtotal - d.descuento
  const hoy      = new Date()
  const vence    = new Date(hoy); vence.setDate(hoy.getDate() + d.validezDias)
  const doc = new jsPDF({ unit: 'mm', format: [58, 297] })
  const W = 58; const M = 3; let y = 7

  const center = (text: string, size = 9) => {
    doc.setFontSize(size); doc.text(text, W / 2, y, { align: 'center' }); y += size * 0.5 + 1
  }
  const line = () => { doc.setDrawColor(180); doc.line(M, y, W - M, y); y += 3 }
  const row  = (left: string, right: string, bold = false, size = 7) => {
    doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(left, M, y); doc.text(right, W - M, y, { align: 'right' }); y += size * 0.45 + 1.8
  }

  doc.setFont('helvetica', 'bold'); center(d.nombreComercio.toUpperCase(), 11)
  doc.setFont('helvetica', 'normal')
  if (d.sloganComercio)   center(d.sloganComercio, 7)
  if (d.telefonoComercio) center(`Tel: ${d.telefonoComercio}`, 7)
  if (d.rncComercio)      center(`RNC: ${d.rncComercio}`, 7)
  y += 1

  doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 90, 200); center('COTIZACION', 10)
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  center(`Fecha: ${fmtDia(hoy)}`, 7); center(`Valida hasta: ${fmtDia(vence)}`, 7)
  y += 1; line()

  if (d.clienteNombre) { doc.setFontSize(7); row('Cliente:', d.clienteNombre) }
  line()

  doc.setFont('helvetica', 'bold'); row('Producto', 'Total')
  doc.setFont('helvetica', 'normal'); y += 1

  for (const item of d.items) {
    const nombre = item.nombre.length > 18 ? item.nombre.substring(0, 17) + '…' : item.nombre
    doc.setFontSize(7); doc.text(nombre, M, y); y += 3.5
    row(`  ${item.cantidad} ${item.unidadMedida} x ${fmtCot(item.precio)}`, fmtCot(item.precio * item.cantidad))
  }

  line()
  row('Subtotal:', fmtCot(subtotal))
  if (d.descuento > 0) row('Descuento:', `-${fmtCot(d.descuento)}`)
  y += 1; line(); y += 2

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7)
  doc.text('TOTAL:', W / 2, y, { align: 'center' }); y += 4.5
  doc.setFontSize(12); doc.text(fmtCot(total), W / 2, y, { align: 'center' }); y += 7

  line()
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
  doc.text(`Valida por ${d.validezDias} dias.`, W / 2, y, { align: 'center' })

  doc.autoPrint(); window.open(URL.createObjectURL(doc.output('blob')), '_blank')
}

function imprimirCotizacionA4(d: CotizacionData) {
  const subtotal = d.items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const total    = subtotal - d.descuento
  const hoy      = new Date()
  const vence    = new Date(hoy); vence.setDate(hoy.getDate() + d.validezDias)
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const W = 210; const ML = 15; const MR = 15; const UW = W - ML - MR
  let y = 20

  // Cabecera
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20)
  doc.text(d.nombreComercio.toUpperCase(), ML, y); y += 8
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  if (d.sloganComercio) { doc.text(d.sloganComercio, ML, y); y += 5 }
  const info: string[] = []
  if (d.telefonoComercio) info.push(`Tel: ${d.telefonoComercio}`)
  if (d.rncComercio)      info.push(`RNC: ${d.rncComercio}`)
  if (info.length > 0) { doc.text(info.join('  |  '), ML, y); y += 5 }

  // Título (esquina derecha)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(30, 90, 200)
  doc.text('COTIZACION', W - MR, 20, { align: 'right' })
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Fecha: ${fmtDia(hoy)}`, W - MR, 32, { align: 'right' })
  doc.text(`Valida hasta: ${fmtDia(vence)}`, W - MR, 38, { align: 'right' })

  y += 3
  doc.setDrawColor(200); doc.line(ML, y, W - MR, y); y += 6

  // Info cliente
  if (d.clienteNombre) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    doc.text('Cliente:', ML, y); doc.setFont('helvetica', 'normal')
    doc.text(d.clienteNombre, ML + 22, y); y += 8
  }

  // Tabla de productos
  const tableBody = d.items.map((item, i) => [
    String(i + 1),
    item.nombre,
    `${item.cantidad} ${item.unidadMedida}`,
    fmtCot(item.precio),
    fmtCot(item.precio * item.cantidad),
  ])
  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    head: [['#', 'Producto', 'Cantidad', 'Precio unitario', 'Subtotal']],
    body: tableBody,
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 90, 200], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [245, 248, 255] },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6

  // Totales
  const totX = W - MR - 70
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  if (d.descuento > 0) {
    doc.text('Subtotal:', totX, y); doc.text(fmtCot(subtotal), W - MR, y, { align: 'right' }); y += 5.5
    doc.text('Descuento:', totX, y); doc.text(`-${fmtCot(d.descuento)}`, W - MR, y, { align: 'right' }); y += 5.5
  }
  doc.setDrawColor(180); doc.line(totX, y, W - MR, y); y += 4
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(30, 90, 200)
  doc.text('TOTAL:', totX, y); doc.text(fmtCot(total), W - MR, y, { align: 'right' })
  doc.setTextColor(0, 0, 0); y += 12

  // Nota de validez
  doc.setFillColor(240, 245, 255); doc.roundedRect(ML, y, UW, 14, 2, 2, 'F')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 80, 180)
  doc.text(`Esta cotizacion es valida por ${d.validezDias} dias (hasta ${fmtDia(vence)}).`, W / 2, y + 5, { align: 'center' })
  doc.text('Los precios estan sujetos a cambio sin previo aviso.', W / 2, y + 10, { align: 'center' })
  doc.setTextColor(0, 0, 0); y += 20

  // Pie
  doc.setFontSize(9); doc.setDrawColor(200); doc.line(ML, y, W - MR, y); y += 5
  doc.text('¡Gracias por su preferencia!', W / 2, y, { align: 'center' })

  doc.autoPrint(); window.open(URL.createObjectURL(doc.output('blob')), '_blank')
}

function imprimirCotizacion(d: CotizacionData) {
  const formato = (localStorage.getItem('pos_formato') ?? '80mm') as 'A4' | '80mm' | '58mm'
  if (formato === '58mm') return imprimirCotizacion58mm(d)
  if (formato === 'A4')   return imprimirCotizacionA4(d)
  return imprimirCotizacion80mm(d)
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function NuevaVentaPage() {
  const navigate = useNavigate()
  const { success, error } = useToast()
  const { comercio, camaraHabilitada } = useComercio()
  const searchRef = useRef<HTMLInputElement>(null)

  // Estado inicial desde localStorage (solo la primera vez)
  const [cartInicial] = useState<CartGuardado | null>(leerCartGuardado)

  const [search,    setSearch]    = useState('')
  const [carrito,   setCarrito]   = useState<ItemCarrito[]>(cartInicial?.carrito ?? [])
  const [descuento, setDescuento] = useState(cartInicial?.descuento ?? 0)
  const [tipoPago,  setTipoPago]  = useState<'Contado' | 'Credito'>(cartInicial?.tipoPago ?? 'Contado')
  const [clienteId, setClienteId] = useState<number | undefined>(cartInicial?.clienteId)
  const [fechaVenc, setFechaVenc] = useState(cartInicial?.fechaVenc ?? '')
  const [tipoComprobanteId, setTipoComprobanteId] = useState<number | undefined>(cartInicial?.tipoComprobanteId)
  const [ncfReservadoId,    setNcfReservadoId]    = useState<number | undefined>(cartInicial?.ncfReservadoId)
  const [ncfReservado,      setNcfReservado]      = useState<string | undefined>(cartInicial?.ncfReservado)

  // Ref para acceder al ncfReservadoId actual sin closure stale
  const ncfReservadoIdRef = useRef(ncfReservadoId)
  ncfReservadoIdRef.current = ncfReservadoId

  const [categoriaId,    setCategoriaId]    = useState<number | undefined>()
  const [categoriasOpen, setCategoriasOpen] = useState(false)
  const categoriasRef = useRef<HTMLDivElement>(null)

  // Cerrar popup de categorías al hacer click afuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (categoriasRef.current && !categoriasRef.current.contains(e.target as Node))
        setCategoriasOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Categorías ────────────────────────────────────────────────────────────
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn:  categoriasApi.getAll,
    staleTime: 5 * 60 * 1000,
  })

  // ── Búsqueda de productos ─────────────────────────────────────────────────
  const { data: productos = [] } = useQuery({
    queryKey: ['productos', 'venta', search, categoriaId],
    queryFn:  () => productosApi.getAll({ search: search || undefined, categoriaId, soloActivos: true }),
    staleTime: 30 * 1000,
  })

  // ── Clientes ──────────────────────────────────────────────────────────────
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', 'venta'],
    queryFn:  () => clientesApi.getAll(),
  })

  // ── Tipos de comprobante (necesarios para saber si el tipo es B o no) ─────
  const { data: tiposComp = [] } = useQuery({
    queryKey: ['comprobantes-activos'],
    queryFn:  () => comprobantesApi.getAll(true),
    staleTime: 5 * 60 * 1000,
  })

  const clienteSeleccionado: ClienteResponse | undefined =
    clientes.find(c => c.id === clienteId)

  const esMayorista = clienteSeleccionado?.esMayorista ?? false

  // ── Guardar carrito en localStorage ──────────────────────────────────────
  useEffect(() => {
    const estado: CartGuardado = {
      carrito, descuento, tipoPago, clienteId,
      fechaVenc, tipoComprobanteId, ncfReservadoId, ncfReservado,
    }
    const vacio = carrito.length === 0 && !tipoComprobanteId && !clienteId
    if (vacio) {
      localStorage.removeItem(CART_KEY)
    } else {
      localStorage.setItem(CART_KEY, JSON.stringify(estado))
    }
  }, [carrito, descuento, tipoPago, clienteId, fechaVenc, tipoComprobanteId, ncfReservadoId, ncfReservado])

  // ── Precio mayorista se activa automáticamente según el cliente ───────────
  const prevEsMayoristaRef = useRef(false)
  useEffect(() => {
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
  }, [esMayorista])

  // ── Agregar al carrito ────────────────────────────────────────────────────
  const agregarProducto = useCallback((p: ProductoResponse) => {
    setSearch('')
    const precio = esMayorista && p.precioMayorista ? p.precioMayorista : p.precio
    setCarrito(prev => {
      const existe = prev.find(i => i.productoId === p.id)
      if (existe) return prev.map(i =>
        i.productoId === p.id ? { ...i, cantidad: i.cantidad + 1 } : i
      )
      return [...prev, {
        productoId: p.id, cantidad: 1,
        nombre: p.nombre, precio,
        precioMinorista: p.precio,
        precioMayorista: p.precioMayorista ?? undefined,
        esMedible: p.esMedible, unidadMedida: p.unidadMedida,
        aplicaImpuesto: p.aplicaImpuesto ?? false,
        porcentajeImpuesto: p.porcentajeImpuesto ?? 0,
      }]
    })
    searchRef.current?.focus()
  }, [esMayorista])

  // ── Lector físico (Enter en input) ────────────────────────────────────────
  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const val = (e.target as HTMLInputElement).value.trim()
    if (!val) return
    e.preventDefault()
    try {
      const res = await productosApi.getAll({ search: val, soloActivos: true })
      if (res.length === 1)      agregarProducto(res[0])
      else if (res.length === 0) error('Producto no encontrado para ese código.')
    } catch { error('Error al buscar el producto.') }
  }

  const handleScannerValue = useCallback((val: string) => {
    setSearch(val)
  }, [])

  // ── Auto-descuento por cliente ────────────────────────────────────────────
  useEffect(() => {
    if (!clienteId) { setDescuento(0); return }
    const cliente = clientes.find(c => c.id === clienteId)
    if (cliente && cliente.porcentajeDescuento > 0) {
      const sub = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0)
      setDescuento(parseFloat((sub * cliente.porcentajeDescuento / 100).toFixed(2)))
    } else {
      setDescuento(0)
    }
  }, [clienteId, clientes, carrito])

  // ── Auto-comprobante por cliente ──────────────────────────────────────────
  // Si el cliente tiene comprobante → lo carga y bloquea.
  // Si no tiene → usa B02 por defecto y bloquea igualmente.
  // Cuando no hay cliente → libera el selector.
  useEffect(() => {
    if (!clienteId) return
    const cliente = clientes.find(c => c.id === clienteId)
    if (!cliente) return

    if (cliente.tipoComprobanteId) {
      handleTipoComprobanteChange(cliente.tipoComprobanteId)
    } else if (tiposComp.length > 0) {
      const b02 = tiposComp.find(t => t.codigo === 'B02')
      if (b02) handleTipoComprobanteChange(b02.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, tiposComp.length])

  // ── Mutación de reserva de NCF ────────────────────────────────────────────
  const [reservando,        setReservando]        = useState(false)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [validezDias,       setValidezDias]       = useState(15)
  const [modoCarrito,       setModoCarrito]       = useState<'venta' | 'cotizacion'>('venta')
  const queryClient = useQueryClient()

  const reservarNcfMut = useMutation({
    mutationFn: (tipoId: number) => comprobantesApi.reservarNcf(tipoId),
    onSuccess: (data) => {
      setNcfReservadoId(data.ncfSecuenciaId)
      setNcfReservado(data.ncf)
      setReservando(false)
    },
    onError: (e) => {
      setReservando(false)
      error(errMsg(e))
    },
  })

  // ── Cambio de tipo de comprobante: liberar anterior y reservar nuevo ───────
  // (no corre en el primer render si ya hay un NCF restaurado de localStorage)
  const esFirstRender = useRef(true)

  const handleTipoComprobanteChange = useCallback((nuevoTipoId: number | undefined) => {
    // Guard: mismo tipo + NCF ya reservado → no liberar ni re-reservar.
    // Evita re-reservas al restaurar el carrito desde localStorage cuando
    // los efectos de auto-comprobante vuelven a ejecutarse al cargar tiposComp.
    if (nuevoTipoId === tipoComprobanteId && ncfReservadoIdRef.current) return

    const tipoAnterior = tiposComp.find(t => t.id === tipoComprobanteId)
    const tipoNuevo    = tiposComp.find(t => t.id === nuevoTipoId)

    // Liberar el NCF anterior si era tipo B
    const anteriorNcfId = ncfReservadoIdRef.current
    if (tipoAnterior?.codigo.startsWith('B') && anteriorNcfId) {
      comprobantesApi.liberarNcfReserva(anteriorNcfId).catch(() => {})
      setNcfReservadoId(undefined)
      setNcfReservado(undefined)
    }

    setTipoComprobanteId(nuevoTipoId)

    // Reservar nuevo NCF si el tipo nuevo es B
    if (tipoNuevo?.codigo.startsWith('B') && nuevoTipoId) {
      setReservando(true)
      reservarNcfMut.mutate(nuevoTipoId)
    }
  }, [tipoComprobanteId, tiposComp, reservarNcfMut])

  // Primer render: si hay un tipo B restaurado sin NCF reservado, reservar uno
  useEffect(() => {
    if (!esFirstRender.current) return
    esFirstRender.current = false

    const tipoActual = tiposComp.find(t => t.id === tipoComprobanteId)
    const esTipoB    = tipoActual?.codigo.startsWith('B') ?? false

    // Si hay tipo B pero NO hay NCF guardado (sesión incompleta), reservar
    if (esTipoB && tipoComprobanteId && !ncfReservadoIdRef.current) {
      setReservando(true)
      reservarNcfMut.mutate(tipoComprobanteId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiposComp])   // corre cuando tiposComp se carga (en el primer render útil)

  // ── Cancelar carrito ──────────────────────────────────────────────────────
  const ejecutarCancelacion = () => {
    const ncfId = ncfReservadoIdRef.current
    if (ncfId) comprobantesApi.liberarNcfReserva(ncfId).catch(() => {})

    localStorage.removeItem(CART_KEY)
    setCarrito([])
    setDescuento(0)
    setTipoPago('Contado')
    setClienteId(undefined)
    setFechaVenc('')
    setTipoComprobanteId(undefined)
    setNcfReservadoId(undefined)
    setNcfReservado(undefined)
    setSearch('')
    setConfirmarCancelar(false)
  }

  // ── Switch Venta / Cotización ────────────────────────────────────────────
  const handleModoSwitch = (modo: 'venta' | 'cotizacion') => {
    if (modo === 'cotizacion' && modoCarrito !== 'cotizacion') {
      // Liberar NCF tipo-B si hay uno reservado
      const tipoActual = tiposComp.find(t => t.id === tipoComprobanteId)
      if (tipoActual?.codigo.startsWith('B') && ncfReservadoId) {
        handleTipoComprobanteChange(undefined)
      }
    }
    setModoCarrito(modo)
  }

  // ── Guardar cotización ────────────────────────────────────────────────────
  const cotizarMut = useMutation({
    mutationFn: () => cotizacionesApi.create({
      clienteId,
      descuento,
      validezDias,
      detalles: carrito.map(i => ({
        productoId:    i.productoId,
        nombreProducto: i.nombre,
        unidadMedida:  i.unidadMedida,
        precio:        i.precio,
        cantidad:      i.cantidad,
      })),
    }),
    onSuccess: () => {
      imprimirCotizacion({
        items:            carrito,
        descuento,
        clienteNombre:    clienteSeleccionado?.nombre,
        validezDias,
        nombreComercio:   comercio?.nombre   ?? 'POS Sistema',
        sloganComercio:   comercio?.slogan   ?? undefined,
        telefonoComercio: comercio?.telefono ?? undefined,
        rncComercio:      comercio?.rnc      ?? undefined,
      })
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] })
      success('Cotización guardada correctamente')
      ejecutarCancelacion()
      navigate('/ventas')
    },
    onError: (e) => error(errMsg(e)),
  })

  // ── Registrar venta ───────────────────────────────────────────────────────
  const crear = useMutation({
    mutationFn: () => ventasApi.create({
      items:    carrito.map(i => ({ productoId: i.productoId, cantidad: i.cantidad })),
      descuento,
      tipoPago,
      clienteId,
      esMayorista,
      fechaVencimientoCredito: tipoPago === 'Credito' && fechaVenc ? fechaVenc : undefined,
      tipoComprobanteId,
      ncfSecuenciaId: ncfReservadoId,   // pasa el NCF pre-reservado al backend
    }),
    onSuccess: () => {
      localStorage.removeItem(CART_KEY) // carrito cumplió su ciclo
      success('Venta registrada correctamente')
      navigate('/ventas')
    },
    onError: (e) => error(errMsg(e)),
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
  const hayCarrito = carrito.length > 0 || !!tipoComprobanteId || !!clienteId

  // ITBIS extraído del precio (precio consumidor ya lo incluye)
  // itbis_item = precio_con_itbis × pct / (100 + pct)
  const tipoSeleccionado = tiposComp.find(t => t.id === tipoComprobanteId)
  const mostrarItbis = tipoSeleccionado ? tipoSeleccionado.aplicaItbis : true
  const itbisTotal = mostrarItbis
    ? carrito.reduce((s, i) => {
        const pct = i.porcentajeImpuesto ?? 0
        if (!i.aplicaImpuesto || pct <= 0) return s
        return s + (i.precio * i.cantidad) * pct / (100 + pct)
      }, 0)
    : 0

  const categoriaSeleccionada = categorias.find(c => c.id === categoriaId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Nueva Venta</h2>
        {hayCarrito && (
          <Button
            variant="secondary"
            icon={<XCircle size={15} className="text-red-500" />}
            className="text-red-500 border-red-200 hover:bg-red-50"
            onClick={() => setConfirmarCancelar(true)}
          >
            Cancelar carrito
          </Button>
        )}
      </div>

      <div className="flex gap-4 items-start" style={{ height: 'calc(100vh - 130px)' }}>

        {/* ── Columna izquierda: Productos + Carrito apilados ─────────── */}
        {/* (renderizado antes del Card de datos → queda a la izquierda) */}

        {/* ── Columna derecha: Datos / Checkout ────────────────────────── */}
        <Card className="w-[340px] shrink-0 flex flex-col h-full overflow-hidden order-last">
          <CardHeader className="shrink-0">
            <h3 className="font-semibold text-slate-700">Datos de la venta</h3>
          </CardHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* Modo Venta / Cotización */}
            <div className="flex rounded-lg overflow-hidden border border-slate-200 text-sm font-medium">
              {(['venta', 'cotizacion'] as const).map(modo => (
                <button key={modo} onClick={() => handleModoSwitch(modo)}
                  className={`flex-1 py-1.5 transition-colors ${
                    modoCarrito === modo
                      ? modo === 'venta' ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}>
                  {modo === 'venta' ? 'Venta' : 'Cotización'}
                </button>
              ))}
            </div>

            {/* Tipo de pago */}
            {modoCarrito === 'venta' && (
              <div className="flex gap-2">
                {(['Contado', 'Credito'] as const).map(t => (
                  <button key={t} onClick={() => setTipoPago(t)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      tipoPago === t
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-300 text-slate-600 hover:border-blue-400'
                    }`}>{t}
                  </button>
                ))}
              </div>
            )}

            {/* Cliente */}
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Cliente{' '}
                {modoCarrito === 'venta' && (tipoPago === 'Credito' || !(comercio?.permitirVentaSinCliente ?? true)) && (
                  <span className="text-red-500">*</span>
                )}
              </label>
              <select value={clienteId ?? ''}
                onChange={e => setClienteId(Number(e.target.value) || undefined)}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500">
                <option value="">Sin cliente / Mostrador</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}{c.esMayorista ? ' [M]' : ''}{c.porcentajeDescuento > 0 ? ` −${c.porcentajeDescuento}%` : ''}
                  </option>
                ))}
              </select>
              {clienteSeleccionado && (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  <span className={esMayorista ? 'text-purple-600 font-medium' : 'text-blue-600'}>
                    {esMayorista ? 'Mayorista' : 'Minorista'}
                  </span>
                  {clienteSeleccionado.porcentajeDescuento > 0 && (
                    <span className="text-green-600">{clienteSeleccionado.porcentajeDescuento}% desc.</span>
                  )}
                  {clienteSeleccionado.totalDeuda > 0 && (
                    <span className="text-red-500">Deuda: {fmt(clienteSeleccionado.totalDeuda)}</span>
                  )}
                  {clienteSeleccionado.creditosActivos > 0 && (
                    <span className="text-orange-500">{clienteSeleccionado.creditosActivos} crédito(s)</span>
                  )}
                  {clienteSeleccionado.nombreComprobante && (
                    <span className="text-indigo-600">{clienteSeleccionado.nombreComprobante}</span>
                  )}
                </div>
              )}
            </div>

            {/* Fecha vencimiento crédito */}
            {modoCarrito === 'venta' && tipoPago === 'Credito' && (
              <Input label="Vencimiento crédito" type="date" value={fechaVenc}
                onChange={e => setFechaVenc(e.target.value)} />
            )}

            {/* Comprobante */}
            {modoCarrito === 'venta' && (
              <ComprobanteSelector
                tipoComprobanteId={tipoComprobanteId}
                onChange={handleTipoComprobanteChange}
                ncfReservado={ncfReservado}
                reservando={reservando}
                disabled={!!clienteId}
                disabledLabel={clienteSeleccionado?.tipoComprobanteId ? 'Del cliente' : 'B02 por defecto'}
                permitirSinComprobante={comercio?.permitirVentaSinComprobante ?? false}
              />
            )}

            {/* Validez cotización */}
            {modoCarrito === 'cotizacion' && (
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Validez</label>
                <div className="flex gap-1.5">
                  {[7, 15, 30].map(d => (
                    <button key={d} onClick={() => setValidezDias(d)}
                      className={`flex-1 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        validezDias === d
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'border-slate-300 text-slate-600 hover:border-amber-400'
                      }`}>{d}d</button>
                  ))}
                  <input type="number" min="1" max="365" value={validezDias}
                    onChange={e => setValidezDias(Math.max(1, parseInt(e.target.value) || 15))}
                    className="w-14 px-2 py-1 text-xs border border-slate-300 rounded-lg text-center outline-none focus:border-amber-400" />
                </div>
              </div>
            )}

            {/* Descuento */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 shrink-0">Descuento RD$</label>
              <input type="number" step="0.01" min="0" value={descuento}
                onChange={e => setDescuento(parseFloat(e.target.value) || 0)}
                className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500" />
            </div>

            {/* Totales */}
            <div className="text-sm space-y-1 pt-2 border-t border-slate-100">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span><span>{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span className="flex items-center gap-1">ITBIS <span className="text-[10px] text-slate-400">(incl.)</span></span>
                <span>{fmt(itbisTotal)}</span>
              </div>
              {descuento > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Descuento{clienteSeleccionado?.porcentajeDescuento ? ` (${clienteSeleccionado.porcentajeDescuento}%)` : ''}</span>
                  <span>-{fmt(descuento)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-slate-800 pt-1 border-t border-slate-100">
                <span>Total</span><span>{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Botón cobrar (fijo abajo) */}
          <div className="shrink-0 px-4 py-3 border-t border-slate-100 space-y-2">
            {modoCarrito === 'venta' ? (
              <Button className="w-full justify-center py-2.5"
                loading={crear.isPending}
                disabled={
                  carrito.length === 0 ||
                  (tipoPago === 'Credito' && !clienteId) ||
                  (!(comercio?.permitirVentaSinCliente ?? true) && !clienteId) ||
                  reservando ||
                  // Comprobante requerido solo cuando no hay cliente ni comprobante elegido
                  // (si hay cliente, el backend aplica B02 por defecto automáticamente)
                  (!(comercio?.permitirVentaSinComprobante ?? false) && !tipoComprobanteId && !clienteId)
                }
                onClick={() => crear.mutate()}>
                {tipoPago === 'Credito' ? 'Registrar a crédito' : 'Cobrar'}
              </Button>
            ) : (
              <Button className="w-full justify-center py-2.5 bg-amber-500 hover:bg-amber-600 border-amber-500"
                loading={cotizarMut.isPending}
                disabled={carrito.length === 0}
                onClick={() => cotizarMut.mutate()}
                icon={<FileText size={15} />}>
                Guardar cotización
              </Button>
            )}
            {cartInicial && (
              <p className="text-[10px] text-center text-slate-400">Carrito restaurado de sesión anterior</p>
            )}
          </div>
        </Card>

        {/* ── Columna derecha: Productos + Carrito apilados ─────────────── */}
        <div className="flex-1 flex flex-col gap-4 h-full min-w-0">

        {/* ── Box Productos ──────────────────────────────────── */}
        <div className="flex flex-col" style={{ height: 'calc(50% - 8px)' }}>
          <Card className="flex flex-col h-full overflow-hidden">
            {/* Toolbar */}
            <CardHeader className="shrink-0">
              <div className="flex items-center gap-2">
                {/* Buscador */}
                <div className="flex-1">
                  <BarcodeInput
                    label=""
                    placeholder="Buscar por nombre, código o escanear…"
                    value={search}
                    onChange={handleScannerValue}
                    camaraHabilitada={camaraHabilitada}
                    onKeyDown={handleSearchKeyDown}
                    inputRef={searchRef}
                  />
                </div>

                {/* Botón Categorías con popup */}
                <div className="relative shrink-0" ref={categoriasRef}>
                  <button
                    onClick={() => setCategoriasOpen(o => !o)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      categoriaId
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 bg-white'
                    }`}
                  >
                    <Tag size={14} />
                    {categoriaSeleccionada ? categoriaSeleccionada.nombre : 'Categorías'}
                    <ChevronDown size={13} className={`transition-transform ${categoriasOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {categoriasOpen && (
                    <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-lg p-2 w-56">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-2 pb-1">Categorías</p>
                      <button
                        onClick={() => { setCategoriaId(undefined); setCategoriasOpen(false) }}
                        className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          !categoriaId ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        Todas
                      </button>
                      <div className="max-h-56 overflow-y-auto mt-0.5 space-y-0.5">
                        {categorias.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => { setCategoriaId(cat.id); setCategoriasOpen(false) }}
                            className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors flex justify-between items-center ${
                              categoriaId === cat.id
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <span>{cat.nombre}</span>
                            <span className="text-xs text-slate-400">{cat.totalProductos}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {esMayorista && <Badge color="purple">Mayorista</Badge>}
              </div>
            </CardHeader>

            {/* Lista de productos (scrollable) */}
            <div className="flex-1 overflow-y-auto p-3">
              {productos.length === 0
                ? <p className="text-center text-slate-400 py-10 text-sm">Sin resultados</p>
                : <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                    {productos.map(p => {
                      const precioMostrar = esMayorista && p.precioMayorista ? p.precioMayorista : p.precio
                      const tieneMayorista = p.precioMayorista != null
                      return (
                        <button key={p.id} onClick={() => agregarProducto(p)}
                          className="text-left bg-white border border-slate-200 rounded-xl p-3 hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm transition-all active:scale-95">
                          <p className="font-medium text-slate-800 text-sm leading-snug line-clamp-2 mb-1">{p.nombre}</p>
                          <p className="text-xs text-slate-400 truncate mb-2">{p.presentacion}{p.nombreCategoria ? ` · ${p.nombreCategoria}` : ''}</p>
                          <p className={`font-bold text-sm ${esMayorista && tieneMayorista ? 'text-purple-600' : 'text-blue-600'}`}>
                            {fmt(precioMostrar)}
                          </p>
                          {esMayorista && tieneMayorista && (
                            <p className="text-xs text-slate-400 line-through">{fmt(p.precio)}</p>
                          )}
                        </button>
                      )
                    })}
                  </div>
              }
            </div>
          </Card>
        </div>

        {/* ── Box Carrito ────────────────────────────────────────────────── */}
        <div className="flex flex-col" style={{ height: 'calc(50% - 8px)' }}>
          <Card className="flex flex-col h-full overflow-hidden">
            <CardHeader className="shrink-0">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <ShoppingCart size={16} /> Carrito
                {carrito.length > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-semibold">
                    {carrito.length}
                  </span>
                )}
              </h3>
            </CardHeader>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0">
              {carrito.length === 0
                ? <p className="text-center text-slate-400 py-8 text-sm">El carrito está vacío</p>
                : carrito.map(item => (
                  <div key={item.productoId} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">{item.nombre}</p>
                      <p className="text-xs text-slate-400">{fmt(item.precio)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!item.esMedible
                        ? <>
                            <button onClick={() => actualizarCantidad(item.productoId, String(item.cantidad - 1))}
                              className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                              <Minus size={11} />
                            </button>
                            <span className="w-7 text-center font-semibold text-sm">{item.cantidad}</span>
                            <button onClick={() => actualizarCantidad(item.productoId, String(item.cantidad + 1))}
                              className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                              <Plus size={11} />
                            </button>
                          </>
                        : <input type="number" step="0.001" value={item.cantidad}
                            onChange={e => actualizarCantidad(item.productoId, e.target.value)}
                            className="w-16 px-2 py-1 text-sm border border-slate-300 rounded-lg text-center outline-none focus:border-blue-500" />
                      }
                    </div>
                    <p className="font-semibold text-slate-800 w-16 text-right text-sm shrink-0">
                      {fmt(item.precio * item.cantidad)}
                    </p>
                    <button
                      onClick={() => setCarrito(prev => prev.filter(i => i.productoId !== item.productoId))}
                      className="text-red-400 hover:text-red-600 shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              }
            </div>
          </Card>
        </div>

        </div>{/* fin columna derecha */}
      </div>

      {/* ── Modal cancelar carrito ────────────────────────────────────────── */}
      {confirmarCancelar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-2 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">¿Cancelar el carrito?</h3>
              <p className="text-sm text-slate-500">
                Se eliminarán todos los productos y configuraciones del carrito actual.
                {ncfReservado && (
                  <span className="block mt-1 text-amber-600 font-medium">
                    El NCF <span className="font-mono">{ncfReservado}</span> quedará libre en el pool.
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2 px-6 py-4">
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => setConfirmarCancelar(false)}>
                Volver
              </Button>
              <Button className="flex-1 justify-center bg-red-600 hover:bg-red-700 border-red-600" onClick={ejecutarCancelacion}>
                Sí, cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
