import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, MapPin, Scissors } from 'lucide-react'
import { createSupabaseServerReadClient, formatSupabaseError } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Felito Barber Studio — Reserva tu turno',
  description: 'Elegí sucursal y reservá online en Felito Barber Studio, Montevideo.',
}

export default async function HomePage() {
  let branches: Array<{ id: string; name: string; address: string | null }> = []

  try {
    const supabase = createSupabaseServerReadClient()
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, address')
      .eq('active', true)
      .order('name')

    if (error) {
      throw error
    }

    branches = data ?? []
  } catch (error) {
    console.error('[home] Failed to load branches from Supabase:', formatSupabaseError(error))
  }

  return (
    <main className="flex min-h-screen flex-col px-4 py-5 sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">

        {/* Header */}
        <header className="flex items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
              <Scissors className="h-4 w-4" />
            </div>
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
            {branches.map(branch => (
              <Link
                key={branch.id}
                href={`/reservar?branch=${branch.id}`}
                className="group flex items-center gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition duration-150 hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-950 group-hover:text-white">
                  <MapPin className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-950">{branch.name}</p>
                  {branch.address && (
                    <p className="mt-0.5 truncate text-sm text-slate-500">{branch.address}</p>
                  )}
                </div>

                <ArrowRight className="h-5 w-5 flex-shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-950" />
              </Link>
            ))}

            {branches.length === 0 && (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                No pudimos cargar las sucursales en este momento.
              </div>
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
