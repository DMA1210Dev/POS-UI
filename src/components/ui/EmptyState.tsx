import { Inbox, AlertCircle, RefreshCw } from 'lucide-react'

interface EmptyStateProps {
  /** 'empty' = sin registros   |   'error' = falló la petición al backend */
  variant?:     'empty' | 'error'
  title?:       string
  description?: string
  /** Renderiza un botón "Reintentar" y llama a esta función al hacer clic */
  onRetry?:     () => void
  /** Número de columnas cuando se usa dentro de un <tbody> */
  colSpan?:     number
  className?:   string
}

/**
 * Estado visual para secciones sin datos o con error de backend.
 *
 * Dentro de una tabla:
 *   <EmptyState colSpan={7} variant="error" onRetry={refetch} />
 *
 * Fuera de una tabla (div):
 *   <EmptyState variant="empty" title="Aún no hay empleados" />
 */
export default function EmptyState({
  variant     = 'empty',
  title,
  description,
  onRetry,
  colSpan,
  className = '',
}: EmptyStateProps) {
  const isErr = variant === 'error'

  const body = (
    <div className={`flex flex-col items-center justify-center gap-3 py-14 ${className}`}>
      {/* Ícono */}
      <div className={`p-4 rounded-full ${isErr ? 'bg-red-50' : 'bg-slate-50'}`}>
        {isErr
          ? <AlertCircle size={36} className="text-red-400" />
          : <Inbox       size={36} className="text-slate-300" />
        }
      </div>

      {/* Texto */}
      <div className="text-center space-y-1">
        <p className={`font-semibold text-base ${isErr ? 'text-red-600' : 'text-slate-600'}`}>
          {title ?? (isErr ? 'Error al cargar los datos' : 'No hay datos')}
        </p>
        <p className="text-sm text-slate-400 max-w-xs">
          {description ?? (
            isErr
              ? 'No se pudo obtener la información desde el servidor. Verifica tu conexión e intenta de nuevo.'
              : 'Aún no hay registros para mostrar.'
          )}
        </p>
      </div>

      {/* Botón reintentar */}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          <RefreshCw size={14} />
          Reintentar
        </button>
      )}
    </div>
  )

  /* Modo tabla: envuelve en <tr><td> */
  if (colSpan !== undefined) {
    return (
      <tr>
        <td colSpan={colSpan} className="p-0">
          {body}
        </td>
      </tr>
    )
  }

  return body
}
