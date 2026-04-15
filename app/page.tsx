import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'
import { createSupabaseAdmin } from '@/lib/supabase'
import { BrandLogo } from '@/components/brand-logo'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Felito Barber Studio — Reserva tu turno',
  description: 'Elegí sucursal y reservá online en Felito Barber Studio, Montevideo.',
}

export default async function HomePage() {
  noStore()

  const supabase = createSupabaseAdmin()

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, address')
    .eq('active', true)
    .order('name')

  const hasVisibleBranches = Boolean((branches ?? []).length)

  return (
    <main className="flex min-h-screen flex-col px-4 py-5 sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">

        {/* Header */}
        <header className="flex items-center">
          <div className="flex items-center gap-3">
            <BrandLogo size={40} className="rounded-xl" />
            <div>
              <p className="text-sm font-semibold text-slate-950">Felito Barber Studio</p>
              <p className="text-xs text-slate-400">Montevideo</p>
            </div>
          </div>
        </header>

        {/* Branch selection */}
        <section className="flex flex-1 flex-col justify-center py-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Reserva online
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Elegí tu sucursal
          </h1>

          <div className="mt-5 space-y-3">
            {!hasVisibleBranches ? (
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-base font-medium text-slate-700">
                  No encontramos sucursales activas.
                </p>
              </div>
            ) : (
              (branches ?? []).map(branch => (
                <Link
                  key={branch.id}
                  href={`/reservar?branch=${branch.id}`}
                  className="group flex items-center gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition duration-150 hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-950 group-hover:text-white">
                    <MapPin className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-950">Felito Barber Studio ({branch.name})</p>
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {branch.address}
                    </p>
                  </div>

                  <ArrowRight className="h-5 w-5 flex-shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-950" />
                </Link>
              ))
            )}
          </div>

          <div className="mt-5 text-center">
            <Link
              href="/mis-turnos"
              className="text-sm text-slate-400 underline-offset-4 transition hover:text-slate-700 hover:underline"
            >
              Ver o cancelar mis turnos
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
