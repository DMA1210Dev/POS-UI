import { useEffect, useState } from 'react'
import { CreditCard, Lock, RefreshCw, Wrench, Loader2, X } from 'lucide-react'
import api from '../lib/axios'

export type LicenciaCodigo = 'mantenimiento' | 'bloqueado_pago' | 'bloqueado'

interface Props {
  codigo:           LicenciaCodigo
  mensaje?:         string
  fechaVencimiento?: string
  onDismiss:        () => void   // se llama cuando la licencia vuelve a ser activa
}

const ESTADOS: Record<LicenciaCodigo, {
  icon:      React.ReactNode
  color:     string
  bg:        string
  border:    string
  ring:      string
  titulo:    string
  subtitulo: string
}> = {
  mantenimiento: {
    icon:      <Wrench size={36} />,
    color:     'text-amber-600',
    bg:        'bg-amber-50',
    border:    'border-amber-200',
    ring:      'ring-amber-100',
    titulo:    'Sistema en mantenimiento',
    subtitulo: 'Estamos realizando mejoras. Vuelve en unos momentos.',
  },
  bloqueado_pago: {
    icon:      <CreditCard size={36} />,
    color:     'text-orange-600',
    bg:        'bg-orange-50',
    border:    'border-orange-200',
    ring:      'ring-orange-100',
    titulo:    'Servicio suspendido',
    subtitulo: 'El acceso ha sido suspendido por falta de pago. Contacta al administrador.',
  },
  bloqueado: {
    icon:      <Lock size={36} />,
    color:     'text-red-600',
    bg:        'bg-red-50',
    border:    'border-red-200',
    ring:      'ring-red-100',
    titulo:    'Acceso bloqueado',
    subtitulo: 'El acceso a este sistema ha sido revocado. Contacta al administrador.',
  },
}

const LICENSE_CODES = new Set(['mantenimiento', 'bloqueado_pago', 'bloqueado'])

/** Intenta un request protegido. Si tiene éxito (o falla por motivo NO de licencia) → activo. */
async function verificarLicencia(): Promise<boolean> {
  try {
    await api.get('/comercio')
    // /api/comercio está en PathsLibres → siempre pasa.
    // Necesitamos un endpoint gateado. Usamos /usuarios/perfil como ping.
    await api.get('/usuarios/perfil')
    return true
  } catch (err: any) {
    const status = err?.response?.status
    const codigo = err?.response?.data?.codigo
    // Si el error es de licencia → sigue bloqueado
    if ((status === 503 || status === 402 || status === 403) && codigo && LICENSE_CODES.has(codigo)) {
      return false
    }
    // Cualquier otro error (401 sesión, 404, red) = licencia OK, otro problema
    return true
  }
}

const RETRY_INTERVAL = 30 // segundos

export default function LicenciaBlockPage({ codigo, mensaje, fechaVencimiento, onDismiss }: Props) {
  const estado = ESTADOS[codigo] ?? ESTADOS.bloqueado
  const [checking, setChecking] = useState(false)
  const [cuenta,   setCuenta]   = useState(RETRY_INTERVAL)

  const vencimiento = fechaVencimiento
    ? new Date(fechaVencimiento).toLocaleDateString('es-DO', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : null

  const reintentar = async () => {
    if (checking) return
    setChecking(true)
    setCuenta(RETRY_INTERVAL)
    const activo = await verificarLicencia()
    setChecking(false)
    if (activo) onDismiss()
  }

  // Cuenta regresiva + auto-reintento cada 30 s
  useEffect(() => {
    const tick = setInterval(() => {
      setCuenta(prev => {
        if (prev <= 1) {
          reintentar()
          return RETRY_INTERVAL
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [checking]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Botón cerrar */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-600 transition-colors"
          title="Cerrar"
        >
          <X size={16} />
        </button>

        {/* Franja de color superior */}
        <div className={`h-1.5 w-full ${
          codigo === 'mantenimiento'  ? 'bg-amber-400'  :
          codigo === 'bloqueado_pago' ? 'bg-orange-400' :
          'bg-red-500'
        }`} />

        <div className="px-8 py-8 text-center space-y-5">
          {/* Icono */}
          <div className={`w-16 h-16 rounded-2xl ${estado.bg} border ${estado.border} ring-4 ${estado.ring} flex items-center justify-center mx-auto ${estado.color}`}>
            {estado.icon}
          </div>

          {/* Texto */}
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-slate-800">{estado.titulo}</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              {mensaje ?? estado.subtitulo}
            </p>
            {vencimiento && codigo === 'bloqueado_pago' && (
              <p className="text-xs text-orange-600 font-medium mt-1">
                Vencimiento: {vencimiento}
              </p>
            )}
          </div>

          {/* Código de estado */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 inline-block">
            <p className="text-xs text-slate-400">Código de estado</p>
            <p className="text-sm font-mono font-semibold text-slate-700 mt-0.5">{codigo}</p>
          </div>

          {/* Botón reintentar + cuenta regresiva */}
          <div className="space-y-1">
            <button
              onClick={reintentar}
              disabled={checking}
              className="flex items-center gap-2 mx-auto text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 transition-colors"
            >
              {checking
                ? <Loader2 size={14} className="animate-spin" />
                : <RefreshCw size={14} />
              }
              {checking ? 'Verificando...' : 'Reintentar ahora'}
            </button>
            {!checking && (
              <p className="text-xs text-slate-400">
                Verificación automática en {cuenta}s
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
