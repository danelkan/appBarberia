'use client'
import { useState, useEffect } from 'react'
import { Scissors, User, Calendar, CheckCircle, ChevronLeft, Clock, DollarSign } from 'lucide-react'
import { Button, Input, Spinner } from '@/components/ui'
import { cn, formatDate, formatPrice, getAvailableDates } from '@/lib/utils'
import { format, addMonths, startOfMonth, getDaysInMonth, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Service, Barber, TimeSlot, BookingStep } from '@/types'

const STEPS = [
  { n: 1, label: 'Servicio', icon: Scissors },
  { n: 2, label: 'Barbero',  icon: User },
  { n: 3, label: 'Fecha',    icon: Calendar },
  { n: 4, label: 'Datos',    icon: User },
]

export default function BookingPage() {
  const [step, setStep] = useState(1)
  const [booking, setBooking] = useState<Partial<BookingStep>>({})
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [appointmentId, setAppointmentId] = useState<string>()

  useEffect(() => {
    Promise.all([
      fetch('/api/services').then(r => r.json()),
      fetch('/api/barbers').then(r => r.json()),
    ]).then(([s, b]) => {
      setServices(s.services ?? [])
      setBarbers(b.barbers ?? [])
      setLoading(false)
    })
  }, [])

  if (confirmed) return <ConfirmationScreen booking={booking} appointmentId={appointmentId} />

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-5">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl text-cream">Felito Studios</h1>
            <p className="text-xs text-cream/40 mt-0.5">Reservá tu turno</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
            <Scissors className="w-3.5 h-3.5 text-gold" />
          </div>
        </div>
      </header>

      {/* Step indicator */}
      <div className="border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-0">
          {STEPS.map((s, i) => {
            const done = step > s.n
            const active = step === s.n
            return (
              <div key={s.n} className="flex items-center flex-1">
                <div className={cn(
                  'flex items-center gap-1.5 text-xs transition-all',
                  active ? 'text-gold font-medium' : done ? 'text-cream/60' : 'text-cream/20'
                )}>
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium border transition-all',
                    active ? 'border-gold bg-gold text-black' :
                    done ? 'border-gold/40 bg-gold/10 text-gold' :
                    'border-border text-cream/20'
                  )}>
                    {done ? '✓' : s.n}
                  </div>
                  <span className="hidden sm:block">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('flex-1 h-px mx-2 transition-all', done ? 'bg-gold/30' : 'bg-border')} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 py-6">
        <div className="max-w-lg mx-auto">
          {loading ? (
            <div className="flex justify-center py-20"><Spinner /></div>
          ) : (
            <>
              {step === 1 && (
                <ServiceStep services={services} booking={booking}
                  onSelect={(service) => { setBooking(b => ({ ...b, service })); setStep(2) }} />
              )}
              {step === 2 && (
                <BarberStep barbers={barbers} booking={booking}
                  onSelect={(barber) => { setBooking(b => ({ ...b, barber })); setStep(3) }}
                  onBack={() => setStep(1)} />
              )}
              {step === 3 && (
                <DateTimeStep booking={booking}
                  onSelect={(date, time) => { setBooking(b => ({ ...b, date, time })); setStep(4) }}
                  onBack={() => setStep(2)} />
              )}
              {step === 4 && (
                <ClientStep booking={booking}
                  onConfirm={(client, id) => { setBooking(b => ({ ...b, client })); setAppointmentId(id); setConfirmed(true) }}
                  onBack={() => setStep(3)} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// ─── Step 1: Service ──────────────────────────────────────────────
function ServiceStep({ services, booking, onSelect }: {
  services: Service[]; booking: Partial<BookingStep>; onSelect: (s: Service) => void
}) {
  return (
    <div className="animate-fade-up">
      <h2 className="font-serif text-2xl text-cream mb-1">¿Qué servicio?</h2>
      <p className="text-sm text-cream/40 mb-6">Seleccioná el servicio que querés</p>
      <div className="grid gap-3">
        {services.map(s => (
          <button key={s.id} onClick={() => onSelect(s)}
            className={cn(
              'w-full text-left p-4 rounded-xl border transition-all duration-200',
              booking.service?.id === s.id
                ? 'border-gold bg-gold/5'
                : 'border-border hover:border-gold/30 hover:bg-surface'
            )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-cream text-sm">{s.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-cream/40 flex items-center gap-1">
                    <Clock className="w-3 h-3" />{s.duration_minutes} min
                  </span>
                </div>
              </div>
              <span className="text-gold font-medium text-sm">{formatPrice(s.price)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Step 2: Barber ───────────────────────────────────────────────
function BarberStep({ barbers, booking, onSelect, onBack }: {
  barbers: Barber[]; booking: Partial<BookingStep>; onSelect: (b: Barber) => void; onBack: () => void
}) {
  return (
    <div className="animate-fade-up">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-cream/40 hover:text-cream mb-5 transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> Volver
      </button>
      <h2 className="font-serif text-2xl text-cream mb-1">¿Con quién?</h2>
      <p className="text-sm text-cream/40 mb-6">Elegí tu barbero</p>
      <div className="grid gap-3">
        {barbers.map(b => (
          <button key={b.id} onClick={() => onSelect(b)}
            className={cn(
              'w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center gap-4',
              booking.barber?.id === b.id ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/30 hover:bg-surface'
            )}>
            <div className="w-11 h-11 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-serif text-lg flex-shrink-0">
              {b.name[0]}
            </div>
            <div>
              <p className="font-medium text-cream text-sm">{b.name}</p>
              <p className="text-xs text-cream/40 mt-0.5">Barbero profesional</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Step 3: Date + Time ──────────────────────────────────────────
function DateTimeStep({ booking, onSelect, onBack }: {
  booking: Partial<BookingStep>; onSelect: (date: string, time: string) => void; onBack: () => void
}) {
  const [selectedDate, setSelectedDate] = useState(booking.date ?? '')
  const [selectedTime, setSelectedTime] = useState(booking.time ?? '')
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const availableDates = booking.barber
    ? new Set(getAvailableDates(booking.barber.availability, 45))
    : new Set<string>()

  useEffect(() => {
    if (!selectedDate || !booking.barber || !booking.service) return
    setLoadingSlots(true)
    setSlots([])
    fetch(`/api/appointments/slots?barberId=${booking.barber.id}&date=${selectedDate}&duration=${booking.service.duration_minutes}`)
      .then(r => r.json())
      .then(d => { setSlots(d.slots ?? []); setLoadingSlots(false) })
  }, [selectedDate, booking.barber, booking.service])

  // Calendar grid
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = getDay(startOfMonth(currentMonth))
  const daysInMonth = getDaysInMonth(currentMonth)
  const today = format(new Date(), 'yyyy-MM-dd')

  const calendarDays = Array.from({ length: firstDay }, (): string | null => null)
    .concat(Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1)
      return format(d, 'yyyy-MM-dd')
    }))

  return (
    <div className="animate-fade-up">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-cream/40 hover:text-cream mb-5 transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> Volver
      </button>
      <h2 className="font-serif text-2xl text-cream mb-1">¿Cuándo?</h2>
      <p className="text-sm text-cream/40 mb-5">Elegí fecha y horario</p>

      {/* Calendar */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentMonth(m => addMonths(m, -1))}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-cream/40 hover:text-cream transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-cream capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </span>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-cream/40 hover:text-cream transition-colors rotate-180">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Do','Lu','Ma','Mi','Ju','Vi','Sá'].map(d => (
            <div key={d} className="text-center text-xs text-cream/30 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} />
            const isPast = date < today
            const isAvail = availableDates.has(date)
            const isSelected = date === selectedDate
            const isToday = date === today
            return (
              <button key={date} disabled={isPast || !isAvail}
                onClick={() => { setSelectedDate(date); setSelectedTime('') }}
                className={cn(
                  'calendar-day aspect-square text-xs',
                  isSelected ? 'selected' : isPast || !isAvail ? 'disabled' : 'available',
                  isToday && !isSelected ? 'today' : ''
                )}>
                {parseInt(date.split('-')[2])}
              </button>
            )
          })}
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div>
          <p className="text-xs text-cream/40 uppercase tracking-wider mb-3">Horarios disponibles</p>
          {loadingSlots ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-cream/30 text-center py-4">No hay horarios disponibles para este día</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map(slot => (
                <button key={slot.time} disabled={!slot.available}
                  onClick={() => setSelectedTime(slot.time)}
                  className={cn(
                    'py-2.5 rounded-lg text-sm border transition-all duration-150',
                    selectedTime === slot.time
                      ? 'bg-gold border-gold text-black font-medium'
                      : slot.available
                        ? 'border-border hover:border-gold/40 hover:bg-surface text-cream/80'
                        : 'border-border/30 text-cream/20 cursor-not-allowed line-through'
                  )}>
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedDate && selectedTime && (
        <div className="mt-6">
          <Button className="w-full" onClick={() => onSelect(selectedDate, selectedTime)}>
            Continuar
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Step 4: Client data ──────────────────────────────────────────
function ClientStep({ booking, onConfirm, onBack }: {
  booking: Partial<BookingStep>
  onConfirm: (client: any, id: string) => void
  onBack: () => void
}) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.first_name || !form.email || !form.phone) {
      setError('Completá todos los campos obligatorios')
      return
    }
    setLoading(true)
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: booking.service?.id,
        barberId: booking.barber?.id,
        date: booking.date,
        startTime: booking.time,
        client: form,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Error al confirmar el turno'); return }
    onConfirm(form, data.appointment.id)
  }

  return (
    <div className="animate-fade-up">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-cream/40 hover:text-cream mb-5 transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> Volver
      </button>
      <h2 className="font-serif text-2xl text-cream mb-1">Tus datos</h2>
      <p className="text-sm text-cream/40 mb-5">Para confirmar el turno</p>

      {/* Booking summary */}
      <div className="card p-4 mb-5 space-y-2">
        <p className="text-xs text-cream/30 uppercase tracking-wider mb-3">Resumen</p>
        {[
          { label: 'Servicio', value: booking.service?.name },
          { label: 'Precio',   value: booking.service ? formatPrice(booking.service.price) : '' },
          { label: 'Barbero',  value: booking.barber?.name },
          { label: 'Fecha',    value: booking.date ? formatDate(booking.date) : '' },
          { label: 'Hora',     value: booking.time },
        ].map(row => (
          <div key={row.label} className="flex justify-between text-sm">
            <span className="text-cream/40">{row.label}</span>
            <span className="text-cream capitalize">{row.value}</span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre *" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Felipe" />
          <Input label="Apellido" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="García" />
        </div>
        <Input label="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="tu@email.com" />
        <Input label="Teléfono *" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+598 9X XXX XXX" />
        {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">{error}</p>}
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Confirmar turno
        </Button>
      </form>
    </div>
  )
}

// ─── Confirmation screen ──────────────────────────────────────────
function ConfirmationScreen({ booking, appointmentId }: { booking: Partial<BookingStep>; appointmentId?: string }) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 text-center">
      <div className="animate-fade-up max-w-sm">
        <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-7 h-7 text-gold" />
        </div>
        <h1 className="font-serif text-2xl text-cream mb-2">¡Turno confirmado!</h1>
        <p className="text-sm text-cream/40 mb-6">Te enviamos un email con los detalles</p>
        <div className="card p-4 text-left space-y-2 mb-6">
          {[
            { label: 'Servicio', value: booking.service?.name },
            { label: 'Barbero',  value: booking.barber?.name },
            { label: 'Fecha',    value: booking.date ? formatDate(booking.date) : '' },
            { label: 'Hora',     value: booking.time },
          ].map(row => (
            <div key={row.label} className="flex justify-between text-sm">
              <span className="text-cream/40">{row.label}</span>
              <span className="text-cream capitalize">{row.value}</span>
            </div>
          ))}
        </div>
        <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
          Hacer otra reserva
        </Button>
      </div>
    </div>
  )
}
