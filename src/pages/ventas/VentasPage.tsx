import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, XCircle, Printer, CheckCircle, AlertTriangle, Pencil, Receipt, RotateCcw, FileX, FileText, Clock, ShoppingBag, Ban } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ventasApi, creditosApi, cotizacionesApi } from '../../api'
import { generarPdfDesdeCotizacion } from './CotizacionModal'
import { Card } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { useAuth } from '../../context/AuthContext'
import { useToast, errMsg } from '../../context/ToastContext'
import { useComercio } from '../../context/ComercioContext'
import type { VentaResponse, CreditoResponse, DevolucionResponse, DetalleVentaResponse, CotizacionResponse } from '../../types'

// ── Modal de confirmación ─────────────────────────────────────────────────────
interface ConfirmModalProps {
  tipo: 'aprobar' | 'anular'
  venta: VentaResponse
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmModal({ tipo, venta, loading, onConfirm, onCancel }: ConfirmModalProps) {
  const esAprobar = tipo === 'aprobar'
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className={`flex items-center gap-3 px-6 pt-6 pb-4`}>
          <div className={`p-2.5 rounded-full ${esAprobar ? 'bg-emerald-100' : 'bg-red-100'}`}>
            {esAprobar
              ? <CheckCircle size={22} className="text-emerald-600" />
              : <AlertTriangle size={22} className="text-red-600" />
            }
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-base">
              {esAprobar ? 'Aprobar venta' : 'Anular venta'}
            </h3>
            <p className="text-xs text-slate-400">Factura #{venta.id}</p>
          </div>
        </div>

        <div className="px-6 pb-2 space-y-2 text-sm text-slate-600">
          {esAprobar ? (
            <>
              <p>¿Confirmas que deseas <span className="font-semibold text-emerald-700">aprobar y completar</span> esta venta?</p>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Cliente</span><span className="font-medium">{venta.nombreCliente ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-bold text-emerald-700">{new Intl.NumberFormat('es-DO',{style:'currency',currency:'DOP'}).format(venta.total)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Tipo pago</span><span className="font-medium">{venta.tipoPago}</span></div>
                {venta.codigoComprobante && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Comprobante</span>
                    <span className="font-mono font-medium">{venta.codigoComprobante}</span>
                  </div>
                )}
                {venta.ncf && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">NCF</span>
                    <span className="font-mono">{venta.ncf}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400">Una vez aprobada, la venta quedará como <strong>Completada</strong> y podrá imprimirse.</p>
            </>
          ) : (
            <>
              <p>¿Confirmas que deseas <span className="font-semibold text-red-600">anular</span> esta venta?</p>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Cliente</span><span className="font-medium">{venta.nombreCliente ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-bold">{new Intl.NumberFormat('es-DO',{style:'currency',currency:'DOP'}).format(venta.total)}</span></div>
              </div>
              <p className="text-xs text-red-500 font-medium">Esta acción no se puede deshacer. El stock será restaurado.</p>
            </>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-xl text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
              esAprobar ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {esAprobar ? 'Sí, aprobar' : 'Sí, anular'}
          </button>
        </div>
      </div>
    </div>
  )
}

const fmt      = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
const fmtFecha = (d: string) => new Date(d).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })
const fmtDate  = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })

type FormatoImpresion = 'A4' | '80mm' | '58mm'
const getFormato = (): FormatoImpresion =>
  (localStorage.getItem('pos_formato') as FormatoImpresion) ?? '80mm'

const estadoColor: Record<string, 'green' | 'yellow' | 'red' | 'gray' | 'blue'> = {
  Completada: 'green', Pendiente: 'yellow', Cancelada: 'red', Devuelta: 'gray', DevueltaParcial: 'blue',
}

// ── Modal devolución (parcial o completa) ─────────────────────────────────────
function DevolucionModal({ venta, loading, onConfirm, onCancel }: {
  venta: VentaResponse
  loading: boolean
  onConfirm: (motivo: string, tipo: 'Completa' | 'Parcial', items?: { detalleVentaId: number; cantidad: number }[]) => void
  onCancel: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [tipo, setTipo]     = useState<'Completa' | 'Parcial'>('Completa')

  // Cantidades a devolver por detalle (default = cantidad original)
  const [cantidades, setCantidades] = useState<Record<number, string>>(() =>
    Object.fromEntries(venta.detalles.map(d => [d.id, String(d.cantidad)]))
  )

  const esE = venta.codigoComprobante?.startsWith('E') ?? false
  const fmtN = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)

  const itemsValidos = venta.detalles.map(d => ({
    det: d,
    cantDev: parseFloat(cantidades[d.id] ?? '0') || 0,
  })).filter(x => x.cantDev > 0 && x.cantDev <= x.det.cantidad)

  const totalDevuelto = tipo === 'Completa'
    ? venta.total
    : itemsValidos.reduce((s, x) => s + x.cantDev * x.det.precioConImpuesto, 0)

  const puedeConfirmar = motivo.trim() && (
    tipo === 'Completa' || (tipo === 'Parcial' && itemsValidos.length > 0)
  )

  const handleConfirm = () => {
    if (tipo === 'Completa') {
      onConfirm(motivo, 'Completa')
    } else {
      onConfirm(motivo, 'Parcial', itemsValidos.map(x => ({
        detalleVentaId: x.det.id,
        cantidad: x.cantDev,
      })))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b">
          <div className="p-2.5 rounded-full bg-orange-100">
            <RotateCcw size={22} className="text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-base">Crear devolución</h3>
            <p className="text-xs text-slate-400">Factura #{venta.id} · Total {fmtN(venta.total)}</p>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4 text-sm text-slate-600">
          {/* Selector tipo */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tipo de devolución</p>
            <div className="grid grid-cols-2 gap-2">
              {(['Completa', 'Parcial'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    tipo === t
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <span className="text-lg">{t === 'Completa' ? '📦' : '📋'}</span>
                  <span>{t}</span>
                  <span className="text-[10px] font-normal text-center leading-tight">
                    {t === 'Completa' ? 'Devuelve toda la factura' : 'Selecciona ítems y cantidades'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Aviso comprobante */}
          {esE ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <p className="font-semibold mb-0.5">Devolución e-CF (tipo E)</p>
              <p>La nota de crédito electrónica se gestionará cuando la API esté disponible.
              Quedará en estado <strong>Pendiente de comprobante electrónico</strong>.</p>
            </div>
          ) : venta.codigoComprobante?.startsWith('B') ? (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
              Se asignará automáticamente un NCF <strong>B04</strong> (Nota de Crédito) del pool.
            </div>
          ) : null}

          {/* Ítems — solo en devolución parcial */}
          {tipo === 'Parcial' && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Ítems a devolver
              </p>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Producto</th>
                      <th className="px-3 py-2 text-right">Original</th>
                      <th className="px-3 py-2 text-right">A devolver</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {venta.detalles.map((d: DetalleVentaResponse) => {
                      const cantDev = parseFloat(cantidades[d.id] ?? '0') || 0
                      const valido  = cantDev > 0 && cantDev <= d.cantidad
                      return (
                        <tr key={d.id} className={valido ? 'bg-orange-50/40' : ''}>
                          <td className="px-3 py-2 font-medium">{d.nombreProducto}</td>
                          <td className="px-3 py-2 text-right text-slate-500">
                            {d.cantidad} {d.unidadMedida}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              max={d.cantidad}
                              step={d.cantidad % 1 === 0 ? '1' : '0.001'}
                              value={cantidades[d.id] ?? ''}
                              onChange={e => setCantidades(prev => ({ ...prev, [d.id]: e.target.value }))}
                              className={`w-20 px-2 py-1 text-right rounded-lg border text-xs outline-none ${
                                cantidades[d.id] && !valido && parseFloat(cantidades[d.id]) !== 0
                                  ? 'border-red-400 bg-red-50'
                                  : 'border-slate-300 focus:border-orange-500'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {valido ? fmtN(cantDev * d.precioConImpuesto) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {itemsValidos.length === 0 && (
                <p className="text-xs text-red-500 mt-1">Ingresa al menos una cantidad válida mayor a 0.</p>
              )}
            </div>
          )}

          {/* Total a devolver */}
          <div className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
            <span className="text-sm font-medium text-orange-700">Total a devolver</span>
            <span className="text-lg font-bold text-orange-800 font-mono">{fmtN(totalDevuelto)}</span>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Describe el motivo de la devolución…"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-orange-500 resize-none"
            />
          </div>

          <p className="text-xs text-red-500 font-medium">
            {tipo === 'Completa'
              ? 'El stock y crédito serán restaurados por completo.'
              : 'Se restaurará stock solo de los ítems seleccionados.'}
          </p>
        </div>

        <div className="flex gap-2 px-6 pb-6">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={loading || !puedeConfirmar}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-xl text-white bg-orange-600 hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            Confirmar devolución {tipo === 'Parcial' && itemsValidos.length > 0 ? `(${itemsValidos.length} ítems)` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Cotización desde venta existente ──────────────────────────────────────────
function cotizacion80mm(v: VentaResponse, validezDias: number, nombreComercio: string, sloganComercio?: string, telefonoComercio?: string, rncComercio?: string) {
  const hoy   = new Date()
  const vence = new Date(hoy); vence.setDate(hoy.getDate() + validezDias)
  const fmtD  = (d: Date) => d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const doc = new jsPDF({ unit: 'mm', format: [80, 297] })
  const W = 80; let y = 8
  const center = (text: string, size = 10) => { doc.setFontSize(size); doc.text(text, W / 2, y, { align: 'center' }); y += size * 0.5 + 1 }
  const line   = () => { doc.setDrawColor(180); doc.line(4, y, W - 4, y); y += 3 }
  const row    = (left: string, right: string, bold = false, size = 8) => {
    doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(left, 4, y); doc.text(right, W - 4, y, { align: 'right' }); y += size * 0.45 + 2
  }
  doc.setFont('helvetica', 'bold'); center(nombreComercio.toUpperCase(), 13)
  doc.setFont('helvetica', 'normal')
  if (sloganComercio)   center(sloganComercio, 8)
  if (telefonoComercio) center(`Tel: ${telefonoComercio}`, 8)
  if (rncComercio)      center(`RNC: ${rncComercio}`, 8)
  y += 1
  doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 90, 200); center('COTIZACION', 12)
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal')
  center(`Fecha: ${fmtD(hoy)}`, 8); center(`Valida hasta: ${fmtD(vence)}`, 8)
  y += 1; line()
  if (v.nombreCliente) row('Cliente:', v.nombreCliente)
  if (v.cedulaCliente) row('RNC:', v.cedulaCliente)
  if (v.esMayorista) { doc.setTextColor(120, 40, 180); doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text('-- PRECIOS MAYORISTAS --', W / 2, y, { align: 'center' }); y += 5; doc.setTextColor(0,0,0); doc.setFont('helvetica', 'normal') }
  line()
  doc.setFont('helvetica', 'bold'); row('Producto', 'Subtotal'); doc.setFont('helvetica', 'normal'); y += 1
  for (const d of v.detalles) {
    const nombre = d.nombreProducto.length > 24 ? d.nombreProducto.substring(0, 23) + '…' : d.nombreProducto
    doc.setFontSize(8); doc.text(nombre, 4, y); y += 4
    row(`  ${d.cantidad} ${d.unidadMedida} × ${fmt(d.precioConImpuesto)}`, fmt(d.subtotalConImpuesto))
  }
  line()
  row('Base (sin ITBIS):', fmt(v.subtotalBase))
  row('ITBIS:', fmt(v.totalImpuesto))
  if (v.descuento > 0) row('Descuento:', `-${fmt(v.descuento)}`)
  y += 1; line(); y += 3
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
  doc.text('TOTAL:', 4, y); doc.text(fmt(v.total), W - 4, y, { align: 'right' }); y += 9
  line()
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text(`Cotizacion valida por ${validezDias} dias.`, W / 2, y, { align: 'center' }); y += 3.5
  doc.text('Precios sujetos a cambio sin previo aviso.', W / 2, y, { align: 'center' })
  doc.autoPrint(); window.open(URL.createObjectURL(doc.output('blob')), '_blank')
}

function cotizacion58mm(v: VentaResponse, validezDias: number, nombreComercio: string, sloganComercio?: string, telefonoComercio?: string, rncComercio?: string) {
  const hoy   = new Date()
  const vence = new Date(hoy); vence.setDate(hoy.getDate() + validezDias)
  const fmtD  = (d: Date) => d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const doc = new jsPDF({ unit: 'mm', format: [58, 297] })
  const W = 58; const M = 3; let y = 7
  const center = (text: string, size = 9) => { doc.setFontSize(size); doc.text(text, W / 2, y, { align: 'center' }); y += size * 0.5 + 1 }
  const line   = () => { doc.setDrawColor(180); doc.line(M, y, W - M, y); y += 3 }
  const row    = (left: string, right: string, bold = false, size = 7) => {
    doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(left, M, y); doc.text(right, W - M, y, { align: 'right' }); y += size * 0.45 + 1.8
  }
  doc.setFont('helvetica', 'bold'); center(nombreComercio.toUpperCase(), 11)
  doc.setFont('helvetica', 'normal')
  if (sloganComercio)   center(sloganComercio, 7)
  if (telefonoComercio) center(`Tel: ${telefonoComercio}`, 7)
  if (rncComercio)      center(`RNC: ${rncComercio}`, 7)
  y += 1
  doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 90, 200); center('COTIZACION', 10)
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  center(`Fecha: ${fmtD(hoy)}`, 7); center(`Valida hasta: ${fmtD(vence)}`, 7)
  y += 1; line()
  if (v.nombreCliente) row('Cliente:', v.nombreCliente)
  if (v.cedulaCliente) row('RNC:', v.cedulaCliente)
  line()
  doc.setFont('helvetica', 'bold'); row('Producto', 'Total'); doc.setFont('helvetica', 'normal'); y += 1
  for (const d of v.detalles) {
    const nombre = d.nombreProducto.length > 18 ? d.nombreProducto.substring(0, 17) + '…' : d.nombreProducto
    doc.setFontSize(7); doc.text(nombre, M, y); y += 3.5
    row(`  ${d.cantidad} ${d.unidadMedida} x ${fmt(d.precioConImpuesto)}`, fmt(d.subtotalConImpuesto))
  }
  line()
  row('Base (sin ITBIS):', fmt(v.subtotalBase))
  row('ITBIS:', fmt(v.totalImpuesto))
  if (v.descuento > 0) row('Descuento:', `-${fmt(v.descuento)}`)
  y += 1; line(); y += 2
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7)
  doc.text('TOTAL:', W / 2, y, { align: 'center' }); y += 4.5
  doc.setFontSize(12); doc.text(fmt(v.total), W / 2, y, { align: 'center' }); y += 7
  line()
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
  doc.text(`Valida por ${validezDias} dias.`, W / 2, y, { align: 'center' })
  doc.autoPrint(); window.open(URL.createObjectURL(doc.output('blob')), '_blank')
}

function cotizacionA4(v: VentaResponse, validezDias: number, nombreComercio: string, sloganComercio?: string, telefonoComercio?: string, rncComercio?: string) {
  const hoy   = new Date()
  const vence = new Date(hoy); vence.setDate(hoy.getDate() + validezDias)
  const fmtD  = (d: Date) => d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const W = 210; const ML = 15; const MR = 15; const UW = W - ML - MR
  let y = 20
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20)
  doc.text(nombreComercio.toUpperCase(), ML, y); y += 8
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  if (sloganComercio) { doc.text(sloganComercio, ML, y); y += 5 }
  const info: string[] = []
  if (telefonoComercio) info.push(`Tel: ${telefonoComercio}`)
  if (rncComercio)      info.push(`RNC: ${rncComercio}`)
  if (info.length > 0) { doc.text(info.join('  |  '), ML, y); y += 5 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(30, 90, 200)
  doc.text('COTIZACION', W - MR, 20, { align: 'right' })
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Fecha: ${fmtD(hoy)}`, W - MR, 32, { align: 'right' })
  doc.text(`Valida hasta: ${fmtD(vence)}`, W - MR, 38, { align: 'right' })
  y += 3; doc.setDrawColor(200); doc.line(ML, y, W - MR, y); y += 6
  const col2 = ML + UW / 2 + 5
  if (v.nombreCliente) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    doc.text('Cliente:', ML, y); doc.setFont('helvetica', 'normal'); doc.text(v.nombreCliente, ML + 22, y)
    if (v.cedulaCliente) { doc.setFont('helvetica', 'bold'); doc.text('RNC:', col2, y); doc.setFont('helvetica', 'normal'); doc.text(v.cedulaCliente, col2 + 12, y) }
    y += 6
  }
  if (v.esMayorista) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(120, 40, 180)
    doc.text('VENTA MAYORISTA — Precios mayoristas aplicados', ML, y); doc.setTextColor(0,0,0); y += 6
  }
  const tableBody = v.detalles.map((d, i) => [
    String(i + 1), d.nombreProducto, `${d.cantidad} ${d.unidadMedida}`, fmt(d.precioConImpuesto), fmt(d.subtotalConImpuesto),
  ])
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
  doc.text('Base (sin ITBIS):', totX, y); doc.text(fmt(v.subtotalBase), W - MR, y, { align: 'right' }); y += 5.5
  doc.text('ITBIS:', totX, y); doc.text(fmt(v.totalImpuesto), W - MR, y, { align: 'right' }); y += 5.5
  if (v.descuento > 0) { doc.text('Descuento:', totX, y); doc.text(`-${fmt(v.descuento)}`, W - MR, y, { align: 'right' }); y += 5.5 }
  doc.setDrawColor(180); doc.line(totX, y, W - MR, y); y += 4
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(30, 90, 200)
  doc.text('TOTAL:', totX, y); doc.text(fmt(v.total), W - MR, y, { align: 'right' })
  doc.setTextColor(0,0,0); y += 12
  doc.setFillColor(240, 245, 255); doc.roundedRect(ML, y, UW, 14, 2, 2, 'F')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 80, 180)
  doc.text(`Esta cotizacion es valida por ${validezDias} dias (hasta ${fmtD(vence)}).`, W / 2, y + 5, { align: 'center' })
  doc.text('Los precios estan sujetos a cambio sin previo aviso.', W / 2, y + 10, { align: 'center' })
  doc.setTextColor(0,0,0); y += 20
  doc.setFontSize(9); doc.setDrawColor(200); doc.line(ML, y, W - MR, y); y += 5
  doc.text('¡Gracias por su preferencia!', W / 2, y, { align: 'center' })
  doc.autoPrint(); window.open(URL.createObjectURL(doc.output('blob')), '_blank')
}

function imprimirCotizacionVenta(v: VentaResponse, validezDias: number, nombreComercio: string, sloganComercio?: string, telefonoComercio?: string, rncComercio?: string) {
  const formato = (localStorage.getItem('pos_formato') ?? '80mm') as 'A4' | '80mm' | '58mm'
  if (formato === '58mm') return cotizacion58mm(v, validezDias, nombreComercio, sloganComercio, telefonoComercio, rncComercio)
  if (formato === 'A4')   return cotizacionA4(v, validezDias, nombreComercio, sloganComercio, telefonoComercio, rncComercio)
  return cotizacion80mm(v, validezDias, nombreComercio, sloganComercio, telefonoComercio, rncComercio)
}

// ── Impresión de recibo ────────────────────────────────────────────────────────
async function imprimirRecibo(v: VentaResponse, nombreComercio = 'POS Sistema', sloganComercio?: string, telefonoComercio?: string, rncComercio?: string) {
  const formato = getFormato()
  if (formato === '58mm') return imprimirRecibo58mm(v, nombreComercio, sloganComercio, telefonoComercio, rncComercio)
  if (formato === 'A4')   return imprimirReciboA4(v, nombreComercio, sloganComercio, telefonoComercio, rncComercio)
  return imprimirRecibo80mm(v, nombreComercio, sloganComercio, telefonoComercio, rncComercio)
}

async function imprimirRecibo80mm(v: VentaResponse, nombreComercio = 'POS Sistema', sloganComercio?: string, telefonoComercio?: string, rncComercio?: string) {
  // Si es crédito, buscar los datos del crédito asociado a esta venta
  let credito: CreditoResponse | null = null
  if (v.tipoPago === 'Credito' && v.clienteId) {
    try {
      const lista = await creditosApi.porCliente(v.clienteId)
      credito = lista.find(c => c.ventaId === v.id) ?? null
    } catch { /* continuar sin datos de crédito */ }
  }

  const doc = new jsPDF({ unit: 'mm', format: [80, 297] })
  const W = 80
  let y = 8

  const center = (text: string, size = 10) => {
    doc.setFontSize(size)
    doc.text(text, W / 2, y, { align: 'center' })
    y += size * 0.5 + 1
  }
  const line = (dashed = false) => {
    doc.setDrawColor(dashed ? 150 : 180)
    /*if (dashed) {
      doc.setLineDash([1, 1])
    } else {
      doc.setLineDash([])
    }*/
    doc.line(4, y, W - 4, y)
    //doc.setLineDash([])
    y += 3
  }
  const row = (left: string, right: string, bold = false, size = 8) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(left, 4, y)
    doc.text(right, W - 4, y, { align: 'right' })
    y += size * 0.45 + 2
  }
  // ── Cabecera ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  center(nombreComercio.toUpperCase(), 13)
  doc.setFont('helvetica', 'normal')
  if (sloganComercio) center(sloganComercio, 8)
  if (telefonoComercio) center(`Tel: ${telefonoComercio}`, 8)
  if (rncComercio) center(`RNC: ${rncComercio}`, 8)
  center(`Factura #${v.id}`, 9)
  center(fmtFecha(v.fechaVenta), 8)
  if (v.esMayorista) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(120, 40, 180)
    center('-- VENTA MAYORISTA --', 8)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
  }
  y += 1
  line()

  // ── Info general ──────────────────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  row('Cajero:', v.nombreUsuario)
  row('Tipo de pago:', v.tipoPago)
  if (v.nombreCliente) row('Cliente:', v.nombreCliente)
  if (v.cedulaCliente) row('RNC:', v.cedulaCliente)

  // ── Comprobante / NCF ─────────────────────────────────────────────────────
  if (v.ncf) {
    line()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('COMPROBANTE FISCAL', W / 2, y, { align: 'center' })
    y += 5
    doc.setFont('helvetica', 'bold')
    doc.text('NCF:', 4, y)
    doc.setFont('helvetica', 'normal')
    doc.text(v.ncf, W - 4, y, { align: 'right' })
    y += 5
  }

  line()

  // ── Productos ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  row('Producto', 'Subtotal')
  doc.setFont('helvetica', 'normal')
  y += 1

  for (const d of v.detalles) {
    const nombre = d.nombreProducto.length > 24
      ? d.nombreProducto.substring(0, 23) + '…'
      : d.nombreProducto
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(nombre, 4, y)
    y += 4
    row(
      `  ${d.cantidad} ${d.unidadMedida} × ${fmt(d.precioConImpuesto)}`,
      fmt(d.subtotalConImpuesto),
    )
  }

  line()

  // ── Totales ───────────────────────────────────────────────────────────────
  row('Base (sin ITBIS):', fmt(v.subtotalBase))
  row('ITBIS:', fmt(v.totalImpuesto))
  if (v.descuento > 0) row('Descuento:', `-${fmt(v.descuento)}`)
  y += 1
  line()
  y += 3

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL:', 4, y)
  doc.text(fmt(v.total), W - 4, y, { align: 'right' })
  y += 8

  // ── Sección crédito ───────────────────────────────────────────────────────
  if (credito) {
    line()
    const esSaldado  = credito.estado === 'Saldado' || credito.estado === 'Cancelado'
    const esPendiente = !esSaldado

    // Caja de crédito con fondo gris
    const boxH = esPendiente
      ? (credito.fechaVencimiento ? 38 : 32)
      : 16
    doc.setFillColor(245, 245, 245)
    doc.roundedRect(4, y - 2, W - 8, boxH, 2, 2, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(
      esSaldado ? 'CREDITO SALDADO' : 'CREDITO PENDIENTE',
      W / 2, y + 3,
      { align: 'center' },
    )
    y += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    row('Monto total:', fmt(credito.montoTotal))
    row('Pagado:', fmt(credito.montoPagado))

    if (esPendiente) {
      y += 1
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('SALDO PENDIENTE:', 4, y)
      doc.text(fmt(credito.saldo), W - 4, y, { align: 'right' })
      y += 6

      if (credito.fechaVencimiento) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(180, 0, 0)
        row('Fecha límite de pago:', fmtDate(credito.fechaVencimiento.slice(0, 10)))
        doc.setTextColor(0, 0, 0)
      }

      // Estado (Vencido en rojo, Pendiente en normal)
      doc.setFontSize(8)
      if (credito.estado === 'Vencido') {
        doc.setTextColor(200, 0, 0)
        doc.setFont('helvetica', 'bold')
        center('-- CREDITO VENCIDO --', 8)
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'normal')
      } else {
        row('Estado:', credito.estado)
      }
    }

    y += 2
  }

  // ── Pie ───────────────────────────────────────────────────────────────────
  line()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  if (credito && credito.estado !== 'Saldado') {
    doc.text('Por favor pague antes de la fecha indicada.', W / 2, y, { align: 'center' })
    y += 4
  }
  doc.text('¡Gracias por su compra!', W / 2, y, { align: 'center' })

  doc.autoPrint()
  const blob = doc.output('blob')
  const url  = URL.createObjectURL(blob)
  window.open(url, '_blank')
}

// ── Recibo 58 mm ──────────────────────────────────────────────────────────────
async function imprimirRecibo58mm(v: VentaResponse, nombreComercio = 'POS Sistema', sloganComercio?: string, telefonoComercio?: string, rncComercio?: string) {
  let credito: CreditoResponse | null = null
  if (v.tipoPago === 'Credito' && v.clienteId) {
    try { const l = await creditosApi.porCliente(v.clienteId); credito = l.find(c => c.ventaId === v.id) ?? null }
    catch { /* sin crédito */ }
  }
  const doc = new jsPDF({ unit: 'mm', format: [58, 297] })
  const W = 58; const M = 3; let y = 7
  const center = (text: string, size = 9) => { doc.setFontSize(size); doc.text(text, W / 2, y, { align: 'center' }); y += size * 0.5 + 1 }
  const line = () => { doc.setDrawColor(180); doc.line(M, y, W - M, y); y += 3 }
  const row = (left: string, right: string, bold = false, size = 7) => {
    doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(left, M, y); doc.text(right, W - M, y, { align: 'right' }); y += size * 0.45 + 1.8
  }
  doc.setFont('helvetica', 'bold'); center(nombreComercio.toUpperCase(), 11)
  doc.setFont('helvetica', 'normal')
  if (sloganComercio) center(sloganComercio, 7)
  if (telefonoComercio) center(`Tel: ${telefonoComercio}`, 7)
  if (rncComercio) center(`RNC: ${rncComercio}`, 7)
  center(`Factura #${v.id}`, 8); center(fmtFecha(v.fechaVenta), 7)
  if (v.esMayorista) { doc.setFont('helvetica', 'bold'); doc.setTextColor(120, 40, 180); center('-- MAYORISTA --', 7); doc.setTextColor(0,0,0); doc.setFont('helvetica', 'normal') }
  y += 1; line()
  doc.setFontSize(7); doc.setFont('helvetica', 'normal')
  row('Cajero:', v.nombreUsuario); row('Tipo pago:', v.tipoPago)
  if (v.nombreCliente) row('Cliente:', v.nombreCliente)
  if (v.cedulaCliente) row('RNC:', v.cedulaCliente)
  if (v.ncf) {
    line(); doc.setFont('helvetica', 'bold'); doc.setFontSize(7)
    doc.text('COMPROBANTE FISCAL', W / 2, y, { align: 'center' }); y += 4
    doc.text('NCF:', M, y); doc.setFont('helvetica', 'normal')
    const ncfText = v.ncf.length > 16 ? v.ncf : v.ncf
    doc.text(ncfText, W - M, y, { align: 'right' }); y += 4
  }
  line()
  doc.setFont('helvetica', 'bold'); row('Producto', 'Total')
  doc.setFont('helvetica', 'normal'); y += 1
  for (const d of v.detalles) {
    const nombre = d.nombreProducto.length > 18 ? d.nombreProducto.substring(0, 17) + '…' : d.nombreProducto
    doc.setFontSize(7); doc.text(nombre, M, y); y += 3.5
    row(`  ${d.cantidad} ${d.unidadMedida} x ${fmt(d.precioConImpuesto)}`, fmt(d.subtotalConImpuesto))
  }
  line()
  row('Base (sin ITBIS):', fmt(v.subtotalBase))
  row('ITBIS:', fmt(v.totalImpuesto))
  if (v.descuento > 0) row('Descuento:', `-${fmt(v.descuento)}`)
  y += 1; line(); y += 3
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
  doc.text('TOTAL:', M, y); doc.text(fmt(v.total), W - M, y, { align: 'right' }); y += 7
  if (credito) {
    line()
    const esSaldado = credito.estado === 'Saldado' || credito.estado === 'Cancelado'
    doc.setFillColor(245, 245, 245); doc.roundedRect(M, y - 2, W - M * 2, esSaldado ? 14 : 28, 2, 2, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
    doc.text(esSaldado ? 'CREDITO SALDADO' : 'CREDITO PENDIENTE', W / 2, y + 3, { align: 'center' }); y += 6
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    row('Total:', fmt(credito.montoTotal)); row('Pagado:', fmt(credito.montoPagado))
    if (!esSaldado) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('SALDO:', M, y); doc.text(fmt(credito.saldo), W - M, y, { align: 'right' }); y += 5 }
    y += 2
  }
  line(); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
  if (credito && credito.estado !== 'Saldado') { doc.text('Pague antes de la fecha indicada.', W / 2, y, { align: 'center' }); y += 3.5 }
  doc.text('¡Gracias por su compra!', W / 2, y, { align: 'center' })
  doc.autoPrint(); window.open(URL.createObjectURL(doc.output('blob')), '_blank')
}

// ── Recibo A4 ─────────────────────────────────────────────────────────────────
async function imprimirReciboA4(v: VentaResponse, nombreComercio = 'POS Sistema', sloganComercio?: string, telefonoComercio?: string, rncComercio?: string) {
  let credito: CreditoResponse | null = null
  if (v.tipoPago === 'Credito' && v.clienteId) {
    try { const l = await creditosApi.porCliente(v.clienteId); credito = l.find(c => c.ventaId === v.id) ?? null }
    catch { /* sin crédito */ }
  }
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const W = 210; const ML = 15; const MR = 15; const UW = W - ML - MR
  let y = 20

  // ── Cabecera ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20)
  doc.text(nombreComercio.toUpperCase(), ML, y); y += 8
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  if (sloganComercio) { doc.text(sloganComercio, ML, y); y += 5 }
  const infoLines: string[] = []
  if (telefonoComercio) infoLines.push(`Tel: ${telefonoComercio}`)
  if (rncComercio) infoLines.push(`RNC: ${rncComercio}`)
  if (infoLines.length > 0) { doc.text(infoLines.join('  |  '), ML, y); y += 5 }

  // Número y fecha (esquina derecha de la cabecera)
  const headerY = 20
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text(`FACTURA #${v.id}`, W - MR, headerY, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(fmtFecha(v.fechaVenta), W - MR, headerY + 7, { align: 'right' })
  if (v.esMayorista) {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(120, 40, 180)
    doc.text('VENTA MAYORISTA', W - MR, headerY + 14, { align: 'right' })
    doc.setTextColor(0,0,0); doc.setFont('helvetica', 'normal')
  }

  y += 3
  doc.setDrawColor(200); doc.line(ML, y, W - MR, y); y += 6

  // ── Bloque info: cajero + cliente ───────────────────────────────────────────
  doc.setFontSize(9)
  const col2 = ML + UW / 2 + 5
  doc.setFont('helvetica', 'bold'); doc.text('Cajero:', ML, y)
  doc.setFont('helvetica', 'normal'); doc.text(v.nombreUsuario, ML + 22, y)
  doc.setFont('helvetica', 'bold'); doc.text('Tipo de pago:', col2, y)
  doc.setFont('helvetica', 'normal'); doc.text(v.tipoPago, col2 + 28, y); y += 6
  if (v.nombreCliente) {
    doc.setFont('helvetica', 'bold'); doc.text('Cliente:', ML, y)
    doc.setFont('helvetica', 'normal'); doc.text(v.nombreCliente, ML + 22, y)
    if (v.cedulaCliente) {
      doc.setFont('helvetica', 'bold'); doc.text('RNC:', col2, y)
      doc.setFont('helvetica', 'normal'); doc.text(v.cedulaCliente, col2 + 28, y)
    }
    y += 6
  }

  // ── Bloque NCF ──────────────────────────────────────────────────────────────
  if (v.ncf) {
    doc.setFillColor(240, 245, 255); doc.roundedRect(ML, y, UW, 14, 2, 2, 'F')
    doc.setDrawColor(180, 200, 240); doc.roundedRect(ML, y, UW, 14, 2, 2, 'S')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(60, 80, 180)
    doc.text('COMPROBANTE FISCAL', ML + 4, y + 4.5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    if (v.codigoComprobante) doc.text(`Tipo: ${v.codigoComprobante}`, ML + 4, y + 9.5)
    doc.setFont('helvetica', 'bold'); doc.text(`NCF: ${v.ncf}`, col2, y + 9.5)
    doc.setTextColor(0,0,0); y += 18
  }

  y += 2
  // ── Tabla de productos ──────────────────────────────────────────────────────
  const tableBody = v.detalles.map((d, i) => [
    String(i + 1),
    d.nombreProducto,
    `${d.cantidad} ${d.unidadMedida}`,
    fmt(d.precioConImpuesto),
    d.aplicaImpuesto ? `${d.porcentajeImpuesto}%` : 'Exento',
    fmt(d.subtotalConImpuesto),
  ])
  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    head: [['#', 'Producto', 'Cant.', 'Precio c/ITBIS', 'ITBIS', 'Subtotal']],
    body: tableBody,
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'center' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [248, 249, 250] },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6

  // ── Totales ──────────────────────────────────────────────────────────────────
  const totX = W - MR - 70
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  const rowA4 = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(label, totX, y, { align: 'left' })
    doc.text(value, W - MR, y, { align: 'right' })
    y += 5.5
  }
  rowA4('Base (sin ITBIS):', fmt(v.subtotalBase))
  rowA4('ITBIS:', fmt(v.totalImpuesto))
  if (v.descuento > 0) rowA4('Descuento:', `-${fmt(v.descuento)}`)
  doc.setDrawColor(180); doc.line(totX, y, W - MR, y); y += 4
  doc.setFontSize(14); doc.setFont('helvetica', 'bold')
  doc.text('TOTAL:', totX, y)
  doc.text(fmt(v.total), W - MR, y, { align: 'right' })
  y += 10

  // ── Crédito ──────────────────────────────────────────────────────────────────
  if (credito) {
    const esSaldado = credito.estado === 'Saldado' || credito.estado === 'Cancelado'
    doc.setFillColor(250, 250, 250); doc.setDrawColor(220)
    doc.roundedRect(ML, y, UW, esSaldado ? 18 : 30, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.text(esSaldado ? 'CREDITO SALDADO' : 'CREDITO PENDIENTE', W / 2, y + 6, { align: 'center' }); y += 10
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    doc.text(`Monto total: ${fmt(credito.montoTotal)}`, ML + 5, y)
    doc.text(`Pagado: ${fmt(credito.montoPagado)}`, W / 2, y); y += 5.5
    if (!esSaldado) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
      doc.text(`SALDO PENDIENTE: ${fmt(credito.saldo)}`, ML + 5, y)
      if (credito.fechaVencimiento) { doc.setFontSize(9); doc.setTextColor(180,0,0); doc.text(`Fecha limite: ${fmtDate(credito.fechaVencimiento.slice(0,10))}`, W/2, y); doc.setTextColor(0,0,0) }
      y += 6
    }
    y += 6
  }

  // ── Pie ───────────────────────────────────────────────────────────────────────
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setDrawColor(200)
  doc.line(ML, y, W - MR, y); y += 5
  if (credito && credito.estado !== 'Saldado') { doc.text('Por favor pague antes de la fecha indicada.', W / 2, y, { align: 'center' }); y += 5 }
  doc.text('¡Gracias por su compra!', W / 2, y, { align: 'center' })

  doc.autoPrint(); window.open(URL.createObjectURL(doc.output('blob')), '_blank')
}

// ── Impresión de recibo de devolución ─────────────────────────────────────────
function imprimirDevolucion(
  dev: DevolucionResponse,
  ventaOriginal: VentaResponse,
  nombreComercio = 'POS Sistema',
  sloganComercio?: string,
  telefonoComercio?: string,
  rncComercio?: string,
) {
  const formato = getFormato()
  if (formato === '58mm') return imprimirDevolucion58mm(dev, ventaOriginal, nombreComercio, sloganComercio, telefonoComercio, rncComercio)
  if (formato === 'A4')   return imprimirDevolucionA4(dev, ventaOriginal, nombreComercio, sloganComercio, telefonoComercio, rncComercio)
  return imprimirDevolucion80mm(dev, ventaOriginal, nombreComercio, sloganComercio, telefonoComercio, rncComercio)
}

function imprimirDevolucion80mm(
  dev: DevolucionResponse,
  ventaOriginal: VentaResponse,
  nombreComercio = 'POS Sistema',
  sloganComercio?: string,
  telefonoComercio?: string,
  rncComercio?: string,
) {
  const doc = new jsPDF({ unit: 'mm', format: [80, 297] })
  const W = 80
  let y = 8

  const center = (text: string, size = 10) => {
    doc.setFontSize(size)
    doc.text(text, W / 2, y, { align: 'center' })
    y += size * 0.5 + 1
  }
  const line = () => {
    doc.setDrawColor(180)
    doc.line(4, y, W - 4, y)
    y += 3
  }
  const row = (left: string, right: string, bold = false, size = 8) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(left, 4, y)
    doc.text(right, W - 4, y, { align: 'right' })
    y += size * 0.45 + 2
  }

  // ── Cabecera ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  center(nombreComercio.toUpperCase(), 13)
  doc.setFont('helvetica', 'normal')
  if (sloganComercio)   center(sloganComercio, 8)
  if (telefonoComercio) center(`Tel: ${telefonoComercio}`, 8)
  if (rncComercio)      center(`RNC: ${rncComercio}`, 8)
  y += 1

  // Título devolución
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(200, 80, 0)
  center('NOTA DE CREDITO', 10)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  center(`Devolución #${dev.id}`, 9)
  center(new Date(dev.fechaDevolucion).toLocaleString('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }), 8)
  y += 1
  line()

  // ── Info general ──────────────────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  row('Factura original:', `#${dev.ventaOriginalId}`)
  row('Cajero:', dev.nombreUsuario)
  if (ventaOriginal.nombreCliente) row('Cliente:', ventaOriginal.nombreCliente)
  if (ventaOriginal.cedulaCliente) row('RNC:', ventaOriginal.cedulaCliente)
  if (ventaOriginal.ncf)           row('NCF afectado:', ventaOriginal.ncf)
  y += 1

  // ── Comprobante de devolución ─────────────────────────────────────────────
  if (dev.ncf) {
    line()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('COMPROBANTE FISCAL DEVOLUCION', W / 2, y, { align: 'center' })
    y += 5
    doc.setFont('helvetica', 'bold')
    doc.text('NCF:', 4, y)
    doc.setFont('helvetica', 'normal')
    doc.text(dev.ncf, W - 4, y, { align: 'right' })
    y += 5
    y += 1
  } else if (dev.estado === 'PendienteComprobanteE') {
    line()
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    doc.setTextColor(180, 100, 0)
    doc.text('Comprobante electronico pendiente.', W / 2, y, { align: 'center' })
    y += 4
    doc.text('El NCF se emitira cuando este disponible.', W / 2, y, { align: 'center' })
    y += 4
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    y += 1
  }

  line()

  // ── Tipo de devolución ────────────────────────────────────────────────────
  if (dev.tipo === 'Parcial') {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(200, 100, 0)
    doc.text('DEVOLUCION PARCIAL', W / 2, y, { align: 'center' })
    y += 5
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
  }

  // ── Productos devueltos (de los detalles de la devolución) ────────────────
  doc.setFont('helvetica', 'bold')
  row('Producto', 'Subtotal')
  doc.setFont('helvetica', 'normal')
  y += 1
  const fmt2 = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
  for (const d of dev.detalles) {
    const nombre = d.nombreProducto.length > 24
      ? d.nombreProducto.substring(0, 23) + '…'
      : d.nombreProducto
    doc.setFontSize(8)
    doc.text(nombre, 4, y)
    y += 4
    row(
      `  ${d.cantidadDevuelta} ${d.unidadMedida} × ${fmt2(d.precioConImpuesto)}`,
      fmt2(d.subtotal),
    )
  }
  y += 1
  line()
  y += 3

  // ── Total devuelto ────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('TOTAL DEVUELTO:', W / 2, y, { align: 'center' })
  y += 5
  doc.setFontSize(13)
  doc.text(fmt2(dev.totalDevuelto), W / 2, y, { align: 'center' })
  y += 8

  doc.autoPrint()
  const blob = doc.output('blob')
  window.open(URL.createObjectURL(blob), '_blank')
}

// ── Devolución 58 mm ──────────────────────────────────────────────────────────
function imprimirDevolucion58mm(
  dev: DevolucionResponse,
  ventaOriginal: VentaResponse,
  nombreComercio = 'POS Sistema',
  sloganComercio?: string,
  telefonoComercio?: string,
  rncComercio?: string,
) {
  const doc = new jsPDF({ unit: 'mm', format: [58, 297] })
  const W = 58; const M = 3; let y = 7
  const fmt2 = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
  const center = (text: string, size = 9) => { doc.setFontSize(size); doc.text(text, W / 2, y, { align: 'center' }); y += size * 0.5 + 1 }
  const line = () => { doc.setDrawColor(180); doc.line(M, y, W - M, y); y += 3 }
  const row = (left: string, right: string, bold = false, size = 7) => {
    doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(left, M, y); doc.text(right, W - M, y, { align: 'right' }); y += size * 0.45 + 1.8
  }
  doc.setFont('helvetica', 'bold'); center(nombreComercio.toUpperCase(), 11)
  doc.setFont('helvetica', 'normal')
  if (sloganComercio) center(sloganComercio, 7)
  if (telefonoComercio) center(`Tel: ${telefonoComercio}`, 7)
  if (rncComercio) center(`RNC: ${rncComercio}`, 7)
  y += 1
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(200, 80, 0)
  center('NOTA DE CREDITO', 9); doc.setTextColor(0,0,0); doc.setFont('helvetica', 'normal')
  center(`Devolucion #${dev.id}`, 8)
  center(new Date(dev.fechaDevolucion).toLocaleString('es-DO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }), 7)
  y += 1; line()
  doc.setFontSize(7); doc.setFont('helvetica', 'normal')
  row('Factura orig.:', `#${dev.ventaOriginalId}`)
  row('Cajero:', dev.nombreUsuario)
  if (ventaOriginal.nombreCliente) row('Cliente:', ventaOriginal.nombreCliente)
  if (ventaOriginal.cedulaCliente) row('RNC:', ventaOriginal.cedulaCliente)
  if (ventaOriginal.ncf)           row('NCF afectado:', ventaOriginal.ncf)
  y += 1
  if (dev.ncf) {
    line(); doc.setFont('helvetica', 'bold'); doc.setFontSize(7)
    doc.text('COMP. FISCAL DEVOLUCION', W / 2, y, { align: 'center' }); y += 4
    doc.text('NCF:', M, y); doc.setFont('helvetica', 'normal'); doc.text(dev.ncf, W - M, y, { align: 'right' }); y += 4; y += 1
  } else if (dev.estado === 'PendienteComprobanteE') {
    line(); doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5); doc.setTextColor(180, 100, 0)
    doc.text('Comprobante electronico pendiente.', W / 2, y, { align: 'center' }); y += 4; doc.setTextColor(0,0,0); doc.setFont('helvetica', 'normal'); y += 1
  }
  line()
  if (dev.tipo === 'Parcial') {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(200, 100, 0)
    doc.text('DEVOLUCION PARCIAL', W / 2, y, { align: 'center' }); y += 4; doc.setTextColor(0,0,0); doc.setFont('helvetica', 'normal')
  }
  doc.setFont('helvetica', 'bold'); row('Producto', 'Total')
  doc.setFont('helvetica', 'normal'); y += 1
  for (const d of dev.detalles) {
    const nombre = d.nombreProducto.length > 18 ? d.nombreProducto.substring(0, 17) + '…' : d.nombreProducto
    doc.setFontSize(7); doc.text(nombre, M, y); y += 3.5
    row(`  ${d.cantidadDevuelta} ${d.unidadMedida} x ${fmt2(d.precioConImpuesto)}`, fmt2(d.subtotal))
  }
  y += 1; line(); y += 3
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text('TOTAL DEVUELTO:', W / 2, y, { align: 'center' }); y += 4.5
  doc.setFontSize(12)
  doc.text(fmt2(dev.totalDevuelto), W / 2, y, { align: 'center' })
  doc.autoPrint(); window.open(URL.createObjectURL(doc.output('blob')), '_blank')
}

// ── Devolución A4 ─────────────────────────────────────────────────────────────
function imprimirDevolucionA4(
  dev: DevolucionResponse,
  ventaOriginal: VentaResponse,
  nombreComercio = 'POS Sistema',
  sloganComercio?: string,
  telefonoComercio?: string,
  rncComercio?: string,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const W = 210; const ML = 15; const MR = 15; const UW = W - ML - MR
  const fmt2 = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
  let y = 20

  // ── Cabecera ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20)
  doc.text(nombreComercio.toUpperCase(), ML, y); y += 8
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  if (sloganComercio) { doc.text(sloganComercio, ML, y); y += 5 }
  const infoLines: string[] = []
  if (telefonoComercio) infoLines.push(`Tel: ${telefonoComercio}`)
  if (rncComercio) infoLines.push(`RNC: ${rncComercio}`)
  if (infoLines.length > 0) { doc.text(infoLines.join('  |  '), ML, y); y += 5 }

  // Título y número (esquina derecha)
  const headerY = 20
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(200, 80, 0)
  doc.text('NOTA DE CREDITO', W - MR, headerY, { align: 'right' })
  doc.setTextColor(0,0,0); doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  doc.text(`Devolucion #${dev.id}  |  Factura original #${dev.ventaOriginalId}`, W - MR, headerY + 8, { align: 'right' })
  doc.setFontSize(9)
  doc.text(new Date(dev.fechaDevolucion).toLocaleString('es-DO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }), W - MR, headerY + 14, { align: 'right' })

  y += 3
  doc.setDrawColor(200); doc.line(ML, y, W - MR, y); y += 6

  // ── Info general ──────────────────────────────────────────────────────────
  const col2 = ML + UW / 2 + 5
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text('Cajero:', ML, y)
  doc.setFont('helvetica', 'normal'); doc.text(dev.nombreUsuario, ML + 22, y)
  if (dev.tipo === 'Parcial') {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(200, 100, 0)
    doc.text('DEVOLUCION PARCIAL', col2, y); doc.setTextColor(0,0,0); doc.setFont('helvetica', 'normal')
  }
  y += 6
  if (ventaOriginal.nombreCliente) {
    doc.setFont('helvetica', 'bold'); doc.text('Cliente:', ML, y)
    doc.setFont('helvetica', 'normal'); doc.text(ventaOriginal.nombreCliente, ML + 22, y)
    if (ventaOriginal.cedulaCliente) {
      doc.setFont('helvetica', 'bold'); doc.text('RNC:', col2, y)
      doc.setFont('helvetica', 'normal'); doc.text(ventaOriginal.cedulaCliente, col2 + 28, y)
    }
    y += 6
  }
  if (ventaOriginal.ncf) {
    doc.setFont('helvetica', 'bold'); doc.text('NCF afectado:', ML, y)
    doc.setFont('helvetica', 'normal'); doc.setFont('helvetica', 'normal'); doc.text(ventaOriginal.ncf, ML + 35, y); y += 6
  }

  // ── Bloque NCF devolución ─────────────────────────────────────────────────
  if (dev.ncf) {
    doc.setFillColor(255, 245, 235); doc.roundedRect(ML, y, UW, 14, 2, 2, 'F')
    doc.setDrawColor(240, 180, 120); doc.roundedRect(ML, y, UW, 14, 2, 2, 'S')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(160, 80, 0)
    doc.text('COMPROBANTE FISCAL DEVOLUCION', ML + 4, y + 4.5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0,0,0)
    if (dev.codigoComprobante) doc.text(`Tipo: ${dev.codigoComprobante}`, ML + 4, y + 9.5)
    doc.setFont('helvetica', 'bold'); doc.text(`NCF: ${dev.ncf}`, col2, y + 9.5)
    y += 18
  } else if (dev.estado === 'PendienteComprobanteE') {
    doc.setFillColor(255, 250, 235); doc.roundedRect(ML, y, UW, 12, 2, 2, 'F')
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(140, 100, 0)
    doc.text('Comprobante electronico pendiente. El NCF se emitira cuando este disponible.', W / 2, y + 7, { align: 'center' })
    doc.setTextColor(0,0,0); y += 16
  }

  y += 2
  // ── Tabla de productos devueltos ──────────────────────────────────────────
  const tableBody = dev.detalles.map((d, i) => [
    String(i + 1),
    d.nombreProducto,
    `${d.cantidadDevuelta} ${d.unidadMedida}`,
    fmt2(d.precioConImpuesto),
    fmt2(d.subtotal),
  ])
  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    head: [['#', 'Producto', 'Cant. Devuelta', 'Precio c/ITBIS', 'Subtotal']],
    body: tableBody,
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [180, 60, 0], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [255, 248, 245] },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8

  // ── Total devuelto ────────────────────────────────────────────────────────
  const totX = W - MR - 70
  doc.setDrawColor(180); doc.line(totX, y, W - MR, y); y += 4
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text('TOTAL DEVUELTO:', totX, y)
  doc.text(fmt2(dev.totalDevuelto), W - MR, y, { align: 'right' }); y += 10

  // ── Pie ───────────────────────────────────────────────────────────────────
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setDrawColor(200)
  doc.line(ML, y, W - MR, y); y += 5
  doc.text('¡Gracias por su preferencia!', W / 2, y, { align: 'center' })

  doc.autoPrint(); window.open(URL.createObjectURL(doc.output('blob')), '_blank')
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function VentasPage() {
  const { puedeVerTodasVentas, puedeAnularVentas, puedeAprobarVentas, puedeEditarVentas, isCajero } = useAuth()
  const { comercio } = useComercio()
  const navigate    = useNavigate()
  const qc          = useQueryClient()
  const { success, error } = useToast()
  const [detalle,    setDetalle]    = useState<VentaResponse | null>(null)
  const [printing,   setPrinting]   = useState<number | null>(null)
  const [confirm,    setConfirm]    = useState<{ tipo: 'aprobar' | 'anular'; venta: VentaResponse } | null>(null)
  const [devolver,        setDevolver]        = useState<VentaResponse | null>(null)
  const [devResult,       setDevResult]       = useState<DevolucionResponse | null>(null)
  const [devOriginalVenta, setDevOriginalVenta] = useState<VentaResponse | null>(null)
  const [tab, setTab] = useState<'facturas' | 'devoluciones' | 'cotizaciones'>('facturas')
  const [formato, setFormato]         = useState<FormatoImpresion>(() => getFormato())
  const [cotizarVenta,    setCotizarVenta]    = useState<VentaResponse | null>(null)
  const [validezCot,      setValidezCot]      = useState(15)

  const { data: ventas, isLoading } = useQuery<VentaResponse[]>({
    queryKey: ['ventas', puedeVerTodasVentas],
    queryFn:  async () => puedeVerTodasVentas ? ventasApi.getAll() : ventasApi.misVentas(),
  })
  const listaVentas: VentaResponse[] = ventas ?? []

  const { data: devoluciones = [], isLoading: loadingDevs } = useQuery<DevolucionResponse[]>({
    queryKey: ['devoluciones', puedeVerTodasVentas],
    queryFn:  () => ventasApi.getDevoluciones(),
  })

  // Crédito del detalle activo (si aplica)
  const { data: creditosDetalle = [] } = useQuery({
    queryKey: ['creditos', 'cliente', detalle?.clienteId],
    queryFn:  () => creditosApi.porCliente(detalle!.clienteId!),
    enabled:  !!detalle?.clienteId && detalle.tipoPago === 'Credito',
  })
  const creditoDetalle = creditosDetalle.find(c => c.ventaId === detalle?.id) ?? null

  const aprobar = useMutation({
    mutationFn: (id: number) => ventasApi.aprobar(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ventas'] })
      success(`Venta #${data.id} aprobada y completada`)
      setConfirm(null)
      setDetalle(data)
    },
    onError: (e) => { error(errMsg(e)); setConfirm(null) },
  })

  const anular = useMutation({
    mutationFn: (id: number) => ventasApi.anular(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ventas'] })
      success('Venta anulada correctamente')
      setConfirm(null)
      setDetalle(null)
    },
    onError: (e) => { error(errMsg(e)); setConfirm(null) },
  })

  const devolverMut = useMutation({
    mutationFn: ({ id, motivo, tipo, items }: {
      id: number
      motivo: string
      tipo: 'Completa' | 'Parcial'
      items?: { detalleVentaId: number; cantidad: number }[]
    }) => ventasApi.devolver(id, { motivo, tipo, items }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ventas'] })
      qc.invalidateQueries({ queryKey: ['devoluciones'] })
      qc.invalidateQueries({ queryKey: ['ncf-proximo'] })
      setDevOriginalVenta(devolver)
      setDevolver(null)
      setDetalle(null)
      setDevResult(data)
    },
    onError: (e) => error(errMsg(e)),
  })

  const handlePrint = async (v: VentaResponse) => {
    setPrinting(v.id)
    try { await imprimirRecibo(v, comercio?.nombre, comercio?.slogan ?? undefined, comercio?.telefono ?? undefined, comercio?.rnc ?? undefined) }
    finally { setPrinting(null) }
  }

  const handleSetFormato = (f: FormatoImpresion) => {
    localStorage.setItem('pos_formato', f)
    setFormato(f)
  }

  const estadoCreditoColor: Record<string, 'green'|'yellow'|'red'|'gray'|'blue'> = {
    Pendiente: 'yellow', PagadoParcial: 'blue', Saldado: 'green', Vencido: 'red', Cancelado: 'gray',
  }

  const pendientes = listaVentas.filter(v => v.estado === 'Pendiente')

  // ── Cotizaciones ────────────────────────────────────────────────────────────
  const { data: cotizaciones = [], isLoading: loadingCots } = useQuery<CotizacionResponse[]>({
    queryKey: ['cotizaciones'],
    queryFn:  cotizacionesApi.getAll,
    refetchInterval: 60_000, // refrescar cada minuto para detectar vencidas
  })

  const cancelarCotMut = useMutation({
    mutationFn: (id: number) => cotizacionesApi.cancelar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
      success('Cotización cancelada')
    },
    onError: (e) => error(errMsg(e)),
  })

  const concretarCot = (cot: CotizacionResponse) => {
    // Pre-cargar el carrito con los ítems de la cotización
    const carrito = cot.detalles.map(d => ({
      productoId:      d.productoId,
      cantidad:        d.cantidad,
      nombre:          d.nombreProducto,
      precio:          d.precio,
      precioMinorista: d.precio,
      precioMayorista: undefined,
      esMedible:       false,
      unidadMedida:    d.unidadMedida,
    }))
    const cartGuardado = {
      carrito,
      descuento:          cot.descuento,
      tipoPago:           'Contado' as const,
      clienteId:          cot.clienteId,
      fechaVenc:          '',
      tipoComprobanteId:  undefined,
      ncfReservadoId:     undefined,
      ncfReservado:       undefined,
    }
    localStorage.setItem('pos_carrito_v1', JSON.stringify(cartGuardado))
    // Marcar como concretada en el backend (sin ventaId por ahora)
    cotizacionesApi.concretar(cot.id).catch(() => {})
    navigate('/ventas/nueva')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-2xl font-bold text-slate-800">Ventas</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Selector de formato de impresión */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
              <Printer size={12} className="inline mr-1 mb-0.5" />Formato:
            </span>
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {([
                { key: 'A4',   label: 'A4',   title: 'Impresora de papel carta / oficio' },
                { key: '80mm', label: '80mm',  title: 'Impresora térmica mediana (80 mm)' },
                { key: '58mm', label: '58mm',  title: 'Impresora térmica pequeña (58 mm)' },
              ] as { key: FormatoImpresion; label: string; title: string }[]).map(f => (
                <button
                  key={f.key}
                  title={f.title}
                  onClick={() => handleSetFormato(f.key)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    formato === f.key
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <Button icon={<Plus size={16} />} onClick={() => navigate('/ventas/nueva')}>
            Nueva venta
          </Button>
        </div>
      </div>

      {/* Banner de ventas pendientes de aprobación */}
      {puedeAprobarVentas && pendientes.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <CheckCircle size={18} className="text-amber-500 shrink-0" />
          <p className="text-amber-800">
            Tienes <span className="font-bold">{pendientes.length}</span> venta{pendientes.length > 1 ? 's' : ''} pendiente{pendientes.length > 1 ? 's' : ''} de aprobación.
            Revísalas y apruébalas para que queden registradas y puedan imprimirse.
          </p>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('facturas')}
          className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'facturas'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Receipt size={14} />
          Facturas
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'facturas' ? 'bg-slate-100' : 'bg-slate-200'}`}>
            {listaVentas.length}
          </span>
        </button>
        <button
          onClick={() => setTab('devoluciones')}
          className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'devoluciones'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileX size={14} />
          Devoluciones
          {devoluciones.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'devoluciones' ? 'bg-slate-100' : 'bg-orange-100 text-orange-700'}`}>
              {devoluciones.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('cotizaciones')}
          className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'cotizaciones'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText size={14} />
          Cotizaciones
          {cotizaciones.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'cotizaciones' ? 'bg-slate-100' : 'bg-blue-100 text-blue-700'}`}>
              {cotizaciones.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Tabla de facturas ─────────────────────────────────────────────── */}
      {tab === 'facturas' && (
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                {['#', 'Fecha', 'Usuario', 'Cliente', 'Tipo', 'Total', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Cargando...</td></tr>
              )}
              {listaVentas.map(v => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400 font-mono">#{v.id}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtFecha(v.fechaVenta)}</td>
                  <td className="px-4 py-3">{v.nombreUsuario}</td>
                  <td className="px-4 py-3">{v.nombreCliente ?? <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <Badge color={v.tipoPago === 'Contado' ? 'green' : 'blue'}>{v.tipoPago}</Badge>
                      {v.esMayorista && <Badge color="purple">Mayorista</Badge>}
                      {v.codigoComprobante && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                          <Receipt size={9} />
                          {v.codigoComprobante}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold">{fmt(v.total)}</td>
                  <td className="px-4 py-3">
                    <Badge color={estadoColor[v.estado]}>{v.estado}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" icon={<Eye size={14} />}
                        onClick={() => setDetalle(v)} />
                      {v.estado !== 'Pendiente' && (
                        <Button variant="ghost" size="sm" icon={<Printer size={14} />}
                          title="Imprimir recibo"
                          loading={printing === v.id}
                          onClick={() => handlePrint(v)} />
                      )}
                      {puedeEditarVentas && v.estado !== 'Cancelada' && (!isCajero || v.estado === 'Pendiente') && (
                        <Button variant="ghost" size="sm" icon={<Pencil size={14} />}
                          className="text-blue-500 hover:bg-blue-50"
                          title="Editar venta"
                          onClick={() => navigate(`/ventas/${v.id}/editar`)} />
                      )}
                      {puedeAprobarVentas && v.estado === 'Pendiente' && (
                        <Button variant="ghost" size="sm" icon={<CheckCircle size={14} />}
                          className="text-emerald-600 hover:bg-emerald-50"
                          title="Aprobar venta"
                          onClick={() => setConfirm({ tipo: 'aprobar', venta: v })} />
                      )}
                      {puedeAnularVentas && v.estado === 'Pendiente' && (
                        <Button variant="ghost" size="sm" icon={<XCircle size={14} />}
                          className="text-red-500 hover:bg-red-50"
                          title="Anular venta pendiente"
                          onClick={() => setConfirm({ tipo: 'anular', venta: v })} />
                      )}
                      {puedeAprobarVentas && v.estado === 'Completada' && (
                        <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />}
                          className="text-orange-500 hover:bg-orange-50"
                          title="Crear devolución"
                          onClick={() => setDevolver(v)} />
                      )}
                      {v.estado !== 'Cancelada' && v.detalles.length > 0 && (
                        <Button variant="ghost" size="sm" icon={<FileText size={14} />}
                          className="text-blue-500 hover:bg-blue-50"
                          title="Generar cotización"
                          onClick={() => { setCotizarVenta(v); setValidezCot(15) }} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && listaVentas.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No hay ventas registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      {/* ── Tabla de devoluciones ─────────────────────────────────────────── */}
      {tab === 'devoluciones' && (
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                {['#Dev', 'Factura original', 'Fecha', 'Cajero', 'Tipo', 'Total devuelto', 'NCF', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingDevs && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Cargando...</td></tr>
              )}
              {devoluciones.map(dev => {
                const ventaOrig = listaVentas.find(v => v.id === dev.ventaOriginalId)
                return (
                  <tr key={dev.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-400 font-mono">#{dev.id}</td>
                    <td className="px-4 py-3">
                      <button
                        className="text-indigo-600 hover:underline font-mono text-sm font-medium"
                        onClick={() => ventaOrig && setDetalle(ventaOrig)}
                        title="Ver factura original"
                      >
                        #{dev.ventaOriginalId}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtFecha(dev.fechaDevolucion)}</td>
                    <td className="px-4 py-3 text-slate-600">{dev.nombreUsuario}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        dev.tipo === 'Parcial'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {dev.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-orange-700 font-mono">
                      {fmt(dev.totalDevuelto)}
                    </td>
                    <td className="px-4 py-3">
                      {dev.ncf
                        ? <span className="font-mono text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded">{dev.ncf}</span>
                        : <span className="text-xs text-slate-400 italic">Pendiente</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={dev.estado === 'Completada' ? 'green' : 'yellow'}>
                        {dev.estado === 'PendienteComprobanteE' ? 'Pendiente e-CF' : dev.estado}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {ventaOrig && (
                          <Button variant="ghost" size="sm" icon={<Eye size={14} />}
                            title="Ver factura original"
                            onClick={() => setDetalle(ventaOrig)} />
                        )}
                        {dev.estado === 'Completada' && (
                          <Button
                            variant="ghost" size="sm"
                            icon={<Printer size={14} />}
                            className="text-orange-600 hover:bg-orange-50"
                            title="Imprimir nota de crédito"
                            onClick={() => imprimirDevolucion(
                              dev, ventaOrig ?? { ...dev, detalles: [], total: dev.totalDevuelto } as unknown as VentaResponse,
                              comercio?.nombre, comercio?.slogan ?? undefined,
                              comercio?.telefono ?? undefined, comercio?.rnc ?? undefined,
                            )}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!loadingDevs && devoluciones.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    No hay devoluciones registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      {/* ── Tabla de cotizaciones ─────────────────────────────────────────── */}
      {tab === 'cotizaciones' && (
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                {['#', 'Cliente', 'Creada', 'Vence', 'Días', 'Total', 'Cajero', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingCots && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Cargando…</td></tr>
              )}
              {cotizaciones.map(cot => {
                const urgente = cot.diasRestantes <= 2
                const proximo = cot.diasRestantes <= 5
                return (
                  <tr key={cot.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-400 font-mono">#{cot.id}</td>
                    <td className="px-4 py-3 font-medium">
                      {cot.nombreCliente ?? <span className="text-slate-300 italic text-xs">Sin cliente</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {fmtFecha(cot.fechaCreacion)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {new Date(cot.fechaVencimiento).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        urgente ? 'bg-red-100 text-red-700' :
                        proximo ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        <Clock size={10} />
                        {cot.diasRestantes}d
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-blue-700 font-mono">{fmt(cot.total)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{cot.nombreUsuario}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" icon={<Printer size={14} />}
                          title="Imprimir cotización"
                          className="text-blue-500 hover:bg-blue-50"
                          onClick={() => generarPdfDesdeCotizacion(cot, comercio)} />
                        <Button variant="ghost" size="sm" icon={<ShoppingBag size={14} />}
                          title="Concretar — cargar en nueva venta"
                          className="text-emerald-600 hover:bg-emerald-50"
                          onClick={() => concretarCot(cot)} />
                        <Button variant="ghost" size="sm" icon={<Ban size={14} />}
                          title="Cancelar cotización"
                          className="text-red-400 hover:bg-red-50"
                          loading={cancelarCotMut.isPending}
                          onClick={() => cancelarCotMut.mutate(cot.id)} />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!loadingCots && cotizaciones.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No hay cotizaciones vigentes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      {/* ── Modal de confirmación (aprobar / anular) ──────────────────────── */}
      {confirm && (
        <ConfirmModal
          tipo={confirm.tipo}
          venta={confirm.venta}
          loading={aprobar.isPending || anular.isPending}
          onConfirm={() => confirm.tipo === 'aprobar'
            ? aprobar.mutate(confirm.venta.id)
            : anular.mutate(confirm.venta.id)
          }
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── Modal devolución ─────────────────────────────────────────────── */}
      {devolver && (
        <DevolucionModal
          venta={devolver}
          loading={devolverMut.isPending}
          onConfirm={(motivo, tipo, items) =>
            devolverMut.mutate({ id: devolver.id, motivo, tipo, items })
          }
          onCancel={() => setDevolver(null)}
        />
      )}

      {/* ── Resultado de devolución ───────────────────────────────────────── */}
      {devResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center gap-3 px-6 pt-6 pb-4">
              <div className={`p-2.5 rounded-full ${devResult.estado === 'Completada' ? 'bg-green-100' : 'bg-amber-100'}`}>
                <RotateCcw size={22} className={devResult.estado === 'Completada' ? 'text-green-600' : 'text-amber-600'} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-base">
                  {devResult.estado === 'Completada' ? 'Devolución registrada' : 'Devolución pendiente'}
                </h3>
                <p className="text-xs text-slate-400">Factura original #{devResult.ventaOriginalId}</p>
              </div>
            </div>
            <div className="px-6 pb-4 space-y-3 text-sm">
              {devResult.estado === 'Completada' && devResult.ncf ? (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-green-700 font-medium">Nota de crédito emitida</p>
                    {devResult.tipo === 'Parcial' && (
                      <span className="text-[10px] font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Parcial</span>
                    )}
                  </div>
                  <p className="font-mono font-bold text-green-900 text-base">{devResult.ncf}</p>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-green-600">Comprobante {devResult.codigoComprobante} del pool</p>
                    <p className="text-sm font-bold text-orange-700">{fmt(devResult.totalDevuelto)}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                  <p className="text-xs text-amber-700 font-medium">Pendiente de comprobante electrónico</p>
                  <p className="text-xs text-amber-600">
                    La devolución fue registrada. El NCF electrónico se gestionará
                    cuando la integración con la API esté disponible.
                  </p>
                </div>
              )}
              {devResult.estado === 'Completada' && devOriginalVenta && (
                <button
                  onClick={() => imprimirDevolucion(
                    devResult, devOriginalVenta,
                    comercio?.nombre, comercio?.slogan ?? undefined,
                    comercio?.telefono ?? undefined, comercio?.rnc ?? undefined,
                  )}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors"
                >
                  <Printer size={14} /> Imprimir nota de crédito
                </button>
              )}
              <button onClick={() => { setDevResult(null); setDevOriginalVenta(null) }}
                className="w-full py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal cotización ─────────────────────────────────────────────── */}
      {cotizarVenta && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b">
              <div className="p-2.5 rounded-full bg-blue-100">
                <FileText size={20} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-base">Generar cotización</h3>
                <p className="text-xs text-slate-400">
                  Factura #{cotizarVenta.id}
                  {cotizarVenta.nombreCliente ? ` · ${cotizarVenta.nombreCliente}` : ''}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4 text-sm">
              {/* Resumen de ítems */}
              <div className="bg-slate-50 rounded-xl p-3 space-y-1 max-h-40 overflow-y-auto">
                {cotizarVenta.detalles.map(d => (
                  <div key={d.id} className="flex justify-between text-xs">
                    <span className="text-slate-600 truncate flex-1 mr-2">{d.nombreProducto}</span>
                    <span className="font-medium text-slate-800 whitespace-nowrap">
                      {d.cantidad} {d.unidadMedida} · {fmt(d.subtotalConImpuesto)}
                    </span>
                  </div>
                ))}
                {cotizarVenta.descuento > 0 && (
                  <div className="flex justify-between text-xs border-t pt-1 text-green-600 font-medium">
                    <span>Descuento</span><span>-{fmt(cotizarVenta.descuento)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs border-t pt-1 font-bold">
                  <span>TOTAL</span>
                  <span className="text-blue-700">{fmt(cotizarVenta.total)}</span>
                </div>
              </div>

              {/* Validez */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Validez de la cotización
                </label>
                <div className="flex gap-2">
                  {[7, 15, 30].map(d => (
                    <button key={d} onClick={() => setValidezCot(d)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        validezCot === d
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-slate-300 text-slate-600 hover:border-blue-400'
                      }`}
                    >{d} días</button>
                  ))}
                  <input type="number" min="1" max="365" value={validezCot}
                    onChange={e => setValidezCot(Math.max(1, parseInt(e.target.value) || 15))}
                    className="w-20 px-2 py-1.5 text-xs border border-slate-300 rounded-lg text-center outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Se genera un PDF con los precios actuales sin registrar ninguna operación.
              </p>
            </div>

            <div className="flex gap-2 px-6 pb-6">
              <button onClick={() => setCotizarVenta(null)}
                className="flex-1 px-4 py-2 text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => {
                  imprimirCotizacionVenta(
                    cotizarVenta, validezCot,
                    comercio?.nombre ?? 'POS Sistema',
                    comercio?.slogan   ?? undefined,
                    comercio?.telefono ?? undefined,
                    comercio?.rnc      ?? undefined,
                  )
                  setCotizarVenta(null)
                }}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <FileText size={14} /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── Modal detalle ─────────────────────────────────────────────────── */}
      {detalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="font-semibold text-slate-800">Venta #{detalle.id}</h3>
              <div className="flex items-center gap-2">
                {detalle.estado !== 'Pendiente' && (
                  <button
                    onClick={() => handlePrint(detalle)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                  >
                    <Printer size={13} />
                    {printing === detalle.id ? 'Generando…' : 'Imprimir'}
                  </button>
                )}
                {puedeAprobarVentas && detalle.estado === 'Pendiente' && (
                  <button
                    onClick={() => setConfirm({ tipo: 'aprobar', venta: detalle })}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                  >
                    <CheckCircle size={13} /> Aprobar
                  </button>
                )}
                {puedeAnularVentas && detalle.estado === 'Pendiente' && (
                  <button
                    onClick={() => setConfirm({ tipo: 'anular', venta: detalle })}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                  >
                    <XCircle size={13} /> Anular
                  </button>
                )}
                {puedeAprobarVentas && detalle.estado === 'Completada' && (
                  <button
                    onClick={() => { setDetalle(null); setDevolver(detalle) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                  >
                    <RotateCcw size={13} /> Devolver
                  </button>
                )}
                {detalle.estado !== 'Cancelada' && (
                  <button
                    onClick={() => { setDetalle(null); setCotizarVenta(detalle); setValidezCot(15) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                  >
                    <FileText size={13} /> Cotizar
                  </button>
                )}
                <button onClick={() => setDetalle(null)}
                  className="text-slate-400 hover:text-slate-600 ml-1 text-lg leading-none">✕</button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4 text-sm">
              {/* Info general */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-slate-600">
                <span className="text-slate-400">Fecha</span>
                <span className="font-medium">{fmtFecha(detalle.fechaVenta)}</span>
                <span className="text-slate-400">Cajero</span>
                <span className="font-medium">{detalle.nombreUsuario}</span>
                <span className="text-slate-400">Tipo pago</span>
                <span><Badge color={detalle.tipoPago === 'Contado' ? 'green' : 'blue'}>{detalle.tipoPago}</Badge></span>
                <span className="text-slate-400">Estado</span>
                <span><Badge color={estadoColor[detalle.estado]}>{detalle.estado}</Badge></span>
                {detalle.esMayorista && (
                  <>
                    <span className="text-slate-400">Tipo venta</span>
                    <span><Badge color="purple">Mayorista</Badge></span>
                  </>
                )}
                {detalle.nombreCliente && (
                  <>
                    <span className="text-slate-400">Cliente</span>
                    <span className="font-medium">{detalle.nombreCliente}</span>
                  </>
                )}
                {detalle.cedulaCliente && (
                  <>
                    <span className="text-slate-400">Cédula/RNC</span>
                    <span className="font-mono">{detalle.cedulaCliente}</span>
                  </>
                )}
              </div>

              {/* Comprobante fiscal */}
              {(detalle.codigoComprobante || detalle.ncf) && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Receipt size={14} className="text-indigo-600" />
                    <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Comprobante Fiscal</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {detalle.codigoComprobante && (
                      <>
                        <span className="text-slate-500">Tipo</span>
                        <span className="font-medium font-mono">{detalle.codigoComprobante} — {detalle.nombreComprobante}</span>
                      </>
                    )}
                    {detalle.ncf && (
                      <>
                        <span className="text-slate-500">NCF</span>
                        <span className="font-mono font-medium flex items-center gap-1">
                          {detalle.ncf}
                          {detalle.ncfValidado && (
                            <span className="text-emerald-600 text-[10px] font-sans">✓</span>
                          )}
                        </span>
                      </>
                    )}
                    {!detalle.aplicaItbisComprobante && (
                      <>
                        <span className="text-slate-500">ITBIS</span>
                        <span className="text-amber-600 font-medium">Exento</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Productos */}
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      {['Producto', 'Cant.', 'Precio', 'ITBIS', 'Subtotal'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detalle.detalles.map(d => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium">{d.nombreProducto}</td>
                        <td className="px-3 py-2">{d.cantidad} {d.unidadMedida}</td>
                        <td className="px-3 py-2">{fmt(d.precioConImpuesto)}</td>
                        <td className="px-3 py-2 text-blue-600">
                          {d.aplicaImpuesto ? fmt(d.montoImpuesto * d.cantidad) : '—'}
                        </td>
                        <td className="px-3 py-2 font-semibold">{fmt(d.subtotalConImpuesto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totales */}
              <div className="space-y-1.5 text-right border-t pt-3">
                <p className="text-slate-500">Base (sin ITBIS): <span className="font-medium text-slate-700">{fmt(detalle.subtotalBase)}</span></p>
                <p className="text-slate-500">ITBIS: <span className="font-medium text-blue-600">{fmt(detalle.totalImpuesto)}</span></p>
                {detalle.descuento > 0 && (
                  <p className="text-slate-500">Descuento: <span className="font-medium text-green-600">-{fmt(detalle.descuento)}</span></p>
                )}
                <p className="text-lg font-bold text-slate-800">Total: {fmt(detalle.total)}</p>
              </div>

              {/* Datos del crédito */}
              {detalle.tipoPago === 'Credito' && creditoDetalle && (
                <div className={`rounded-xl border p-4 space-y-2 text-sm ${
                  creditoDetalle.estado === 'Saldado'  ? 'bg-green-50 border-green-200' :
                  creditoDetalle.estado === 'Vencido'  ? 'bg-red-50   border-red-200'   :
                  'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-700">Información del crédito</p>
                    <Badge color={estadoCreditoColor[creditoDetalle.estado]}>{creditoDetalle.estado}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-slate-500">Monto total</span>
                    <span className="font-medium text-right">{fmt(creditoDetalle.montoTotal)}</span>
                    <span className="text-slate-500">Pagado</span>
                    <span className="font-medium text-green-700 text-right">{fmt(creditoDetalle.montoPagado)}</span>
                    <span className="text-slate-500 font-semibold">Saldo pendiente</span>
                    <span className={`font-bold text-right ${creditoDetalle.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmt(creditoDetalle.saldo)}
                    </span>
                    {creditoDetalle.fechaVencimiento && (
                      <>
                        <span className="text-slate-500">Fecha límite</span>
                        <span className={`font-medium text-right ${creditoDetalle.estado === 'Vencido' ? 'text-red-600' : 'text-slate-700'}`}>
                          {fmtDate(creditoDetalle.fechaVencimiento.slice(0, 10))}
                        </span>
                      </>
                    )}
                  </div>
                  {creditoDetalle.estado === 'Vencido' && (
                    <p className="text-xs font-semibold text-red-600 border-t border-red-200 pt-2 mt-1">
                      Este crédito está vencido
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
