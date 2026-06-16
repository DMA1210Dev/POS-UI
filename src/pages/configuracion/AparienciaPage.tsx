import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Palette, Upload, Trash2, ImageIcon, RefreshCw, PaintBucket, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { comercioApi, type UpdateAparienciaDto } from '../../api'
import { useComercio } from '../../context/ComercioContext'
import { useToast, errMsg } from '../../context/ToastContext'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import ImageCropModal from '../../components/ui/ImageCropModal'
import { COLORES_DEFAULT, parseColoresJson } from '../../lib/colores'
import type { ColoresMap } from '../../lib/colores'

function ColorGroup({ title, icon, description, colores, onChange, prefix, shades }: {
  title: string
  icon: React.ReactNode
  description: string
  colores: ColoresMap
  onChange: (key: string, value: string) => void
  prefix: string
  shades: number[]
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-slate-600">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
      </div>
      <p className="text-[11px] text-slate-400 -mt-2">{description}</p>
      {shades.map(s => {
        const key = `${prefix}-${s}`
        const val = colores[key] ?? COLORES_DEFAULT[key]
        return (
          <div key={key} className="flex items-center gap-2">
            <input
              type="color"
              className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0.5 bg-white shrink-0"
              value={val}
              onChange={e => onChange(key, e.target.value)}
            />
            <span className="text-[11px] font-mono text-slate-500 w-20 shrink-0">{key}</span>
            <input
              type="text"
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={val}
              onChange={e => onChange(key, e.target.value)}
            />
          </div>
        )
      })}
    </div>
  )
}

export default function AparienciaPage() {
  const { comercio } = useComercio()
  const qc  = useQueryClient()
  const { success, error } = useToast()
  const fileRef    = useRef<HTMLInputElement>(null)
  const fileRefTag = useRef<HTMLInputElement>(null)

  const [cropModal, setCropModal] = useState<{
    src: string
    fileName: string
    aspect: number | undefined
    title: string
    onConfirm: (file: File) => void
  } | null>(null)

  const openCrop = useCallback((
    file: File,
    aspect: number | undefined,
    title: string,
    onConfirm: (file: File) => void,
  ) => {
    const reader = new FileReader()
    reader.onload = () => {
      setCropModal({
        src: reader.result as string,
        fileName: file.name,
        aspect,
        title,
        onConfirm,
      })
    }
    reader.readAsDataURL(file)
  }, [])

  // Colores del sistema
  const [colores, setColores] = useState<ColoresMap>({ ...COLORES_DEFAULT })
  useEffect(() => {
    if (comercio?.coloresJson)
      setColores(parseColoresJson(comercio.coloresJson))
  }, [comercio?.coloresJson])

  const actualizarColor = (key: string, value: string) =>
    setColores(prev => ({ ...prev, [key]: value }))

  // Colores del menú lateral y login
  const [colorMenu,    setColorMenu]    = useState('#1e293b')
  const [colorMenuFin, setColorMenuFin] = useState('#1e293b')
  const [colorLogin,   setColorLogin]   = useState('#0f172a')
  const [colorLoginFin,setColorLoginFin]= useState('#1e3a8a')

  useEffect(() => {
    if (comercio) {
      setColorMenu(comercio.colorMenu ?? '#1e293b')
      setColorMenuFin(comercio.colorMenuFin ?? '#1e293b')
      setColorLogin(comercio.colorLogin ?? '#0f172a')
      setColorLoginFin(comercio.colorLoginFin ?? '#1e3a8a')
    }
  }, [comercio])

  // Mutations
  const guardar = useMutation({
    mutationFn: (dto: UpdateAparienciaDto) => comercioApi.updateApariencia(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comercio'] }); success('Cambios guardados') },
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

  const onSubmit = () => {
    guardar.mutate({
      colorMenu,
      colorMenuFin,
      colorLogin,
      colorLoginFin,
      coloresJson: JSON.stringify(colores),
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-brand-100 rounded-xl">
          <Palette size={22} className="text-brand-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Apariencia</h2>
          <p className="text-sm text-slate-400">Logos, colores del menú e identidad visual del sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Col 1: Logos */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ImageIcon size={15} className="text-slate-500" />
                <h3 className="font-semibold text-slate-700">Logos</h3>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
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
                      <Button type="button" variant="secondary" icon={<Upload size={13} />}
                        loading={subirLogo.isPending}
                        onClick={() => fileRef.current?.click()}>
                        {comercio?.logoUrl ? 'Cambiar' : 'Subir'}
                      </Button>
                      {comercio?.logoUrl && (
                        <Button type="button" variant="secondary" icon={<Trash2 size={13} className="text-danger-500" />}
                          loading={eliminarLogo.isPending}
                          onClick={() => eliminarLogo.mutate()}>
                          Quitar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100" />

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
                      <Button type="button" variant="secondary" icon={<Upload size={13} />}
                        loading={subirLogoTag.isPending}
                        onClick={() => fileRefTag.current?.click()}>
                        {comercio?.logoTagUrl ? 'Cambiar' : 'Subir'}
                      </Button>
                      {comercio?.logoTagUrl && (
                        <Button type="button" variant="secondary" icon={<Trash2 size={13} className="text-danger-500" />}
                          loading={eliminarLogoTag.isPending}
                          onClick={() => eliminarLogoTag.mutate()}>
                          Quitar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Col 2: Colores del menú y login */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette size={15} className="text-slate-500" />
                <h3 className="font-semibold text-slate-700">Menú lateral</h3>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-[11px] text-slate-400">Sólido si ambos colores son iguales, degradado si son distintos.</p>
              <div className="h-6 rounded-lg w-full"
                style={{ background: `linear-gradient(to right, ${colorMenu}, ${colorMenuFin})` }} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-500">Inicio</p>
                  <div className="flex items-center gap-2">
                    <input type="color" className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5 bg-white shrink-0"
                      value={colorMenu} onChange={e => setColorMenu(e.target.value)} />
                    <input type="text" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-brand-300"
                      value={colorMenu} onChange={e => setColorMenu(e.target.value)} placeholder="#1e293b" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-500">Fin</p>
                  <div className="flex items-center gap-2">
                    <input type="color" className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5 bg-white shrink-0"
                      value={colorMenuFin} onChange={e => setColorMenuFin(e.target.value)} />
                    <input type="text" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-brand-300"
                      value={colorMenuFin} onChange={e => setColorMenuFin(e.target.value)} placeholder="#1e293b" />
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette size={15} className="text-slate-500" />
                <h3 className="font-semibold text-slate-700">Inicio de sesión</h3>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-[11px] text-slate-400">Sólido si ambos colores son iguales, degradado si son distintos.</p>
              <div className="h-6 rounded-lg w-full"
                style={{ background: `linear-gradient(135deg, ${colorLogin}, ${colorLoginFin})` }} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-500">Inicio</p>
                  <div className="flex items-center gap-2">
                    <input type="color" className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5 bg-white shrink-0"
                      value={colorLogin} onChange={e => setColorLogin(e.target.value)} />
                    <input type="text" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-brand-300"
                      value={colorLogin} onChange={e => setColorLogin(e.target.value)} placeholder="#0f172a" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-500">Fin</p>
                  <div className="flex items-center gap-2">
                    <input type="color" className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5 bg-white shrink-0"
                      value={colorLoginFin} onChange={e => setColorLoginFin(e.target.value)} />
                    <input type="text" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-brand-300"
                      value={colorLoginFin} onChange={e => setColorLoginFin(e.target.value)} placeholder="#1e3a8a" />
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Col 3: Colores del sistema */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette size={15} className="text-slate-500" />
              <h3 className="font-semibold text-slate-700">Colores del sistema</h3>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-xs text-slate-400 mb-4">Personaliza la paleta de colores que se usa en todo el sistema.</p>
            <div className="space-y-6">
              <ColorGroup
                title="Primario"
                icon={<PaintBucket size={14} />}
                description="Botones, enlaces, estados activos"
                colores={colores}
                onChange={actualizarColor}
                prefix="brand"
                shades={[50, 100, 200, 300, 400, 500, 600, 700]}
              />
              <ColorGroup
                title="Éxito"
                icon={<CheckCircle size={14} />}
                description="Montos pagados, estados positivos"
                colores={colores}
                onChange={actualizarColor}
                prefix="success"
                shades={[50, 100, 400, 600, 700]}
              />
              <ColorGroup
                title="Advertencia"
                icon={<AlertTriangle size={14} />}
                description="Alertas, créditos, límites"
                colores={colores}
                onChange={actualizarColor}
                prefix="warning"
                shades={[50, 100, 200, 400, 500, 600, 700, 800]}
              />
              <ColorGroup
                title="Peligro"
                icon={<XCircle size={14} />}
                description="Errores, stock bajo, estados negativos"
                colores={colores}
                onChange={actualizarColor}
                prefix="danger"
                shades={[50, 100, 300, 400, 500, 600, 700]}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Guardar */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" icon={<RefreshCw size={13} />}
          onClick={() => {
            setColores({ ...COLORES_DEFAULT })
            guardar.mutate({
              colorMenu, colorMenuFin, colorLogin, colorLoginFin,
              coloresJson: '{}',
            })
          }}>
          Restablecer colores
        </Button>
        <Button type="button" loading={guardar.isPending} onClick={onSubmit}>
          Guardar cambios
        </Button>
      </div>

      {/* Inputs ocultos para logos */}
      <input
        ref={fileRef}
        type="file"
        accept=".png,.jpg,.jpeg,.gif,.webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) openCrop(file, undefined, 'Recortar logo del menú', (cropped) => subirLogo.mutate(cropped))
          e.target.value = ''
        }}
      />
      <input
        ref={fileRefTag}
        type="file"
        accept=".png,.ico,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) openCrop(file, undefined, 'Recortar favicon', (cropped) => subirLogoTag.mutate(cropped))
          e.target.value = ''
        }}
      />

      {cropModal && (
        <ImageCropModal
          imageSrc={cropModal.src}
          fileName={cropModal.fileName}
          aspect={cropModal.aspect}
          title={cropModal.title}
          onConfirm={(file) => {
            cropModal.onConfirm(file)
            setCropModal(null)
          }}
          onCancel={() => setCropModal(null)}
        />
      )}
    </div>
  )
}
