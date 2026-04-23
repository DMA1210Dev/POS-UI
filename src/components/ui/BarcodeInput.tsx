import { useState, useRef, useEffect, useCallback } from 'react'
import { ScanLine, X } from 'lucide-react'

// BarcodeDetector: API nativa Chrome/Edge/Android
declare class BarcodeDetector {
  constructor(options?: { formats?: string[] })
  detect(source: HTMLVideoElement | HTMLCanvasElement): Promise<Array<{ rawValue: string }>>
}

interface Props {
  label?: string
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  camaraHabilitada?: boolean
  // Para react-hook-form con register()
  name?: string
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  inputRef?: React.Ref<HTMLInputElement>
}

export default function BarcodeInput({ label, placeholder, value, onChange, camaraHabilitada = true, name, onBlur, inputRef }: Props) {
  const [scanning,  setScanning]  = useState(false)
  const [iniciando, setIniciando] = useState(false)
  const videoRef  = useRef<HTMLVideoElement>(null)
  const stopRef   = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    stopRef.current?.()
    stopRef.current = null
    setScanning(false)
    setIniciando(false)
  }, [])

  useEffect(() => {
    if (!scanning) return

    let active = true
    let stream: MediaStream | null = null
    let timerId: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      active = false
      if (timerId !== null) clearTimeout(timerId)
      stream?.getTracks().forEach(t => t.stop())
      stream = null
      const v = videoRef.current
      if (v) { v.srcObject = null; v.load() }
    }
    stopRef.current = cleanup

    // ── BarcodeDetector nativo ────────────────────────────────────────────
    const nativeAvailable = typeof window !== 'undefined' && 'BarcodeDetector' in window

    const startWithNative = (detector: InstanceType<typeof BarcodeDetector>, video: HTMLVideoElement) => {
      const scan = async () => {
        if (!active) return
        try {
          const codes = await detector.detect(video)
          if (codes.length > 0 && active) {
            active = false
            cleanup()
            stopRef.current = null
            setScanning(false)
            setIniciando(false)
            onChange?.(codes[0].rawValue)
            return
          }
        } catch { /* frame sin código */ }
        if (active) timerId = setTimeout(scan, 200)
      }
      scan()
    }

    // ── Fallback: zxing decodeFromCanvas ──────────────────────────────────
    const startWithZxing = async (video: HTMLVideoElement) => {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      const canvas = document.createElement('canvas')
      const ctx    = canvas.getContext('2d', { willReadFrequently: true })!

      const scan = () => {
        if (!active) return
        if (video.readyState >= 2 && video.videoWidth > 0) {
          canvas.width  = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0)
          try {
            const result = reader.decodeFromCanvas(canvas)
            if (active) {
              active = false
              cleanup()
              stopRef.current = null
              setScanning(false)
              setIniciando(false)
              onChange?.(result.getText())
              return
            }
          } catch { /* sin código en este frame */ }
        }
        if (active) timerId = setTimeout(scan, 250)
      }
      scan()
    }

    // ── Arrancar cámara ───────────────────────────────────────────────────
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
      } catch {
        if (active) { cleanup(); setScanning(false); setIniciando(false) }
        return
      }
      if (!active) { stream.getTracks().forEach(t => t.stop()); return }

      const video = videoRef.current
      if (!video) { cleanup(); return }

      video.srcObject = stream
      try { await video.play() } catch { /* autoplay */ }
      setIniciando(false)
      if (!active) return

      if (nativeAvailable) {
        try {
          const detector = new BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'qr_code', 'code_128', 'code_39',
                      'code_93', 'upc_a', 'upc_e', 'itf', 'pdf417'],
          })
          startWithNative(detector, video)
          return
        } catch { /* fallback */ }
      }
      await startWithZxing(video)
    }

    setIniciando(true)
    start()
    return cleanup
  }, [scanning]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}

      <div className="flex gap-2">
        <input
          ref={inputRef}
          name={name}
          onBlur={onBlur}
          type="text"
          placeholder={placeholder}
          value={value ?? ''}
          onChange={e => onChange?.(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        {camaraHabilitada && (
          <button
            type="button"
            onClick={scanning ? stop : () => setScanning(true)}
            title={scanning ? 'Cerrar cámara' : 'Escanear con cámara'}
            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5 flex-shrink-0 ${
              scanning
                ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
                : 'border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            {scanning ? <X size={15} /> : <ScanLine size={15} />}
            {scanning ? 'Cerrar' : 'Cámara'}
          </button>
        )}
      </div>

      {/* Vista de cámara */}
      {scanning && (
        <div className="mt-1 rounded-xl overflow-hidden border border-slate-200 bg-black relative">
          <video ref={videoRef} playsInline muted autoPlay className="w-full h-48 object-cover" />
          {iniciando && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-2">
              <div className="w-7 h-7 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-white">Iniciando cámara…</p>
            </div>
          )}
          {!iniciando && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-20 border-2 border-blue-400 rounded-lg opacity-80" />
            </div>
          )}
          <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white bg-black/50 py-1">
            Apunta el código de barras al recuadro
          </p>
        </div>
      )}
    </div>
  )
}
