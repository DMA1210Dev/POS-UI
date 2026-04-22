import { useLocation } from 'react-router-dom'
import { Clock } from 'lucide-react'

const NOMBRES: Record<string, string> = {
  '/compras':   'Compras',
  '/proyectos': 'Proyectos',
}

export default function ProximamentePage() {
  const { pathname } = useLocation()
  const seccion = NOMBRES[pathname] ?? 'Este módulo'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
      <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
        <Clock size={40} className="text-blue-400" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-800">Próximamente</h2>
        <p className="text-slate-500 max-w-sm">
          El módulo de <span className="font-semibold text-slate-700">{seccion}</span> está
          en desarrollo y estará disponible pronto.
        </p>
      </div>
      <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
        Módulo en construcción
      </span>
    </div>
  )
}
