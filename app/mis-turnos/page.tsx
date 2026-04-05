'use client'
import { useState } from 'react'
import { Scissors, Calendar, Clock, User, Search, X, AlertCircle, CheckCircle } from 'lucide-react'
import { Button, Input, Spinner } from '@/components/ui'
import { cn, formatDate, STATUS_CONFIG } from '@/lib/utils'
import Link from 'next/link'
import type { Appointment, Client } from '@/types'

interface AppointmentWithDetails extends Omit<Appointment, 'barber' | 'service'> {
  barber: { id: string; name: string }
  service: { id: string; name: string; price: number; duration_minutes: number }
}

interface LookupResult {
  client: Client
  appointments: AppointmentWithDetails[]
}

export default function MisTurnosPage() {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LookupResult | null>(null)
  const [error, setError] = useState('')
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null)

  const lookup = async () => {
    if (!email || !phone) return
    setLoading(true)
    setError('')
    setResult(null)
    const res = await fetch(`/api/appointments/manage?email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? 'Error buscando turnos')
      return
    }
    setResult(data)
  }

  const cancel = async (appointmentId: string) => {
    if (!result) return
    setCancelingId(appointmentId)
    setCancelError(null)
    setCancelSuccess(null)
    const res = await fetch('/api/appointments/manage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_id: appointmentId, email, phone }),
    })
    const data = await res.json()
    setCancelingId(null)
    if (!res.ok) {
      setCancelError(data.error ?? 'Error cancelando el turno')
      return
    }
    setCancelSuccess('Turno cancelado correctamente. Te enviamos un email de confirmación.')
    // Remover turno de la lista
    setResult(prev => prev ? {
      ...prev,
      appointments: prev.appointments.filter(a => a.id !== appointmentId),
    } : prev)
  }

  return (
    <div className="min-h-screen bg-black text-cream">
      <header className="border-b border-border px-4 py-5">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl text-cream">Felito Studios</h1>
            <p className="text-xs text-cream/40 mt-0.5">Gestión de turnos</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
            <Scissors className="w-3.5 h-3.5 text-gold" />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-10">
        <div className="mb-8">
          <h2 className="font-serif text-2xl text-cream mb-1">Mis turnos</h2>
          <p className="text-sm text-cream/40">Ingresá tu email y teléfono para ver y cancelar tus citas pendientes.</p>
        </div>

        <div className="card p-5 mb-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="tu@email.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); setResult(null) }}
              onKeyDown={e => e.key === 'Enter' && lookup()}
            />
          </div>
          <div>
            <label className="label">Teléfono (con el que reservaste)</label>
            <input
              type="tel"
              className="input"
              placeholder="+598 9X XXX XXX"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError(''); setResult(null) }}
              onKeyDown={e => e.key === 'Enter' && lookup()}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <Button onClick={lookup} loading={loading} className="w-full">
            <Search className="w-4 h-4" />
            Buscar mis turnos
          </Button>
        </div>

        {cancelError && (
          <div className="flex items-start gap-2.5 p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{cancelError}</p>
          </div>
        )}

        {cancelSuccess && (
          <div className="flex items-start gap-2.5 p-3 mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-400">{cancelSuccess}</p>
          </div>
        )}

        {result && (
          <div>
            <p className="text-sm text-cream/40 mb-4">
              Hola, <span className="text-cream">{result.client.first_name}</span>.{' '}
              {result.appointments.length === 0
                ? 'No tenés turnos pendientes.'
                : `Tenés ${result.appointments.length} turno${result.appointments.length > 1 ? 's' : ''} próximo${result.appointments.length > 1 ? 's' : ''}.`}
            </p>

            {result.appointments.length === 0 ? (
              <div className="card p-8 text-center">
                <Calendar className="w-8 h-8 text-cream/20 mx-auto mb-3" />
                <p className="text-cream/40 text-sm">No hay turnos pendientes</p>
                <Link href="/reservar" className="inline-flex items-center gap-2 mt-4 text-sm text-gold hover:text-gold/80 transition-colors">
                  <Scissors className="w-3.5 h-3.5" />
                  Reservar un turno nuevo
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {result.appointments.map(appt => {
                  const isUpcoming = new Date(`${appt.date}T${appt.start_time}`) > new Date()
                  const hoursUntil = (new Date(`${appt.date}T${appt.start_time}`).getTime() - Date.now()) / (1000 * 60 * 60)
                  const canCancel = hoursUntil > 2

                  return (
                    <div key={appt.id} className="card p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-medium text-cream">{appt.service?.name}</p>
                          <p className="text-xs text-cream/40 mt-0.5">con {appt.barber?.name}</p>
                        </div>
                        <span className={cn('badge text-xs', STATUS_CONFIG[appt.status]?.color)}>
                          {STATUS_CONFIG[appt.status]?.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-3 text-xs text-cream/50 mb-4">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gold/60" />
                          <span className="capitalize">{formatDate(appt.date)}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gold/60" />
                          {appt.start_time?.slice(0, 5)} – {appt.end_time?.slice(0, 5)}
                        </span>
                      </div>

                      {appt.status === 'pendiente' && (
                        canCancel ? (
                          <button
                            onClick={() => cancel(appt.id)}
                            disabled={cancelingId === appt.id}
                            className="flex items-center gap-2 text-xs text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-50"
                          >
                            {cancelingId === appt.id ? (
                              <Spinner />
                            ) : (
                              <X className="w-3.5 h-3.5" />
                            )}
                            {cancelingId === appt.id ? 'Cancelando...' : 'Cancelar este turno'}
                          </button>
                        ) : (
                          <p className="text-xs text-cream/25">
                            Para cancelar contactanos directamente — faltan menos de 2 horas.
                          </p>
                        )
                      )}
                    </div>
                  )
                })}

                <div className="pt-2 text-center">
                  <Link href="/reservar" className="text-sm text-gold/60 hover:text-gold transition-colors">
                    + Reservar otro turno
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
