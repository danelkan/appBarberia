'use client'

import { useState } from 'react'
import { Calendar, Clock, Search, X, AlertCircle, CheckCircle, MapPin, ArrowLeft, Scissors } from 'lucide-react'
import { Button, Input, Spinner } from '@/components/ui'
import { cn, formatDate, STATUS_CONFIG } from '@/lib/utils'
import { BrandLogo } from '@/components/brand-logo'
import Link from 'next/link'
import type { Appointment, Client } from '@/types'

interface AppointmentWithDetails extends Omit<Appointment, 'barber' | 'service' | 'branch'> {
  barber: { id: string; name: string }
  service: { id: string; name: string; price: number; duration_minutes: number }
  branch?: { name: string }
}

interface LookupResult {
  client: Client
  appointments: AppointmentWithDetails[]
}

interface MisTurnosClientProps {
  branchId: string | null
  company: string | null
}

export default function MisTurnosClient({ branchId, company }: MisTurnosClientProps) {
  const [email, setEmail]         = useState('')
  const [phone, setPhone]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<LookupResult | null>(null)
  const [error, setError]         = useState('')
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null)
  const homeHref = company ? `/?company=${encodeURIComponent(company)}` : '/'

  const lookup = async () => {
    if (!email || !phone) return
    setLoading(true)
    setError('')
    setResult(null)
    const params = new URLSearchParams({ email, phone })
    if (branchId) params.set('branch_id', branchId)
    if (company) params.set('company', company)
    const res  = await fetch(`/api/appointments/manage?${params.toString()}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'No encontramos turnos con esos datos'); return }
    setResult(data)
  }

  const cancel = async (appointmentId: string) => {
    if (!result) return
    setCancelingId(appointmentId)
    setCancelError(null)
    setCancelSuccess(null)
    const res  = await fetch('/api/appointments/manage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointment_id: appointmentId,
        email,
        phone,
        branch_id: branchId ?? undefined,
        company: company ?? undefined,
      }),
    })
    const data = await res.json()
    setCancelingId(null)
    if (!res.ok) { setCancelError(data.error ?? 'Error cancelando el turno'); return }
    setCancelSuccess('Turno cancelado. Te enviamos un email de confirmación.')
    setResult(prev => prev ? {
      ...prev,
      appointments: prev.appointments.filter(a => a.id !== appointmentId),
    } : prev)
  }

  return (
    <div className="admin-theme min-h-screen bg-page">
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size={32} className="rounded-xl" />
            <div>
              <p className="text-sm font-semibold text-cream leading-none">Felito Barber Studio</p>
              <p className="text-[10px] text-cream/40 mt-0.5 font-medium">Mis turnos</p>
            </div>
          </div>
          <Link
            href={homeHref}
            className="flex items-center gap-1.5 text-xs font-medium text-cream/50 hover:text-cream transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Reservar
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="card p-6 mb-6 shadow-card">
          <h1 className="font-serif text-2xl text-cream mb-1">Mis turnos</h1>
          <p className="text-sm text-cream/50 mb-5">
            Ingresá el email y teléfono con los que reservaste.
          </p>

          <div className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); setResult(null) }}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && lookup()}
              placeholder="tu@email.com"
            />
            <Input
              label="Teléfono"
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError(''); setResult(null) }}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && lookup()}
              placeholder="+598 9X XXX XXX"
            />

            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            <Button onClick={lookup} loading={loading} className="w-full" disabled={!email || !phone}>
              <Search className="w-4 h-4" />
              Buscar mis turnos
            </Button>
          </div>
        </div>

        {cancelError && (
          <div className="flex items-start gap-2.5 p-3.5 mb-4 rounded-xl bg-red-50 border border-red-200 animate-fade-up">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 font-medium">{cancelError}</p>
          </div>
        )}
        {cancelSuccess && (
          <div className="flex items-start gap-2.5 p-3.5 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 animate-fade-up">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-700 font-medium">{cancelSuccess}</p>
          </div>
        )}

        {result && (
          <div className="animate-fade-up">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-cream/50 font-medium">
                Hola, <span className="text-cream font-semibold">{result.client.first_name}</span>.
              </p>
              <p className="text-xs text-cream/35">
                {result.appointments.length === 0
                  ? 'Sin turnos próximos'
                  : `${result.appointments.length} turno${result.appointments.length !== 1 ? 's' : ''} próximo${result.appointments.length !== 1 ? 's' : ''}`}
              </p>
            </div>

            {result.appointments.length === 0 ? (
              <div className="card p-10 text-center shadow-card">
                <Calendar className="w-10 h-10 text-cream/15 mx-auto mb-3" />
                <p className="text-cream/50 text-sm font-medium mb-4">No tenés turnos próximos</p>
                <Link
                  href={homeHref}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-black text-sm font-semibold rounded-xl hover:bg-gold-dark transition-colors"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  Reservar un turno
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {result.appointments.map(appt => {
                  const hoursUntil = (new Date(`${appt.date}T${appt.start_time}`).getTime() - Date.now()) / (1000 * 60 * 60)
                  const canCancel  = hoursUntil > 2
                  const cfg = STATUS_CONFIG[appt.status]

                  return (
                    <div key={appt.id} className="card p-5 shadow-card">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <p className="font-semibold text-cream">{appt.service?.name}</p>
                          <p className="text-xs text-cream/45 mt-0.5 font-medium">con {appt.barber?.name}</p>
                        </div>
                        <span className={cn('badge text-xs flex-shrink-0', cfg?.color)}>
                          {cfg?.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-3 text-xs text-cream/55 mb-4">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-gold/70 flex-shrink-0" />
                          <span className="capitalize">{formatDate(appt.date)}</span>
                        </span>
                        <span className="flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5 text-gold/70 flex-shrink-0" />
                          {appt.start_time?.slice(0, 5)} – {appt.end_time?.slice(0, 5)}
                        </span>
                        {appt.branch && (
                          <span className="flex items-center gap-1.5 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-gold/70 flex-shrink-0" />
                            {appt.branch.name}
                          </span>
                        )}
                      </div>

                      {appt.status === 'pendiente' && (
                        canCancel ? (
                          <button
                            onClick={() => cancel(appt.id)}
                            disabled={cancelingId === appt.id}
                            className="flex items-center gap-2 text-xs text-red-500 hover:text-red-600 transition-colors disabled:opacity-50 font-semibold"
                          >
                            {cancelingId === appt.id
                              ? <><Spinner className="w-3.5 h-3.5" /> Cancelando...</>
                              : <><X className="w-3.5 h-3.5" /> Cancelar este turno</>
                            }
                          </button>
                        ) : (
                          <p className="text-xs text-cream/30 font-medium">
                            Faltan menos de 2 horas — contactanos directamente para cancelar.
                          </p>
                        )
                      )}
                    </div>
                  )
                })}

                <div className="pt-1 text-center">
                  <Link href={homeHref} className="text-sm text-gold-dark hover:text-gold transition-colors font-semibold">
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
