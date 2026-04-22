import { useEffect, useRef, useState } from 'react'
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ShieldAlert, Unlock, Vault, PackageX } from 'lucide-react'
import Sidebar from './Sidebar'
import ToastContainer from '../ui/Toast'
import { useAuth } from '../../context/AuthContext'
import { useComercio } from '../../context/ComercioContext'
import { useToast, errMsg } from '../../context/ToastContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cajaApi } from '../../api'
import type { AbrirCajaDto } from '../../types'
import Button from '../ui/Button'
import {
  registerNetworkErrorHandler,   unregisterNetworkErrorHandler,
  registerSessionExpiredHandler, unregisterSessionExpiredHandler,
} from '../../lib/axios'

const COUNTDOWN = 5

// ── Modal: apertura de caja al inicio de turno ───────────────────────────────
function CajaPromptModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { success, error } = useToast()
  const [monto, setMonto] = useState('')
  const [obs,   setObs]   = useState('')

  const abrir = useMutation({
    mutationFn: () => cajaApi.abrir({
      montoApertura: parseFloat(monto) || 0,
      observaciones: obs.trim() || undefined,
    } satisfies AbrirCajaDto),
    onSuccess: () => { success('Caja abierta. ¡Buen turno!'); onSaved() },
    onError:   (e) => error(errMsg(e)),
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-50 px-6 py-4 flex items-center gap-3 border-b border-emerald-100">
          <div className="p-2 rounded-full bg-emerald-100">
            <Vault size={20} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-emerald-800">Abrir caja</h3>
            <p className="text-xs text-emerald-600">No tienes una sesión de caja activa</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600">
            Para comenzar tu turno registra el fondo inicial que recibiste.
          </p>

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
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Observaciones (opcional)
            </label>
            <textarea
              rows={2} value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Ej: Turno de la mañana"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              className="flex-1 justify-center"
              onClick={onClose}
            >
              Continuar sin abrir
            </Button>
            <Button
              className="flex-1 justify-center bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
              loading={abrir.isPending}
              disabled={!monto || parseFloat(monto) < 0}
              onClick={() => abrir.mutate()}
            >
              <Unlock size={15} />
              Abrir caja
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Layout principal ─────────────────────────────────────────────────────────
export default function AppLayout() {
  const { isAuthenticated, logout, isCajero } = useAuth()
  const { comercio } = useComercio()
  const { error } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const qc       = useQueryClient()

  const [planBloqueo, setPlanBloqueo] = useState<{ error: string; feature: string } | null>(null)

  // Si la caja chica está desactivada, los cajeros no deben ver el prompt
  const cajaChicaActiva = comercio?.permitirCajaChica !== false

  const [sessionPopup,    setSessionPopup]    = useState(false)
  const [seconds,         setSeconds]         = useState(COUNTDOWN)
  const [cajaPrompt,      setCajaPrompt]      = useState(false)
  // Evita mostrar el prompt más de una vez por sesión de navegador
  const cajaPromptChecked = useRef(false)

  // ── Sesión activa del cajero (sólo si es cajero y aún no verificamos) ─────
  const { data: sesionActiva, isSuccess: cajaChecked } = useQuery({
    queryKey: ['caja-activa'],
    queryFn:  () => cajaApi.activa().catch(e => {
      if (e?.response?.status === 404) return null
      throw e
    }),
    enabled: isCajero && cajaChicaActiva && !cajaPromptChecked.current,
    staleTime: 60_000,
    retry: false,
  })

  // Cuando se resuelve la query del cajero, decidir si mostrar el prompt
  useEffect(() => {
    if (!isCajero || !cajaChicaActiva || !cajaChecked || cajaPromptChecked.current) return
    cajaPromptChecked.current = true
    if (sesionActiva === null) {
      setCajaPrompt(true)
    }
  }, [isCajero, cajaChicaActiva, cajaChecked, sesionActiva])

  const handleCajaPromptSaved = () => {
    setCajaPrompt(false)
    qc.invalidateQueries({ queryKey: ['caja-activa'] })
    qc.invalidateQueries({ queryKey: ['caja-historial'] })
  }

  // ── Countdown + auto-redirect cuando el popup está abierto ───────────────
  useEffect(() => {
    if (!sessionPopup) return

    setSeconds(COUNTDOWN)
    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          goToLogin()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [sessionPopup]) // eslint-disable-line react-hooks/exhaustive-deps

  const goToLogin = () => {
    setSessionPopup(false)
    logout()
    navigate('/login', { replace: true })
  }

  // ── Limpiar bloqueo de plan al cambiar de sección ────────────────────────
  useEffect(() => { setPlanBloqueo(null) }, [location.pathname])

  // ── Registro de handlers de axios ────────────────────────────────────────
  useEffect(() => {
    registerNetworkErrorHandler(() =>
      error('No se pudo conectar con el servidor. Verifica tu conexión.')
    )
    registerSessionExpiredHandler(() => setSessionPopup(true))

    const onPlanSinAcceso = (e: Event) =>
      setPlanBloqueo((e as CustomEvent).detail)
    window.addEventListener('plan-sin-acceso', onPlanSinAcceso)

    return () => {
      unregisterNetworkErrorHandler()
      unregisterSessionExpiredHandler()
      window.removeEventListener('plan-sin-acceso', onPlanSinAcceso)
    }
  }, [error])

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="relative flex-1 overflow-y-auto bg-slate-50">
        <div className="p-6">
          <Outlet />
        </div>

        {/* ── Overlay plan_sin_acceso: solo cubre el contenido, no el sidebar ── */}
        {planBloqueo && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-50/80 backdrop-blur-sm p-6">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm text-center overflow-hidden">
              <div className="h-1 w-full bg-violet-400" />
              <div className="px-8 py-8 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-200 ring-4 ring-violet-50 flex items-center justify-center mx-auto text-violet-500">
                  <PackageX size={28} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-800">Función no disponible</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {planBloqueo.error || 'Tu plan actual no incluye acceso a esta sección.'}
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  Puedes seguir navegando en las demás secciones.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <ToastContainer />

      {/* ── Prompt de apertura de caja (cajero sin sesión activa) ──────────── */}
      {cajaPrompt && (
        <CajaPromptModal
          onClose={() => setCajaPrompt(false)}
          onSaved={handleCajaPromptSaved}
        />
      )}

      {/* ── Popup sesión expirada ───────────────────────────────────────── */}
      {sessionPopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-amber-50 px-6 py-4 flex items-center gap-3 border-b border-amber-100">
              <ShieldAlert className="text-amber-500 shrink-0" size={22} />
              <h3 className="font-semibold text-amber-700">Sesión expirada</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-slate-700 text-sm">
                Tu sesión ha expirado o no tienes acceso. Serás redirigido al inicio de sesión.
              </p>
              {/* Barra de progreso */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-400 h-1.5 rounded-full transition-all duration-1000"
                  style={{ width: `${(seconds / COUNTDOWN) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Redirigiendo en <strong>{seconds}s</strong>…
                </span>
                <button
                  onClick={goToLogin}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Ir al login
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
