import { Lock, WifiOff, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { comprobantesApi } from '../../api'

interface Props {
  tipoComprobanteId?: number
  onChange: (tipoId: number | undefined) => void
  /** NCF ya reservado para este carrito (tipo B). Muestra confirmado en lugar de la vista previa. */
  ncfReservado?: string
  /** Indica que se está procesando la reserva (muestra spinner). */
  reservando?: boolean
  /** Bloquea el selector — el comprobante viene del cliente o es el B02 por defecto. */
  disabled?: boolean
  /** Texto del badge cuando el selector está bloqueado. Por defecto "Del cliente". */
  disabledLabel?: string
  /** Si false (defecto), oculta la opción "Sin comprobante". */
  permitirSinComprobante?: boolean
}

/**
 * Selector de comprobante con lógica diferenciada por tipo:
 *
 * Tipo B (B01, B02, B04…)
 *   → Al seleccionar, el padre llama a la API y reserva el NCF en el pool.
 *   → Si `ncfReservado` está presente: muestra el NCF confirmado (verde/índigo).
 *   → Si no: muestra vista previa del próximo disponible (sin reservar).
 *
 * Tipo E (E31, E32…)
 *   → NCF no se genera hasta que la venta sea aprobada (API externa).
 *   → Solo se muestra un aviso informativo.
 *
 * Otros / Sin comprobante
 *   → Solo el selector de tipo, sin campo NCF.
 */
export function ComprobanteSelector({ tipoComprobanteId, onChange, ncfReservado, reservando, disabled, disabledLabel = 'Del cliente', permitirSinComprobante = false }: Props) {
  const { data: todosLosTipos = [], isLoading } = useQuery({
    queryKey: ['comprobantes-activos'],
    queryFn: () => comprobantesApi.getAll(true),
    staleTime: 5 * 60 * 1000,
  })

  // B04 (Nota de Crédito) es exclusivo de devoluciones — nunca aparece en ventas
  const tipos = todosLosTipos.filter(t => t.codigo !== 'B04')

  const tipoSeleccionado = tipos.find(t => t.id === tipoComprobanteId)
  const esTipoB = tipoSeleccionado?.codigo.startsWith('B') ?? false
  const esTipoE = tipoSeleccionado?.codigo.startsWith('E') ?? false

  // Vista previa del próximo NCF (solo cuando NO hay uno ya reservado)
  const { data: proximoNcf } = useQuery({
    queryKey: ['ncf-proximo', tipoComprobanteId],
    queryFn: () => comprobantesApi.ncfProximo(tipoComprobanteId!),
    enabled: esTipoB && !!tipoComprobanteId && !ncfReservado,
    staleTime: 10_000,
  })

  return (
    <div className="space-y-2">
      {/* Selector de tipo */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
          Tipo de comprobante
          {disabled && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
              <Lock size={9} /> {disabledLabel}
            </span>
          )}
        </label>
        <select
          value={tipoComprobanteId ?? ''}
          onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)}
          disabled={isLoading || disabled}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-50"
        >
          {permitirSinComprobante && <option value="">— Sin comprobante —</option>}
          {tipos.map(t => (
            <option key={t.id} value={t.id}>
              {t.codigo} — {t.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Tipo B — reservando (spinner) */}
      {esTipoB && tipoComprobanteId && reservando && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5 flex items-center gap-2 text-xs text-indigo-600">
          <Loader2 size={13} className="animate-spin shrink-0" />
          Reservando NCF…
        </div>
      )}

      {/* Tipo B — NCF ya reservado para este carrito (confirmado) */}
      {esTipoB && tipoComprobanteId && ncfReservado && !reservando && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
              <Lock size={11} />
              NCF reservado para este carrito
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              Confirmado
            </span>
          </div>
          <div className="font-mono text-sm font-bold text-emerald-900 tracking-wider">
            {ncfReservado}
          </div>
          <p className="text-[10px] text-emerald-600">
            Este NCF está separado para ti. Se activa al aprobar la factura.
          </p>
        </div>
      )}

      {/* Tipo B — vista previa (sin reserva activa) */}
      {esTipoB && tipoComprobanteId && !ncfReservado && !reservando && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-700 flex items-center gap-1.5">
              <Lock size={11} />
              NCF asignado automáticamente
            </span>
            {proximoNcf && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                proximoNcf.disponibles > 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {proximoNcf.disponibles > 0
                  ? `${proximoNcf.disponibles} disponibles`
                  : 'Sin NCF disponibles'}
              </span>
            )}
          </div>

          {proximoNcf?.ncf ? (
            <div className="font-mono text-sm font-bold text-indigo-900 tracking-wider">
              {proximoNcf.ncf}
            </div>
          ) : proximoNcf !== undefined ? (
            <div className="text-xs text-red-600 font-medium">
              No hay NCF disponibles para {tipoSeleccionado?.codigo}.
              Carga secuencias en Configuración → Comprobantes.
            </div>
          ) : null}

          <p className="text-[10px] text-indigo-500">
            El NCF se reserva al guardar y se activa al aprobar la factura.
          </p>
        </div>
      )}

      {/* Tipo E: aviso de asignación diferida */}
      {esTipoE && tipoComprobanteId && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <WifiOff size={11} />
            Comprobante electrónico (e-CF)
          </div>
          <p className="text-[10px] text-amber-600">
            El número de comprobante se obtendrá al confirmar la venta, consultando con la DGII.
          </p>
        </div>
      )}
    </div>
  )
}
