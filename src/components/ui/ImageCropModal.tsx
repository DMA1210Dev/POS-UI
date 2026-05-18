import { useState, useRef, useCallback } from 'react'
import ReactCrop, {
  centerCrop, makeAspectCrop,
  type Crop, type PixelCrop,
} from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Crop as CropIcon, Check, X, RotateCw, Maximize2 } from 'lucide-react'
import Button from './Button'

// ── Utilidad: aplica el recorte con Canvas ──────────────────────────────────
function cropImageToFile(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  crop: PixelCrop,
  rotation: number,
  fileName: string,
): Promise<File> {
  const ctx = canvas.getContext('2d')!
  const scaleX = image.naturalWidth  / image.width
  const scaleY = image.naturalHeight / image.height
  const pixelRatio = window.devicePixelRatio || 1

  canvas.width  = Math.floor(crop.width  * scaleX * pixelRatio)
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio)

  ctx.scale(pixelRatio, pixelRatio)
  ctx.imageSmoothingQuality = 'high'

  const cropX = crop.x * scaleX
  const cropY = crop.y * scaleY
  const centerX = image.naturalWidth  / 2
  const centerY = image.naturalHeight / 2
  const rad = (rotation * Math.PI) / 180

  ctx.save()
  ctx.translate(-cropX, -cropY)
  ctx.translate(centerX, centerY)
  ctx.rotate(rad)
  ctx.translate(-centerX, -centerY)
  ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight)
  ctx.restore()

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('Canvas vacío')); return }
      resolve(new File([blob], fileName.replace(/\.[^.]+$/, '.png'), { type: 'image/png' }))
    }, 'image/png', 1)
  })
}

// ── Props ───────────────────────────────────────────────────────────────────
interface ImageCropModalProps {
  imageSrc: string
  fileName?: string
  /** Fija aspecto (ej. 1 para cuadrado). undefined = completamente libre */
  aspect?: number
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
  const imgRef    = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [crop,     setCrop]     = useState<Crop>()
  const [completed, setCompleted] = useState<PixelCrop>()
  const [rotation, setRotation] = useState(0)
  const [applying, setApplying] = useState(false)

  // Al cargar la imagen inicializa el recorte centrado
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget
    const initial = aspect
      ? centerCrop(makeAspectCrop({ unit: '%', width: 80 }, aspect, nw, nh), nw, nh)
      : centerCrop({ unit: '%', width: 80, height: 80 }, nw, nh)
    setCrop(initial)
  }, [aspect])

  // Seleccionar todo
  const selectAll = () => {
    if (!imgRef.current) return
    const { naturalWidth: nw, naturalHeight: nh } = imgRef.current
    const full = aspect
      ? centerCrop(makeAspectCrop({ unit: '%', width: 100 }, aspect, nw, nh), nw, nh)
      : ({ unit: '%' as const, x: 0, y: 0, width: 100, height: 100 })
    setCrop(full)
  }

  const handleConfirm = async () => {
    if (!completed || !imgRef.current || !canvasRef.current) return
    setApplying(true)
    try {
      const file = await cropImageToFile(
        imgRef.current, canvasRef.current, completed, rotation, fileName,
      )
      onConfirm(file)
    } catch {
      /* silencioso */
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden">

        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50">
              <CropIcon size={16} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 leading-tight">{title}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Arrastra las esquinas o bordes para ajustar el recorte
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-xl leading-none ml-4">✕</button>
        </div>

        {/* Área de recorte */}
        <div className="bg-slate-800 flex items-center justify-center overflow-auto p-3" style={{ maxHeight: 420, minHeight: 260 }}>
          <ReactCrop
            crop={crop}
            onChange={c => setCrop(c)}
            onComplete={c => setCompleted(c)}
            aspect={aspect}
            minWidth={20}
            minHeight={20}
            keepSelection
            style={{ maxHeight: 390 }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Preview"
              style={{
                maxHeight: 390,
                maxWidth: '100%',
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.15s ease',
              }}
              onLoad={onImageLoad}
            />
          </ReactCrop>
        </div>

        {/* Controles */}
        <div className="px-5 py-4 space-y-3 shrink-0">

          {/* Rotación */}
          <div className="flex items-center gap-3">
            <RotateCw size={15} className="text-slate-400 shrink-0" />
            <input
              type="range" min={-180} max={180} step={1}
              value={rotation}
              onChange={e => setRotation(Number(e.target.value))}
              className="flex-1 accent-blue-600 h-1.5"
            />
            <span className="text-xs text-slate-400 w-10 text-right font-mono">{rotation}°</span>
            {rotation !== 0 && (
              <button
                onClick={() => setRotation(0)}
                className="text-xs text-blue-500 hover:text-blue-700 font-medium"
              >
                Reset
              </button>
            )}
          </div>

          {/* Acciones rápidas + botones */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              title="Seleccionar toda la imagen"
            >
              <Maximize2 size={12} /> Todo
            </button>
            <div className="flex-1" />
            <Button
              type="button" variant="secondary"
              icon={<X size={14} />}
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              icon={<Check size={14} />}
              loading={applying}
              disabled={!completed || completed.width < 1 || completed.height < 1}
              onClick={handleConfirm}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </div>

      {/* Canvas oculto para generar el archivo */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
