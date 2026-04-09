'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addDays, format, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DollarSign,
  Plus,
  Receipt,
  UserRound,
  XCircle,
  Zap,
} from 'lucide-react'
import { Badge, Button, EmptyState, Input, Modal, PageHeader, Spinner } from '@/components/ui'
import { cn, formatDate, formatPrice, STATUS_CONFIG } from '@/lib/utils'
import { useAdmin } from '../layout'
import type { Appointment, Barber, Client, PaymentMethod, Service } from '@/types'

type ViewMode = 'day' | 'week'

const PAYMENT_METHODS: PaymentMethod[] = ['efectivo', 'mercado_pago', 'debito', 'transferencia']
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo:      'Efectivo',
  mercado_pago:  'Mercado Pago',
  debito:        'Débito',
  transferencia: 'Transferencia',
}

interface InstantForm {
  client_name:  string
  client_phone: string
  client_email: string
  service_id:   string
  barber_id:    string
  date:         string
  start_time:   string
}

export default function AgendaPage() {
  const { user, activeBranch, can } = useAdmin()
  const router = useRouter()
  const [view, setView]             = useState<ViewMode>('day')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]       = useState(true)

  // Detail / payment
  const [selected,     setSelected]     = useState<Appointment | null>(null)
  const [paymentModal, setPaymentModal] = useState(false)
  const [payMethod,    setPayMethod]    = useState<PaymentMethod>('efectivo')
  const [payAmount,    setPayAmount]    = useState('')
  const [paying,       setPaying]       = useState(false)
  const [payError,     setPayError]     = useState('')
  const [paidId,       setPaidId]       = useState<string | null>(null)

  // Quick client creation
  const [clientModal,   setClientModal]   = useState(false)
  const [clientForm,    setClientForm]    = useState({ first_name: '', phone: '', email: '' })
  const [clientSaving,  setClientSaving]  = useState(false)
  const [clientError,   setClientError]   = useState('')
  const [clientCreated, setClientCreated] = useState<Client | null>(null)

  // Instant appointment
  const [instantModal,  setInstantModal]  = useState(false)
  const [instantForm,   setInstantForm]   = useState<InstantForm | null>(null)
  const [instantSaving, setInstantSaving] = useState(false)
  const [instantError,  setInstantError]  = useState('')
  const [barbers,   setBarbers]   = useState<Barber[]>([])
  const [services,  setServices]  = useState<Service[]>([])
  const [loadingMeta, setLoadingMeta] = useState(false)

  const isBarber = user?.role === 'barber'

  const titleDate = useMemo(() => {
    if (view === 'day') return format(currentDate, "EEEE d 'de' MMMM", { locale: es })
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    const weekEnd   = addDays(weekStart, 6)
    return `${format(weekStart, 'd MMM', { locale: es })} - ${format(weekEnd, 'd MMM yyyy', { locale: es })}`
  }, [currentDate, view])

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [currentDate])

  const fetchAppointments = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const from = view === 'day'
      ? format(currentDate, 'yyyy-MM-dd')
      : format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const to = view === 'day'
      ? from
      : format(addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), 6), 'yyyy-MM-dd')

    let url = `/api/appointments?from=${from}&to=${to}`
    if (isBarber && user.barber_id) url += `&barber_id=${user.barber_id}`
    if (activeBranch) url += `&branch_id=${activeBranch.id}`

    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok) throw new Error('No se pudieron cargar los turnos')
      const data = await res.json()
      setAppointments(data.appointments ?? [])
    } catch {
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }, [activeBranch, currentDate, isBarber, router, user, view])

  useEffect(() => { void fetchAppointments() }, [fetchAppointments])

  function navigate(direction: 1 | -1) {
    setCurrentDate(d => addDays(d, view === 'day' ? direction : direction * 7))
  }

  function openPayment(appointment: Appointment) {
    setSelected(appointment)
    setPayAmount(String(appointment.service?.price ?? ''))
    setPayMethod('efectivo')
    setPayError('')
    setPaidId(null)
    setPaymentModal(true)
  }

  async function submitPayment() {
    if (!selected || !payMethod || !payAmount) return
    setPaying(true); setPayError('')
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_id: selected.id, amount: Number(payAmount), method: payMethod }),
    })
    const data = await res.json()
    setPaying(false)
    if (!res.ok) { setPayError(data.error ?? 'No se pudo registrar el cobro'); return }
    setPaidId(data.payment?.id ?? null)
    await fetchAppointments()
  }

  async function cancelAppointment(appointment: Appointment) {
    await fetch(`/api/appointments/${appointment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelada' }),
    })
    setSelected(null)
    await fetchAppointments()
  }

  function openClientModal() {
    setClientForm({ first_name: '', phone: '', email: '' })
    setClientError('')
    setClientCreated(null)
    setClientModal(true)
  }

  async function saveClient() {
    if (!clientForm.first_name.trim()) { setClientError('El nombre es obligatorio'); return }
    setClientSaving(true); setClientError('')
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientForm),
    })
    const data = await res.json()
    setClientSaving(false)
    if (!res.ok) { setClientError(data.error ?? 'No se pudo crear el cliente'); return }
    setClientCreated(data.client)
  }

  async function openInstantModal() {
    setLoadingMeta(true)
    try {
      const branchQuery = activeBranch ? `?branch_id=${activeBranch.id}` : ''
      const [barbersRes, servicesRes] = await Promise.all([
        fetch(`/api/barbers${branchQuery}`, { cache: 'no-store' }),
        fetch('/api/services', { cache: 'no-store' }),
      ])

      if (barbersRes.status === 401 || servicesRes.status === 401) {
        router.replace('/login')
        return
      }

      const [barbersData, servicesData] = await Promise.all([barbersRes.json(), servicesRes.json()])
      setBarbers(barbersRes.ok ? (barbersData.barbers ?? []) : [])
      setServices(servicesRes.ok ? (servicesData.services ?? []) : [])
    } finally {
      setLoadingMeta(false)
    }

    // Default time = current time rounded to next 15-min
    const now = new Date()
    const mins = now.getMinutes()
    const roundedMins = Math.ceil(mins / 15) * 15
    now.setMinutes(roundedMins, 0, 0)
    const defaultTime = format(now, 'HH:mm')
    const defaultDate = format(currentDate, 'yyyy-MM-dd')

    // Pre-select barber if current user is a barber
    const defaultBarberId = isBarber && user?.barber_id ? user.barber_id : ''

    setInstantForm({
      client_name:  '',
      client_phone: '',
      client_email: '',
      service_id:   '',
      barber_id:    defaultBarberId,
      date:         defaultDate,
      start_time:   defaultTime,
    })
    setInstantError('')
    setInstantModal(true)
  }

  async function saveInstantAppointment() {
    if (!instantForm) return
    if (!instantForm.client_name.trim()) { setInstantError('El nombre del cliente es obligatorio'); return }
    if (!instantForm.service_id)         { setInstantError('Seleccioná un servicio'); return }
    if (!instantForm.barber_id)          { setInstantError('Seleccioná un barbero'); return }
    if (!instantForm.date)               { setInstantError('Seleccioná una fecha'); return }
    if (!instantForm.start_time)         { setInstantError('Ingresá la hora'); return }

    setInstantSaving(true); setInstantError('')

    const payload = {
      client_name:  instantForm.client_name.trim(),
      client_phone: instantForm.client_phone.trim() || null,
      client_email: instantForm.client_email.trim() || null,
      service_id:   instantForm.service_id,
      barber_id:    instantForm.barber_id,
      branch_id:    activeBranch?.id ?? null,
      date:         instantForm.date,
      start_time:   instantForm.start_time,
    }

    const res = await fetch('/api/admin/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setInstantSaving(false)

    if (!res.ok) { setInstantError(data.error ?? 'No se pudo crear el turno'); return }

    setInstantModal(false)
    await fetchAppointments()
  }

  const groupedByDay = useMemo(() => {
    const record: Record<string, Appointment[]> = {}
    const dates = view === 'day'
      ? [format(currentDate, 'yyyy-MM-dd')]
      : weekDays.map(d => format(d, 'yyyy-MM-dd'))

    dates.forEach(date => {
      record[date] = appointments
        .filter(a => a.date === date)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
    })
    return record
  }, [appointments, currentDate, view, weekDays])

  // Barbers filtered by active branch if applicable
  const filteredBarbers = useMemo(() => {
    if (!activeBranch) return barbers
    return barbers.filter(b => !b.branches || b.branches.some((br: any) => br.id === activeBranch.id) || (b.branch_ids ?? []).includes(activeBranch.id))
  }, [barbers, activeBranch])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title={isBarber ? 'Mi agenda' : 'Agenda'}
        subtitle={activeBranch ? activeBranch.name : undefined}
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={openInstantModal} loading={loadingMeta}>
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Turno ya</span>
            </Button>
            <Button variant="outline" size="sm" onClick={openClientModal}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Cliente</span>
            </Button>
            <div className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
              {(['day', 'week'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setView(mode)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    view === mode
                      ? 'bg-slate-950 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  {mode === 'day' ? 'Día' : 'Semana'}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* Date navigation */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <p className="text-base font-semibold capitalize text-slate-950">{titleDate}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Hoy
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="Sin turnos en este período"
          description="Usá 'Turno ya' para cargar uno en el momento."
          action={
            <Button onClick={openInstantModal}>
              <Zap className="h-4 w-4" />
              Turno ya
            </Button>
          }
        />
      ) : view === 'day' ? (
        <div className="space-y-3">
          {(groupedByDay[format(currentDate, 'yyyy-MM-dd')] ?? []).map(a => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              showBarber={!isBarber}
              onOpen={() => setSelected(a)}
              onPay={can('cash.add_movement') ? () => openPayment(a) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {weekDays.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const dayAppointments = groupedByDay[dateKey] ?? []
            return (
              <div key={dateKey} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {format(day, 'EEE', { locale: es })}
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {format(day, 'd MMM', { locale: es })}
                </p>
                <div className="mt-4 space-y-3">
                  {dayAppointments.length === 0 ? (
                    <p className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">Sin turnos</p>
                  ) : (
                    dayAppointments.map(a => (
                      <AppointmentCard
                        key={a.id}
                        appointment={a}
                        compact
                        showBarber={!isBarber}
                        onOpen={() => setSelected(a)}
                        onPay={can('cash.add_movement') ? () => openPayment(a) : undefined}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Appointment detail modal */}
      <Modal open={!!selected && !paymentModal} onClose={() => setSelected(null)} title="Detalle del turno">
        {selected && (
          <div className="space-y-5">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 text-sm text-slate-600">
                <DetailRow label="Cliente"  value={`${selected.client?.first_name ?? ''} ${selected.client?.last_name ?? ''}`.trim()} />
                <DetailRow label="Servicio" value={selected.service?.name ?? '-'} />
                {!isBarber && <DetailRow label="Barbero" value={selected.barber?.name ?? '-'} />}
                <DetailRow label="Fecha"    value={formatDate(selected.date)} />
                <DetailRow label="Hora"     value={`${selected.start_time.slice(0, 5)} – ${selected.end_time.slice(0, 5)}`} />
                {selected.branch && <DetailRow label="Sucursal" value={selected.branch.name} />}
                {selected.client?.phone && <DetailRow label="Teléfono" value={selected.client.phone} />}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge className={STATUS_CONFIG[selected.status].color}>
                {STATUS_CONFIG[selected.status].label}
              </Badge>
              {selected.payment && (
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Cobrado</Badge>
              )}
            </div>

            <div className="flex gap-3">
              {!selected.payment && selected.status !== 'cancelada' && can('cash.add_movement') && (
                <Button className="flex-1" onClick={() => openPayment(selected)}>
                  <DollarSign className="h-4 w-4" />
                  Cobrar
                </Button>
              )}
              {!selected.payment && selected.status !== 'cancelada' && can('cancel_appointments') && (
                <Button variant="danger" className="flex-1" onClick={() => cancelAppointment(selected)}>
                  <XCircle className="h-4 w-4" />
                  Cancelar
                </Button>
              )}
            </div>

            {selected.payment && (
              <Link
                href={`/admin/comprobante/${selected.payment.id}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Receipt className="h-4 w-4" />
                Ver comprobante
              </Link>
            )}
          </div>
        )}
      </Modal>

      {/* Payment modal */}
      <Modal
        open={paymentModal}
        onClose={() => setPaymentModal(false)}
        title={paidId ? 'Cobro registrado' : 'Registrar cobro'}
      >
        {paidId ? (
          <div className="space-y-4 text-center">
            <p className="text-3xl font-semibold text-slate-950">{formatPrice(Number(payAmount))}</p>
            <Link href={`/admin/comprobante/${paidId}`} className="btn-gold w-full">
              <ArrowRight className="h-4 w-4" />
              Abrir comprobante
            </Link>
            <Button variant="outline" className="w-full" onClick={() => setPaymentModal(false)}>
              Cerrar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              {selected?.client?.first_name} {selected?.client?.last_name} · {selected?.service?.name}
            </div>
            <div>
              <label className="label">Monto</label>
              <input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Método</label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(method => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPayMethod(method)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      payMethod === method
                        ? 'border-slate-950 bg-slate-950 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {PAYMENT_METHOD_LABELS[method]}
                  </button>
                ))}
              </div>
            </div>
            {payError && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {payError}
              </p>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setPaymentModal(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={submitPayment} loading={paying}>
                Confirmar cobro
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Quick client modal */}
      <Modal open={clientModal} onClose={() => setClientModal(false)} title="Nuevo cliente">
        {clientCreated ? (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">¡Cliente guardado!</p>
              <p className="mt-1 text-sm text-emerald-700">
                {clientCreated.first_name} {clientCreated.last_name}
                {clientCreated.phone && ` · ${clientCreated.phone}`}
              </p>
            </div>
            <Button className="w-full" onClick={() => setClientModal(false)}>Listo</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Nombre *"
              value={clientForm.first_name}
              onChange={e => setClientForm(f => ({ ...f, first_name: e.target.value }))}
              placeholder="Juan"
              autoFocus
            />
            <Input
              label="Teléfono"
              type="tel"
              value={clientForm.phone}
              onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="091 000 000"
            />
            <Input
              label="Email"
              type="email"
              value={clientForm.email}
              onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))}
              placeholder="juan@email.com"
            />
            {clientError && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {clientError}
              </p>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setClientModal(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={saveClient} loading={clientSaving}>Guardar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Instant appointment modal */}
      <Modal
        open={instantModal}
        onClose={() => setInstantModal(false)}
        title="Turno ya"
        size="lg"
      >
        {instantForm && (
          <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
            {/* Client */}
            <div>
              <p className="label mb-3">Cliente</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Nombre *"
                  value={instantForm.client_name}
                  onChange={e => setInstantForm(f => f ? { ...f, client_name: e.target.value } : f)}
                  placeholder="Juan García"
                  autoFocus
                />
                <Input
                  label="Teléfono"
                  type="tel"
                  value={instantForm.client_phone}
                  onChange={e => setInstantForm(f => f ? { ...f, client_phone: e.target.value } : f)}
                  placeholder="091 000 000"
                />
              </div>
            </div>

            {/* Service */}
            <div>
              <label className="label">Servicio *</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {services.filter(s => s.active).map(service => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setInstantForm(f => f ? { ...f, service_id: service.id } : f)}
                    className={cn(
                      'rounded-2xl border px-4 py-3 text-left text-sm transition',
                      instantForm.service_id === service.id
                        ? 'border-slate-950 bg-slate-950 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <p className="font-semibold">{service.name}</p>
                    <p className={cn('text-xs', instantForm.service_id === service.id ? 'text-slate-300' : 'text-slate-400')}>
                      {formatPrice(service.price)} · {service.duration_minutes} min
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Barber — only show if user is not a barber themselves */}
            {!isBarber && (
              <div>
                <label className="label">Barbero *</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {filteredBarbers.map(barber => (
                    <button
                      key={barber.id}
                      type="button"
                      onClick={() => setInstantForm(f => f ? { ...f, barber_id: barber.id } : f)}
                      className={cn(
                        'rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition',
                        instantForm.barber_id === barber.id
                          ? 'border-slate-950 bg-slate-950 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      {barber.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date + Time */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Fecha *</label>
                <input
                  type="date"
                  value={instantForm.date}
                  onChange={e => setInstantForm(f => f ? { ...f, date: e.target.value } : f)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Hora *</label>
                <input
                  type="time"
                  value={instantForm.start_time}
                  onChange={e => setInstantForm(f => f ? { ...f, start_time: e.target.value } : f)}
                  className="input"
                  step="900"
                />
              </div>
            </div>

            {instantError && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {instantError}
              </p>
            )}

            <div className="flex gap-3 sticky bottom-0 bg-white pb-1 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setInstantModal(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={saveInstantAppointment} loading={instantSaving}>
                <Zap className="h-4 w-4" />
                Agendar turno
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function AppointmentCard({
  appointment,
  showBarber,
  onOpen,
  onPay,
  compact,
}: {
  appointment: Appointment
  showBarber: boolean
  onOpen: () => void
  onPay?: () => void
  compact?: boolean
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-slate-950">
              {appointment.client?.first_name} {appointment.client?.last_name}
            </p>
            <Badge className={STATUS_CONFIG[appointment.status].color}>
              {STATUS_CONFIG[appointment.status].label}
            </Badge>
            {appointment.payment && (
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Cobrado</Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4" />
              {appointment.start_time.slice(0, 5)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {appointment.service?.name}
            </span>
            {showBarber && (
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4" />
                {appointment.barber?.name}
              </span>
            )}
          </div>
        </div>

        {!compact && !appointment.payment && onPay && appointment.status !== 'cancelada' && (
          <Button size="sm" onClick={onPay}>
            <DollarSign className="h-4 w-4" />
            Cobrar
          </Button>
        )}
      </div>

      <button
        onClick={onOpen}
        className="mt-4 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
      >
        Ver detalle →
      </button>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="font-medium text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-700">{value}</span>
    </div>
  )
}
