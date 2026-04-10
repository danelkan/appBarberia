import Link from 'next/link'
import { MapPin, Scissors } from 'lucide-react'
import { createSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = createSupabaseAdmin()
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, address')
    .eq('active', true)
    .order('name')

  return (
    <main className="min-h-screen bg-[#0c0a08] flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
            <Scissors className="h-6 w-6" />
          </div>
          <div>
            <p className="font-serif text-2xl text-cream">Felito Barber Studio</p>
            <p className="mt-1 text-sm uppercase tracking-[0.28em] text-cream/45">Reservas online</p>
          </div>
        </div>

        <p className="mb-6 text-center text-sm text-cream/50">Elegí una sucursal para reservar</p>

        <div className="space-y-3">
          {(branches ?? []).map(branch => (
            <Link
              key={branch.id}
              href={`/reservar?branch=${branch.id}`}
              className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 transition hover:border-gold/30 hover:bg-white/[0.07]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-cream">{branch.name}</p>
                  {branch.address && (
                    <p className="mt-0.5 text-xs text-cream/45">{branch.address}</p>
                  )}
                </div>
              </div>
              <span className="text-sm font-semibold text-gold opacity-0 transition group-hover:opacity-100">
                Reservar →
              </span>
            </Link>
          ))}

          {(branches ?? []).length === 0 && (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-6 text-center text-sm text-cream/40">
              No hay sucursales disponibles por el momento.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
