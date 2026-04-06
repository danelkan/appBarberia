'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Scissors, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        const isConfigError = error.message?.includes('NEXT_PUBLIC_SUPABASE')
        setError(
          isConfigError
            ? 'Falta configurar Supabase en el deploy. Revisá las variables públicas en Vercel.'
            : 'Email o contraseña incorrectos. Verificá tus datos.'
        )
        setLoading(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('Se inició sesión, pero no se pudo guardar la sesión en el navegador. Probá de nuevo.')
        setLoading(false)
        return
      }

      router.refresh()
      router.replace('/admin')
    } catch {
      setError('No se pudo iniciar sesión. Probá de nuevo en unos segundos.')
      setLoading(false)
    }
  }

  return (
    <div className="admin-theme min-h-screen bg-page flex items-center justify-center px-4">

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gold/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gold/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-white shadow-card border border-border items-center justify-center mb-4">
            <Scissors className="w-6 h-6 text-gold" />
          </div>
          <h1 className="font-serif text-2xl text-cream">Felito Studios</h1>
          <p className="text-sm text-cream/50 mt-1">Panel de administración</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-border shadow-modal p-8">
          <form onSubmit={handleLogin} className="space-y-5">

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-11"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cream/30 hover:text-cream/60 transition-colors p-0.5"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn-gold w-full mt-1"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Ingresando...
                </>
              ) : 'Ingresar'}
            </button>

          </form>
        </div>

        <p className="text-center text-xs text-cream/30 mt-6">
          Felito Barber Studio · Montevideo, Uruguay
        </p>

      </div>
    </div>
  )
}
