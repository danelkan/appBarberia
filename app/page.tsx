import Link from 'next/link'
import { ArrowRight, CornerDownLeft, MapPin, Scissors } from 'lucide-react'
import { createSupabaseAdmin } from '@/lib/supabase'

export const revalidate = 300

export default async function HomePage() {
  const supabase = createSupabaseAdmin()
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, address')
    .eq('active', true)
    .order('name')

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col">
        <header className="flex items-center justify-between rounded-[32px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Scissors className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Felito Barber Studio</p>
              <p className="text-xs text-slate-500">Reserva online</p>
            </div>
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-4xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Elegí sucursal</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                Reservá en la sede que te quede mejor.
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-500">
                Entrás, elegís sucursal y seguís con la reserva. Sin landing, sin vueltas y con una experiencia rápida en mobile y desktop.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {(branches ?? []).map(branch => (
                <Link
                  key={branch.id}
                  href={`/reservar?branch=${branch.id}`}
                  className="group rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-900" />
                  </div>

                  <div className="mt-10">
                    <h2 className="text-2xl font-semibold text-slate-950">{branch.name}</h2>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{branch.address}</p>
                    <p className="mt-6 text-sm font-semibold text-slate-950">Continuar con esta sucursal</p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-8 flex justify-center">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow-sm transition hover:text-slate-950"
              >
                <CornerDownLeft className="h-4 w-4" />
                Volver atrás
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
