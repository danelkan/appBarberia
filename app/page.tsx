'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, MapPin, RefreshCw, Scissors } from 'lucide-react'
import type { Branch } from '@/types'

export default function RootPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/branches')
      .then(res => {
        if (!res.ok) throw new Error('No se pudieron cargar las sucursales')
        return res.json()
      })
      .then(data => {
        setBranches(data.branches ?? [])
      })
      .catch(() => {
        setError('No se pudieron cargar las sucursales.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return (
    <main className="admin-theme min-h-screen bg-page">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
              <Scissors className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-cream">Felito Barber Studio</p>
              <p className="text-xs text-cream/45">Elegí sucursal y reservá</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10 sm:py-14">
          <div className="w-full">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-gold-dark">Reserva online</p>
              <h1 className="mt-3 font-serif text-4xl text-cream sm:text-5xl">
                Elegí tu sucursal
              </h1>
              <p className="mt-3 text-base text-cream/50">
                Entrás, elegís sede y seguís. Sin vueltas.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
              {loading ? (
                <>
                  <div className="card skeleton h-40" />
                  <div className="card skeleton h-40" />
                </>
              ) : error ? (
                <button
                  onClick={() => window.location.reload()}
                  className="col-span-full rounded-3xl border border-border bg-white p-8 text-center shadow-card"
                >
                  <RefreshCw className="mx-auto h-6 w-6 text-gold" />
                  <p className="mt-4 text-base font-semibold text-cream">{error}</p>
                  <p className="mt-1 text-sm text-cream/45">Tocá para reintentar.</p>
                </button>
              ) : (
                branches.map(branch => (
                  <Link
                    key={branch.id}
                    href={`/reservar?branch=${branch.id}`}
                    className="group rounded-3xl border border-border bg-white p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                  >
                    <div className="flex h-full flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <ChevronRight className="h-5 w-5 text-cream/25 transition-transform group-hover:translate-x-1 group-hover:text-gold" />
                      </div>

                      <div className="mt-8">
                        <h2 className="text-2xl font-semibold text-cream">{branch.name}</h2>
                        {branch.address && <p className="mt-3 text-sm text-cream/50">{branch.address}</p>}
                        <p className="mt-6 text-sm font-semibold text-gold-dark">Reservar en esta sucursal</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
