'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Instagram,
  MapPin,
  Phone,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import type { Barber, Branch, Service } from '@/types'

const BENEFITS = [
  {
    icon: Trophy,
    title: '34 años de oficio',
    description: 'La experiencia no se improvisa. Caballeros MVD trabaja desde el detalle y la consistencia.',
  },
  {
    icon: Sparkles,
    title: 'Estilo clásico y actual',
    description: 'Cortes sobrios, libres o más jugados, siempre pensados para tu cara, pelo y rutina.',
  },
  {
    icon: ShieldCheck,
    title: 'Reserva simple',
    description: 'Elegís sucursal, servicio y horario sin llamadas ni idas y vueltas.',
  },
]

const EXPERIENCE_POINTS = [
  'Corte, barba y terminación con criterio profesional.',
  'Atención a caballeros y niños en un entorno cuidado.',
  'Productos y herramientas seleccionadas para sostener el resultado.',
]

const CONTACT_ITEMS = [
  {
    icon: MapPin,
    label: 'Ubicación principal',
    value: 'Alejandro Chucarro 1194, Pocitos, Montevideo',
  },
  {
    icon: Instagram,
    label: 'Instagram',
    value: '@caballerosmvd',
    href: 'https://www.instagram.com/caballerosmvd/',
  },
  {
    icon: Phone,
    label: 'Reserva rápida',
    value: 'Elegí una sucursal y confirmá online',
    href: '/reservar',
  },
]

export default function RootPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/branches').then(res => {
        if (!res.ok) throw new Error('No se pudieron cargar las sucursales')
        return res.json()
      }),
      fetch('/api/services').then(res => {
        if (!res.ok) throw new Error('No se pudieron cargar los servicios')
        return res.json()
      }),
      fetch('/api/barbers').then(res => {
        if (!res.ok) throw new Error('No se pudieron cargar el staff')
        return res.json()
      }),
    ])
      .then(([branchData, serviceData, barberData]) => {
        setBranches(branchData.branches ?? [])
        setServices(serviceData.services ?? [])
        setBarbers(barberData.barbers ?? [])
      })
      .catch(() => {
        setError('No se pudo cargar la información principal.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const featuredServices = useMemo(() => services.slice(0, 4), [services])

  const stats = useMemo(
    () => [
      { value: '34+', label: 'años de experiencia' },
      { value: `${services.length || 5}`, label: 'servicios disponibles' },
      { value: `${branches.length || 1}`, label: 'sucursales para reservar' },
      { value: `${barbers.length || 3}`, label: 'profesionales en agenda' },
    ],
    [barbers.length, branches.length, services.length]
  )

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#120f0a] text-cream">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,168,76,0.22),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.07),transparent_24%),linear-gradient(180deg,#17120d_0%,#120f0a_45%,#0c0a08_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(201,168,76,0.1),transparent)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pb-24">
        <header className="rounded-full border border-white/10 bg-white/5 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/35 bg-gold/10 text-gold">
                <Scissors className="h-5 w-5" />
              </div>
              <div>
                <p className="font-serif text-xl text-cream">Caballeros MVD</p>
                <p className="text-xs uppercase tracking-[0.3em] text-cream/45">Barberia de autor</p>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-3 text-sm text-cream/60">
              <a href="#servicios" className="transition hover:text-gold">Servicios</a>
              <a href="#sucursales" className="transition hover:text-gold">Sucursales</a>
              <a href="#contacto" className="transition hover:text-gold">Contacto</a>
              <Link href="/mis-turnos" className="transition hover:text-gold">Mis turnos</Link>
            </nav>
          </div>
        </header>

        <section className="grid gap-10 pb-16 pt-10 lg:grid-cols-[minmax(0,1.2fr)_420px] lg:items-end lg:pb-24 lg:pt-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-gold">
              <Star className="h-3.5 w-3.5" />
              Pocitos, Montevideo
            </div>

            <h1 className="mt-6 max-w-4xl font-serif text-5xl leading-none text-cream sm:text-6xl lg:text-7xl">
              Una barbería con presencia, criterio y reserva online de verdad.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-cream/68 sm:text-lg">
              Caballeros MVD combina oficio, asesoramiento y un sistema de reserva simple para que
              el cliente llegue, se atienda bien y salga mejor de lo que entró.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={branches[0] ? `/reservar?branch=${branches[0].id}` : '/reservar'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-7 py-3 text-sm font-semibold text-black transition hover:bg-gold-dark sm:w-auto"
              >
                Reservar ahora
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#servicios"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-3 text-sm font-semibold text-cream transition hover:border-gold/35 hover:bg-white/10"
              >
                Ver servicios
              </a>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map(stat => (
                <div
                  key={stat.label}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur-sm"
                >
                  <p className="text-3xl font-semibold text-gold">{stat.value}</p>
                  <p className="mt-1 text-sm text-cream/55">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(201,168,76,0.22),transparent_55%)] blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-gold/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.03))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-gold/80">Director creativo</p>
                  <h2 className="mt-2 font-serif text-3xl text-cream">Charles Oribe</h2>
                </div>
                <div className="rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                  Desde 1992
                </div>
              </div>

              <p className="mt-6 text-sm leading-7 text-cream/68">
                La propuesta arranca en el diagnóstico. Corte, barba y terminación se resuelven
                desde la observación, la experiencia y una ejecución prolija, no desde fórmulas.
              </p>

              <div className="mt-8 space-y-3">
                {EXPERIENCE_POINTS.map(point => (
                  <div
                    key={point}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3"
                  >
                    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-gold text-black">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-sm text-cream/70">{point}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Reserva express</p>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-cream">Elegí sucursal y horario</p>
                    <p className="mt-1 text-sm text-cream/55">Proceso corto, claro y adaptable a móvil.</p>
                  </div>
                  <Link
                    href={branches[0] ? `/reservar?branch=${branches[0].id}` : '/reservar'}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gold text-black transition hover:bg-gold-light"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-y border-white/10 py-8 sm:grid-cols-3">
          {BENEFITS.map(item => (
            <article
              key={item.title}
              className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 text-gold">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-cream">{item.title}</h2>
              <p className="mt-2 text-sm leading-7 text-cream/60">{item.description}</p>
            </article>
          ))}
        </section>

        <section id="servicios" className="grid gap-8 py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gold/80">Servicios</p>
            <h2 className="mt-4 font-serif text-4xl text-cream sm:text-5xl">
              Corte, barba y detalle final con una ejecución limpia.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-cream/65">
              La carta de servicios tiene que ayudar a decidir rápido. Por eso la portada prioriza
              lo esencial, muestra precios cuando están disponibles y empuja al usuario directo a la reserva.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton h-40 rounded-[1.75rem]" />
              ))
            ) : error ? (
              <button
                onClick={() => window.location.reload()}
                className="col-span-full rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-8 text-left"
              >
                <RefreshCw className="h-5 w-5 text-gold" />
                <p className="mt-4 text-lg font-semibold text-cream">{error}</p>
                <p className="mt-2 text-sm text-cream/55">Recargá para intentar de nuevo.</p>
              </button>
            ) : (
              featuredServices.map(service => (
                <article
                  key={service.id}
                  className="group rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-1 hover:border-gold/25 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
                      <Scissors className="h-4 w-4" />
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cream/55">
                      {service.duration_minutes} min
                    </span>
                  </div>

                  <h3 className="mt-5 text-2xl font-semibold text-cream">{service.name}</h3>
                  <div className="mt-4 flex items-center gap-2 text-sm text-cream/55">
                    <Clock3 className="h-4 w-4 text-gold" />
                    Servicio pensado para agenda online.
                  </div>
                  <p className="mt-5 text-2xl font-semibold text-gold">{formatPrice(service.price)}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section
          id="sucursales"
          className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-6 sm:p-8"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gold/80">Sucursales</p>
              <h2 className="mt-3 font-serif text-4xl text-cream">Elegí dónde querés atenderte</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-cream/58">
              La reserva arranca por sucursal para ordenar agenda, staff y horarios disponibles desde el primer paso.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {loading ? (
              <>
                <div className="skeleton h-52 rounded-[1.75rem]" />
                <div className="skeleton h-52 rounded-[1.75rem]" />
              </>
            ) : error ? (
              <div className="rounded-[1.75rem] border border-white/10 bg-black/15 p-8 text-center text-cream/60">
                No pudimos cargar las sucursales.
              </div>
            ) : (
              branches.map((branch, index) => (
                <Link
                  key={branch.id}
                  href={`/reservar?branch=${branch.id}`}
                  className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/15 p-6 transition hover:-translate-y-1 hover:border-gold/25"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent opacity-0 transition group-hover:opacity-100" />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-cream/40">Sucursal {index + 1}</p>
                      <h3 className="mt-3 text-3xl font-semibold text-cream">{branch.name}</h3>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/20 bg-gold/10 text-gold transition group-hover:bg-gold group-hover:text-black">
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-8 flex items-start gap-3 text-sm text-cream/60">
                    <MapPin className="mt-0.5 h-4 w-4 text-gold" />
                    <span>{branch.address || 'Dirección disponible al entrar a la reserva'}</span>
                  </div>

                  <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cream/55">
                    Reservar en esta sede
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="grid gap-6 py-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-24">
          <div className="rounded-[2rem] border border-white/10 bg-black/15 p-7 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gold/80">Por qué funciona mejor</p>
            <h2 className="mt-4 font-serif text-4xl text-cream">Una portada que vende mejor el oficio y reduce fricción.</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                'Jerarquía clara entre marca, propuesta y llamada a la acción.',
                'Servicios y sucursales visibles sin obligar a navegar de más.',
                'Mejor lectura en móvil y contraste más consistente.',
                'Branding alineado con Caballeros MVD en vez de una marca ajena.',
              ].map(point => (
                <div
                  key={point}
                  className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-7 text-cream/65"
                >
                  {point}
                </div>
              ))}
            </div>
          </div>

          <aside id="contacto" className="rounded-[2rem] border border-gold/20 bg-gold/10 p-7 text-black">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-black/65">Contacto</p>
            <h2 className="mt-4 font-serif text-4xl">Reservá o escribinos</h2>
            <div className="mt-6 space-y-4">
              {CONTACT_ITEMS.map(item => (
                <a
                  key={item.label}
                  href={item.href ?? '#'}
                  className={cn(
                    'flex items-start gap-3 rounded-[1.35rem] bg-black/5 px-4 py-4',
                    item.href ? 'transition hover:bg-black/10' : 'pointer-events-none'
                  )}
                >
                  <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-black text-gold">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-xs uppercase tracking-[0.22em] text-black/55">{item.label}</span>
                    <span className="mt-1 block text-sm font-semibold text-black/85">{item.value}</span>
                  </span>
                </a>
              ))}
            </div>
            <Link
              href={branches[0] ? `/reservar?branch=${branches[0].id}` : '/reservar'}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-cream transition hover:bg-black/90"
            >
              Empezar reserva
              <ArrowRight className="h-4 w-4" />
            </Link>
          </aside>
        </section>

        <footer className="flex flex-col gap-3 border-t border-white/10 py-6 text-sm text-cream/45 sm:flex-row sm:items-center sm:justify-between">
          <p>Caballeros MVD. Barbería en Pocitos con reserva online y atención personalizada.</p>
          <div className="flex items-center gap-4">
            <Link href="/reservar" className="transition hover:text-gold">Reservar</Link>
            <Link href="/mis-turnos" className="transition hover:text-gold">Mis turnos</Link>
            <a href="https://www.instagram.com/caballerosmvd/" className="transition hover:text-gold">Instagram</a>
          </div>
        </footer>
      </div>
    </main>
  )
}
