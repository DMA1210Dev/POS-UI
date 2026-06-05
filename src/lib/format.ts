import type { EstadoCredito, EstadoVenta, MetodoPago } from '../types'

export const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)

export const fmtFecha = (d: string) =>
  new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

export const fmtDetalle = (d: string) =>
  new Date(d).toLocaleString('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

export const fmtEstado = (estado: string) =>
  estado.replace(/([a-z])([A-Z])/g, '$1 $2')

type BadgeColor = 'yellow' | 'blue' | 'green' | 'red' | 'gray' | 'purple' | 'orange'

export const estadoCreditoColor: Record<EstadoCredito, BadgeColor> = {
  Pendiente: 'yellow',
  PagadoParcial: 'blue',
  Saldado: 'green',
  Vencido: 'red',
  Cancelado: 'gray',
}

export const estadoVentaColor: Record<EstadoVenta, BadgeColor> = {
  Pendiente: 'yellow',
  Completada: 'green',
  Cancelada: 'red',
  Devuelta: 'purple',
}

export const metodoPagoLabel: Record<MetodoPago, string> = {
  Efectivo: 'Efectivo',
  Tarjeta: 'Tarjeta de crédito/débito',
  Transferencia: 'Transferencia bancaria',
  Cheque: 'Cheque',
  Otro: 'Otro',
}

export const METODOS_PAGO: MetodoPago[] = ['Efectivo', 'Tarjeta', 'Transferencia', 'Cheque', 'Otro']
