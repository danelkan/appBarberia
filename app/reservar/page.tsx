'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  Clock,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  User,
} from 'lucide-react'
import { format, addMonths, startOfMonth, getDaysInMonth, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button, Input, Spinner } from '@/components/ui'
import { cn, formatDate, formatPrice, getAvailableDates } from '@/lib/utils'
import type { Barber, BookingStep, Service, TimeSlot } from '@/types'

const STEPS = [
  { n: 1, label: 'Servicio', icon: Scissors },
  { n: 2, label: 'Barbero', icon: User },
  { n: 3, label: 'Fecha', icon: Calendar },
  { n: 4, label: 'Datos', icon: ShieldCheck },
]

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^[\d\s\-\(\)\+]{7,20}$/

interface ClientFormData {
  first_name: string
  last_name: string
  email: string
  phone: string
}

interface FormErrors {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
}

const EXPERIENCE_POINTS = [
  { icon: Sparkles, title: 'Reserva en menos de 60 segundos', description: 'Flujo claro, sin fricción y pensado para convertir.' },
  { icon: ShieldCheck, title: 'Confirmación inmediata', description: 'Tu turno queda agendado al instante y con respaldo por email.' },
  { icon: Star, title: 'Experiencia premium', description: 'Diseño editorial, selección simple y sensación de marca top.' },
]

export default function BookingPage() {
  const [step, setStep] = useState(1)
  const [booking, setBooking] = useState<Partial<BookingStep>>({})
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [appointmentId, setAppointmentId] = useState<string>()

  useEffect(() => {
    Promise.all([
      fetch('/api/services').then((r) => {
        if (!r.ok) throw new Error('Error al cargar servicios')
        return r.json()
      }),
      fetch('/api/barbers').then((r) => {
        if (!r.ok) throw new Error('Error al cargar barberos')
        return r.json()
      }),
    ])
      .then(([s, b]) => {
        setServices(s.services ?? [])
        setBarbers(b.barbers ?? [])
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error loading data:', err)
        setLoadingError(err.message || 'Error al cargar los datos. Por favor intentá de nuevo.')
        setLoading(false)
      })
  }, [])

  if (loadingError) {
    return (
      <div className="min-h-screen premium-backdrop flex items-center justify-center px-4">
        <div className="premium-panel max-w-md p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="text-xs uppercase tracking-[0.35em] text-red-300/70">Conexión</p>
          <h1 className="mt-3 font-serif text-3xl text-cream">No pudimos cargar la agenda</h1>
          <p className="mt-3 text-sm leading-6 text-cream/55">{loadingError}</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="mt-6 w-full">
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  if (confirmed) {
    return <ConfirmationScreen booking={booking} appointmentId={appointmentId} />
  }

  return (
    <div className="min-h-screen premium-backdrop">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(201,168,76,0.22),transparent_48%)]" />
      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="glass-card mb-6 flex flex-col gap-6 overflow-hidden px-5 py-5 sm:px-7 lg:mb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-gold/90">
              <Sparkles className="h-3.5 w-3.5" />
              La nueva forma de reservar
            </div>
            <h1 className="mt-4 max-w-2xl font-serif text-4xl leading-none text-cream sm:text-5xl">
              La experiencia de citas para barbería que se siente de clase mundial.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-cream/65 sm:text-base">
              Elegí servicio, profesional y horario en un flujo elegante, rápido y clarísimo. Todo pensado para que reservar sea tan bueno como el corte.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-left sm:min-w-[340px]">
            <MetricCard value="1 min" label="Tiempo promedio" />
            <MetricCard value="24/7" label="Reservas online" />
            <MetricCard value="Premium" label="Feeling del producto" />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_380px] lg:items-start">
          <section className="space-y-6">
            <ProgressRail currentStep={step} />

            <div className="premium-panel overflow-hidden p-5 sm:p-7">
              <div className="mb-6 flex flex-col gap-4 border-b border-white/8 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-gold/80">Reserva inteligente</p>
                  <h2 className="mt-2 font-serif text-3xl text-cream">Armá tu cita ideal</h2>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-cream/60">
                  <span className="rounded-full border border-white/10 px-3 py-1">Sin llamadas</span>
                  <span className="rounded-full border border-white/10 px-3 py-1">Confirmación inmediata</span>
                  <span className="rounded-full border border-white/10 px-3 py-1">Diseño mobile-first</span>
                </div>
              </div>

              {loading ? (
                <div className="flex min-h-[320px] items-center justify-center">
                  <Spinner className="h-7 w-7" />
                </div>
              ) : (
                <>
                  {step === 1 && (
                    <ServiceStep
                      services={services}
                      booking={booking}
                      onSelect={(service) => {
                        setBooking((b) => ({ ...b, service, barber: undefined, date: undefined, time: undefined }))
                        setStep(2)
                      }}
                    />
                  )}
                  {step === 2 && (
                    <BarberStep
                      barbers={barbers}
                      booking={booking}
                      onSelect={(barber) => {
                        setBooking((b) => ({ ...b, barber, date: undefined, time: undefined }))
                        setStep(3)
                      }}
                      onBack={() => setStep(1)}
                    />
                  )}
                  {step === 3 && (
                    <DateTimeStep
                      booking={booking}
                      onSelect={(date, time) => {
                        setBooking((b) => ({ ...b, date, time }))
                        setStep(4)
                      }}
                      onBack={() => setStep(2)}
                    />
                  )}
                  {step === 4 && (
                    <ClientStep
                      booking={booking}
                      onConfirm={(client, id) => {
                        setBooking((b) => ({ ...b, client }))
                        setAppointmentId(id)
                        setConfirmed(true)
                      }}
                      onBack={() => setStep(3)}
                    />
                  )}
                </>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {EXPERIENCE_POINTS.map((point) => (
                <div key={point.title} className="glass-card p-5">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
                    <point.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-cream">{point.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-cream/55">{point.description}</p>
                </div>
              ))}
            </div>
          </section>

          <BookingSidebar booking={booking} step={step} />
        </div>
      </div>
    </div>
  )
}

function ProgressRail({ currentStep }: { currentStep: number }) {
  return (
    <div className="glass-card px-4 py-4 sm:px-5">
      <div className="grid gap-3 sm:grid-cols-4">
        {STEPS.map((item) => {
          const done = currentStep > item.n
          const active = currentStep === item.n
          return (
            <div
              key={item.n}
              className={cn(
                'rounded-2xl border p-3 transition-all duration-300',
                active
                  ? 'border-gold/40 bg-gold/10 glow-gold'
                  : done
                    ? 'border-emerald-400/25 bg-emerald-400/10'
                    : 'border-white/8 bg-white/[0.02]'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-2xl border text-sm transition-all',
                    active
                      ? 'border-gold bg-gold text-black'
                      : done
                        ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-300'
                        : 'border-white/10 bg-white/5 text-cream/45'
                  )}
                >
                  {done ? <CheckCircle className="h-4 w-4" /> : <item.icon className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-cream/35">Paso {item.n}</p>
                  <p className={cn('text-sm font-medium', active ? 'text-cream' : done ? 'text-emerald-200' : 'text-cream/55')}>
                    {item.label}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BookingSidebar({ booking, step }: { booking: Partial<BookingStep>; step: number }) {
  const summaryRows = [
    { label: 'Servicio', value: booking.service?.name || 'Elegí el servicio ideal' },
    { label: 'Profesional', value: booking.barber?.name || 'Seleccioná tu barbero' },
    { label: 'Fecha', value: booking.date ? formatDate(booking.date) : 'Definí el mejor día' },
    { label: 'Hora', value: booking.time || 'Elegí un horario disponible' },
  ]

  return (
    <aside className="space-y-5 lg:sticky lg:top-6">
      <div className="premium-panel overflow-hidden p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.35em] text-gold/80">Tu cita</p>
        <h3 className="mt-2 font-serif text-3xl text-cream">Resumen en vivo</h3>
        <p className="mt-2 text-sm leading-6 text-cream/55">
          Cada selección actualiza tu reserva en tiempo real para que siempre sepas exactamente qué estás confirmando.
        </p>

        <div className="mt-6 space-y-3">
          {summaryRows.map((row, index) => (
            <div key={row.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-cream/30">{row.label}</p>
                  <p className="mt-2 text-sm leading-6 text-cream">{row.value}</p>
                </div>
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-cream/45">
                  0{index + 1}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[24px] border border-gold/20 bg-gold/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-gold/80">Precio estimado</p>
              <p className="mt-2 text-2xl font-semibold text-cream">
                {booking.service ? formatPrice(booking.service.price) : '--'}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/20 bg-black/20 text-gold">
              <Scissors className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm">
          <span className="text-cream/55">Estado del flujo</span>
          <span className="font-medium text-cream">Paso {step} de 4</span>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-gold">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-cream">Reserva segura y profesional</p>
            <p className="text-xs text-cream/45">Datos mínimos, confirmación clara y proceso sin ruido.</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
      <p className="text-2xl font-semibold text-cream">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-cream/35">{label}</p>
    </div>
  )
}

function StepHeader({
  eyebrow,
  title,
  description,
  onBack,
}: {
  eyebrow: string
  title: string
  description: string
  onBack?: () => void
}) {
  return (
    <div className="mb-6">
      {onBack && (
        <button
          onClick={onBack}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-cream/55 transition hover:border-white/15 hover:text-cream"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Volver
        </button>
      )}
      <p className="text-xs uppercase tracking-[0.35em] text-gold/80">{eyebrow}</p>
      <h3 className="mt-3 font-serif text-4xl text-cream">{title}</h3>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-cream/55">{description}</p>
    </div>
  )
}

function SelectionCard({
  children,
  selected,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  selected?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group w-full rounded-[28px] border p-5 text-left transition-all duration-300',
        selected
          ? 'border-gold/40 bg-gold/10 glow-gold'
          : 'border-white/8 bg-white/[0.025] hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.05]',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      {children}
    </button>
  )
}

function ServiceStep({
  services,
  booking,
  onSelect,
}: {
  services: Service[]
  booking: Partial<BookingStep>
  onSelect: (service: Service) => void
}) {
  if (services.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-cream/50">No hay servicios disponibles en este momento.</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-up">
      <StepHeader
        eyebrow="Paso 1"
        title="Empecemos por el servicio"
        description="Elegí la experiencia que querés reservar. Mostramos duración y precio para que decidas rápido y sin sorpresas."
      />

      <div className="grid gap-4">
        {services.map((service) => (
          <SelectionCard
            key={service.id}
            selected={booking.service?.id === service.id}
            onClick={() => onSelect(service)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.25em] text-gold/85">
                    Alta demanda
                  </span>
                  <span className="text-xs text-cream/35">Optimizado para reservar más rápido</span>
                </div>
                <h4 className="text-lg font-semibold text-cream">{service.name}</h4>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-cream/55">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1">
                    <Clock className="h-3.5 w-3.5 text-gold" />
                    {service.duration_minutes} min
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-gold" />
                    Confirmación inmediata
                  </span>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.25em] text-cream/35">Desde</p>
                <p className="mt-2 text-2xl font-semibold text-cream">{formatPrice(service.price)}</p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm text-gold">
                  Elegir
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </SelectionCard>
        ))}
      </div>
    </div>
  )
}

function BarberStep({
  barbers,
  booking,
  onSelect,
  onBack,
}: {
  barbers: Barber[]
  booking: Partial<BookingStep>
  onSelect: (barber: Barber) => void
  onBack: () => void
}) {
  if (barbers.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-cream/50">No hay barberos disponibles.</p>
        <Button onClick={onBack} variant="outline" className="mt-5">
          Volver
        </Button>
      </div>
    )
  }

  return (
    <div className="animate-fade-up">
      <StepHeader
        eyebrow="Paso 2"
        title="Elegí al profesional"
        description="Cada perfil se presenta con una lectura simple para que decidas con confianza. La experiencia de selección también tiene que sentirse premium."
        onBack={onBack}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {barbers.map((barber, index) => (
          <SelectionCard
            key={barber.id}
            selected={booking.barber?.id === barber.id}
            onClick={() => onSelect(barber)}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] border border-gold/20 bg-gold/10 font-serif text-xl text-gold">
                {barber.name[0]?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="truncate text-lg font-semibold text-cream">{barber.name}</h4>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-cream/40">
                    Pro {index + 1}
                  </span>
                </div>
                <p className="mt-2 text-sm text-cream/55">Especialista en experiencia, precisión y atención consistente.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-cream/60">Perfil activo</span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-cream/60">Agenda online</span>
                </div>
              </div>
            </div>
          </SelectionCard>
        ))}
      </div>
    </div>
  )
}

function DateTimeStep({
  booking,
  onSelect,
  onBack,
}: {
  booking: Partial<BookingStep>
  onSelect: (date: string, time: string) => void
  onBack: () => void
}) {
  const [selectedDate, setSelectedDate] = useState(booking.date ?? '')
  const [selectedTime, setSelectedTime] = useState(booking.time ?? '')
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const availableDates = useMemo(
    () => (booking.barber ? new Set(getAvailableDates(booking.barber.availability, 45)) : new Set<string>()),
    [booking.barber]
  )

  useEffect(() => {
    if (!selectedDate || !booking.barber || !booking.service) return
    setLoadingSlots(true)
    setSlotsError(null)
    setSlots([])

    fetch(`/api/appointments/slots?barberId=${booking.barber.id}&date=${selectedDate}&duration=${booking.service.duration_minutes}`)
      .then((r) => {
        if (!r.ok) throw new Error('Error al cargar horarios')
        return r.json()
      })
      .then((d) => {
        setSlots(d.slots ?? [])
        setLoadingSlots(false)
      })
      .catch((err) => {
        console.error('Error loading slots:', err)
        setSlotsError('No se pudieron cargar los horarios')
        setLoadingSlots(false)
      })
  }, [selectedDate, booking.barber, booking.service])

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = getDay(startOfMonth(currentMonth))
  const daysInMonth = getDaysInMonth(currentMonth)
  const today = format(new Date(), 'yyyy-MM-dd')

  const calendarDays = Array.from({ length: firstDay }, (): string | null => null).concat(
    Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month, i + 1)
      return format(date, 'yyyy-MM-dd')
    })
  )

  const retrySlots = () => {
    if (!booking.barber || !booking.service || !selectedDate) return
    setLoadingSlots(true)
    fetch(`/api/appointments/slots?barberId=${booking.barber.id}&date=${selectedDate}&duration=${booking.service.duration_minutes}`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d) => {
        setSlots(d.slots ?? [])
        setSlotsError(null)
        setLoadingSlots(false)
      })
      .catch(() => {
        setSlotsError('No se pudieron cargar los horarios')
        setLoadingSlots(false)
      })
  }

  return (
    <div className="animate-fade-up">
      <StepHeader
        eyebrow="Paso 3"
        title="Definí el mejor momento"
        description="Visualizá disponibilidad real, elegí fecha y cerrá el horario perfecto en un calendario simple, rápido y muy claro."
        onBack={onBack}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[30px] border border-white/8 bg-white/[0.025] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setCurrentMonth((m) => addMonths(m, -1))}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-cream/55 transition hover:text-cream"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-[0.3em] text-gold/75">Calendario</p>
              <p className="mt-2 text-lg font-medium capitalize text-cream">{format(currentMonth, 'MMMM yyyy', { locale: es })}</p>
            </div>
            <button
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="flex h-11 w-11 rotate-180 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-cream/55 transition hover:text-cream"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-3 grid grid-cols-7 gap-2">
            {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map((day) => (
              <div key={day} className="text-center text-[11px] uppercase tracking-[0.2em] text-cream/30">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="aspect-square" />
              }

              const isPast = date < today
              const isAvailable = availableDates.has(date)
              const isSelected = date === selectedDate
              const isToday = date === today

              return (
                <button
                  key={date}
                  disabled={isPast || !isAvailable}
                  onClick={() => {
                    setSelectedDate(date)
                    setSelectedTime('')
                  }}
                  className={cn(
                    'aspect-square rounded-2xl border text-sm transition-all duration-200',
                    isSelected
                      ? 'border-gold bg-gold text-black shadow-[0_12px_28px_rgba(201,168,76,0.28)]'
                      : isPast || !isAvailable
                        ? 'cursor-not-allowed border-transparent bg-white/[0.02] text-cream/18'
                        : 'border-white/8 bg-white/[0.025] text-cream hover:border-gold/35 hover:bg-white/[0.05]',
                    isToday && !isSelected && 'border-gold/25'
                  )}
                >
                  {Number.parseInt(date.split('-')[2], 10)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-[30px] border border-white/8 bg-white/[0.025] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-gold/75">Disponibilidad</p>
              <p className="mt-1 text-lg font-medium text-cream">
                {selectedDate ? formatDate(selectedDate) : 'Elegí un día'}
              </p>
            </div>
          </div>

          <div className="mt-5">
            {selectedDate ? (
              <>
                {loadingSlots ? (
                  <div className="flex min-h-[220px] items-center justify-center">
                    <Spinner className="h-6 w-6" />
                  </div>
                ) : slotsError ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                    <p className="text-sm text-red-300">{slotsError}</p>
                    <Button variant="ghost" className="mt-3 px-0 text-red-200 hover:bg-transparent" onClick={retrySlots}>
                      Reintentar
                    </Button>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <p className="text-sm text-cream/50">No quedan horarios disponibles para este día.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {slots.map((slot) => (
                      <button
                        key={slot.time}
                        disabled={!slot.available}
                        onClick={() => setSelectedTime(slot.time)}
                        className={cn(
                          'rounded-2xl border px-4 py-3 text-sm transition-all duration-200',
                          selectedTime === slot.time
                            ? 'border-gold bg-gold text-black'
                            : slot.available
                              ? 'border-white/8 bg-white/[0.03] text-cream hover:border-gold/35 hover:bg-white/[0.05]'
                              : 'cursor-not-allowed border-transparent bg-white/[0.02] text-cream/18 line-through'
                        )}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-cream/45">
                Elegí una fecha para mostrar los horarios disponibles.
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedDate && selectedTime && (
        <div className="mt-6 flex justify-end">
          <Button className="w-full sm:w-auto" size="lg" onClick={() => onSelect(selectedDate, selectedTime)}>
            Continuar con mis datos
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

function ClientStep({
  booking,
  onConfirm,
  onBack,
}: {
  booking: Partial<BookingStep>
  onConfirm: (client: ClientFormData, id: string) => void
  onBack: () => void
}) {
  const [form, setForm] = useState<ClientFormData>({ first_name: '', last_name: '', email: '', phone: '' })
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validateForm = (): boolean => {
    const errors: FormErrors = {}

    if (!form.first_name.trim()) {
      errors.first_name = 'El nombre es obligatorio'
    } else if (form.first_name.trim().length < 2) {
      errors.first_name = 'El nombre debe tener al menos 2 caracteres'
    } else if (form.first_name.trim().length > 50) {
      errors.first_name = 'El nombre es demasiado largo'
    }

    if (!form.email.trim()) {
      errors.email = 'El email es obligatorio'
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      errors.email = 'Ingresá un email válido'
    }

    if (!form.phone.trim()) {
      errors.phone = 'El teléfono es obligatorio'
    } else if (!PHONE_REGEX.test(form.phone.trim())) {
      errors.phone = 'Ingresá un teléfono válido'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const updateField = (field: keyof ClientFormData, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (formErrors[field]) {
      setFormErrors((current) => ({ ...current, [field]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) return

    if (!booking.service?.id || !booking.barber?.id || !booking.date || !booking.time) {
      setError('Datos de reserva incompletos. Por favor volvé al inicio.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: booking.service.id,
          barberId: booking.barber.id,
          date: booking.date,
          startTime: booking.time,
          client: {
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim(),
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message || data.error || 'Error al confirmar el turno')
        setLoading(false)
        return
      }

      onConfirm(
        {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
        },
        data.appointment.id
      )
    } catch (err) {
      console.error('Error submitting booking:', err)
      setError('Error de conexión. Por favor intentá de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <StepHeader
        eyebrow="Paso 4"
        title="Confirmá tus datos"
        description="Pedimos solo lo esencial para dejar la cita confirmada, enviarte el detalle y que puedas gestionarla después sin esfuerzo."
        onBack={onBack}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre *"
              value={form.first_name}
              onChange={(e) => updateField('first_name', e.target.value)}
              placeholder="Felipe"
              error={formErrors.first_name}
              maxLength={50}
            />
            <Input
              label="Apellido"
              value={form.last_name}
              onChange={(e) => updateField('last_name', e.target.value)}
              placeholder="García"
              error={formErrors.last_name}
              maxLength={50}
            />
          </div>

          <Input
            label="Email *"
            type="email"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="tu@email.com"
            error={formErrors.email}
            autoComplete="email"
          />

          <Input
            label="Teléfono *"
            type="tel"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="+598 9X XXX XXX"
            error={formErrors.phone}
            autoComplete="tel"
          />

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="rounded-[28px] border border-gold/20 bg-gold/10 p-4 text-sm text-cream/70">
            Confirmaremos el turno con los datos ingresados y te enviaremos el detalle completo para que puedas verlo o cancelarlo cuando quieras.
          </div>

          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Confirmar turno ahora
          </Button>
        </form>

        <div className="rounded-[30px] border border-white/8 bg-white/[0.025] p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-gold/80">Checklist final</p>
          <div className="mt-5 space-y-3">
            {[
              { label: 'Servicio', value: booking.service?.name },
              { label: 'Duración', value: booking.service ? `${booking.service.duration_minutes} min` : '' },
              { label: 'Profesional', value: booking.barber?.name },
              { label: 'Fecha', value: booking.date ? formatDate(booking.date) : '' },
              { label: 'Hora', value: booking.time },
            ].map((row) => (
              <div key={row.label} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.25em] text-cream/30">{row.label}</p>
                <p className="mt-2 text-sm text-cream">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfirmationScreen({
  booking,
  appointmentId,
}: {
  booking: Partial<BookingStep>
  appointmentId?: string
}) {
  return (
    <div className="min-h-screen premium-backdrop px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="premium-panel overflow-hidden p-8 text-center sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-gold/20 bg-gold/10">
            <CheckCircle className="h-9 w-9 text-gold" />
          </div>

          <p className="mt-6 text-xs uppercase tracking-[0.35em] text-gold/80">Reserva lista</p>
          <h1 className="mt-3 font-serif text-4xl text-cream sm:text-5xl">Tu turno quedó confirmado</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-cream/55">
            La experiencia termina tan bien como empieza: resumen claro, número de reserva visible y acceso inmediato para gestionar tu cita.
          </p>

          <div className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
            {[
              { label: 'Servicio', value: booking.service?.name },
              { label: 'Barbero', value: booking.barber?.name },
              { label: 'Fecha', value: booking.date ? formatDate(booking.date) : '' },
              { label: 'Hora', value: booking.time },
            ].map((row) => (
              <div key={row.label} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-cream/30">{row.label}</p>
                <p className="mt-2 text-sm text-cream">{row.value}</p>
              </div>
            ))}
          </div>

          {appointmentId && (
            <div className="mx-auto mt-6 max-w-md rounded-full border border-gold/20 bg-gold/10 px-4 py-3 text-sm text-gold">
              Número de reserva: {appointmentId.slice(0, 8)}
            </div>
          )}

          <div className="mx-auto mt-8 grid max-w-md gap-3">
            <a
              href="/mis-turnos"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gold/30 bg-gold/10 px-5 py-3 text-sm font-medium text-gold transition hover:bg-gold/15"
            >
              Ver o cancelar mi turno
            </a>
            <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
              Hacer otra reserva
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
