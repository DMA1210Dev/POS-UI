import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Key, Trash2, UserPlus, Eye, ShieldOff, Copy, Check, RefreshCw, KeyRound, Mail } from 'lucide-react'
import { usuariosApi } from '../../api'
import { Card } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { useToast, errMsg } from '../../context/ToastContext'
import { useRoles } from '../../context/RolesContext'
import type { UsuarioResponse, RegisterUsuarioDto } from '../../types'

const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-DO')
const inputClass = "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"

// Tailwind color → Badge color name (aproximado)
function badgeColorForRol(color: string): 'red' | 'orange' | 'green' | 'blue' | 'purple' | 'yellow' {
  if (color.includes('red'))    return 'red'
  if (color.includes('orange')) return 'orange'
  if (color.includes('green'))  return 'green'
  if (color.includes('purple') || color.includes('violet') || color.includes('indigo')) return 'purple'
  if (color.includes('yellow') || color.includes('amber')) return 'yellow'
  return 'blue'
}

export default function UsuariosPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const { roles, getLabelForRol, getColorForRol } = useRoles()

  // ── modales state ─────────────────────────────────────────────────────────
  const [crearModal, setCrearModal]   = useState(false)
  const [editModal, setEditModal]     = useState<UsuarioResponse | null>(null)
  const [editModo, setEditModo]       = useState<'ver' | 'editar'>('ver')
  const [pwdModal, setPwdModal]       = useState<UsuarioResponse | null>(null)

  // ── crear usuario ─────────────────────────────────────────────────────────
  const [newNombre, setNewNombre]       = useState('')
  const [newEmail, setNewEmail]         = useState('')
  const [newPwdCreate, setNewPwdCreate] = useState('')
  const [newRolCreate, setNewRolCreate] = useState('Cajero')

  // ── editar usuario ────────────────────────────────────────────────────────
  const [nombre, setNombre] = useState('')
  const [rol, setRol]       = useState('Cajero')
  const [activo, setActivo] = useState(true)

  // ── cambiar password ──────────────────────────────────────────────────────
  const [newPwd, setNewPwd]         = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')

  // ── restablecer acceso ────────────────────────────────────────────────────
  const [restablecerModal, setRestablecerModal] = useState<UsuarioResponse | null>(null)
  const [tempPwd,          setTempPwd]          = useState('')
  const [reactivar,        setReactivar]        = useState(true)
  const [copiado,          setCopiado]          = useState(false)

  // ── código reset pendiente ────────────────────────────────────────────────
  const [codigoResetModal, setCodigoResetModal] = useState<{
    usuario: UsuarioResponse
    codigo: string | null
    loading: boolean
  } | null>(null)
  const [codigoCopied,   setCodigoCopied]   = useState(false)
  const [enviandoCorreo, setEnviandoCorreo] = useState(false)

  const generarPassword = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!'
    return Array.from(crypto.getRandomValues(new Uint8Array(10)))
      .map(b => chars[b % chars.length])
      .join('')
  }, [])

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: usuariosApi.getAll,
  })

  const crear = useMutation({
    mutationFn: () => usuariosApi.create({
      nombre: newNombre, email: newEmail, password: newPwdCreate, rol: newRolCreate,
    } as RegisterUsuarioDto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] })
      setCrearModal(false)
      setNewNombre(''); setNewEmail(''); setNewPwdCreate(''); setNewRolCreate('Cajero')
      success('Usuario creado correctamente')
    },
    onError: (e) => error(errMsg(e)),
  })

  const actualizar = useMutation({
    mutationFn: () => usuariosApi.update(editModal!.id, { nombre, rol, activo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] })
      setEditModal(null)
      success('Usuario actualizado correctamente')
    },
    onError: (e) => error(errMsg(e)),
  })

  const cambiarPwd = useMutation({
    mutationFn: () => usuariosApi.cambiarPassword(pwdModal!.id, { nuevoPassword: newPwd, confirmarPassword: confirmPwd }),
    onSuccess: () => {
      setPwdModal(null); setNewPwd(''); setConfirmPwd('')
      success('Contraseña actualizada correctamente')
    },
    onError: (e) => error(errMsg(e)),
  })

  const eliminar = useMutation({
    mutationFn: (id: number) => usuariosApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); success('Usuario desactivado') },
    onError: (e) => error(errMsg(e)),
  })

  const restablecerAcceso = useMutation({
    mutationFn: async () => {
      const u = restablecerModal!
      await usuariosApi.cambiarPassword(u.id, { nuevoPassword: tempPwd, confirmarPassword: tempPwd })
      if (reactivar && !u.activo)
        await usuariosApi.update(u.id, { nombre: u.nombre, rol: u.rol, activo: true })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] })
      setRestablecerModal(null)
      success('Acceso restablecido correctamente')
    },
    onError: (e) => error(errMsg(e)),
  })

  const abrirRestablecer = (u: UsuarioResponse) => {
    setRestablecerModal(u)
    setTempPwd(generarPassword())
    setReactivar(!u.activo)
    setCopiado(false)
  }

  const copiarPassword = () => {
    navigator.clipboard.writeText(tempPwd)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const verCodigoReset = async (u: UsuarioResponse) => {
    setCodigoResetModal({ usuario: u, codigo: null, loading: true })
    setCodigoCopied(false)
    try {
      const res = await usuariosApi.getCodigoReset(u.id)
      setCodigoResetModal({ usuario: u, codigo: res.codigo, loading: false })
    } catch (e) {
      setCodigoResetModal(null)
      error('No se pudo obtener el código de recuperación')
    }
  }

  const copiarCodigo = () => {
    if (codigoResetModal?.codigo) {
      navigator.clipboard.writeText(codigoResetModal.codigo)
      setCodigoCopied(true)
      setTimeout(() => setCodigoCopied(false), 2000)
    }
  }

  // Select de roles para los modales
  const RolSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={e => onChange(e.target.value)} className={inputClass}>
      {roles.map(r => (
        <option key={r.nombre} value={r.nombre}>{r.label}</option>
      ))}
    </select>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Usuarios</h2>
        <Button icon={<UserPlus size={16} />} onClick={() => setCrearModal(true)}>
          Nuevo usuario
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>{['Nombre','Email','Rol','Registro','Estado',''].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Cargando...</td></tr>}
              {usuarios.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => { setEditModal(u); setNombre(u.nombre); setRol(u.rol); setActivo(u.activo); setEditModo('ver') }}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <span className="flex items-center gap-2">
                      {u.nombre}
                      {u.tieneResetPendiente && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Reset de contraseña pendiente" />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge color={badgeColorForRol(getColorForRol(u.rol))}>
                      {getLabelForRol(u.rol)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{fmtFecha(u.fechaCreacion)}</td>
                  <td className="px-4 py-3"><Badge color={u.activo ? 'green' : 'red'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" icon={<Eye size={14} />}
                        onClick={() => { setEditModal(u); setNombre(u.nombre); setRol(u.rol); setActivo(u.activo); setEditModo('ver') }} />
                      <Button variant="ghost" size="sm" icon={<Pencil size={14} />}
                        onClick={() => { setEditModal(u); setNombre(u.nombre); setRol(u.rol); setActivo(u.activo); setEditModo('editar') }} />
                      <Button variant="ghost" size="sm" icon={<Key size={14} />}
                        onClick={() => { setPwdModal(u); setNewPwd(''); setConfirmPwd('') }} />
                      <Button variant="ghost" size="sm" icon={<ShieldOff size={14} />}
                        className="text-amber-500 hover:bg-amber-50"
                        title="Restablecer acceso"
                        onClick={() => abrirRestablecer(u)} />
                      {u.tieneResetPendiente && (
                        <Button variant="ghost" size="sm" icon={<KeyRound size={14} />}
                          className="text-amber-600 hover:bg-amber-50"
                          title="Ver código de recuperación"
                          onClick={() => verCodigoReset(u)} />
                      )}
                      <Button variant="ghost" size="sm" icon={<Trash2 size={14} />}
                        className="text-red-500 hover:bg-red-50"
                        onClick={() => eliminar.mutate(u.id)} />
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && usuarios.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No hay usuarios</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Modal: Nuevo usuario ─────────────────────────────────────────────── */}
      {crearModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="font-semibold text-slate-800">Nuevo usuario</h3>
              <button onClick={() => setCrearModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Nombre *</label>
                <input value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Ej: Juan Pérez" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Email *</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="usuario@ejemplo.com" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Password *</label>
                <input type="password" value={newPwdCreate} onChange={e => setNewPwdCreate(e.target.value)} placeholder="Mínimo 6 caracteres" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Rol</label>
                <RolSelect value={newRolCreate} onChange={setNewRolCreate} />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <Button variant="secondary" onClick={() => setCrearModal(false)}>Cancelar</Button>
                <Button loading={crear.isPending} disabled={!newNombre || !newEmail || newPwdCreate.length < 6}
                  onClick={() => crear.mutate()}>
                  Crear usuario
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Ver / Editar usuario ──────────────────────────────────────── */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <div>
                <h3 className="font-semibold text-slate-800">
                  {editModo === 'ver' ? editModal.nombre : 'Editar usuario'}
                </h3>
                {editModo === 'ver' && <p className="text-xs text-slate-400 mt-0.5">Datos del registro</p>}
              </div>
              <div className="flex items-center gap-2">
                {editModo === 'ver' && (
                  <button onClick={() => setEditModo('editar')}
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                    <Pencil size={12} /> Editar
                  </button>
                )}
                <button onClick={() => setEditModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
            </div>

            {editModo === 'ver' ? (
              <div className="px-6 py-4 space-y-0">
                {[
                  { label: 'Nombre',   valor: editModal.nombre },
                  { label: 'Email',    valor: editModal.email },
                  { label: 'Rol',      valor: <Badge color={badgeColorForRol(getColorForRol(editModal.rol))}>{getLabelForRol(editModal.rol)}</Badge> },
                  { label: 'Registro', valor: fmtFecha(editModal.fechaCreacion) },
                  { label: 'Estado',   valor: <Badge color={editModal.activo ? 'green' : 'red'}>{editModal.activo ? 'Activo' : 'Inactivo'}</Badge> },
                ].map(({ label, valor }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="text-sm font-medium text-slate-800">{valor}</span>
                  </div>
                ))}
                <div className="flex justify-end pt-3">
                  <Button variant="secondary" onClick={() => setEditModal(null)}>Cerrar</Button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Nombre</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Rol</label>
                  <RolSelect value={rol} onChange={setRol} />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-700">
                  <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} /> Activo
                </label>
                <div className="flex justify-end gap-3 pt-1">
                  <Button variant="secondary" onClick={() => setEditModo('ver')}>Cancelar</Button>
                  <Button loading={actualizar.isPending} onClick={() => actualizar.mutate()}>Guardar</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Restablecer acceso ────────────────────────────────────────── */}
      {restablecerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-amber-50 px-6 py-4 flex items-center gap-3 border-b border-amber-100">
              <div className="p-2 rounded-full bg-amber-100">
                <ShieldOff size={18} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-800">Restablecer acceso</h3>
                <p className="text-xs text-amber-600">{restablecerModal.nombre}</p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600">
                Se generará una contraseña temporal. Compártela con el usuario para que pueda ingresar.
              </p>

              {/* Contraseña temporal */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Contraseña temporal
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-800 tracking-wider select-all">
                    {tempPwd}
                  </div>
                  <button
                    onClick={copiarPassword}
                    title="Copiar"
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      copiado
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {copiado ? <Check size={14} /> : <Copy size={14} />}
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                  <button
                    onClick={() => { setTempPwd(generarPassword()); setCopiado(false) }}
                    title="Generar otra"
                    className="flex items-center px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              {/* Reactivar cuenta (solo si está inactivo) */}
              {!restablecerModal.activo && (
                <label className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reactivar}
                    onChange={e => setReactivar(e.target.checked)}
                    className="mt-0.5 accent-amber-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Reactivar cuenta</p>
                    <p className="text-xs text-amber-600">La cuenta está inactiva. Actívala para que el usuario pueda ingresar.</p>
                  </div>
                </label>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <Button variant="secondary" onClick={() => setRestablecerModal(null)}>
                  Cancelar
                </Button>
                <Button
                  loading={restablecerAcceso.isPending}
                  className="bg-amber-500 hover:bg-amber-600 border-amber-500"
                  onClick={() => restablecerAcceso.mutate()}
                >
                  Restablecer acceso
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Código de recuperación ───────────────────────────────────── */}
      {codigoResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-amber-50 px-6 py-4 flex items-center gap-3 border-b border-amber-100">
              <div className="p-2 rounded-full bg-amber-100">
                <KeyRound size={18} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-800">Código de recuperación</h3>
                <p className="text-xs text-amber-600">{codigoResetModal.usuario.nombre}</p>
              </div>
              <button onClick={() => setCodigoResetModal(null)} className="ml-auto text-amber-400 hover:text-amber-600">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {codigoResetModal.loading ? (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-600">
                    Comparte este código con <strong>{codigoResetModal.usuario.nombre}</strong> para que pueda restablecer su contraseña. Expira en 30 minutos.
                  </p>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 flex items-center justify-center px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl font-mono text-2xl font-bold text-amber-800 tracking-[0.3em] select-all">
                      {codigoResetModal.codigo}
                    </div>
                    <button
                      onClick={copiarCodigo}
                      title="Copiar"
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        codigoCopied
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {codigoCopied ? <Check size={14} /> : <Copy size={14} />}
                      {codigoCopied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <Button
                      variant="secondary"
                      icon={<Mail size={14} />}
                      loading={enviandoCorreo}
                      onClick={async () => {
                        setEnviandoCorreo(true)
                        try {
                          await usuariosApi.enviarCodigoReset(codigoResetModal!.usuario.id)
                          success(`Código enviado a ${codigoResetModal!.usuario.email}`)
                        } catch (e) { error(errMsg(e)) }
                        finally { setEnviandoCorreo(false) }
                      }}
                    >
                      Enviar por correo
                    </Button>
                    <Button variant="secondary" onClick={() => setCodigoResetModal(null)}>Cerrar</Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Cambiar password ──────────────────────────────────────────── */}
      {pwdModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="font-semibold text-slate-800">Password — {pwdModal.nombre}</h3>
              <button onClick={() => setPwdModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Nuevo password</label>
                <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Confirmar password</label>
                <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} className={inputClass} />
              </div>
              {newPwd && confirmPwd && newPwd !== confirmPwd && (
                <p className="text-amber-600 text-sm">Los passwords no coinciden</p>
              )}
              <div className="flex justify-end gap-3 pt-1">
                <Button variant="secondary" onClick={() => setPwdModal(null)}>Cancelar</Button>
                <Button loading={cambiarPwd.isPending} disabled={!newPwd || newPwd !== confirmPwd}
                  onClick={() => cambiarPwd.mutate()}>
                  Cambiar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
