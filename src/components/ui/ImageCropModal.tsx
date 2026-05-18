import { useState, useCallback } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Crop, ZoomIn, ZoomOut, RotateCw, Check, X } from 'lucide-react'
import Button from './Button'

// ── Utilidad: recortar imagen con Canvas ────────────────────────────────────
async function getCroppedFile(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
  fileName = 'logo.png',
): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = imageSrc
  })

  const canvas  = document.createElement('canvas')
  const ctx     = canvas.getContext('2d')!
  const radians = (rotation * Math.PI) / 180

  // Tamaño del canvas rotado
  const sin = Math.abs(Math.sin(radians))
  const cos = Math.abs(Math.cos(radians))
  const bw  = image.width * cos + image.height * sin
  const bh  = image.width * sin + image.height * cos

  const offCanvas = document.createElement('canvas')
  offCanvas.width  = bw
  offCanvas.height = bh
  const offCtx = offCanvas.getContext('2d')!
  offCtx.translate(bw / 2, bh / 2)
  offCtx.rotate(radians)
  offCtx.drawImage(image, -image.width / 2, -image.height / 2)

  canvas.width  = pixelCrop.width
  canvas.height = pixelCrop.height
  ctx.drawImage(
    offCanvas,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    pixelCrop.width, pixelCrop.height,
  )

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('Canvas vacío')); return }
      resolve(new File([blob], fileName, { type: 'image/png' }))
    }, 'image/png')
  })
}

// ── Props ───────────────────────────────────────────────────────────────────
interface ImageCropModalProps {
  /** Data URL de la imagen original (desde FileReader) */
  imageSrc: string
  /** Nombre del archivo para el File resultante */
  fileName?: string
  /** Relación de aspecto del recorte. undefined = libre */
  aspect?: number
  /** Título que se muestra en el modal */
  title?: string
  onConfirm: (file: File) => void
  onCancel: () => void
}

// ── Componente ──────────────────────────────────────────────────────────────
export default function ImageCropModal({
  imageSrc,
  fileName = 'imagen.png',
  aspect,
  title = 'Recortar imagen',
  onConfirm,
  onCancel,
}: ImageCropModalProps) {
  const [crop,       setCrop]       = useState({ x: 0, y: 0 })
  const [zoom,       setZoom]       = useState(1)
  const [rotation,   setRotation]   = useState(0)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [applying,   setApplying]   = useState(false)

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedArea(croppedPixels)
  }, [])

  const handleConfirm = async () => {
    if (!croppedArea) return
    setApplying(true)
    try {
      const file = await getCroppedFile(imageSrc, croppedArea, rotation, fileName)
      onConfirm(file)
    } catch {
      /* silencioso — el usuario puede reintentar */
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">

        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50">
              <Crop size={16} className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-800">{title}</h3>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>

        {/* Área de recorte */}
        <div className="relative bg-slate-900" style={{ height: 340 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle:  { border: '2px solid #3b82f6', borderRadius: 8 },
            }}
          />
        </div>

        {/* Controles */}
        <div className="px-5 py-4 space-y-3 shrink-0">

          {/* Zoom */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setZoom(z => Math.max(1, z - 0.1))}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              title="Alejar"
            >
              <ZoomOut size={16} />
            </button>
            <input
              type="range"
              min={1} max={3} step={0.05}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 accent-blue-600 h-1.5"
            />
            <button
              onClick={() => setZoom(z => Math.min(3, z + 0.1))}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              title="Acercar"
            >
              <ZoomIn size={16} />
            </button>
            <span className="text-xs text-slate-400 w-10 text-right">{Math.round(zoom * 100)}%</span>
          </div>

          {/* Rotación */}
          <div className="flex items-center gap-3">
            <RotateCw size={15} className="text-slate-400 shrink-0" />
            <input
              type="range"
              min={-180} max={180} step={1}
              value={rotation}
              onChange={e => setRotation(Number(e.target.value))}
              className="flex-1 accent-blue-600 h-1.5"
            />
            <span className="text-xs text-slate-400 w-10 text-right">{rotation}°</span>
            {rotation !== 0 && (
              <button
                onClick={() => setRotation(0)}
                className="text-xs text-blue-500 hover:text-blue-700 font-medium"
              >
                Reset
              </button>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              icon={<X size={14} />}
              className="flex-1 justify-center"
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              icon={<Check size={14} />}
              className="flex-1 justify-center"
              loading={applying}
              onClick={handleConfirm}
            >
              Aplicar recorte
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
