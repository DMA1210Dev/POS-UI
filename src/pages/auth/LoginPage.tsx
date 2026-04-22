import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { AlertCircle, X, ShieldCheck, RefreshCw } from 'lucide-react'
import { authApi, twoFactorApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useComercio } from '../../context/ComercioContext'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import type { LoginDto, TwoFactorChallenge } from '../../types'

const COUNTDOWN = 5

// ── OTP Input (6 cajas individuales) ─────────────────────────────────────────
function OtpInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[i]) {
        const next = [...value]; next[i] = ''; onChange(next)
      } else if (i > 0) {
        refs.current[i - 1]?.focus()
      }
    }
  }

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next  = [...value]; next[i] = digit; onChange(next)
    if (digit && i < 5) refs.current[i + 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('')
    if (!digits.length) return
    e.preventDefault()
    const next = Array(6).fill('')
    digits.forEach((d, i) => { next[i] = d })
    onChange(next)
    refs.current[Math.min(digits.length, 5)]?.focus()
  }

  return (
    <div className="flex gap-2 justify-center">
      {value.map((digit, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          className={`w-11 h-12 text-center text-lg font-bold border-2 rounded-xl outline-none transition-colors ${
            digit ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-800'
          } focus:border-blue-500`}
        />
      ))}
    </div>
  )
}

export default function LoginPage() {
  const { login }    = useAuth()
  const { comercio } = useComercio()
  const navigate     = useNavigate()

  // ── Estados login ─────────────────────────────────────────────────────────
  const [errorPopup, setErrorPopup] = useState('')
  const [seconds, setSeconds]       = useState(COUNTDOWN)

  // ── Estados 2FA ───────────────────────────────────────────────────────────
  const [step, setStep]               = useState<'login' | '2fa'>('login')
  const [tfaChallenge, setTfaChallenge] = useState<TwoFactorChallenge | null>(null)
  const [otpCode, setOtpCode]         = useState(Array(6).fill(''))
  const [rememberDevice, setRememberDevice] = useState(false)
  const [tfaLoading, setTfaLoading]   = useState(false)
  const [tfaError, setTfaError]       = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg, setResendMsg]     = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginDto>()

  // ── Countdown popup error ─────────────────────────────────────────────────
  useEffect(() => {
    if (!errorPopup) return
    setSeconds(COUNTDOWN)
    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) { clearInterval(interval); setErrorPopup(''); return COUNTDOWN }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [errorPopup])

  // ── Submit login ──────────────────────────────────────────────────────────
  const onSubmit = async (data: LoginDto) => {
    try {
      setErrorPopup('')
      const deviceToken = localStorage.getItem('pos_device_token') ?? undefined
      const res = await authApi.login({ ...data, deviceToken })

      if ('requiresTwoFactor' in res && res.requiresTwoFactor) {
        setTfaChallenge(res)
        setOtpCode(Array(6).fill(''))
        setTfaError('')
        setResendMsg('')
        setStep('2fa')
      } else {
        // login normal (sin 2FA o dispositivo de confianza)
        const authRes = res as Exclude<typeof res, { requiresTwoFactor: true }>
        login(authRes)
        navigate('/dashboard')
      }
    } catch (e: any) {
      if (!e.response) {
        setErrorPopup('No se pudo conectar con el servidor. Verifica tu conexión o que la API esté en línea.')
      } else {
        setErrorPopup(e.response.data?.error ?? 'Email o contraseña incorrectos.')
      }
    }
  }

  // ── Submit 2FA ────────────────────────────────────────────────────────────
  const onVerify2FA = async () => {
    if (!tfaChallenge) return
    const codigo = otpCode.join('')
    if (codigo.length < 6) { setTfaError('Ingresa los 6 dígitos del código.'); return }

    setTfaLoading(true)
    setTfaError('')
    try {
      const res = await twoFactorApi.verify({
        twoFactorKey:  tfaChallenge.twoFactorKey,
        codigo,
        recordarEquipo: rememberDevice,
        nombreEquipo:   navigator.userAgent.slice(0, 120),
      })

      if (res.deviceToken) {
        localStorage.setItem('pos_device_token', res.deviceToken)
      }

      login(res)
      navigate('/dashboard')
    } catch (e: any) {
      setTfaError(e.response?.data?.error ?? 'Código incorrecto.')
    } finally {
      setTfaLoading(false)
    }
  }

  // ── Reenviar código (método email) ────────────────────────────────────────
  const resendCode = async () => {
    if (!tfaChallenge) return
    setResendLoading(true)
    setResendMsg('')
    try {
      await twoFactorApi.sendCode(tfaChallenge.twoFactorKey)
      setResendMsg('Nuevo código enviado a tu correo.')
      setOtpCode(Array(6).fill(''))
    } catch (e: any) {
      setResendMsg(e.response?.data?.error ?? 'Error al reenviar.')
    } finally {
      setResendLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, var(--color-login, #0f172a), var(--color-login-fin, #1e3a8a))' }}
    >
      <div className="w-full max-w-sm">

        {/* ── Header con logo o nombre ─────────────────────────────────── */}
        <div className="text-center mb-8">
          {comercio?.logoUrl ? (
            <img
              src={comercio.logoUrl}
              alt={comercio.nombre}
              className="h-20 max-w-[200px] object-contain mx-auto mb-3 drop-shadow-lg"
            />
          ) : (
            <>
              <h1 className="text-3xl font-bold text-white">{comercio?.nombre ?? 'POS Sistema'}</h1>
              {comercio?.slogan && <p className="text-slate-300 mt-1 text-sm">{comercio.slogan}</p>}
            </>
          )}
          {step === 'login' && (
            <p className="text-slate-400 mt-2 text-sm">Inicia sesión para continuar</p>
          )}
        </div>

        {/* ── PASO 1: Formulario de login ──────────────────────────────── */}
        {step === 'login' && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="bg-white rounded-2xl shadow-2xl p-8 space-y-5"
          >
            <Input
              label="Email"
              type="email"
              placeholder="admin@pos.com"
              error={errors.email?.message}
              {...register('email', { required: 'El email es requerido' })}
            />
            <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password', { required: 'La contraseña es requerida' })}
            />
            <Button type="submit" loading={isSubmitting} className="w-full justify-center py-2.5">
              Iniciar sesión
            </Button>
            <div className="text-center">
              <Link to="/recuperar" className="text-sm text-slate-500 hover:text-blue-600 transition-colors">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>
        )}

        {/* ── PASO 2: Challenge 2FA ────────────────────────────────────── */}
        {step === '2fa' && tfaChallenge && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">
            {/* Header */}
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                <ShieldCheck size={24} className="text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Verificación en dos pasos</h2>
              <p className="text-sm text-slate-500">
                {tfaChallenge.method === 'email'
                  ? 'Ingresa el código de 6 dígitos enviado a tu correo.'
                  : 'Ingresa el código de tu app autenticadora (Google Authenticator, Duo, Authy…).'}
              </p>
            </div>

            <OtpInput value={otpCode} onChange={setOtpCode} />

            {tfaError && (
              <p className="text-sm text-red-600 text-center">{tfaError}</p>
            )}

            {/* Recordar dispositivo */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={e => setRememberDevice(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm text-slate-600">Recordar este dispositivo 30 días</span>
            </label>

            <Button
              className="w-full justify-center py-2.5"
              loading={tfaLoading}
              disabled={otpCode.join('').length < 6}
              onClick={onVerify2FA}
            >
              Verificar
            </Button>

            {/* Reenviar código (solo email) */}
            {tfaChallenge.method === 'email' && (
              <div className="text-center space-y-1">
                <button
                  type="button"
                  onClick={resendCode}
                  disabled={resendLoading}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1.5 mx-auto disabled:opacity-50"
                >
                  <RefreshCw size={13} className={resendLoading ? 'animate-spin' : ''} />
                  Reenviar código
                </button>
                {resendMsg && <p className="text-xs text-slate-500">{resendMsg}</p>}
              </div>
            )}

            {/* Volver al login */}
            <button
              type="button"
              onClick={() => { setStep('login'); setTfaChallenge(null) }}
              className="text-sm text-slate-400 hover:text-slate-600 w-full text-center transition-colors"
            >
              ← Volver al inicio de sesión
            </button>
          </div>
        )}
      </div>

      {/* ── Popup de error ───────────────────────────────────────────────── */}
      {errorPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-red-50 px-6 py-4 flex items-center gap-3 border-b border-red-100">
              <AlertCircle className="text-red-500 shrink-0" size={22} />
              <h3 className="font-semibold text-red-700">Error al iniciar sesión</h3>
              <button onClick={() => setErrorPopup('')} className="ml-auto text-red-400 hover:text-red-600">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-slate-700 text-sm">{errorPopup}</p>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-red-400 h-1.5 rounded-full transition-all duration-1000"
                  style={{ width: `${(seconds / COUNTDOWN) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Cerrando en <strong>{seconds}s</strong>…</span>
                <Button onClick={() => setErrorPopup('')}>Aceptar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
