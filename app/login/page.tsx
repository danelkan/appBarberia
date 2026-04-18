'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { BrandLogo } from '@/components/brand-logo'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        setError('No pudimos iniciar sesión. Revisá tu email y contraseña.')
        setLoading(false)
        return
      }

      router.refresh()
      router.replace('/admin')
    } catch {
      setError('Hubo un problema al iniciar sesión. Probá nuevamente.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[36px] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
            <BrandLogo size={56} className="rounded-3xl" />
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{process.env.NEXT_PUBLIC_APP_NAME ?? 'Barbería'}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Acceso de staff y administración.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-500">
              Entrá al panel para gestionar agenda, caja, usuarios, sucursales y operación diaria con permisos reales por rol.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                'Agenda y turnos',
                'Caja y cobros',
                'Usuarios y permisos',
              ].map(item => (
                <div key={item} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[36px] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
            <p className="text-sm font-semibold text-slate-950">Ingresar</p>
            <p className="mt-1 text-sm text-slate-500">Usá tu cuenta asignada para operar el negocio.</p>

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="staff@felitobarber.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className="label">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-11"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(current => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading || !email || !password} className="btn-gold w-full">
                {loading ? 'Ingresando...' : 'Ingresar al panel'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}
