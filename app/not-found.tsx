import Link from 'next/link'
import { FileQuestion, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="admin-theme min-h-screen bg-page flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-6">
          <FileQuestion className="w-7 h-7 text-gold" />
        </div>
        <h1 className="font-serif text-2xl text-cream mb-2">Página no encontrada</h1>
        <p className="text-sm text-cream/50 mb-6">
          La página que buscás no existe o fue movida.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold text-black font-sans font-medium text-sm rounded-lg transition-all duration-200 hover:bg-gold-light active:scale-95"
        >
          <Home className="w-4 h-4" />
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
