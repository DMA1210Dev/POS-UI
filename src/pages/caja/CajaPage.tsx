import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Lock, Unlock, DollarSign, TrendingUp, TrendingDown,
  Clock, Receipt, CheckCircle2, ChevronDown, ChevronUp,
  Calendar, User, Users, ShieldCheck, ShieldOff, Shield,
} from 'lucide-react'
import { cajaApi } from '../../api'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { useToast, errMsg } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useComercio } from '../../context/ComercioContext'
import type { CajaSessionResponse } from '../../types'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

const fmtDuracion = (desde: string, hasta?: string) => {
  const ini = new Date(desde).getTime()
  const fin = hasta ? new Date(hasta).getTime() : Date.now()
  const mins = Math.floor((fin - ini) / 60000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}min`
}

// ── Badge de validación ───────────────────────────────────────────────────────
function ValidacionBadge({ valor }: { valor?: boolean | null }) {
  if (valor === true)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
        <ShieldCheck size={11} /> Validación activa
      </span>
    )
  if (valor === false)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        <ShieldOff size={11} /> Validación desactivada
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
      <Shield size={11} /> Sin configurar
    </span>
  )
}

// ── Modal toggle validación de facturas ───────────────────────────────────────
function ValidarModal({
  sesion,
  onClose,
  onSaved,
}: {
  sesion: CajaSessionResponse
  onClose: () => void
  onSaved: (updated: CajaSessionResponse) => void
}) {
  const { success, error } = useToast()
  const [obs, setObs] = useState('')
  // si ya está activa → la acción es desactivar, y viceversa
  const activarAhora = sesion.validacionAdmin !== true

  const validar = useMutation({
    mutationFn: () =>
      cajaApi.validar(sesion.id, {
        valida: activarAhora,
        observacion: obs.trim() || undefined,
      }),
    onSuccess: (data) => {
      success(
        activarAhora
          ? 'Validación de facturas activada'
          : 'Validación de facturas desactivada'
      )
      onSaved(data)
    },
    onError: (e) => error(errMsg(e)),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            {activarAhora
              ? <ShieldCheck size={18} className="text-emerald-600" />
              : <ShieldOff   size={18} className="text-red-500" />}
            <h3 className="font-semibold text-slate-800">
              {activarAhora ? 'Activar' : 'Desactivar'} validación de facturas
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Cajero / sesión */}
          <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between text-slate-600">
              <span className="text-slate-400">Cajero</span>
              <span className="font-medium">{sesion.nombreUsuario}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span className="text-slate-400">Apertura</span>
              <span>{fmtFecha(sesion.fechaApertura)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span className="text-slate-400">Estado actual</span>
              <ValidacionBadge valor={sesion.validacionAdmin} />
            </div>
          </div>

          {/* Si ya había alguien que la configuró */}
          {sesion.nombreValidadoPor && sesion.fechaValidacion && (
            <p className="text-xs text-slate-400 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Última modificación por <span className="font-medium text-slate-600">{sesion.nombreValidadoPor}</span>{' '}
              el {fmtFecha(sesion.fechaValidacion)}
              {sesion.observacionValidacion && (
                <span className="block mt-1 italic">"{sesion.observacionValidacion}"</span>
              )}
            </p>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Observación (opcional)
            </label>
            <textarea
              rows={2}
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder={activarAhora
                ? 'Ej: Se activa para turno de tarde'
                : 'Ej: No se requiere validación este turno'}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1 justify-center" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className={`flex-1 justify-center ${
                activarAhora
                  ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600'
                  : 'bg-red-600 hover:bg-red-700 border-red-600'
              }`}
              loading={validar.isPending}
              onClick={() => validar.mutate()}
            >
              {activarAhora ? 'Activar' : 'Desactivar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal apertura ────────────────────────────────────────────────────────────
function AbrirCajaModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { success, error } = useToast()
  const [monto, setMonto]  = useState('')
  const [obs,   setObs]    = useState('')

  const abrir = useMutation({
    mutationFn: () => cajaApi.abrir({
      montoApertura: parseFloat(monto) || 0,
      observaciones: obs.trim() || undefined,
    }),
    onSuccess: () => { success('Caja abierta correctamente'); onSaved() },
    onError:   (e) => error(errMsg(e)),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Unlock size={18} className="text-emerald-600" />
            <h3 className="font-semibold text-slate-800">Abrir caja</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Fondo inicial (RD$) <span className="text-red-500">*</span>
            </label>
            <input
              type="number" min="0" step="0.01"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-emerald-500 text-right font-mono text-lg"
              autoFocus
            />
            <p className="text-xs text-slate-400 mt-1">
              Efectivo entregado al cajero para dar cambio al inicio del turno.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Observaciones (opcional)</label>
            <textarea
              rows={2} value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Ej: Turno de la mañana"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-emerald-500 resize-none"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1 justify-center" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1 justify-center bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
              loading={abrir.isPending}
              disabled={!monto || parseFloat(monto) < 0}
              onClick={() => abrir.mutate()}
            >
              Abrir caja
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal cierre ──────────────────────────────────────────────────────────────
function CerrarCajaModal({
  sesion, onClose, onSaved,
}: { sesion: CajaSessionResponse; onClose: () => void; onSaved: () => void }) {
  const { success, error } = useToast()
  const [monto, setMonto]  = useState('')
  const [obs,   setObs]    = useState('')

  const montoNum = parseFloat(monto) || 0

  const cerrar = useMutation({
    mutationFn: () => cajaApi.cerrar(sesion.id, {
      montoContado:  montoNum,
      observaciones: obs.trim() || undefined,
    }),
    onSuccess: () => { success('Caja cerrada correctamente'); onSaved() },
    onError:   (e) => error(errMsg(e)),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-red-500" />
            <h3 className="font-semibold text-slate-800">Cerrar caja</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Resumen del turno */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <p className="font-medium text-slate-700 text-xs uppercase tracking-wide mb-2">Resumen del turno</p>
            <div className="flex justify-between text-slate-600">
              <span>Fondo inicial</span>
              <span className="font-mono">{fmt(sesion.montoApertura)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Apertura</span>
              <span>{fmtFecha(sesion.fechaApertura)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Duración</span>
              <span>{fmtDuracion(sesion.fechaApertura)}</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Efectivo contado en caja (RD$) <span className="text-red-500">*</span>
            </label>
            <input
              type="number" min="0" step="0.01"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-right font-mono text-lg"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Observaciones (opcional)</label>
            <textarea
              rows={2} value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Ej: Se encontró billete falso, etc."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <p className="text-xs text-slate-400">
            El sistema calculará automáticamente el total de ventas del turno y la diferencia al cerrar.
          </p>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1 justify-center" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1 justify-center bg-red-600 hover:bg-red-700 border-red-600"
              loading={cerrar.isPending}
              disabled={!monto}
              onClick={() => cerrar.mutate()}
            >
              Cerrar caja
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de sesión cerrada (historial) ─────────────────────────────────────
function TarjetaSesion({ sesion }: { sesion: CajaSessionResponse }) {
  const [expandida, setExpandida] = useState(false)
  const diferencia = sesion.diferencia ?? 0
  const ok         = Math.abs(diferencia) < 0.01

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
        onClick={() => setExpandida(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${sesion.estado === 'Abierta' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          <div>
            <p className="text-sm font-medium text-slate-800">{sesion.nombreUsuario}</p>
            <p className="text-xs text-slate-400">{fmtFecha(sesion.fechaApertura)}</p>
          </div>
          <Badge color={sesion.estado === 'Abierta' ? 'green' : 'gray'}>{sesion.estado}</Badge>
          {sesion.validacionAdmin != null && (
            <ValidacionBadge valor={sesion.validacionAdmin} />
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-800">{fmt(sesion.totalGeneral ?? 0)}</p>
            <p className="text-xs text-slate-400">{sesion.totalFacturas ?? 0} facturas</p>
          </div>
          {sesion.estado === 'Cerrada' && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              ok ? 'bg-emerald-100 text-emerald-700' :
              diferencia > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
            }`}>
              {ok ? '✓ Cuadrado' : diferencia > 0 ? `+${fmt(diferencia)}` : fmt(diferencia)}
            </span>
          )}
          {expandida ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {expandida && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-400">Fondo inicial</p>
            <p className="font-mono font-semibold text-slate-700">{fmt(sesion.montoApertura)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Ventas efectivo</p>
            <p className="font-mono font-semibold text-slate-700">{fmt(sesion.totalVentasContado ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Ventas crédito</p>
            <p className="font-mono font-semibold text-slate-700">{fmt(sesion.totalVentasCredito ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Monto esperado</p>
            <p className="font-mono font-semibold text-slate-700">{fmt(sesion.montoEsperado ?? 0)}</p>
          </div>
          {sesion.estado === 'Cerrada' && (
            <>
              <div>
                <p className="text-xs text-slate-400">Contado por cajero</p>
                <p className="font-mono font-semibold text-slate-700">{fmt(sesion.montoContado ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Diferencia</p>
                <p className={`font-mono font-bold ${ok ? 'text-emerald-600' : diferencia > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {ok ? '—' : fmt(diferencia)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Duración</p>
                <p className="font-semibold text-slate-700">{fmtDuracion(sesion.fechaApertura, sesion.fechaCierre)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Cierre</p>
                <p className="font-semibold text-slate-700">{sesion.fechaCierre ? fmtFecha(sesion.fechaCierre) : '—'}</p>
              </div>
            </>
          )}
          {sesion.observacionesApertura && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs text-slate-400">Obs. apertura</p>
              <p className="text-sm text-slate-600">{sesion.observacionesApertura}</p>
            </div>
          )}
          {sesion.observacionesCierre && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs text-slate-400">Obs. cierre</p>
              <p className="text-sm text-slate-600">{sesion.observacionesCierre}</p>
            </div>
          )}
          {/* Validación de facturas */}
          {sesion.validacionAdmin != null && (
            <div className="col-span-2 sm:col-span-4 border-t border-slate-200 pt-3 mt-1">
              <p className="text-xs text-slate-400 mb-1">Validación de facturas</p>
              <div className="flex flex-wrap items-center gap-3">
                <ValidacionBadge valor={sesion.validacionAdmin} />
                {sesion.nombreValidadoPor && (
                  <span className="text-xs text-slate-500">
                    por <span className="font-medium text-slate-700">{sesion.nombreValidadoPor}</span>
                    {sesion.fechaValidacion && <> · {fmtFecha(sesion.fechaValidacion)}</>}
                  </span>
                )}
                {sesion.observacionValidacion && (
                  <span className="text-xs italic text-slate-400">"{sesion.observacionValidacion}"</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Panel de sesión activa ────────────────────────────────────────────────────
function SesionActivaPanel({
  sesion,
  onCerrar,
  onValidar,
  esAdminOGerente,
}: {
  sesion: CajaSessionResponse
  onCerrar: () => void
  onValidar: () => void
  esAdminOGerente: boolean
}) {
  const stats = [
    { label: 'Fondo inicial',  value: fmt(sesion.montoApertura),          icon: <DollarSign size={18} className="text-slate-500" /> },
    { label: 'Apertura',       value: fmtFecha(sesion.fechaApertura),     icon: <Clock      size={18} className="text-slate-500" /> },
    { label: 'Duración',       value: fmtDuracion(sesion.fechaApertura),  icon: <Calendar   size={18} className="text-slate-500" /> },
    { label: 'Cajero',         value: sesion.nombreUsuario,               icon: <User       size={18} className="text-slate-500" /> },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-semibold text-slate-700">Sesión en curso</h3>
          </div>
          <Badge color="green">Abierta</Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(s => (
            <div key={s.label} className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
              {s.icon}
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">{s.label}</p>
                <p className="text-sm font-semibold text-slate-800">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {sesion.observacionesApertura && (
          <p className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {sesion.observacionesApertura}
          </p>
        )}

        {/* ── Validación de facturas ─────────────────────────────────────────── */}
        {esAdminOGerente && (
          <div className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <Shield size={18} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-700">Validación de facturas</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <ValidacionBadge valor={sesion.validacionAdmin} />
                  {sesion.nombreValidadoPor && sesion.fechaValidacion && (
                    <span className="text-[11px] text-slate-400">
                      por {sesion.nombreValidadoPor} · {fmtFecha(sesion.fechaValidacion)}
                    </span>
                  )}
                </div>
                {sesion.observacionValidacion && (
                  <p className="text-[11px] italic text-slate-400 mt-0.5">
                    "{sesion.observacionValidacion}"
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="secondary"
              icon={sesion.validacionAdmin === true
                ? <ShieldOff size={14} className="text-red-500" />
                : <ShieldCheck size={14} className="text-emerald-600" />}
              onClick={onValidar}
            >
              {sesion.validacionAdmin === true ? 'Desactivar' : 'Activar'}
            </Button>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button
            icon={<Lock size={15} />}
            className="bg-red-600 hover:bg-red-700 border-red-600"
            onClick={onCerrar}
          >
            Cerrar caja
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ── Resumen de cierre ─────────────────────────────────────────────────────────
function ResumenCierre({ sesion }: { sesion: CajaSessionResponse }) {
  const diferencia = sesion.diferencia ?? 0
  const ok         = Math.abs(diferencia) < 0.01
  const sobrante   = diferencia > 0
  const faltante   = diferencia < 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">Último cierre</h3>
          <Badge color="gray">Cerrada</Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Resultado principal */}
        <div className={`rounded-xl p-4 flex items-center gap-4 ${
          ok ? 'bg-emerald-50 border border-emerald-200' :
          sobrante ? 'bg-blue-50 border border-blue-200' :
          'bg-red-50 border border-red-200'
        }`}>
          {ok
            ? <CheckCircle2 size={32} className="text-emerald-500 shrink-0" />
            : faltante
              ? <TrendingDown size={32} className="text-red-500 shrink-0" />
              : <TrendingUp   size={32} className="text-blue-500 shrink-0" />
          }
          <div>
            <p className={`text-lg font-bold ${ok ? 'text-emerald-700' : faltante ? 'text-red-700' : 'text-blue-700'}`}>
              {ok ? 'Cuadre exacto' : faltante ? `Faltante: ${fmt(Math.abs(diferencia))}` : `Sobrante: ${fmt(diferencia)}`}
            </p>
            <p className={`text-sm ${ok ? 'text-emerald-600' : faltante ? 'text-red-600' : 'text-blue-600'}`}>
              {ok
                ? 'El cajero entregó exactamente lo esperado.'
                : faltante
                  ? 'El cajero entregó menos de lo esperado.'
                  : 'El cajero entregó más de lo esperado.'}
            </p>
          </div>
        </div>

        {/* Desglose */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {[
            { label: 'Fondo inicial',     val: fmt(sesion.montoApertura),          color: 'text-slate-700' },
            { label: 'Ventas efectivo',   val: fmt(sesion.totalVentasContado ?? 0), color: 'text-emerald-700' },
            { label: 'Ventas crédito',    val: fmt(sesion.totalVentasCredito ?? 0), color: 'text-blue-700' },
            { label: 'Total ventas',      val: fmt(sesion.totalGeneral ?? 0),        color: 'text-slate-700' },
            { label: 'Monto esperado',    val: fmt(sesion.montoEsperado ?? 0),       color: 'text-slate-700' },
            { label: 'Contado por cajero', val: fmt(sesion.montoContado ?? 0),      color: 'text-slate-700' },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className={`font-mono font-bold ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span className="flex items-center gap-1">
            <Receipt size={12} /> {sesion.totalFacturas ?? 0} facturas en el turno
          </span>
          <span>{sesion.fechaCierre ? fmtFecha(sesion.fechaCierre) : ''}</span>
        </div>

        {/* Validación */}
        {sesion.validacionAdmin != null && (
          <div className="border-t border-slate-100 pt-3 flex items-center gap-3 text-sm">
            <ValidacionBadge valor={sesion.validacionAdmin} />
            {sesion.nombreValidadoPor && (
              <span className="text-xs text-slate-400">
                por <span className="font-medium text-slate-600">{sesion.nombreValidadoPor}</span>
                {sesion.fechaValidacion && <> · {fmtFecha(sesion.fechaValidacion)}</>}
              </span>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ── Panel de cajeros activos (Admin/Gerente) ──────────────────────────────────
function CajerosActivosPanel({
  onValidar,
}: {
  onValidar: (sesion: CajaSessionResponse) => void
}) {
  const { data: activas = [], isLoading } = useQuery<CajaSessionResponse[]>({
    queryKey: ['caja-activas-totales'],
    queryFn:  cajaApi.activasConTotales,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  if (isLoading) return (
    <Card>
      <CardBody>
        <p className="text-sm text-slate-400 py-4 text-center">Cargando cajeros activos…</p>
      </CardBody>
    </Card>
  )

  if (activas.length === 0) return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users size={16} className="text-slate-500" />
          <h3 className="font-semibold text-slate-700">Cajeros activos</h3>
        </div>
      </CardHeader>
      <CardBody>
        <div className="flex flex-col items-center py-8 gap-2 text-center text-slate-400">
          <Lock size={28} className="text-slate-300" />
          <p className="text-sm">No hay cajeros con caja abierta en este momento.</p>
        </div>
      </CardBody>
    </Card>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-semibold text-slate-700">Cajeros activos</h3>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
              {activas.length} en turno
            </span>
          </div>
          <span className="text-xs text-slate-400">Se actualiza automáticamente</span>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        <div className="divide-y divide-slate-100">
          {activas.map(s => (
            <div key={s.id} className="px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              {/* Cajero + turno */}
              <div className="flex items-center gap-2 min-w-[140px]">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <User size={14} className="text-emerald-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{s.nombreUsuario}</p>
                  <p className="text-[11px] text-slate-400">{fmtDuracion(s.fechaApertura)} en turno</p>
                </div>
              </div>

              {/* Métricas */}
              <div className="flex gap-4 flex-1 flex-wrap">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Ventas efectivo</p>
                  <p className="text-sm font-bold text-emerald-700 font-mono">{fmt(s.totalVentasContado ?? 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Ventas crédito</p>
                  <p className="text-sm font-bold text-blue-700 font-mono">{fmt(s.totalVentasCredito ?? 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total vendido</p>
                  <p className="text-sm font-bold text-slate-800 font-mono">{fmt(s.totalGeneral ?? 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Facturas</p>
                  <p className="text-sm font-bold text-slate-700">{s.totalFacturas ?? 0}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Fondo inicial</p>
                  <p className="text-sm font-mono text-slate-600">{fmt(s.montoApertura)}</p>
                </div>
              </div>

              {/* Validación + botón toggle */}
              <div className="flex items-center gap-2">
                <ValidacionBadge valor={s.validacionAdmin} />
                <button
                  onClick={() => onValidar(s)}
                  title={s.validacionAdmin === true ? 'Desactivar validación' : 'Activar validación'}
                  className={`p-1.5 rounded-lg border transition-colors text-xs ${
                    s.validacionAdmin === true
                      ? 'border-red-200 text-red-500 hover:bg-red-50'
                      : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  {s.validacionAdmin === true
                    ? <ShieldOff size={14} />
                    : <ShieldCheck size={14} />}
                </button>
              </div>

              <Badge color="green">Abierta</Badge>
            </div>
          ))}
        </div>

        {/* Totales sumados */}
        {activas.length > 1 && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex flex-wrap gap-6 text-sm">
            <span className="text-slate-500 font-medium">Total combinado:</span>
            <span className="font-bold text-emerald-700 font-mono">
              Efectivo {fmt(activas.reduce((s, c) => s + (c.totalVentasContado ?? 0), 0))}
            </span>
            <span className="font-bold text-blue-700 font-mono">
              Crédito {fmt(activas.reduce((s, c) => s + (c.totalVentasCredito ?? 0), 0))}
            </span>
            <span className="font-bold text-slate-800 font-mono">
              Total {fmt(activas.reduce((s, c) => s + (c.totalGeneral ?? 0), 0))}
            </span>
            <span className="text-slate-500">
              {activas.reduce((s, c) => s + (c.totalFacturas ?? 0), 0)} facturas
            </span>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function CajaPage() {
  const qc = useQueryClient()
  const { isAdmin, isGerente } = useAuth()
  const { comercio } = useComercio()
  const esAdminOGerente = isAdmin || isGerente
  const cajaChicaDesactivada = !esAdminOGerente && comercio?.permitirCajaChica === false

  const [modalAbrir,  setModalAbrir]  = useState(false)
  const [modalCerrar, setModalCerrar] = useState(false)
  const [sesionValidar, setSesionValidar] = useState<CajaSessionResponse | null>(null)

  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  // ── Sesión activa del usuario ─────────────────────────────────────────────
  const { data: sesionActiva, isLoading: loadingSesion } = useQuery<CajaSessionResponse | null>({
    queryKey: ['caja-activa'],
    queryFn: () => cajaApi.activa().catch(e => {
      if (e?.response?.status === 404) return null
      throw e
    }),
    staleTime: 30_000,
    retry: false,
  })

  // ── Historial (Admin/Gerente: todas; Cajero: las suyas) ───────────────────
  const historialFn = esAdminOGerente
    ? () => cajaApi.getAll({ desde: filtroDesde || undefined, hasta: filtroHasta || undefined })
    : () => cajaApi.misSesiones({ desde: filtroDesde || undefined, hasta: filtroHasta || undefined })

  const { data: historial = [], isLoading: loadingHistorial } = useQuery<CajaSessionResponse[]>({
    queryKey: ['caja-historial', filtroDesde, filtroHasta, esAdminOGerente],
    queryFn:  historialFn,
    staleTime: 30_000,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['caja-activa'] })
    qc.invalidateQueries({ queryKey: ['caja-historial'] })
    qc.invalidateQueries({ queryKey: ['caja-activas-totales'] })
    setModalAbrir(false)
    setModalCerrar(false)
  }

  const sesionesHistorial = historial.filter(s => s.estado === 'Cerrada')

  if (cajaChicaDesactivada) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Caja</h2>
        </div>
        <Card>
          <CardBody>
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                <Lock size={28} className="text-amber-500" />
              </div>
              <p className="text-slate-700 font-semibold text-lg">Caja chica desactivada</p>
              <p className="text-sm text-slate-400 max-w-sm">
                El administrador ha desactivado las solicitudes de caja chica para cajeros.
                Contacta a tu supervisor si necesitas abrir una sesión.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Apertura y cierre de caja</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Control del turno del cajero y cuadre al final del día
          </p>
        </div>
        {!sesionActiva && !loadingSesion && (
          <Button
            icon={<Unlock size={16} />}
            className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
            onClick={() => setModalAbrir(true)}
          >
            Abrir caja
          </Button>
        )}
      </div>

      {/* Cargando */}
      {loadingSesion && (
        <Card>
          <CardBody>
            <p className="text-center text-slate-400 py-6">Verificando sesión…</p>
          </CardBody>
        </Card>
      )}

      {/* Sin sesión activa — aviso */}
      {!loadingSesion && !sesionActiva && (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                <Lock size={28} className="text-slate-400" />
              </div>
              <p className="text-slate-700 font-medium">Caja cerrada</p>
              <p className="text-sm text-slate-400 max-w-xs">
                No hay ninguna sesión de caja abierta. Abre la caja para comenzar a registrar ventas.
              </p>
              <Button
                icon={<Unlock size={16} />}
                className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 mt-2"
                onClick={() => setModalAbrir(true)}
              >
                Abrir caja ahora
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Cajeros activos — solo Admin/Gerente */}
      {esAdminOGerente && (
        <CajerosActivosPanel
          onValidar={s => setSesionValidar(s)}
        />
      )}

      {/* Sesión activa del propio usuario */}
      {sesionActiva && (
        <SesionActivaPanel
          sesion={sesionActiva}
          onCerrar={() => setModalCerrar(true)}
          onValidar={() => setSesionValidar(sesionActiva)}
          esAdminOGerente={esAdminOGerente}
        />
      )}

      {/* Último cierre — si hay historial y no hay sesión activa */}
      {!sesionActiva && sesionesHistorial.length > 0 && (
        <ResumenCierre sesion={sesionesHistorial[0]} />
      )}

      {/* ── Historial ───────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-700">
            {esAdminOGerente ? 'Historial de sesiones' : 'Mis sesiones anteriores'}
          </h3>
          {/* Filtros de fecha */}
          <div className="flex items-center gap-2">
            <input
              type="date" value={filtroDesde}
              onChange={e => setFiltroDesde(e.target.value)}
              className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
            />
            <span className="text-slate-400 text-xs">→</span>
            <input
              type="date" value={filtroHasta}
              onChange={e => setFiltroHasta(e.target.value)}
              className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {loadingHistorial ? (
          <p className="text-sm text-slate-400 px-1">Cargando historial…</p>
        ) : sesionesHistorial.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-xl px-6 py-8 text-center text-slate-400 text-sm">
            No hay sesiones registradas en el período seleccionado.
          </div>
        ) : (
          <div className="space-y-2">
            {sesionesHistorial.map(s => <TarjetaSesion key={s.id} sesion={s} />)}
          </div>
        )}
      </div>

      {/* Modales */}
      {modalAbrir && (
        <AbrirCajaModal onClose={() => setModalAbrir(false)} onSaved={refresh} />
      )}
      {modalCerrar && sesionActiva && (
        <CerrarCajaModal
          sesion={sesionActiva}
          onClose={() => setModalCerrar(false)}
          onSaved={refresh}
        />
      )}
      {sesionValidar && (
        <ValidarModal
          sesion={sesionValidar}
          onClose={() => setSesionValidar(null)}
          onSaved={() => {
            setSesionValidar(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}
