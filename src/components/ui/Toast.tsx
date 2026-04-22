import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToast, type ToastType } from '../../context/ToastContext'

const config: Record<ToastType, {
  icon: React.ElementType
  bg: string
  border: string
  text: string
  iconColor: string
  bar: string
}> = {
  success: {
    icon:      CheckCircle,
    bg:        'bg-white',
    border:    'border-green-400',
    text:      'text-slate-800',
    iconColor: 'text-green-500',
    bar:       'bg-green-400',
  },
  error: {
    icon:      XCircle,
    bg:        'bg-white',
    border:    'border-red-400',
    text:      'text-slate-800',
    iconColor: 'text-red-500',
    bar:       'bg-red-400',
  },
  warning: {
    icon:      AlertTriangle,
    bg:        'bg-white',
    border:    'border-amber-400',
    text:      'text-slate-800',
    iconColor: 'text-amber-500',
    bar:       'bg-amber-400',
  },
  info: {
    icon:      Info,
    bg:        'bg-white',
    border:    'border-blue-400',
    text:      'text-slate-800',
    iconColor: 'text-blue-500',
    bar:       'bg-blue-400',
  },
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map(toast => {
        const { icon: Icon, bg, border, text, iconColor, bar } = config[toast.type]
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto relative overflow-hidden rounded-xl border-l-4 shadow-lg ${bg} ${border}`}
          >
            {/* Barra de progreso */}
            <div className={`absolute bottom-0 left-0 h-0.5 w-full ${bar} opacity-30`} />

            <div className="flex items-start gap-3 px-4 py-3">
              <Icon size={18} className={`shrink-0 mt-0.5 ${iconColor}`} />
              <p className={`flex-1 text-sm font-medium leading-snug ${text}`}>
                {toast.message}
              </p>
              <button
                onClick={() => dismiss(toast.id)}
                className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
