import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { User, Lock, ShieldCheck, ShieldOff, Smartphone, Mail, X, QrCode, RefreshCw } from 'lucide-react'
import { usuariosApi, twoFactorApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useToast, errMsg } from '../../context/ToastContext'
import { Card } from '../../components/ui/Card'
import Button from '../../components/ui/Button'

const inputClass = "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"

// ── OTP Input reutilizable ────────────────────────────────────────────────────
function OtpInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[i]) { const n = [...value]; n[i] = ''; onChange(n) }
      else if (i > 0) refs.current[i - 1]?.focus()
    }
  }
  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const n = [...value]; n[i] = digit; onChange(n)
    if (digit && i < 5) refs.current[i + 1]?.focus()
  }
  const handlePaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('')
    if (!digits.length) return
    e.preventDefault()
    const n = Array(6).fill('')
    digits.forEach((d, i) => { n[i] = d })
    onChange(n)
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
          className={`w-10 h-11 text-center text-lg font-bold border-2 rounded-xl outline-none transition-colors ${
            digit ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-800'
          } focus:border-blue-500`}
        />
      ))}
    </div>
  )
}

// ── Modal de configuración 2FA ────────────────────────────────────────────────
type SetupModal =
  | { type: 'choose' }
  | { type: 'totp'; qrCodeBase64: string; secret: string; otp: string[] }
  | { type: 'email'; otp: string[] }
  | { type: 'disable' }

export default function PerfilPage() {
  const { user, updateUser } = useAuth()
  const { success, error }   = useToast()

  // ── Datos personales ──────────────────────────────────────────────────────
  const [nombre, setNombre] = useState(user?.nombre ?? '')
  const [email, setEmail]   = useState(user?.email  ?? '')

  // ── Contraseña ────────────────────────────────────────────────────────────
  const [pwdActual, setPwdActual]     = useState('')
  const [pwdNuevo, setPwdNuevo]       = useState('')
  const [pwdConfirm, setPwdConfirm]   = useState('')
  // 2FA para cambio de contraseña
  const [pwdTfaMethod, setPwdTfaMethod] = useState<'totp' | 'email'>(
    user?.twoFactorMethod === 'email' ? 'email' : 'totp'
  )
  const [pwdTfaOtp, setPwdTfaOtp]         = useState(Array(6).fill(''))
  const [pwdTfaSendMsg, setPwdTfaSendMsg] = useState('')
  const [pwdTfaSending, setPwdTfaSending] = useState(false)

  // ── 2FA modal ─────────────────────────────────────────────────────────────
  const [modal, setModal]       = useState<SetupModal | null>(null)
  const [disablePwd, setDisablePwd] = useState('')
  const [tfaError, setTfaError] = useState('')
  const [tfaLoading, setTfaLoading] = useState(false)

  // ── Mutations ─────────────────────────────────────────────────────────────
  const actualizarPerfil = useMutation({
    mutationFn: () => usuariosApi.updatePerfil({ nombre, email }),
    onSuccess: (data) => { updateUser({ nombre: data.nombre, email: data.email }); success('Perfil actualizado') },
    onError:   (e) => error(errMsg(e)),
  })

  const cambiarPassword = useMutation({
    mutationFn: () => usuariosApi.cambiarPassword(user!.id, {
      passwordActual:    pwdActual,
      nuevoPassword:     pwdNuevo,
      confirmarPassword: pwdConfirm,
      codigoTwoFactor:   user?.twoFactorEnabled ? pwdTfaOtp.join('') : undefined,
    }),
    onSuccess: () => {
      setPwdActual(''); setPwdNuevo(''); setPwdConfirm('')
      setPwdTfaOtp(Array(6).fill('')); setPwdTfaSendMsg('')
      success('Contraseña actualizada')
    },
    onError: (e: any) => error(errMsg(e)),
  })

  const enviarCodigoCambioPwd = async () => {
    setPwdTfaSending(true); setPwdTfaSendMsg('')
    try {
      const res = await usuariosApi.enviarCodigoCambioPwd(user!.id)
      setPwdTfaSendMsg(res.mensaje ?? 'Código enviado.')
      setPwdTfaOtp(Array(6).fill(''))
    } catch (e: any) {
      setPwdTfaSendMsg(errMsg(e))
    } finally {
      setPwdTfaSending(false)
    }
  }

  const passwordsCoinciden = pwdNuevo === pwdConfirm
  const perfilCambiado     = nombre !== user?.nombre || email !== user?.email

  // ── Abrir modal de setup TOTP ─────────────────────────────────────────────
  const startSetupTotp = async () => {
    setTfaError('')
    setTfaLoading(true)
    try {
      const res = await twoFactorApi.setupTotp()
      setModal({ type: 'totp', qrCodeBase64: res.qrCodeBase64, secret: res.secret, otp: Array(6).fill('') })
    } catch (e: any) { setTfaError(errMsg(e)) }
    finally { setTfaLoading(false) }
  }

  // ── Abrir modal de setup Email ────────────────────────────────────────────
  const startSetupEmail = async () => {
    setTfaError('')
    setTfaLoading(true)
    try {
      await twoFactorApi.setupEmail()
      setModal({ type: 'email', otp: Array(6).fill('') })
    } catch (e: any) { setTfaError(errMsg(e)) }
    finally { setTfaLoading(false) }
  }

  // ── Confirmar código y habilitar ──────────────────────────────────────────
  const confirmEnable = async (otp: string[]) => {
    const codigo = otp.join('')
    if (codigo.length < 6) { setTfaError('Ingresa los 6 dígitos.'); return }
    setTfaLoading(true); setTfaError('')
    try {
      await twoFactorApi.enable(codigo)
      success('2FA activado correctamente')
      updateUser({ twoFactorEnabled: true, twoFactorMethod: modal?.type === 'email' ? 'email' : 'totp' })
      setModal(null)
    } catch (e: any) { setTfaError(errMsg(e)) }
    finally { setTfaLoading(false) }
  }

  // ── Deshabilitar 2FA ──────────────────────────────────────────────────────
  const confirmDisable = async () => {
    if (!disablePwd) { setTfaError('Ingresa tu contraseña.'); return }
    setTfaLoading(true); setTfaError('')
    try {
      await twoFactorApi.disable(disablePwd)
      success('2FA desactivado')
      updateUser({ twoFactorEnabled: false, twoFactorMethod: undefined })
      setModal(null); setDisablePwd('')
    } catch (e: any) { setTfaError(errMsg(e)) }
    finally { setTfaLoading(false) }
  }

  const closeModal = () => { setModal(null); setTfaError(''); setDisablePwd('') }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Mi perfil</h2>
        <p className="text-slate-500 text-sm mt-1">Actualiza tu información personal y contraseña</p>
      </div>

      {/* Info del usuario */}
      <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
          <User className="text-blue-600" size={24} />
        </div>
        <div>
          <p className="font-semibold text-slate-800">{user?.nombre}</p>
          <p className="text-sm text-slate-500">{user?.email}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${
            user?.rol === 'AdminSistema' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {user?.rol}
          </span>
        </div>
      </div>

      {/* Datos personales */}
      <Card>
        <div className="px-6 py-5 space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <User size={16} className="text-slate-500" /> Datos personales
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Nombre</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button loading={actualizarPerfil.isPending} disabled={!perfilCambiado || !nombre || !email}
              onClick={() => actualizarPerfil.mutate()}>
              Guardar cambios
            </Button>
          </div>
        </div>
      </Card>

      {/* Cambiar contraseña */}
      <Card>
        <div className="px-6 py-5 space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Lock size={16} className="text-slate-500" /> Cambiar contraseña
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Contraseña actual</label>
              <input type="password" value={pwdActual} onChange={e => setPwdActual(e.target.value)} placeholder="••••••••" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Nueva contraseña</label>
              <input type="password" value={pwdNuevo} onChange={e => setPwdNuevo(e.target.value)} placeholder="Mínimo 6 caracteres" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Confirmar nueva contraseña</label>
              <input type="password" value={pwdConfirm} onChange={e => setPwdConfirm(e.target.value)} placeholder="••••••••" className={inputClass} />
              {pwdNuevo && pwdConfirm && !passwordsCoinciden && (
                <p className="text-xs text-amber-600 mt-1">Las contraseñas no coinciden</p>
              )}
            </div>
          </div>

          {/* 2FA verification — solo si el usuario tiene 2FA activo */}
          {user?.twoFactorEnabled && (
            <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-blue-800 flex items-center gap-2">
                <ShieldCheck size={15} /> Verificación en dos pasos requerida
              </p>

              {/* Selector de método */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setPwdTfaMethod('totp'); setPwdTfaOtp(Array(6).fill('')); setPwdTfaSendMsg('') }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    pwdTfaMethod === 'totp'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                  }`}
                >
                  <Smartphone size={13} /> App autenticadora
                </button>
                <button
                  type="button"
                  onClick={() => { setPwdTfaMethod('email'); setPwdTfaOtp(Array(6).fill('')); setPwdTfaSendMsg('') }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    pwdTfaMethod === 'email'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                  }`}
                >
                  <Mail size={13} /> Correo electrónico
                </button>
              </div>

              {pwdTfaMethod === 'totp' ? (
                <div className="space-y-2">
                  <p className="text-xs text-blue-700">Ingresa el código de tu app autenticadora.</p>
                  <OtpInput value={pwdTfaOtp} onChange={setPwdTfaOtp} />
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={enviarCodigoCambioPwd}
                    disabled={pwdTfaSending}
                    className="flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-800 disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={pwdTfaSending ? 'animate-spin' : ''} />
                    {pwdTfaSendMsg ? 'Reenviar código' : 'Enviar código al correo'}
                  </button>
                  {pwdTfaSendMsg && (
                    <p className="text-xs text-slate-600">{pwdTfaSendMsg}</p>
                  )}
                  {pwdTfaSendMsg && (
                    <OtpInput value={pwdTfaOtp} onChange={setPwdTfaOtp} />
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button loading={cambiarPassword.isPending}
              disabled={
                !pwdActual || !pwdNuevo || !passwordsCoinciden || pwdNuevo.length < 6 ||
                (!!user?.twoFactorEnabled && pwdTfaOtp.join('').length < 6)
              }
              onClick={() => cambiarPassword.mutate()}>
              Cambiar contraseña
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Autenticación de dos factores ────────────────────────────────── */}
      <Card>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <ShieldCheck size={16} className="text-slate-500" /> Verificación en dos pasos (2FA)
            </h3>
            {user?.twoFactorEnabled ? (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">Activo</span>
            ) : (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">Inactivo</span>
            )}
          </div>

          {user?.twoFactorEnabled ? (
            // ── 2FA activo ────────────────────────────────────────────────
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                {user.twoFactorMethod === 'email'
                  ? <Mail size={18} className="text-green-600 shrink-0" />
                  : <Smartphone size={18} className="text-green-600 shrink-0" />}
                <div>
                  <p className="text-sm font-medium text-green-800">
                    {user.twoFactorMethod === 'email' ? 'Correo electrónico' : 'App autenticadora'}
                  </p>
                  <p className="text-xs text-green-600">
                    {user.twoFactorMethod === 'email'
                      ? 'Se envía un código a tu correo en cada inicio.'
                      : 'Usa Google Authenticator, Duo o Authy para generar códigos.'}
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="secondary" icon={<ShieldOff size={14} />}
                  onClick={() => { setTfaError(''); setDisablePwd(''); setModal({ type: 'disable' }) }}>
                  Desactivar 2FA
                </Button>
              </div>
            </div>
          ) : (
            // ── 2FA inactivo ──────────────────────────────────────────────
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                Protege tu cuenta con una segunda capa de seguridad. Podrás elegir entre una app autenticadora o tu correo electrónico.
              </p>
              <Button icon={<ShieldCheck size={14} />}
                onClick={() => { setTfaError(''); setModal({ type: 'choose' }) }}>
                Activar verificación en dos pasos
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* ── Modal 2FA ──────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

            {/* ── Elegir método ───────────────────────────────────────────── */}
            {modal.type === 'choose' && (
              <>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Elegir método de verificación</h3>
                  <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <div className="px-6 py-5 space-y-3">
                  <button
                    onClick={startSetupTotp}
                    disabled={tfaLoading}
                    className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Smartphone size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">App autenticadora</p>
                      <p className="text-xs text-slate-500 mt-0.5">Google Authenticator, Duo, Authy, Microsoft Authenticator…</p>
                    </div>
                  </button>

                  <button
                    onClick={startSetupEmail}
                    disabled={tfaLoading}
                    className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                      <Mail size={18} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">Correo electrónico</p>
                      <p className="text-xs text-slate-500 mt-0.5">Te enviamos un código cada vez que inicias sesión.</p>
                    </div>
                  </button>

                  {tfaError && <p className="text-sm text-red-600">{tfaError}</p>}
                </div>
              </>
            )}

            {/* ── Setup TOTP: QR ──────────────────────────────────────────── */}
            {modal.type === 'totp' && (
              <>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Escanea el código QR</h3>
                  <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <p className="text-sm text-slate-600">
                    Abre tu app autenticadora y escanea este código. Luego ingresa el código de 6 dígitos que aparece.
                  </p>

                  <div className="flex justify-center">
                    <img
                      src={`data:image/png;base64,${modal.qrCodeBase64}`}
                      alt="QR 2FA"
                      className="w-48 h-48 rounded-xl border border-slate-200"
                    />
                  </div>

                  <details className="text-xs text-slate-500">
                    <summary className="cursor-pointer flex items-center gap-1 hover:text-slate-700">
                      <QrCode size={12} /> ¿No puedes escanear? Ingresa la clave manualmente
                    </summary>
                    <p className="mt-2 font-mono bg-slate-50 rounded-lg px-3 py-2 break-all select-all border border-slate-200">
                      {modal.secret}
                    </p>
                  </details>

                  <OtpInput value={modal.otp} onChange={otp => setModal({ ...modal, otp })} />

                  {tfaError && <p className="text-sm text-red-600 text-center">{tfaError}</p>}

                  <Button className="w-full justify-center" loading={tfaLoading}
                    disabled={modal.otp.join('').length < 6}
                    onClick={() => confirmEnable(modal.otp)}>
                    Confirmar y activar
                  </Button>
                </div>
              </>
            )}

            {/* ── Setup Email ─────────────────────────────────────────────── */}
            {modal.type === 'email' && (
              <>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Verificar correo electrónico</h3>
                  <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <p className="text-sm text-slate-600">
                    Te enviamos un código a <strong>{user?.email}</strong>. Ingrésalo para confirmar.
                  </p>

                  <OtpInput value={modal.otp} onChange={otp => setModal({ ...modal, otp })} />

                  {tfaError && <p className="text-sm text-red-600 text-center">{tfaError}</p>}

                  <Button className="w-full justify-center" loading={tfaLoading}
                    disabled={modal.otp.join('').length < 6}
                    onClick={() => confirmEnable(modal.otp)}>
                    Confirmar y activar
                  </Button>
                </div>
              </>
            )}

            {/* ── Deshabilitar ────────────────────────────────────────────── */}
            {modal.type === 'disable' && (
              <>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Desactivar 2FA</h3>
                  <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <p className="text-sm text-slate-600">Ingresa tu contraseña para confirmar la desactivación.</p>
                  <input
                    type="password"
                    value={disablePwd}
                    onChange={e => setDisablePwd(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && confirmDisable()}
                    placeholder="Tu contraseña actual"
                    className={inputClass}
                    autoFocus
                  />
                  {tfaError && <p className="text-sm text-red-600">{tfaError}</p>}
                  <Button className="w-full justify-center" variant="secondary" loading={tfaLoading}
                    disabled={!disablePwd}
                    onClick={confirmDisable}>
                    Desactivar verificación en dos pasos
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
