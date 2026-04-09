'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Scissors,
} from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { formatDate, formatPrice, getAvailableDates } from '@/lib/utils'
import type { Barber, Branch, Service, TimeSlot } from '@/types'

type Step = 1 | 2 | 3

interface ClientForm {
  first_name: string
  last_name:  string
  email:      string
  phone:      string
}

const INITIAL_CLIENT: ClientForm = { first_name: '', last_name: '', email: '', phone: '' }

// ── Sub-components ──────────────────────────────────────────────────

function StepDot({ n, current }: { n: number; current: number }) {
  const done    = current > n
  const active  = current === n
  return (
    <div className="flex items-center">
      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all ${
        done   ? 'bg-emerald-500 text-white' :
        active ? 'bg-slate-950 text-white' :
                 'bg-slate-200 text-slate-500'
      }`}>
        {done ? '✓' : n}
      </div>
      {n < 3 && (
        <div className={`mx-2 h-0.5 w-8 flex-shrink-0 transition-all ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
      )}
    </div>
  )
}

function SummaryLine({
  service, barber, date, time,
}: {
  service: Service | null
  barber:  Barber  | null
  date:    string
  time:    string
}) {
  const parts: string[] = []
  if (service) parts.push(service.name)
  if (barber)  parts.push(barber.name)
  if (date && time) parts.push(`${format(new Date(`${date}T00:00:00`), 'd MMM', { locale: es })} ${time}`)
  return (
    <p className="truncate text-sm text-slate-600">
      {parts.length ? parts.join(' · ') : <span className="text-slate-400">Completá los pasos para confirmar</span>}
    </p>
  )
}

// ── Main component ──────────────────────────────────────────────────

export default function BookingFlow({
  branch,
  services,
  barbers,
}: {
  branch:   Pick<Branch, 'id' | 'name' | 'address'>
  services: Service[]
  barbers:  Barber[]
}) {
  const [step, setStep]               = useState<Step>(1)
  const [selectedService, setService] = useState<Service | null>(null)
  const [selectedBarber,  setBarber]  = useState<Barber  | null>(null)
  const [selectedDate, setDate]       = useState('')
  const [selectedTime, setTime]       = useState('')
  const [slots, setSlots]             = useState<TimeSlot[]>([])
  const [client, setClient]           = useState<ClientForm>(INITIAL_CLIENT)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState(false)
  const [loadingSlots, startLoadingSlots] = useTransition()
  const [submitting,   startSubmitting]   = useTransition()

  // Ref for auto-scrolling to slots on mobile
  const slotsRef = useRef<HTMLDivElement>(null)
  const datesRef = useRef<HTMLDivElement>(null)

  const availableDates = useMemo(
    () => (selectedBarber ? getAvailableDates(selectedBarber.availability ?? {}, 21) : []),
    [selectedBarber]
  )

  // Auto-select first date when barber changes
  useEffect(() => {
    if (!selectedBarber) { setDate(''); setTime(''); setSlots([]); return }
    setDate(current => current || availableDates[0] || '')
  }, [availableDates, selectedBarber])

  // Scroll to dates when barber is selected
  useEffect(() => {
    if (selectedBarber && datesRef.current) {
      setTimeout(() => datesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    }
  }, [selectedBarber])

  // Fetch slots when barber+service+date are all set
  useEffect(() => {
    if (!selectedBarber || !selectedService || !selectedDate) { setSlots([]); return }
    startLoadingSlots(async () => {
      setError('')
      const params = new URLSearchParams({
        barberId: selectedBarber.id,
        branchId: branch.id,
        date: selectedDate,
        duration: String(selectedService.duration_minutes),
      })
      const res  = await fetch(`/api/appointments/slots?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No se pudieron cargar los horarios'); setSlots([]); return }
      setSlots(data.slots ?? [])
    })
  }, [branch.id, selectedBarber, selectedDate, selectedService])

  // Scroll to slots when they load
  useEffect(() => {
    if (slots.length && slotsRef.current) {
      setTimeout(() => slotsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    }
  }, [slots])

  function goNext() {
    if (step === 1 && selectedService) setStep(2)
    if (step === 2 && selectedBarber && selectedDate && selectedTime) setStep(3)
  }

  function goBack() {
    if (step === 2) { setStep(1); setTime('') }
    if (step === 3) setStep(2)
  }

  function submitBooking() {
    if (!selectedService || !selectedBarber || !selectedDate || !selectedTime) return
    startSubmitting(async () => {
      setError('')
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          barberId:  selectedBarber.id,
          branchId:  branch.id,
          date:      selectedDate,
          startTime: selectedTime,
          client,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No pudimos confirmar el turno'); return }
      setSuccess(true)
    })
  }

  const canStep2  = Boolean(selectedBarber && selectedDate && selectedTime)
  const canSubmit = Boolean(client.first_name && client.email && client.phone)

  const ctaLabel = step === 1 ? 'Elegí un servicio' :
                   step === 2 ? (canStep2 ? 'Continuar con mis datos' : 'Elegí barbero, fecha y hora') :
                                'Confirmar turno'

  const ctaDisabled = step === 1 ? !selectedService :
                      step === 2 ? !canStep2 :
                                   !canSubmit

  // ── Success screen ──────────────────────────────────────────────
  if (success) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <div className="rounded-[32px] border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-6 text-2xl font-semibold text-slate-950">Turno confirmado</h1>
            <p className="mt-2 text-sm text-slate-500">
              Ya quedó reservado en {branch.name}. Te enviamos el detalle por email.
            </p>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-left">
              <p className="font-semibold text-slate-950">{selectedService?.name}</p>
              <p className="mt-1 text-sm text-slate-500">{selectedBarber?.name}</p>
              <p className="mt-2 text-sm font-medium text-slate-700">
                {formatDate(selectedDate)} · {selectedTime}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <Link href="/" className="btn-gold w-full">
                Nueva reserva
              </Link>
              <Link href="/mis-turnos" className="btn-outline w-full">
                Ver mis turnos
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ── Booking flow ─────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col">

      {/* ── Sticky header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver</span>
          </Link>

          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
              <Scissors className="h-3.5 w-3.5" />
            </div>
            <span className="truncate text-sm font-semibold text-slate-950">{branch.name}</span>
          </div>

          {/* Step indicator */}
          <div className="flex items-center">
            {[1, 2, 3].map(n => <StepDot key={n} n={n} current={step} />)}
          </div>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────── */}
      <div className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-6xl">
          <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-6">

            {/* ── Step content ───────────────────────────────── */}
            {/* min-w-0 is critical: without it, a grid/flex child expands to fit
                its content instead of clipping — causes page-level horizontal scroll
                when the dates overflow-x-auto container is inside */}
            <div className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:rounded-[32px]">

              {/* Step 1 — Service */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Paso 1 de 3</p>
                    <h2 className="mt-1.5 text-xl font-semibold text-slate-950 sm:text-2xl">Elegí el servicio</h2>
                  </div>

                  <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                    {services.map(service => (
                      <button
                        key={service.id}
                        onClick={() => setService(service)}
                        className={`rounded-[20px] border p-4 text-left transition active:scale-[0.98] ${
                          selectedService?.id === service.id
                            ? 'border-slate-950 bg-slate-950 text-white'
                            : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-sm font-semibold sm:text-base">{service.name}</p>
                        <div className={`mt-2.5 flex items-center justify-between text-xs sm:text-sm ${
                          selectedService?.id === service.id ? 'text-slate-300' : 'text-slate-500'
                        }`}>
                          <span>{service.duration_minutes} min</span>
                          <span className="font-semibold">{formatPrice(service.price)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2 — Barber / Date / Time */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Paso 2 de 3</p>
                      <h2 className="mt-1.5 text-xl font-semibold text-slate-950 sm:text-2xl">Barbero y horario</h2>
                    </div>
                    <button
                      onClick={goBack}
                      className="text-sm font-medium text-slate-500 transition hover:text-slate-950"
                    >
                      ← Volver
                    </button>
                  </div>

                  {/* Barbers — compact row */}
                  <div>
                    <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-slate-400">Barbero</p>
                    {barbers.length === 0 ? (
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                        No hay barberos disponibles en esta sucursal por ahora.
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {barbers.map(barber => (
                          <button
                            key={barber.id}
                            onClick={() => { setBarber(barber); setTime('') }}
                            className={`flex items-center gap-3 rounded-[20px] border p-3.5 text-left transition active:scale-[0.98] ${
                              selectedBarber?.id === barber.id
                                ? 'border-slate-950 bg-slate-950 text-white'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                              selectedBarber?.id === barber.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {barber.name[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-sm font-semibold ${selectedBarber?.id === barber.id ? 'text-white' : 'text-slate-950'}`}>
                                {barber.name}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dates — horizontal scroll chips */}
                  {selectedBarber && (
                    <div ref={datesRef}>
                      <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-slate-400">Fecha</p>
                      {/* relative + after = fade hint on the right indicating more dates to scroll */}
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white to-transparent" />
                      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {availableDates.slice(0, 21).map(date => {
                          const d = new Date(`${date}T00:00:00`)
                          return (
                            <button
                              key={date}
                              onClick={() => { setDate(date); setTime('') }}
                              className={`flex-shrink-0 rounded-[18px] border px-3.5 py-2.5 text-center transition active:scale-[0.97] ${
                                selectedDate === date
                                  ? 'border-slate-950 bg-slate-950 text-white'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <p className={`text-[10px] font-semibold uppercase tracking-wider ${selectedDate === date ? 'text-slate-300' : 'text-slate-400'}`}>
                                {format(d, 'EEE', { locale: es })}
                              </p>
                              <p className="mt-0.5 text-sm font-semibold">
                                {format(d, 'd MMM', { locale: es })}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                      </div>{/* end scroll wrapper */}
                    </div>
                  )}

                  {/* Time slots */}
                  {selectedBarber && selectedDate && (
                    <div ref={slotsRef}>
                      <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-slate-400">Horario</p>
                      {loadingSlots ? (
                        <div className="flex h-24 items-center justify-center rounded-[20px] border border-slate-200 bg-slate-50">
                          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        </div>
                      ) : slots.filter(s => s.available).length === 0 ? (
                        <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                          No hay horarios disponibles para esta fecha.
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                          {slots.filter(s => s.available).map(slot => (
                            <button
                              key={slot.time}
                              onClick={() => setTime(slot.time)}
                              className={`rounded-xl border py-2.5 text-center text-sm font-semibold transition active:scale-[0.97] ${
                                selectedTime === slot.time
                                  ? 'border-slate-950 bg-slate-950 text-white'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              {slot.time}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3 — Client data */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Paso 3 de 3</p>
                      <h2 className="mt-1.5 text-xl font-semibold text-slate-950 sm:text-2xl">Tus datos</h2>
                    </div>
                    <button
                      onClick={goBack}
                      className="text-sm font-medium text-slate-500 transition hover:text-slate-950"
                    >
                      ← Volver
                    </button>
                  </div>

                  {/* Booking summary (visible on mobile) */}
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 lg:hidden">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Servicio</p>
                        <p className="mt-1 text-xs font-semibold text-slate-950">{selectedService?.name}</p>
                        <p className="text-xs text-slate-500">{selectedService && formatPrice(selectedService.price)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Barbero</p>
                        <p className="mt-1 text-xs font-semibold text-slate-950">{selectedBarber?.name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Turno</p>
                        <p className="mt-1 text-xs font-semibold text-slate-950">
                          {format(new Date(`${selectedDate}T00:00:00`), 'd MMM', { locale: es })}
                        </p>
                        <p className="text-xs text-slate-500">{selectedTime}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Nombre"
                      value={client.first_name}
                      onChange={e => setClient(c => ({ ...c, first_name: e.target.value }))}
                      placeholder="Tu nombre"
                      autoFocus
                    />
                    <Input
                      label="Apellido"
                      value={client.last_name}
                      onChange={e => setClient(c => ({ ...c, last_name: e.target.value }))}
                      placeholder="Tu apellido"
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={client.email}
                      onChange={e => setClient(c => ({ ...c, email: e.target.value }))}
                      placeholder="nombre@email.com"
                    />
                    <Input
                      label="Teléfono"
                      value={client.phone}
                      onChange={e => setClient(c => ({ ...c, phone: e.target.value }))}
                      placeholder="09X XXX XXX"
                    />
                  </div>

                  {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Desktop sidebar summary ─────────────────────── */}
            <aside className="hidden lg:flex lg:flex-col">
              <div className="sticky top-[65px] rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Resumen</p>

                <div className="mt-5 space-y-4">
                  <SummaryItem label="Sucursal" value={branch.name} />
                  <SummaryItem label="Servicio"  value={selectedService ? `${selectedService.name} · ${formatPrice(selectedService.price)}` : '—'} />
                  <SummaryItem label="Barbero"   value={selectedBarber?.name  ?? '—'} />
                  <SummaryItem
                    label="Fecha y hora"
                    value={selectedDate && selectedTime
                      ? `${formatDate(selectedDate)} · ${selectedTime}`
                      : '—'
                    }
                  />
                </div>

                <div className="mt-8">
                  <Button
                    className="w-full"
                    disabled={ctaDisabled}
                    loading={submitting}
                    onClick={step === 3 ? submitBooking : goNext}
                  >
                    {step === 3 ? 'Confirmar turno' : 'Continuar'}
                    {!submitting && <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* ── Mobile sticky bottom CTA ───────────────────────── */}
      <div className="safe-area-pb sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto max-w-lg">
          <SummaryLine service={selectedService} barber={selectedBarber} date={selectedDate} time={selectedTime} />
          <Button
            className="mt-2 w-full"
            disabled={ctaDisabled}
            loading={submitting}
            onClick={step === 3 ? submitBooking : goNext}
          >
            {ctaDisabled ? ctaLabel : (step === 3 ? 'Confirmar turno' : 'Continuar')}
            {!ctaDisabled && !submitting && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${value === '—' ? 'text-slate-400' : 'text-slate-950'}`}>{value}</p>
    </div>
  )
}
