'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <h1 className="font-serif text-2xl text-cream mb-2">Algo salió mal</h1>
        <p className="text-sm text-cream/50 mb-6">
          Ocurrió un error inesperado. Por favor intentá de nuevo.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold text-black font-sans font-medium text-sm rounded-lg transition-all duration-200 hover:bg-gold-light active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          Intentar de nuevo
        </button>
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mt-6 p-4 bg-surface border border-border rounded-lg text-left">
            <p className="text-xs text-cream/40 mb-2">Error details (dev only):</p>
            <pre className="text-xs text-red-400 overflow-auto whitespace-pre-wrap">
              {error.message}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
