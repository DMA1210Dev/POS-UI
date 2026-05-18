import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

/**
 * Captura errores de renderizado en componentes hijos y muestra un mensaje
 * amigable en lugar de una pantalla en blanco.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : 'Error inesperado al renderizar esta sección.'
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    // En producción podrías enviar esto a un servicio de logging
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center gap-4 py-20 px-6 text-center">
          <div className="p-4 rounded-full bg-red-50">
            <AlertTriangle size={40} className="text-red-400" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-lg text-red-600">Algo salió mal</p>
            <p className="text-sm text-slate-400 max-w-sm">
              {this.state.message || 'Ocurrió un error inesperado al cargar esta sección.'}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            <RefreshCw size={14} />
            Reintentar
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
