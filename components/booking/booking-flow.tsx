'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock3,
  Loader2,
  Scissors,
  UserRound,
} from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { formatDate, formatPrice, getAvailableDates } from '@/lib/utils'
import type { Barber, Branch, Service, TimeSlot } from '@/types'

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

export default function BookingFlow({
  branch,
  services,
  barbers,
}: {
  branch: Pick<Branch, 'id' | 'name' | 'address'>
  services: Service[]
  barbers: Barber[]
}) {
  const [selectedService, setSelectedService] = useState<Service | null>(services[0] ?? null)
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [client, setClient] = useState<ClientForm>(INITIAL_CLIENT)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ id: string } | null>(null)
  const [loadingSlots, startLoadingSlots] = useTransition()
  const [submitting, startSubmitting] = useTransition()

  const availableDates = useMemo(() => {
    if (!selectedBarber) return []
    return getAvailableDates(selectedBarber.availability ?? {}, 21)
  }, [selectedBarber])

  useEffect(() => {
    setSelectedDate(availableDates[0] ?? '')
    setSelectedTime('')
  }, [availableDates])

  useEffect(() => {
    if (!selectedBarber || !selectedService || !selectedDate) {
      setSlots([])
      return
    }

    startLoadingSlots(async () => {
      setError('')
      const response = await fetch(
        `/api/appointments/slots?barberId=${selectedBarber.id}&date=${selectedDate}&duration=${selectedService.duration_minutes}`,
        { cache: 'no-store' }
      )
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'No se pudieron cargar los horarios')
        setSlots([])
        return
      }

      setSlots(data.slots ?? [])
    })
  }, [selectedBarber, selectedDate, selectedService])

  const canSubmit = selectedService && selectedBarber && selectedDate && selectedTime && client.first_name && client.email && client.phone

  function submitBooking() {
    if (!selectedService || !selectedBarber || !selectedDate || !selectedTime) return

    startSubmitting(async () => {
      setError('')

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          barberId: selectedBarber.id,
          branchId: branch.id,
          date: selectedDate,
          startTime: selectedTime,
          client,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'No pudimos confirmar el turno')
        return
      }

      setSuccess({ id: data.appointment?.id ?? '' })
    })
  }

  if (success) {
    return (
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[32px] border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-6 text-3xl font-semibold text-slate-950">Turno confirmado</h1>
            <p className="mt-3 text-slate-500">
              Te mandamos el detalle por email. Ya quedó reservado en {branch.name}.
            </p>

            <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50 p-5 text-left">
              <p className="text-sm font-semibold text-slate-950">{selectedService?.name}</p>
              <p className="mt-1 text-sm text-slate-500">{selectedBarber?.name}</p>
              <p className="mt-3 text-sm text-slate-600">
                {formatDate(selectedDate)} a las {selectedTime}
              </p>
            </div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/" className="btn-gold">
                Nueva reserva
              </Link>
              <Link href="/mis-turnos" className="btn-outline">
                Ver mis turnos
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-950">
              <ArrowLeft className="h-4 w-4" />
              Volver a sucursales
            </Link>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Scissors className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm text-slate-500">Sucursal</p>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{branch.name}</h1>
              </div>
            </div>

            <div className="mt-8 grid gap-8">
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-slate-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Servicio</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {services.map(service => (
                    <button
                      key={service.id}
                      onClick={() => setSelectedService(service)}
                      className={`rounded-[24px] border p-4 text-left transition ${
                        selectedService?.id === service.id
                          ? 'border-slate-950 bg-slate-950 text-white'
                          : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-base font-semibold">{service.name}</p>
                      <div className={`mt-3 flex items-center justify-between text-sm ${selectedService?.id === service.id ? 'text-slate-300' : 'text-slate-500'}`}>
                        <span>{service.duration_minutes} min</span>
                        <span className="font-semibold">{formatPrice(service.price)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-4 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-slate-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Barbero</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {barbers.map(barber => (
                    <button
                      key={barber.id}
                      onClick={() => setSelectedBarber(barber)}
                      className={`rounded-[24px] border p-4 text-left transition ${
                        selectedBarber?.id === barber.id
                          ? 'border-slate-950 bg-slate-950 text-white'
                          : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-base font-semibold">{barber.name}</p>
                      <p className={`mt-2 text-sm ${selectedBarber?.id === barber.id ? 'text-slate-300' : 'text-slate-500'}`}>
                        {barber.email}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Fecha</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
                    {availableDates.map(date => (
                      <button
                        key={date}
                        onClick={() => setSelectedDate(date)}
                        className={`rounded-[22px] border px-4 py-4 text-left transition ${
                          selectedDate === date
                            ? 'border-slate-950 bg-slate-950 text-white'
                            : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-xs uppercase tracking-[0.16em] opacity-70">
                          {format(new Date(`${date}T00:00:00`), 'EEE', { locale: es })}
                        </p>
                        <p className="mt-1 text-base font-semibold">
                          {format(new Date(`${date}T00:00:00`), 'd MMM', { locale: es })}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-slate-400" />
                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Horario</h2>
                  </div>
                  {loadingSlots ? (
                    <div className="flex min-h-40 items-center justify-center rounded-[24px] border border-slate-200 bg-slate-50">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {slots.filter(slot => slot.available).map(slot => (
                        <button
                          key={slot.time}
                          onClick={() => setSelectedTime(slot.time)}
                          className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
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
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">Tus datos</h2>
              <div className="mt-5 space-y-4">
                <Input
                  label="Nombre"
                  value={client.first_name}
                  onChange={event => setClient(current => ({ ...current, first_name: event.target.value }))}
                  placeholder="Tu nombre"
                />
                <Input
                  label="Apellido"
                  value={client.last_name}
                  onChange={event => setClient(current => ({ ...current, last_name: event.target.value }))}
                  placeholder="Tu apellido"
                />
                <Input
                  label="Email"
                  type="email"
                  value={client.email}
                  onChange={event => setClient(current => ({ ...current, email: event.target.value }))}
                  placeholder="nombre@email.com"
                />
                <Input
                  label="Teléfono"
                  value={client.phone}
                  onChange={event => setClient(current => ({ ...current, phone: event.target.value }))}
                  placeholder="09X XXX XXX"
                />
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Resumen</p>
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-sm text-slate-400">Servicio</p>
                  <p className="font-semibold">{selectedService?.name ?? 'Elegí un servicio'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Barbero</p>
                  <p className="font-semibold">{selectedBarber?.name ?? 'Elegí un barbero'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Fecha y hora</p>
                  <p className="font-semibold">
                    {selectedDate && selectedTime ? `${formatDate(selectedDate)} · ${selectedTime}` : 'Elegí fecha y horario'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Precio</p>
                  <p className="font-semibold">{selectedService ? formatPrice(selectedService.price) : '-'}</p>
                </div>
              </div>

              {error && (
                <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <Button
                className="mt-6 w-full bg-white text-slate-950 hover:bg-slate-100"
                onClick={submitBooking}
                loading={submitting}
                disabled={!canSubmit}
              >
                Confirmar turno
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
