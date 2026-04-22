import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { CheckCircle, Smartphone, Mail, RefreshCw } from 'lucide-react'
import { authApi } from '../../api'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

type Paso1Form = { email: string }
type Paso2Form = { nuevoPassword: string; confirmarPassword: string }

// ── OTP código de reset (string) ──────────────────────────────────────────────
function ResetOtp({ value, onChange, error }: {
  value: string; onChange: (v: string) => void; error?: string
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const arr = value.split('')
      if (arr[i]) { arr[i] = '' } else if (i > 0) { arr[i - 1] = ''; refs.current[i - 1]?.focus() }
      onChange(arr.join(''))
    }
  }
  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const digit = e.target.value.replace(/\D/g, '').slice(-1)
    const arr = value.padEnd(6, ' ').split('')
    arr[i] = digit; onChange(arr.join('').trimEnd())
    if (digit && i < 5) refs.current[i + 1]?.focus()
  }
  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted) { onChange(pasted); refs.current[Math.min(pasted.length, 5)]?.focus() }
    e.preventDefault()
  }

  return (
    <div>
      <label className="text-sm font-medium text-slate-700 block mb-2">Código de recuperación</label>
      <div className="flex gap-2 justify-center">
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i} ref={el => { refs.current[i] = el }}
            type="text" inputMode="numeric" maxLength={1}
            value={value[i] ?? ''}
            onChange={e => handleChange(i, e)} onKeyDown={e => handleKey(i, e)}
            onPaste={handlePaste} onFocus={e => e.target.select()}
            className={`w-11 text-center text-xl font-bold font-mono border-2 rounded-xl outline-none transition-colors
              ${value[i] ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-800'}
              focus:border-blue-500 focus:bg-blue-50`}
            style={{ height: '52px' }}
          />
        ))}
      </div>
      {error && <p className="text-xs text-red-500 mt-1.5 text-center">{error}</p>}
    </div>
  )
}

// ── OTP de 2FA (array) ────────────────────────────────────────────────────────
function TfaOtp({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (value[i]) { const n = [...value]; n[i] = ''; onChange(n) }
      else if (i > 0) refs.current[i - 1]?.focus()
    }
  }
  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const digit = e.target.value.replace(/\D/g, '').slice(-1)
    const n = [...value]; n[i] = digit; onChange(n)
    if (digit && i < 5) refs.current[i + 1]?.focus()
  }
  const handlePaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('')
    if (!digits.length) return
    e.preventDefault()
    const n = Array(6).fill(''); digits.forEach((d, i) => { n[i] = d }); onChange(n)
    refs.current[Math.min(digits.length, 5)]?.focus()
  }
  return (
    <div className="flex gap-2 justify-center">
      {value.map((digit, i) => (
        <input key={i} ref={el => { refs.current[i] = el }}
          type="text" inputMode="numeric" maxLength={1} value={digit}
          onChange={e => handleChange(i, e)} onKeyDown={e => handleKey(i, e)} onPaste={handlePaste}
          className={`w-11 h-12 text-center text-lg font-bold border-2 rounded-xl outline-none transition-colors ${
            digit ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-800'
          } focus:border-blue-500`}
        />
      ))}
    </div>
  )
}

export default function RecuperarPage() {
  const [paso, setPaso]         = useState<1 | 2>(1)
  const [email, setEmail]       = useState('')
  const [exitoso, setExitoso]   = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Estado después de paso 1
  const [hasTwoFactor, setHasTwoFactor]       = useState(false)
  const [twoFactorMethod, setTwoFactorMethod] = useState<string | undefined>()

  // Código de reset (solo usuarios sin 2FA)
  const [codigo, setCodigo] = useState('')

  // 2FA (usuarios con 2FA)
  const [tfaSelected, setTfaSelected]   = useState<'totp' | 'email'>('totp')
  const [tfaOtp, setTfaOtp]             = useState(Array(6).fill(''))
  const [tfaSendMsg, setTfaSendMsg]     = useState('')
  const [tfaSending, setTfaSending]     = useState(false)

  const { register: r1, handleSubmit: hs1, formState: { errors: e1, isSubmitting: s1 } } = useForm<Paso1Form>()
  const { register: r2, handleSubmit: hs2, watch: w2, formState: { errors: e2, isSubmitting: s2 } } = useForm<Paso2Form>()
  const nuevoPassword = w2('nuevoPassword')

  // ── Paso 1 ────────────────────────────────────────────────────────────────
  const onPaso1 = async (data: Paso1Form) => {
    try {
      setErrorMsg('')
      const res = await authApi.solicitarReset(data.email)
      setEmail(data.email)
      setHasTwoFactor(res.hasTwoFactor)
      setTwoFactorMethod(res.twoFactorMethod)
      // Preseleccionar el método configurado del usuario
      setTfaSelected(res.twoFactorMethod === 'email' ? 'email' : 'totp')
      setTfaSendMsg(res.twoFactorMethod === 'email' ? 'Código enviado a tu correo.' : '')
      setPaso(2)
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error ?? 'No se pudo enviar la solicitud. Verifica el email.')
    }
  }

  // ── Paso 2 ────────────────────────────────────────────────────────────────
  const onPaso2 = async (data: Paso2Form) => {
    try {
      setErrorMsg('')
      await authApi.confirmarReset({
        email,
        codigo:            hasTwoFactor ? undefined : codigo,
        nuevoPassword:     data.nuevoPassword,
        confirmarPassword: data.confirmarPassword,
        codigoTwoFactor:   hasTwoFactor ? tfaOtp.join('') : undefined,
      })
      setExitoso(true)
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error ?? 'Código inválido o expirado. Solicita uno nuevo.')
    }
  }

  const enviarCodigoEmail = async () => {
    setTfaSending(true); setTfaSendMsg('')
    try {
      const res = await authApi.enviarCodigo2faReset(email)
      setTfaSendMsg(res.mensaje ?? 'Código enviado.')
      setTfaOtp(Array(6).fill(''))
    } catch (e: any) {
      setTfaSendMsg(e?.response?.data?.error ?? 'Error al enviar el código.')
    } finally {
      setTfaSending(false)
    }
  }

  // El formulario está completo cuando hay código válido según el flujo
  const codigoValido = hasTwoFactor
    ? tfaOtp.join('').length === 6
    : codigo.length === 6

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, var(--color-login, #0f172a), var(--color-login-fin, #1e3a8a))' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Recuperar contraseña</h1>
          <p className="text-slate-400 mt-2 text-sm">
            {paso === 1
              ? 'Ingresa tu email para comenzar'
              : hasTwoFactor
                ? 'Verifica tu identidad para continuar'
                : 'Ingresa el código y tu nueva contraseña'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">

          {/* ── Éxito ─────────────────────────────────────────────────────── */}
          {exitoso ? (
            <div className="space-y-5 text-center">
              <div className="flex justify-center">
                <CheckCircle size={48} className="text-emerald-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-lg">¡Contraseña actualizada!</p>
                <p className="text-slate-500 text-sm mt-1">Ya puedes iniciar sesión con tu nueva contraseña.</p>
              </div>
              <Link to="/login" className="block w-full text-center py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm">
                Ir al inicio de sesión
              </Link>
            </div>

          ) : paso === 1 ? (
            /* ── Paso 1 ───────────────────────────────────────────────────── */
            <form onSubmit={hs1(onPaso1)} className="space-y-5">
              <Input
                label="Email"
                type="email"
                placeholder="tu@email.com"
                error={e1.email?.message}
                {...r1('email', { required: 'El email es requerido' })}
              />
              {errorMsg && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorMsg}</p>
              )}
              <Button type="submit" loading={s1} className="w-full justify-center py-2.5">
                Continuar
              </Button>
              <div className="text-center">
                <Link to="/login" className="text-sm text-slate-500 hover:text-blue-600 transition-colors">
                  ← Volver al inicio de sesión
                </Link>
              </div>
            </form>

          ) : (
            /* ── Paso 2 ───────────────────────────────────────────────────── */
            <form onSubmit={hs2(onPaso2)} className="space-y-5">

              {hasTwoFactor ? (
                /* ── Verificación 2FA (reemplaza el código de admin) ──────── */
                <div className="space-y-3">
                  {/* Selector de método — solo para usuarios con TOTP */}
                  {twoFactorMethod === 'totp' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setTfaSelected('totp'); setTfaOtp(Array(6).fill('')); setTfaSendMsg('') }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          tfaSelected === 'totp'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                        }`}
                      >
                        <Smartphone size={12} /> App autenticadora
                      </button>
                      <button
                        type="button"
                        onClick={() => { setTfaSelected('email'); setTfaOtp(Array(6).fill('')); setTfaSendMsg('') }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          tfaSelected === 'email'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                        }`}
                      >
                        <Mail size={12} /> Correo electrónico
                      </button>
                    </div>
                  )}

                  {/* Contenido según método seleccionado */}
                  {tfaSelected === 'totp' ? (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600">Ingresa el código de tu app autenticadora.</p>
                      <TfaOtp value={tfaOtp} onChange={setTfaOtp} />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Para email-2FA ya se envió automáticamente; para TOTP que eligió email, necesita pedirlo */}
                      {twoFactorMethod !== 'email' && (
                        <button
                          type="button"
                          onClick={enviarCodigoEmail}
                          disabled={tfaSending}
                          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                        >
                          <RefreshCw size={13} className={tfaSending ? 'animate-spin' : ''} />
                          {tfaSendMsg ? 'Reenviar código' : 'Enviar código al correo'}
                        </button>
                      )}
                      {tfaSendMsg && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500">{tfaSendMsg}</p>
                          <button
                            type="button"
                            onClick={enviarCodigoEmail}
                            disabled={tfaSending}
                            className={`flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50 ${twoFactorMethod !== 'email' ? 'hidden' : ''}`}
                          >
                            <RefreshCw size={11} className={tfaSending ? 'animate-spin' : ''} />
                            Reenviar código
                          </button>
                          <TfaOtp value={tfaOtp} onChange={setTfaOtp} />
                        </div>
                      )}
                      {!tfaSendMsg && twoFactorMethod === 'email' && (
                        <p className="text-sm text-slate-500">Cargando…</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Sin 2FA: código del administrador ────────────────────── */
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                    <p className="text-sm text-blue-700">
                      Contacta a tu administrador para obtener el código de 6 dígitos.
                    </p>
                  </div>
                  <ResetOtp
                    value={codigo}
                    onChange={setCodigo}
                    error={codigo.length > 0 && codigo.length < 6 ? 'Completa los 6 dígitos' : undefined}
                  />
                </>
              )}

              {/* Nueva contraseña */}
              <Input
                label="Nueva contraseña"
                type="password"
                placeholder="••••••••"
                error={e2.nuevoPassword?.message}
                {...r2('nuevoPassword', {
                  required: 'La contraseña es requerida',
                  minLength: { value: 6, message: 'Mínimo 6 caracteres' },
                })}
              />
              <Input
                label="Confirmar contraseña"
                type="password"
                placeholder="••••••••"
                error={e2.confirmarPassword?.message}
                {...r2('confirmarPassword', {
                  required: 'Debes confirmar la contraseña',
                  validate: v => v === nuevoPassword || 'Las contraseñas no coinciden',
                })}
              />

              {errorMsg && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorMsg}</p>
              )}

              <Button
                type="submit"
                loading={s2}
                disabled={!codigoValido}
                className="w-full justify-center py-2.5"
              >
                Cambiar contraseña
              </Button>
              <div className="text-center">
                <Link to="/login" className="text-sm text-slate-500 hover:text-blue-600 transition-colors">
                  ← Volver al inicio de sesión
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
