import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Store, Receipt, Upload, Trash2, ImageIcon, ShieldCheck, User, Users, Vault, Mail, SendHorizonal, Palette } from 'lucide-react'
import { comercioApi, type UpdateComercioDto } from '../../api'
import { useComercio } from '../../context/ComercioContext'
import { useAuth } from '../../context/AuthContext'
import { useToast, errMsg } from '../../context/ToastContext'
import { useRoles } from '../../context/RolesContext'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

// ── Toggle reutilizable ───────────────────────────────────────────────────────
function Toggle({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700 leading-tight">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5 leading-snug">{desc}</p>
      </div>
      {children}
    </div>
  )
}

function ToggleSwitch({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
      <input type="checkbox" className="sr-only peer" {...props} />
      <div className="w-10 h-5 bg-slate-200 rounded-full peer
        peer-checked:after:translate-x-full peer-checked:after:border-white
        after:content-[''] after:absolute after:top-[2px] after:left-[2px]
        after:bg-white after:border-slate-300 after:border after:rounded-full
        after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
    </label>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function ComercioPage() {
  const { comercio } = useComercio()
  const { user }     = useAuth()
  const qc           = useQueryClient()
  const { success, error } = useToast()
  const fileRef    = useRef<HTMLInputElement>(null)
  const fileRefTag = useRef<HTMLInputElement>(null)
  const [probandoSmtp, setProbandoSmtp] = useState(false)

  const { register, handleSubmit, reset, control, setValue, getValues,
          formState: { errors, isDirty } } = useForm<UpdateComercioDto>()

  const facturacionHabilitada = useWatch({ control, name: 'facturacionElectronicaHabilitada' }) ?? false
  const autoAprobacion        = useWatch({ control, name: 'permitirAutoAprobacion' })
  const rolesActuales         = useWatch({ control, name: 'rolesAprobadores' })    ?? []
  const rolesMayoristas   = useWatch({ control, name: 'rolesMayoristas' })     ?? []
  const colorMenu         = useWatch({ control, name: 'colorMenu' })            ?? '#1e293b'
  const colorMenuFin      = useWatch({ control, name: 'colorMenuFin' })         ?? '#1e293b'
  const colorLogin        = useWatch({ control, name: 'colorLogin' })           ?? '#0f172a'
  const colorLoginFin     = useWatch({ control, name: 'colorLoginFin' })        ?? '#1e3a8a'
  const todosVenMayoristas = rolesMayoristas.includes('*')
  const { roles: rolesDisponibles } = useRoles()

  useEffect(() => {
    if (comercio) reset({
      nombre:                      comercio.nombre,
      slogan:                      comercio.slogan    ?? '',
      telefono:                    comercio.telefono  ?? '',
      direccion:                   comercio.direccion ?? '',
      rnc:                         comercio.rnc       ?? '',
      facturacionElectronicaHabilitada: comercio.facturacionElectronicaHabilitada ?? false,
      permitirVentaSinComprobante:      comercio.permitirVentaSinComprobante,
      permitirVentaSinCliente:          comercio.permitirVentaSinCliente,
      permitirAutoAprobacion:      comercio.permitirAutoAprobacion,
      permitirCajaChica:           comercio.permitirCajaChica ?? true,
      rolesMayoristas:             comercio.rolesMayoristas?.length
                                     ? comercio.rolesMayoristas
                                     : ['AdminSistema', 'GerenteGeneral'],
      rolesAprobadores:            comercio.rolesAprobadores?.length
                                     ? comercio.rolesAprobadores
                                     : ['AdminSistema', 'GerenteGeneral'],
      colorMenu:    comercio.colorMenu    ?? '#1e293b',
      colorMenuFin: comercio.colorMenuFin ?? '#1e293b',
      colorLogin:   comercio.colorLogin   ?? '#0f172a',
      colorLoginFin:comercio.colorLoginFin?? '#1e3a8a',
      smtpHost:     comercio.smtpHost     ?? '',
      smtpPort:     comercio.smtpPort     ?? 465,
      smtpUseSsl:   comercio.smtpUseSsl   ?? true,
      smtpUsername: comercio.smtpUsername ?? '',
      smtpFromName: comercio.smtpFromName ?? '',
      smtpPassword: '',  // nunca pre-llenar la contraseña
    })
  }, [comercio, reset])

  const guardar = useMutation({
    mutationFn: (dto: UpdateComercioDto) => comercioApi.update(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comercio'] }); success('Configuración guardada') },
    onError:   (e) => error(errMsg(e)),
  })

  const subirLogo = useMutation({
    mutationFn: (file: File) => comercioApi.uploadLogo(file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comercio'] }); success('Logo actualizado') },
    onError:   (e) => error(errMsg(e)),
  })

  const eliminarLogo = useMutation({
    mutationFn: () => comercioApi.deleteLogo(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comercio'] }); success('Logo eliminado') },
    onError:   (e) => error(errMsg(e)),
  })

  const subirLogoTag = useMutation({
    mutationFn: (file: File) => comercioApi.uploadLogoTag(file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comercio'] }); success('Favicon actualizado') },
    onError:   (e) => error(errMsg(e)),
  })

  const eliminarLogoTag = useMutation({
    mutationFn: () => comercioApi.deleteLogoTag(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comercio'] }); success('Favicon eliminado') },
    onError:   (e) => error(errMsg(e)),
  })

  const toggleRol = (val: string, checked: boolean) => {
    const prev = getValues('rolesAprobadores') ?? []
    setValue(
      'rolesAprobadores',
      checked ? [...prev, val] : prev.filter(r => r !== val),
      { shouldDirty: true },
    )
  }

  const toggleRolMayorista = (val: string, checked: boolean) => {
    const prev = getValues('rolesMayoristas').filter(r => r !== '*')
    setValue(
      'rolesMayoristas',
      checked ? [...prev, val] : prev.filter(r => r !== val),
      { shouldDirty: true },
    )
  }

  const toggleTodosMayoristas = (checked: boolean) => {
    setValue(
      'rolesMayoristas',
      checked ? ['*'] : ['AdminSistema', 'GerenteGeneral'],
      { shouldDirty: true },
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Store size={22} className="text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Configuración del comercio</h2>
          <p className="text-sm text-slate-400">Ajusta los datos del negocio, reglas de facturación y aprobaciones</p>
        </div>
      </div>

      {/* ── Grid 3 columnas ────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(d => guardar.mutate(d))}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

          {/* ── Col 1: Info del negocio + Logos ──────────────────────── */}
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Store size={15} className="text-slate-500" />
                  <h3 className="font-semibold text-slate-700">Información del negocio</h3>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <Input
                  label="Nombre *"
                  placeholder="Ej: Farmacia Doménica"
                  error={errors.nombre?.message}
                  {...register('nombre', { required: 'Requerido' })}
                />
                <Input
                  label="Slogan"
                  placeholder="Ej: Tu salud, nuestra prioridad"
                  {...register('slogan')}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Teléfono" placeholder="809-555-0000" {...register('telefono')} />
                  <Input label="RNC / NIF" placeholder="1-23-45678-9" {...register('rnc')} />
                </div>
                <Input
                  label="Dirección"
                  placeholder="Ej: Av. 27 de Febrero #100"
                  {...register('direccion')}
                />

                {/* Preview recibo */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-0.5 mt-1">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Vista previa recibo</p>
                  <p className="font-bold text-slate-800 text-sm">{comercio?.nombre ?? '—'}</p>
                  {comercio?.slogan    && <p className="text-[11px] text-slate-500">{comercio.slogan}</p>}
                  {comercio?.telefono  && <p className="text-[11px] text-slate-500">Tel: {comercio.telefono}</p>}
                  {comercio?.direccion && <p className="text-[11px] text-slate-500">{comercio.direccion}</p>}
                  {comercio?.rnc       && <p className="text-[11px] text-slate-500">RNC: {comercio.rnc}</p>}
                </div>
              </CardBody>
            </Card>

            {/* Logos */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ImageIcon size={15} className="text-slate-500" />
                  <h3 className="font-semibold text-slate-700">Logos y apariencia</h3>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">

                {/* Logo del menú */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-600">Logo del menú</p>
                  <p className="text-[11px] text-slate-400 -mt-1">Se muestra en la barra lateral del sistema.</p>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-14 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                      {comercio?.logoUrl ? (
                        <img src={comercio.logoUrl} alt="Logo menú" className="w-full h-full object-contain p-1" />
                      ) : (
                        <div className="text-center">
                          <ImageIcon size={18} className="mx-auto text-slate-300" />
                          <p className="text-[10px] text-slate-400 mt-0.5">Sin logo</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <p className="text-xs text-slate-500">PNG, JPG, SVG · máx. 2 MB</p>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          variant="secondary"
                          icon={<Upload size={13} />}
                          loading={subirLogo.isPending}
                          onClick={() => fileRef.current?.click()}
                        >
                          {comercio?.logoUrl ? 'Cambiar' : 'Subir'}
                        </Button>
                        {comercio?.logoUrl && (
                          <Button
                            type="button"
                            variant="secondary"
                            icon={<Trash2 size={13} className="text-red-500" />}
                            loading={eliminarLogo.isPending}
                            onClick={() => eliminarLogo.mutate()}
                          >
                            Quitar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100" />

                {/* Favicon / Logo del navegador */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-600">Logo del navegador (favicon)</p>
                  <p className="text-[11px] text-slate-400 -mt-1">Icono que aparece en la pestaña del navegador. Recomendado: imagen cuadrada PNG.</p>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                      {comercio?.logoTagUrl ? (
                        <img src={comercio.logoTagUrl} alt="Favicon" className="w-full h-full object-contain p-1" />
                      ) : (
                        <div className="text-center">
                          <ImageIcon size={18} className="mx-auto text-slate-300" />
                          <p className="text-[10px] text-slate-400 mt-0.5">Sin icono</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <p className="text-xs text-slate-500">PNG, ICO, SVG · cuadrado · máx. 2 MB</p>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          variant="secondary"
                          icon={<Upload size={13} />}
                          loading={subirLogoTag.isPending}
                          onClick={() => fileRefTag.current?.click()}
                        >
                          {comercio?.logoTagUrl ? 'Cambiar' : 'Subir'}
                        </Button>
                        {comercio?.logoTagUrl && (
                          <Button
                            type="button"
                            variant="secondary"
                            icon={<Trash2 size={13} className="text-red-500" />}
                            loading={eliminarLogoTag.isPending}
                            onClick={() => eliminarLogoTag.mutate()}
                          >
                            Quitar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100" />

                {/* Colores del menú lateral */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Palette size={13} className="text-slate-500" />
                    <p className="text-xs font-medium text-slate-600">Menú lateral</p>
                  </div>
                  <p className="text-[11px] text-slate-400 -mt-1">Sólido si ambos colores son iguales, degradado si son distintos.</p>
                  <div
                    className="h-6 rounded-lg w-full"
                    style={{ background: `linear-gradient(to right, ${colorMenu}, ${colorMenuFin})` }}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] text-slate-500">Inicio</p>
                      <div className="flex items-center gap-2">
                        <input type="color" className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5 bg-white shrink-0"
                          value={colorMenu} onChange={e => setValue('colorMenu', e.target.value, { shouldDirty: true })} />
                        <input type="text" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder="#1e293b" {...register('colorMenu')} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-slate-500">Fin</p>
                      <div className="flex items-center gap-2">
                        <input type="color" className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5 bg-white shrink-0"
                          value={colorMenuFin} onChange={e => setValue('colorMenuFin', e.target.value, { shouldDirty: true })} />
                        <input type="text" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder="#1e293b" {...register('colorMenuFin')} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100" />

                {/* Colores del login */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Palette size={13} className="text-slate-500" />
                    <p className="text-xs font-medium text-slate-600">Pantalla de inicio de sesión</p>
                  </div>
                  <p className="text-[11px] text-slate-400 -mt-1">Sólido si ambos colores son iguales, degradado si son distintos.</p>
                  <div
                    className="h-6 rounded-lg w-full"
                    style={{ background: `linear-gradient(135deg, ${colorLogin}, ${colorLoginFin})` }}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] text-slate-500">Inicio</p>
                      <div className="flex items-center gap-2">
                        <input type="color" className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5 bg-white shrink-0"
                          value={colorLogin} onChange={e => setValue('colorLogin', e.target.value, { shouldDirty: true })} />
                        <input type="text" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder="#0f172a" {...register('colorLogin')} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-slate-500">Fin</p>
                      <div className="flex items-center gap-2">
                        <input type="color" className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5 bg-white shrink-0"
                          value={colorLoginFin} onChange={e => setValue('colorLoginFin', e.target.value, { shouldDirty: true })} />
                        <input type="text" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder="#1e3a8a" {...register('colorLoginFin')} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inputs ocultos */}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.gif,.webp,.svg"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) subirLogo.mutate(file)
                    e.target.value = ''
                  }}
                />
                <input
                  ref={fileRefTag}
                  type="file"
                  accept=".png,.ico,.svg,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) subirLogoTag.mutate(file)
                    e.target.value = ''
                  }}
                />
              </CardBody>
            </Card>
          </div>

          {/* ── Col 2: Fiscal ─────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Fiscal */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Receipt size={15} className="text-slate-500" />
                  <h3 className="font-semibold text-slate-700">Facturación</h3>
                </div>
              </CardHeader>
              <CardBody className="py-1 px-4">
                {/* Switch maestro */}
                <Toggle
                  label="Facturación electrónica"
                  desc="Habilita comprobantes fiscales y el módulo NCF en todo el sistema."
                >
                  <ToggleSwitch {...register('facturacionElectronicaHabilitada')} />
                </Toggle>

                {/* Sub-opciones: solo visibles si la facturación está habilitada */}
                <div className={`transition-opacity duration-200 ${facturacionHabilitada ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <Toggle
                    label="Vender sin comprobante"
                    desc="Permite omitir el tipo de comprobante fiscal en la venta."
                  >
                    <ToggleSwitch {...register('permitirVentaSinComprobante')} disabled={!facturacionHabilitada} />
                  </Toggle>
                </div>

                <Toggle
                  label="Facturar sin cliente"
                  desc="Permite registrar ventas sin seleccionar un cliente."
                >
                  <ToggleSwitch {...register('permitirVentaSinCliente')} />
                </Toggle>
              </CardBody>
            </Card>

            {/* Caja chica */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Vault size={15} className="text-slate-500" />
                  <h3 className="font-semibold text-slate-700">Caja chica</h3>
                </div>
              </CardHeader>
              <CardBody className="py-1 px-4">
                <Toggle
                  label="Permitir caja chica a cajeros"
                  desc="Si está desactivado, solo Admin y Gerente pueden abrir sesiones de caja. Los cajeros no tendrán acceso."
                >
                  <ToggleSwitch {...register('permitirCajaChica')} />
                </Toggle>
              </CardBody>
            </Card>

            {/* Clientes mayoristas */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-slate-500" />
                  <h3 className="font-semibold text-slate-700">Clientes mayoristas</h3>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <Toggle
                  label="Visible para todos"
                  desc="Cualquier rol puede ver la etiqueta y el filtro de mayoristas."
                >
                  <ToggleSwitch
                    checked={todosVenMayoristas}
                    onChange={e => toggleTodosMayoristas(e.target.checked)}
                  />
                </Toggle>

                {!todosVenMayoristas && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <User size={13} className="text-slate-400" />
                      <p className="text-xs font-medium text-slate-600">Roles que pueden verlos</p>
                    </div>
                    <div className="space-y-1.5">
                      {rolesDisponibles.map(rol => {
                        const checked = rolesMayoristas.includes(rol.nombre)
                        return (
                          <label
                            key={rol.nombre}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                              checked
                                ? 'border-purple-400 bg-purple-50 text-purple-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              checked ? 'bg-purple-600 border-purple-600' : 'border-slate-300'
                            }`}>
                              {checked && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                            </span>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={checked}
                              onChange={e => toggleRolMayorista(rol.nombre, e.target.checked)}
                            />
                            {rol.label}
                          </label>
                        )
                      })}
                    </div>
                    {rolesMayoristas.filter(r => r !== '*').length === 0 && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Sin ningún rol seleccionado, nadie verá la distinción de mayoristas.
                      </p>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Correo electrónico */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail size={15} className="text-slate-500" />
                  <h3 className="font-semibold text-slate-700">Correo electrónico</h3>
                  {comercio?.smtpConfigurado ? (
                    <span className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Configurado</span>
                  ) : (
                    <span className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Sin configurar</span>
                  )}
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Input
                      label="Servidor SMTP"
                      placeholder="sv91.ifastnet.com"
                      {...register('smtpHost')}
                    />
                  </div>
                  <Input
                    label="Puerto"
                    type="number"
                    placeholder="465"
                    {...register('smtpPort', { valueAsNumber: true })}
                  />
                  <div className="flex flex-col justify-end pb-1">
                    <Toggle label="SSL/TLS" desc="">
                      <ToggleSwitch {...register('smtpUseSsl')} />
                    </Toggle>
                  </div>
                </div>
                <Input
                  label="Correo remitente"
                  type="email"
                  placeholder="informacion@ejemplo.com"
                  {...register('smtpUsername')}
                />
                <Input
                  label="Nombre del remitente"
                  placeholder="Mi Negocio"
                  {...register('smtpFromName')}
                />
                <Input
                  label="Contraseña"
                  type="password"
                  placeholder="••••••• (dejar vacío para no cambiar)"
                  {...register('smtpPassword')}
                />
                <p className="text-[11px] text-slate-400 leading-snug">
                  La contraseña solo se actualiza si escribes una nueva.
                </p>

                {/* Botón de prueba — solo si ya está configurado */}
                {comercio?.smtpConfigurado && (
                  <div className="pt-1 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="secondary"
                      icon={<SendHorizonal size={13} />}
                      loading={probandoSmtp}
                      onClick={async () => {
                        if (!user?.email) return
                        setProbandoSmtp(true)
                        try {
                          await comercioApi.probarSmtp(user.email)
                          success(`Correo de prueba enviado a ${user.email}`)
                        } catch (e) { error(errMsg(e)) }
                        finally { setProbandoSmtp(false) }
                      }}
                    >
                      Enviar correo de prueba
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* ── Col 3: Aprobación de ventas ───────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-slate-500" />
                <h3 className="font-semibold text-slate-700">Aprobación de ventas</h3>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <Toggle
                label="Auto-aprobación"
                desc="Las ventas se aprueban automáticamente al crearse sin revisión manual."
              >
                <ToggleSwitch {...register('permitirAutoAprobacion')} />
              </Toggle>

              {!autoAprobacion && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <User size={13} className="text-slate-400" />
                    <p className="text-xs font-medium text-slate-600">Roles que pueden aprobar</p>
                  </div>
                  <div className="space-y-1.5">
                    {rolesDisponibles.map(rol => {
                      const checked = rolesActuales.includes(rol.nombre)
                      return (
                        <label
                          key={rol.nombre}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                            checked
                              ? 'border-blue-400 bg-blue-50 text-blue-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                          }`}>
                            {checked && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                          </span>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={checked}
                            onChange={e => toggleRol(rol.nombre, e.target.checked)}
                          />
                          {rol.label}
                        </label>
                      )
                    })}
                  </div>
                  {rolesActuales.length === 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Selecciona al menos un rol para poder aprobar ventas.
                    </p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Guardar — único botón para todo el formulario */}
        <div className="flex justify-end mt-5">
          <Button type="submit" loading={guardar.isPending} disabled={!isDirty}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  )
}
