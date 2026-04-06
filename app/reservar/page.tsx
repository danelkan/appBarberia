'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { addMonths, format, getDay, getDaysInMonth, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle,
  ChevronLeft,
  Clock,
  MapPin,
  RefreshCw,
  Scissors,
  User,
} from 'lucide-react'
import { Button, Input, Spinner } from '@/components/ui'
import { cn, formatDate, formatPrice, getAvailableDates } from '@/lib/utils'
import type { Barber, BookingStep, Branch, Service, TimeSlot } from '@/types'

type BookingStage = 'service' | 'barber' | 'datetime' | 'client'

interface ClientForm {
  first_name: string
  last_name: string
  email: string
  phone: string
}

const INITIAL_CLIENT: ClientForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
}

const STEPS: { key: BookingStage; label: string }[] = [
  { key: 'service', label: 'Servicio' },
  { key: 'barber', label: 'Barbero' },
  { key: 'datetime', label: 'Fecha y hora' },
  { key: 'client', label: 'Tus datos' },
]

export default function BookingPage() {
  const [branchId, setBranchId] = useState<string | null>(null)

  const [stage, setStage] = useState<BookingStage>('service')
  const [booking, setBooking] = useState<Partial<BookingStep>>({})
  const [branches, setBranches] = useState<Branch[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [appointmentId, setAppointmentId] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setBranchId(params.get('branch'))

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
        if (!res.ok) throw new Error('No se pudieron cargar los barberos')
        return res.json()
      }),
    ])
      .then(([branchData, servicesData, barbersData]) => {
        setBranches(branchData.branches ?? [])
        setServices(servicesData.services ?? [])
        setBarbers(barbersData.barbers ?? [])
      })
      .catch((error: Error) => {
        setLoadingError(error.message || 'No se pudo cargar la reserva')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const selectedBranch = useMemo(
    () => branches.find(branch => branch.id === branchId),
    [branchId, branches]
  )

  useEffect(() => {
    if (!selectedBranch) return

    setBooking(current => ({
      ...current,
      branch: selectedBranch,
    }))
  }, [selectedBranch])

  const branchBarbers = useMemo(() => {
    if (!selectedBranch) return []

    return barbers.filter(barber => {
      const branchIds = barber.branch_ids ?? barber.branches?.map(branch => branch.id) ?? []
      return branchIds.includes(selectedBranch.id)
    })
  }, [barbers, selectedBranch])

  function goBack() {
    if (stage === 'barber') {
      setBooking(current => ({ ...current, barber: undefined, date: undefined, time: undefined }))
      setStage('service')
      return
    }

    if (stage === 'datetime') {
      setBooking(current => ({ ...current, date: undefined, time: undefined }))
      setStage('barber')
      return
    }

    if (stage === 'client') {
      setStage('datetime')
    }
  }

  if (loading) {
    return (
      <div className="admin-theme min-h-screen bg-page flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (loadingError) {
    return (
      <div className="admin-theme min-h-screen bg-page flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-white p-8 text-center shadow-modal">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
          <h1 className="mt-4 font-serif text-2xl text-cream">No pudimos abrir la reserva</h1>
          <p className="mt-2 text-sm text-cream/50">{loadingError}</p>
          <Button className="mt-6 w-full" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  if (!selectedBranch) {
    return (
      <div className="admin-theme min-h-screen bg-page flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-white p-8 text-center shadow-modal">
          <MapPin className="mx-auto h-8 w-8 text-gold" />
          <h1 className="mt-4 font-serif text-2xl text-cream">Elegí una sucursal</h1>
          <p className="mt-2 text-sm text-cream/50">Primero seleccioná dónde querés reservar.</p>
          <Link href="/" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-black">
            Volver a sucursales
          </Link>
        </div>
      </div>
    )
  }

  if (confirmed) {
    return (
      <ConfirmationScreen
        booking={booking}
        appointmentId={appointmentId}
      />
    )
  }

  const currentStep = STEPS.findIndex(step => step.key === stage) + 1

  return (
    <main className="admin-theme min-h-screen bg-page">
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-border bg-white px-5 py-5 shadow-card sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-cream/50 hover:text-cream">
                <ArrowLeft className="h-4 w-4" />
                Cambiar sucursal
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <h1 className="font-serif text-3xl text-cream">{selectedBranch.name}</h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold-dark">
                  <MapPin className="h-3.5 w-3.5" />
                  Reserva online
                </span>
              </div>
              {selectedBranch.address && <p className="mt-2 text-sm text-cream/50">{selectedBranch.address}</p>}
            </div>

            <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.24em] text-cream/35">Paso actual</p>
              <p className="mt-1 text-lg font-semibold text-cream">{currentStep} de 4</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            {STEPS.map((step, index) => {
              const active = step.key === stage
              const complete = index < currentStep - 1

              return (
                <div
                  key={step.key}
                  className={cn(
                    'rounded-2xl border px-4 py-3 text-sm font-medium transition-all',
                    active
                      ? 'border-gold/30 bg-gold/10 text-gold-dark'
                      : complete
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-border bg-surface-2 text-cream/45'
                  )}
                >
                  {step.label}
                </div>
              )
            })}
          </div>
        </header>

        <section className="mt-5 rounded-3xl border border-border bg-white p-5 shadow-card sm:p-6">
          {stage === 'service' && (
            <ServiceStep
              services={services}
              selectedServiceId={booking.service?.id}
              onSelect={service => {
                setBooking(current => ({
                  ...current,
                  service,
                  barber: undefined,
                  date: undefined,
                  time: undefined,
                }))
                setStage('barber')
              }}
            />
          )}

          {stage === 'barber' && (
            <BarberStep
              barbers={branchBarbers}
              selectedBarberId={booking.barber?.id}
              onBack={goBack}
              onSelect={barber => {
                setBooking(current => ({
                  ...current,
                  barber,
                  date: undefined,
                  time: undefined,
                }))
                setStage('datetime')
              }}
            />
          )}

          {stage === 'datetime' && booking.barber && booking.service && (
            <DateTimeStep
              booking={booking}
              onBack={goBack}
              onSelect={(date, time) => {
                setBooking(current => ({ ...current, date, time }))
                setStage('client')
              }}
            />
          )}

          {stage === 'client' && booking.barber && booking.service && booking.date && booking.time && (
            <ClientStep
              booking={booking}
              onBack={goBack}
              onConfirm={(client, id) => {
                setBooking(current => ({ ...current, client }))
                setAppointmentId(id)
                setConfirmed(true)
              }}
            />
          )}
        </section>
      </div>
    </main>
  )
}

function StepIntro({
  title,
  description,
  onBack,
}: {
  title: string
  description: string
  onBack?: () => void
}) {
  return (
    <div className="mb-6">
      {onBack && (
        <button
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-cream/50 hover:text-cream"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver
        </button>
      )}
      <h2 className="font-serif text-3xl text-cream">{title}</h2>
      <p className="mt-2 text-sm text-cream/50">{description}</p>
    </div>
  )
}

function ServiceStep({
  services,
  selectedServiceId,
  onSelect,
}: {
  services: Service[]
  selectedServiceId?: string
  onSelect: (service: Service) => void
}) {
  return (
    <div className="animate-fade-up">
      <StepIntro
        title="Elegí el servicio"
        description="Solo lo necesario para seguir rápido."
      />

      <div className="grid gap-3">
        {services.map(service => (
          <button
            key={service.id}
            onClick={() => onSelect(service)}
            className={cn(
              'rounded-2xl border p-4 text-left transition-all hover:shadow-card-hover',
              selectedServiceId === service.id
                ? 'border-gold/30 bg-gold/10'
                : 'border-border bg-surface-2 hover:bg-white'
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-cream">{service.name}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-cream/55">
                    <Clock className="h-3.5 w-3.5 text-gold" />
                    {service.duration_minutes} min
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-cream">{formatPrice(service.price)}</p>
                <p className="mt-2 text-sm font-semibold text-gold-dark">Continuar</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function BarberStep({
  barbers,
  selectedBarberId,
  onSelect,
  onBack,
}: {
  barbers: Barber[]
  selectedBarberId?: string
  onSelect: (barber: Barber) => void
  onBack: () => void
}) {
  return (
    <div className="animate-fade-up">
      <StepIntro
        title="Elegí barbero"
        description="Mostramos solo el equipo de esta sucursal."
        onBack={onBack}
      />

      {barbers.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-2 p-5 text-sm text-cream/55">
          No hay barberos asignados a esta sucursal todavía.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {barbers.map(barber => (
            <button
              key={barber.id}
              onClick={() => onSelect(barber)}
              className={cn(
                'rounded-2xl border p-4 text-left transition-all hover:shadow-card-hover',
                selectedBarberId === barber.id
                  ? 'border-gold/30 bg-gold/10'
                  : 'border-border bg-surface-2 hover:bg-white'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/20 bg-gold/10 font-semibold text-gold">
                  {barber.name[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-cream">{barber.name}</h3>
                  <p className="text-sm text-cream/45">Ver horarios disponibles</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
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
  const [slotsError, setSlotsError] = useState('')
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const availableDates = useMemo(
    () => (booking.barber ? new Set(getAvailableDates(booking.barber.availability, 45)) : new Set<string>()),
    [booking.barber]
  )

  useEffect(() => {
    if (!selectedDate || !booking.barber || !booking.service) return

    setLoadingSlots(true)
    setSlotsError('')
    setSlots([])

    fetch(`/api/appointments/slots?barberId=${booking.barber.id}&date=${selectedDate}&duration=${booking.service.duration_minutes}`)
      .then(res => {
        if (!res.ok) throw new Error('No se pudieron cargar los horarios')
        return res.json()
      })
      .then(data => {
        setSlots(data.slots ?? [])
      })
      .catch(() => {
        setSlotsError('No se pudieron cargar los horarios.')
      })
      .finally(() => {
        setLoadingSlots(false)
      })
  }, [selectedDate, booking.barber, booking.service])

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = getDay(startOfMonth(currentMonth))
  const daysInMonth = getDaysInMonth(currentMonth)
  const today = format(new Date(), 'yyyy-MM-dd')

  const calendarDays = Array.from({ length: firstDay }, (): string | null => null).concat(
    Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(year, month, index + 1)
      return format(date, 'yyyy-MM-dd')
    })
  )

  return (
    <div className="animate-fade-up">
      <StepIntro
        title="Elegí fecha y hora"
        description="Disponibilidad real, sin pasos extra."
        onBack={onBack}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-3xl border border-border bg-surface-2 p-4">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setCurrentMonth(month => addMonths(month, -1))}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-cream/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-base font-semibold capitalize text-cream">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </p>
            <button
              onClick={() => setCurrentMonth(month => addMonths(month, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-cream/50 rotate-180"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-cream/35">
            {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map(day => (
              <div key={day}>{day}</div>
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

              return (
                <button
                  key={date}
                  disabled={isPast || !isAvailable}
                  onClick={() => {
                    setSelectedDate(date)
                    setSelectedTime('')
                  }}
                  className={cn(
                    'aspect-square rounded-2xl border text-sm font-medium transition-all',
                    isSelected
                      ? 'border-gold bg-gold text-black'
                      : isPast || !isAvailable
                        ? 'cursor-not-allowed border-transparent bg-white text-cream/20'
                        : 'border-border bg-white text-cream hover:border-gold/30'
                  )}
                >
                  {Number.parseInt(date.split('-')[2], 10)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-surface-2 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-cream">
                {selectedDate ? formatDate(selectedDate) : 'Elegí un día'}
              </p>
              <p className="text-xs text-cream/45">Horarios disponibles</p>
            </div>
          </div>

          <div className="mt-4">
            {!selectedDate ? (
              <div className="rounded-2xl border border-dashed border-border bg-white px-4 py-5 text-sm text-cream/45">
                Tocá una fecha para ver los horarios.
              </div>
            ) : loadingSlots ? (
              <div className="flex min-h-[180px] items-center justify-center">
                <Spinner />
              </div>
            ) : slotsError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-600">
                {slotsError}
              </div>
            ) : slots.length === 0 ? (
              <div className="rounded-2xl border border-border bg-white px-4 py-5 text-sm text-cream/45">
                No quedan horarios para ese día.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {slots.map(slot => (
                  <button
                    key={slot.time}
                    disabled={!slot.available}
                    onClick={() => setSelectedTime(slot.time)}
                    className={cn(
                      'rounded-2xl border px-3 py-3 text-sm font-semibold transition-all',
                      selectedTime === slot.time
                        ? 'border-gold bg-gold text-black'
                        : slot.available
                          ? 'border-border bg-white text-cream hover:border-gold/30'
                          : 'cursor-not-allowed border-transparent bg-white text-cream/20 line-through'
                    )}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedDate && selectedTime && (
        <div className="mt-6 flex justify-end">
          <Button className="w-full sm:w-auto" onClick={() => onSelect(selectedDate, selectedTime)}>
            Continuar
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
  onConfirm: (client: ClientForm, id: string) => void
  onBack: () => void
}) {
  const [form, setForm] = useState<ClientForm>(INITIAL_CLIENT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: booking.service?.id,
          barberId: booking.barber?.id,
          branchId: booking.branch?.id,
          date: booking.date,
          startTime: booking.time,
          client: form,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message || data.error || 'No se pudo confirmar el turno')
        setLoading(false)
        return
      }

      onConfirm(form, data.appointment.id)
    } catch {
      setError('No se pudo confirmar el turno.')
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <StepIntro
        title="Confirmá tus datos"
        description="Pedimos solo lo justo para dejar el turno confirmado."
        onBack={onBack}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre *"
              value={form.first_name}
              onChange={event => setForm(current => ({ ...current, first_name: event.target.value }))}
              placeholder="Felipe"
            />
            <Input
              label="Apellido"
              value={form.last_name}
              onChange={event => setForm(current => ({ ...current, last_name: event.target.value }))}
              placeholder="García"
            />
          </div>

          <Input
            label="Email *"
            type="email"
            value={form.email}
            onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
            placeholder="tu@email.com"
          />

          <Input
            label="Teléfono *"
            type="tel"
            value={form.phone}
            onChange={event => setForm(current => ({ ...current, phone: event.target.value }))}
            placeholder="+598 9X XXX XXX"
          />

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            Confirmar turno
          </Button>
        </form>

        <div className="rounded-3xl border border-border bg-surface-2 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-cream/35">Resumen</p>
          <div className="mt-4 space-y-3 text-sm">
            <SummaryRow icon={<MapPin className="h-4 w-4" />} label="Sucursal" value={booking.branch?.name} />
            <SummaryRow icon={<Scissors className="h-4 w-4" />} label="Servicio" value={booking.service?.name} />
            <SummaryRow icon={<User className="h-4 w-4" />} label="Barbero" value={booking.barber?.name} />
            <SummaryRow icon={<Calendar className="h-4 w-4" />} label="Fecha" value={booking.date ? formatDate(booking.date) : ''} />
            <SummaryRow icon={<Clock className="h-4 w-4" />} label="Hora" value={booking.time} />
            <SummaryRow icon={<Scissors className="h-4 w-4" />} label="Precio" value={booking.service ? formatPrice(booking.service.price) : ''} />
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-cream/35">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-cream">{value || 'Pendiente'}</p>
    </div>
  )
}

function ConfirmationScreen({
  booking,
  appointmentId,
}: {
  booking: Partial<BookingStep>
  appointmentId: string
}) {
  return (
    <main className="admin-theme min-h-screen bg-page px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-white p-8 text-center shadow-modal">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
          <CheckCircle className="h-8 w-8 text-emerald-600" />
        </div>

        <h1 className="mt-5 font-serif text-4xl text-cream">Turno confirmado</h1>
        <p className="mt-2 text-sm text-cream/50">Ya quedó registrado y listo para gestionarlo después.</p>

        <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
          <SummaryRow icon={<MapPin className="h-4 w-4" />} label="Sucursal" value={booking.branch?.name} />
          <SummaryRow icon={<Scissors className="h-4 w-4" />} label="Servicio" value={booking.service?.name} />
          <SummaryRow icon={<User className="h-4 w-4" />} label="Barbero" value={booking.barber?.name} />
          <SummaryRow icon={<Calendar className="h-4 w-4" />} label="Fecha" value={booking.date ? formatDate(booking.date) : ''} />
        </div>

        <div className="mt-6 inline-flex rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold-dark">
          Reserva #{appointmentId.slice(0, 8)}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/mis-turnos"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm font-semibold text-cream"
          >
            Ver mis turnos
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-black"
          >
            Hacer otra reserva
          </Link>
        </div>
      </div>
    </main>
  )
}
