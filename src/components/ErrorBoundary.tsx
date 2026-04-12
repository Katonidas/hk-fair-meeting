import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * ErrorBoundary global. Captura cualquier error de render y muestra una
 * pantalla de fallback con la opción de recargar. Sin esto, un error de
 * render petaba toda la SPA dejando una pantalla en blanco.
 *
 * React 19 sigue requiriendo class component para esto — no hay equivalente
 * con hooks en el core.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleReset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-light px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-4 text-center text-4xl">⚠️</div>
            <h1 className="mb-2 text-center text-lg font-bold text-gray-800">
              Algo ha fallado
            </h1>
            <p className="mb-4 text-center text-sm text-gray-500">
              La aplicación ha encontrado un error inesperado. Tus datos están
              guardados localmente y no se han perdido.
            </p>
            <details className="mb-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              <summary className="cursor-pointer font-medium">
                Detalles técnicos
              </summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words">
                {this.state.error.message}
                {this.state.error.stack && '\n\n' + this.state.error.stack.slice(0, 500)}
              </pre>
            </details>
            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Reintentar
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-white transition-colors hover:bg-primary-light"
              >
                Recargar app
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
