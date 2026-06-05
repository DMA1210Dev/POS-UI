import jsPDF from 'jspdf'
import { fmt, fmtFecha, fmtDetalle, metodoPagoLabel } from './format'
import type { MetodoPago } from '../types'

type Doc = jsPDF

export function crearReciboBase(comercioNombre: string, titulo: string): { doc: Doc; y: number } {
  const doc = new jsPDF({ unit: 'mm', format: [80, 200] })
  const W = 80; const ML = 4; const MR = 4
  let y = 5

  const center = (txt: string, yy: number, sz = 9) => {
    doc.setFontSize(sz); doc.text(txt, W / 2, yy, { align: 'center' }); return yy + sz * 0.45
  }

  doc.setFont('helvetica', 'bold')
  y = center(comercioNombre, y, 11) + 2
  doc.setFont('helvetica', 'normal')
  y = center(titulo, y, 9) + 1
  y = center(new Date().toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }), y, 7.5) + 1
  y = hline(doc, ML, MR, W, y)

  return { doc, y: y + 1 }
}

export function hline(doc: Doc, ML: number, MR: number, W: number, yy: number) {
  doc.setDrawColor(180); doc.line(ML, yy, W - MR, yy); return yy + 3
}

export function row(doc: Doc, ML: number, MR: number, W: number, lbl: string, val: string, yy: number, boldVal = false, sz = 8) {
  doc.setFontSize(sz); doc.setFont('helvetica', 'normal'); doc.text(lbl, ML, yy)
  doc.setFont('helvetica', boldVal ? 'bold' : 'normal'); doc.text(val, W - MR, yy, { align: 'right' })
  return yy + 4
}

export function finalizarRecibo(doc: Doc) {
  doc.autoPrint()
  window.open(URL.createObjectURL(doc.output('blob')), '_blank')
}

export function imprimirReciboPagoCredito(
  comercioNombre: string,
  clienteNombre: string,
  facturas: { ventaId: number; monto: number; saldoRestante: number; fechaVenta?: string }[],
  totalPagado: number,
  metodoPago: MetodoPago,
  observacion: string | undefined,
  nombreUsuario: string,
) {
  const { doc, y: y0 } = crearReciboBase(comercioNombre, 'RECIBO DE COBRO')
  const W = 80; const ML = 4; const MR = 4
  let y = y0

  doc.setFontSize(8); doc.setFont('helvetica', 'bold')
  doc.text('CLIENTE:', ML, y); y += 4
  doc.setFont('helvetica', 'normal')
  doc.text(clienteNombre, ML, y); y += 5
  y = hline(doc, ML, MR, W, y)

  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
  doc.text('DETALLE DE FACTURAS PAGADAS', ML, y); y += 4

  for (const fp of facturas) {
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
    doc.text(`Factura #${fp.ventaId}`, ML, y); y += 3.5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    if (fp.fechaVenta) { doc.text(`Fecha: ${fmtFecha(fp.fechaVenta)}`, ML, y); y += 3 }
    doc.setFontSize(7.5)
    y = row(doc, ML, MR, W, 'Monto pagado:', fmt(fp.monto), y, true)
    y = row(doc, ML, MR, W, 'Saldo restante:', fmt(fp.saldoRestante), y)
    doc.setDrawColor(220); doc.line(ML + 2, y, W - MR - 2, y); y += 2.5
  }

  y = hline(doc, ML, MR, W, y)
  doc.setFontSize(8)
  y = row(doc, ML, MR, W, 'Total pagado:', fmt(totalPagado), y, true)
  y = row(doc, ML, MR, W, 'Método:', metodoPagoLabel[metodoPago], y)
  y = hline(doc, ML, MR, W, y)

  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
  doc.text('INFORMACIÓN DEL PAGO', ML, y); y += 4
  doc.setFont('helvetica', 'normal')
  y = row(doc, ML, MR, W, 'Fecha:', fmtDetalle(new Date().toISOString()), y)
  y = row(doc, ML, MR, W, 'Recibido por:', nombreUsuario, y)
  if (observacion) {
    doc.setFontSize(7); doc.setFont('helvetica', 'italic')
    const lines = doc.splitTextToSize(`"${observacion}"`, W - ML - MR)
    doc.text(lines, ML, y); y += lines.length * 3.5
  }

  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal')
  doc.text('¡Gracias por su pago!', W / 2, y + 3, { align: 'center' })

  finalizarRecibo(doc)
}
