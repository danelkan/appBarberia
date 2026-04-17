'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addDays, format, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Filter,
  MessageCircle,
  Plus,
  Receipt,
  XCircle,
  Zap,
} from 'lucide-react'
import { Badge, Button, Input, Modal, PageHeader, Spinner } from '@/components/ui'
import { cn, formatDate, formatPrice, STATUS_CONFIG } from '@/lib/utils'
import { useAdmin } from '../layout'
import { PAYMENT_METHOD_LABELS, type Appointment, type Barber, type Client, type PaymentMethod, type Service } from '@/types'

type ViewMode = 'day' | 'week'

/**
 * Normalizes a Uruguayan phone number to the international format required by WhatsApp
 * (country code without + followed by the subscriber number, no spaces).
 * Examples: "091 234 567" → "59891234567", "094567890" → "59894567890"
 * Returns null if the number cannot be reasonably normalized.
 */
function buildWhatsAppUrl(rawPhone: string | null | undefined, message: string): string | null {
  if (!rawPhone) return null
  const digits = rawPhone.replace(/\D/g, '')
  if (digits.length < 8) return null

  let international: string
  if (digits.startsWith('598')) {
    international = digits
  } else if (digits.startsWith('0')) {
    // Local format 09X... → strip leading 0, prepend 598
    international = '598' + digits.slice(1)
  } else if (digits.length === 8) {
    // 8-digit number without prefix → assume Uruguay mobile (add 598)
    international = '598' + digits
  } else {
    // Already looks like an international number or unknown format
    international = digits
  }

  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`
}

const PAYMENT_METHODS: PaymentMethod[] = ['efectivo', 'mercado_pago', 'debito', 'transferencia']
const HOUR_HEIGHT = 72
const MOBILE_HOUR_HEIGHT = 104
const DEFAULT_START_MINUTES = 8 * 60
const DEFAULT_END_MINUTES = 21 * 60
const MIN_EVENT_HEIGHT = 42
const MOBILE_MIN_EVENT_HEIGHT = 72

interface CalendarResource {
  id: string
  name: string
}

interface InstantForm {
  client_name:  string
  client_phone: string
  client_email: string
  service_id:   string
  barber_id:    string
  branch_id:    string
  date:         string
  start_time:   string
}

function toMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return (hours * 60) + minutes
}

function fromMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function getCalendarBounds(appointments: Appointment[]) {
  const starts = appointments.map(appointment => toMinutes(appointment.start_time))
  const ends = appointments.map(appointment => toMinutes(appointment.end_time))
  const minStart = starts.length > 0 ? Math.min(...starts) : DEFAULT_START_MINUTES
  const maxEnd = ends.length > 0 ? Math.max(...ends) : DEFAULT_END_MINUTES

  return {
    start: Math.min(DEFAULT_START_MINUTES, Math.floor(minStart / 60) * 60),
    end: Math.max(DEFAULT_END_MINUTES, Math.ceil(maxEnd / 60) * 60),
  }
}

function getEventStyle(appointment: Appointment, bounds: { start: number; end: number }) {
  const start = Math.max(toMinutes(appointment.start_time), bounds.start)
  const end = Math.min(toMinutes(appointment.end_time), bounds.end)
  const top = ((start - bounds.start) / 60) * HOUR_HEIGHT
  const height = Math.max(((end - start) / 60) * HOUR_HEIGHT - 6, MIN_EVENT_HEIGHT)
  return { top, height }
}

function getMobileTimelineBounds(appointments: Appointment[]) {
  if (appointments.length === 0) {
    return { start: 8 * 60, end: 21 * 60 }
  }

  const starts = appointments.map(appointment => toMinutes(appointment.start_time))
  const ends = appointments.map(appointment => toMinutes(appointment.end_time))
  const earliest = Math.min(...starts)
  const latest = Math.max(...ends)
  const start = Math.min(DEFAULT_START_MINUTES, Math.max(0, Math.floor(Math.max(0, earliest - 30) / 60) * 60))
  const end = Math.max(DEFAULT_END_MINUTES, Math.min(24 * 60, Math.max(Math.ceil((latest + 30) / 60) * 60, start + (3 * 60))))

  return { start, end }
}

function getMobileEventStyle(appointment: Appointment, bounds: { start: number; end: number }) {
  const start = Math.max(toMinutes(appointment.start_time), bounds.start)
  const end = Math.min(toMinutes(appointment.end_time), bounds.end)
  const top = ((start - bounds.start) / 60) * MOBILE_HOUR_HEIGHT
  const height = Math.max(((end - start) / 60) * MOBILE_HOUR_HEIGHT - 8, MOBILE_MIN_EVENT_HEIGHT)
  return { top, height }
}

function getMobileEventLayouts(appointments: Appointment[], bounds: { start: number; end: number }) {
  const sorted = [...appointments].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const laneEnds: number[] = []
  const positioned = sorted.map(appointment => {
    const start = toMinutes(appointment.start_time)
    const end = toMinutes(appointment.end_time)
    let lane = laneEnds.findIndex(laneEnd => laneEnd <= start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = end
    return { appointment, start, end, lane, lanes: 1, ...getMobileEventStyle(appointment, bounds) }
  })

  return positioned.map(item => {
    const lanes = Math.max(
      1,
      ...positioned
        .filter(other => item.start < other.end && other.start < item.end)
        .map(other => other.lane + 1)
    )
    return { ...item, lanes }
  })
}

export default function AgendaPage() {
  const { user, activeBranch, branches, can } = useAdmin()
  const router = useRouter()
  const [view, setView]             = useState<ViewMode>('day')
  const [currentDate, setCurrentDate] = useState(() => {
    const dateParam = typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('date')
    return dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? new Date(`${dateParam}T00:00:00`)
      : new Date()
  })
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
  const [clientForm,    setClientForm]    = useState({ first_name: '', phone: '', email: '', birthday: '' })
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
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)

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
      setAppointments((data.appointments ?? []).filter((appointment: Appointment) => appointment.status !== 'cancelada'))
    } catch {
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }, [activeBranch, currentDate, isBarber, router, user, view])

  useEffect(() => { void fetchAppointments() }, [fetchAppointments])

  const fetchMeta = useCallback(async (showButtonLoading = false, includeServices = false) => {
    if (showButtonLoading) setLoadingMeta(true)
    try {
      const branchQuery = activeBranch ? `?branch_id=${activeBranch.id}` : ''
      const [barbersRes, servicesRes] = await Promise.all([
        fetch(`/api/barbers${branchQuery}`, { cache: 'no-store' }),
        includeServices ? fetch(`/api/services${branchQuery}`, { cache: 'no-store' }) : Promise.resolve(null),
      ])

      if (barbersRes.status === 401 || servicesRes?.status === 401) {
        router.replace('/login')
        return
      }

      const [barbersData, servicesData] = await Promise.all([
        barbersRes.json(),
        servicesRes ? servicesRes.json() : Promise.resolve(null),
      ])
      setBarbers(barbersRes.ok ? (barbersData.barbers ?? []) : [])
      if (servicesRes) {
        setServices(servicesRes.ok ? (servicesData.services ?? []) : [])
      }
    } finally {
      if (showButtonLoading) setLoadingMeta(false)
    }
  }, [activeBranch, router])

  useEffect(() => { void fetchMeta(false) }, [fetchMeta])

  function navigate(direction: 1 | -1) {
    setCurrentDate(d => addDays(d, view === 'day' ? direction : direction * 7))
  }

  function handleAgendaTouchEnd(point: { x: number; y: number }) {
    if (!touchStart) return
    const delta = point.x - touchStart.x
    const verticalDelta = point.y - touchStart.y
    setTouchStart(null)
    if (Math.abs(delta) < 72 || Math.abs(delta) < Math.abs(verticalDelta) * 1.6) return
    navigate(delta < 0 ? 1 : -1)
  }

  function openPayment(appointment: Appointment) {
    setSelected(appointment)
    setPayAmount(String(appointment.service_price ?? appointment.service?.price ?? ''))
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
    setAppointments(prev => prev.filter(item => item.id !== appointment.id))
    setSelected(null)
    const res = await fetch(`/api/appointments/${appointment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelada' }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setPayError(data.error ?? 'No se pudo cancelar el turno')
      await fetchAppointments()
      return
    }
    setPayError('')
    await fetchAppointments()
  }

  function openClientModal() {
    setClientForm({ first_name: '', phone: '', email: '', birthday: '' })
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
      body: JSON.stringify({
        ...clientForm,
        birthday: clientForm.birthday || null,
      }),
    })
    const data = await res.json()
    setClientSaving(false)
    if (!res.ok) { setClientError(data.error ?? 'No se pudo crear el cliente'); return }
    setClientCreated(data.client)
  }

  async function openInstantModal() {
    await fetchMeta(true, true)

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
      branch_id:    activeBranch?.id ?? branches[0]?.id ?? '',
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
    if (!instantForm.branch_id && !activeBranch?.id) { setInstantError('Seleccioná una sucursal'); return }
    if (!instantForm.date)               { setInstantError('Seleccioná una fecha'); return }
    if (!instantForm.start_time)         { setInstantError('Ingresá la hora'); return }

    setInstantSaving(true); setInstantError('')

    const payload = {
      client_name:  instantForm.client_name.trim(),
      client_phone: instantForm.client_phone.trim() || null,
      client_email: instantForm.client_email.trim() || null,
      service_id:   instantForm.service_id,
      barber_id:    instantForm.barber_id,
      branch_id:    instantForm.branch_id || activeBranch?.id || null,
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
        .filter(a => a.date === date && a.status !== 'cancelada')
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
    })
    return record
  }, [appointments, currentDate, view, weekDays])

  // Barbers filtered by active branch if applicable
  const filteredBarbers = useMemo(() => {
    if (!activeBranch) return barbers
    return barbers.filter(b => !b.branches || b.branches.some((br: any) => br.id === activeBranch.id) || (b.branch_ids ?? []).includes(activeBranch.id))
  }, [barbers, activeBranch])

  const modalBarbers = useMemo(() => {
    const branchId = instantForm?.branch_id || activeBranch?.id
    if (!branchId) return filteredBarbers
    return barbers.filter(b => !b.branches || b.branches.some((br: any) => br.id === branchId) || (b.branch_ids ?? []).includes(branchId))
  }, [activeBranch?.id, barbers, filteredBarbers, instantForm?.branch_id])

  const getServicePriceForInstantBranch = useCallback((service: Service) => {
    const branchId = instantForm?.branch_id || activeBranch?.id
    const branchPrice = branchId
      ? service.branch_prices?.find(price => price.branch_id === branchId)
      : undefined
    return Number(branchPrice?.price ?? service.price)
  }, [activeBranch?.id, instantForm?.branch_id])

  const calendarResources = useMemo<CalendarResource[]>(() => {
    if (isBarber) {
      return [{
        id: user?.barber_id ?? 'mine',
        name: user?.name ?? 'Mi agenda',
      }]
    }

    const resources = new Map<string, string>()
    filteredBarbers.forEach(barber => resources.set(barber.id, barber.name))
    appointments.forEach(appointment => {
      if (appointment.barber_id) {
        resources.set(appointment.barber_id, appointment.barber?.name ?? 'Barbero')
      }
    })

    return Array.from(resources.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [appointments, filteredBarbers, isBarber, user?.barber_id, user?.name])

  const calendarBounds = useMemo(() => getCalendarBounds(appointments), [appointments])
  const calendarHours = useMemo(() => {
    const count = Math.ceil((calendarBounds.end - calendarBounds.start) / 60) + 1
    return Array.from({ length: count }, (_, index) => calendarBounds.start + (index * 60))
  }, [calendarBounds])

  return (
    <div className="mx-auto max-w-7xl px-0 py-0 md:px-4 md:py-6 lg:px-8">
      <div className="hidden md:block">
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
      </div>

      {/* Date navigation */}
      <div className="mb-6 hidden flex-wrap items-center justify-between gap-3 rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex">
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
      ) : view === 'day' ? (
        <CalendarShell
          empty={appointments.length === 0}
          onCreate={openInstantModal}
        >
          <MobileAgenda
            currentDate={currentDate}
            weekDays={weekDays}
            view={view}
            groupedByDay={groupedByDay}
            showBarber={!isBarber}
            onOpen={setSelected}
            onCreate={openInstantModal}
            onToggleView={() => setView(current => current === 'day' ? 'week' : 'day')}
            onSelectDate={setCurrentDate}
            onTouchStart={setTouchStart}
            onTouchEnd={handleAgendaTouchEnd}
          />
          <DayCalendar
            date={format(currentDate, 'yyyy-MM-dd')}
            appointments={groupedByDay[format(currentDate, 'yyyy-MM-dd')] ?? []}
            resources={calendarResources}
            hours={calendarHours}
            bounds={calendarBounds}
            showBarber={!isBarber}
            onOpen={setSelected}
            onPay={can('cash.add_movement') ? openPayment : undefined}
          />
        </CalendarShell>
      ) : (
        <CalendarShell
          empty={appointments.length === 0}
          onCreate={openInstantModal}
        >
          <MobileAgenda
            currentDate={currentDate}
            weekDays={weekDays}
            view={view}
            groupedByDay={groupedByDay}
            showBarber={!isBarber}
            onOpen={setSelected}
            onCreate={openInstantModal}
            onToggleView={() => setView(current => current === 'day' ? 'week' : 'day')}
            onSelectDate={setCurrentDate}
            onTouchStart={setTouchStart}
            onTouchEnd={handleAgendaTouchEnd}
          />
          <WeekCalendar
            days={weekDays}
            groupedByDay={groupedByDay}
            hours={calendarHours}
            bounds={calendarBounds}
            showBarber={!isBarber}
            onOpen={setSelected}
            onPay={can('cash.add_movement') ? openPayment : undefined}
          />
        </CalendarShell>
      )}

      {/* Appointment detail modal */}
      <Modal open={!!selected && !paymentModal} onClose={() => setSelected(null)} title="Detalle del turno">
        {selected && (() => {
          const clientName = `${selected.client?.first_name ?? ''} ${selected.client?.last_name ?? ''}`.trim()
          const waMessage = [
            `Hola ${selected.client?.first_name ?? 'cliente'}! ✂️`,
            `Te confirmamos tu turno en Felito Barber Studio:`,
            `📅 ${formatDate(selected.date)}`,
            `⏰ ${selected.start_time.slice(0, 5)} – ${selected.end_time.slice(0, 5)}`,
            `💈 ${selected.service?.name ?? ''}`,
            !isBarber && selected.barber?.name ? `Barbero: ${selected.barber.name}` : null,
            selected.branch?.name ? `📍 ${selected.branch.name}` : null,
            `¡Te esperamos!`,
          ].filter(Boolean).join('\n')
          const waUrl = buildWhatsAppUrl(selected.client?.phone, waMessage)

          return (
            <div className="space-y-5">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 text-sm text-slate-600">
                  <DetailRow label="Cliente"  value={clientName || '-'} />
                  <DetailRow label="Servicio" value={selected.service?.name ?? '-'} />
                  <DetailRow label="Precio" value={formatPrice(Number(selected.service_price ?? selected.service?.price ?? 0))} />
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

              {payError && !paymentModal && (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{payError}</p>
              )}

              {/* WhatsApp confirmation */}
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 active:scale-[0.99]"
                >
                  <MessageCircle className="h-4 w-4" />
                  Confirmar por WhatsApp
                </a>
              )}

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
          )
        })()}
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
              <label className="label">Monto según sucursal</label>
              <input
                type="number"
                value={payAmount}
                readOnly
                className="input bg-slate-50"
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
            <Input
              label="Cumpleaños (opcional)"
              type="date"
              value={clientForm.birthday}
              onChange={e => setClientForm(f => ({ ...f, birthday: e.target.value }))}
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

            {!activeBranch && branches.length > 1 && (
              <div>
                <label className="label">Sucursal *</label>
                <select
                  value={instantForm.branch_id}
                  onChange={e => setInstantForm(f => f ? { ...f, branch_id: e.target.value, barber_id: '' } : f)}
                  className="input"
                >
                  <option value="">Seleccioná sucursal</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>
            )}

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
                      {formatPrice(getServicePriceForInstantBranch(service))} · {service.duration_minutes} min
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
                  {modalBarbers.map(barber => (
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

function CalendarShell({
  children,
  empty,
  onCreate,
}: {
  children: ReactNode
  empty: boolean
  onCreate: () => void
}) {
  return (
    <div className="space-y-4">
      {empty && (
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-stone-300 bg-white/70 px-4 py-4 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between">
          <span>No hay turnos operativos en este período.</span>
          <Button size="sm" onClick={onCreate}>
            <Zap className="h-4 w-4" />
            Turno ya
          </Button>
        </div>
      )}
      {children}
    </div>
  )
}

function CalendarTimeColumn({
  hours,
  bounds,
}: {
  hours: number[]
  bounds: { start: number; end: number }
}) {
  const height = ((bounds.end - bounds.start) / 60) * HOUR_HEIGHT

  return (
    <div className="relative border-r border-stone-200 bg-stone-50" style={{ height }}>
      {hours.map(hour => {
        const top = ((hour - bounds.start) / 60) * HOUR_HEIGHT
        return (
          <div key={hour} className="absolute left-0 right-0 -translate-y-2 px-3 text-right text-[11px] font-semibold text-stone-400" style={{ top }}>
            {fromMinutes(hour)}
          </div>
        )
      })}
    </div>
  )
}

function CalendarLines({
  hours,
  bounds,
}: {
  hours: number[]
  bounds: { start: number; end: number }
}) {
  return (
    <>
      {hours.map(hour => {
        const top = ((hour - bounds.start) / 60) * HOUR_HEIGHT
        return <div key={hour} className="absolute left-0 right-0 border-t border-stone-100" style={{ top }} />
      })}
    </>
  )
}

function MobileAgenda({
  currentDate,
  weekDays,
  view,
  groupedByDay,
  showBarber,
  onOpen,
  onCreate,
  onToggleView,
  onSelectDate,
  onTouchStart,
  onTouchEnd,
}: {
  currentDate: Date
  weekDays: Date[]
  view: ViewMode
  groupedByDay: Record<string, Appointment[]>
  showBarber: boolean
  onOpen: (appointment: Appointment) => void
  onCreate: () => void
  onToggleView: () => void
  onSelectDate: (date: Date) => void
  onTouchStart: (point: { x: number; y: number }) => void
  onTouchEnd: (point: { x: number; y: number }) => void
}) {
  const dateKey = format(currentDate, 'yyyy-MM-dd')
  const dayAppointments = groupedByDay[dateKey] ?? []
  const bounds = getMobileTimelineBounds(dayAppointments)
  const timelineHeight = ((bounds.end - bounds.start) / 60) * MOBILE_HOUR_HEIGHT
  const hours = Array.from(
    { length: Math.floor((bounds.end - bounds.start) / 60) + 1 },
    (_, index) => bounds.start + (index * 60)
  )
  const eventLayouts = getMobileEventLayouts(dayAppointments, bounds)
  const monthLabel = format(currentDate, "d MMM yyyy", { locale: es })

  return (
    <div className="relative min-h-[calc(100dvh-64px)] bg-white pb-[calc(env(safe-area-inset-bottom,0px)+116px)] md:hidden" style={{ touchAction: 'pan-y' }}>
      <div
        className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 px-5 pb-4 pt-5 backdrop-blur"
        onTouchStart={event => {
          const touch = event.touches[0]
          if (touch) onTouchStart({ x: touch.clientX, y: touch.clientY })
        }}
        onTouchEnd={event => {
          const touch = event.changedTouches[0]
          if (touch) onTouchEnd({ x: touch.clientX, y: touch.clientY })
        }}
        style={{ touchAction: 'pan-y' }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <CalendarDays className="h-6 w-6 shrink-0 text-stone-950" />
            <p className="truncate text-[1.35rem] font-semibold leading-none text-stone-950">
              {monthLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectDate(new Date())}
              className="rounded-2xl p-2 text-stone-950 transition active:bg-stone-100"
              aria-label="Ir a hoy"
            >
              <CalendarDays className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={onToggleView}
              className="rounded-2xl p-2 text-stone-950 transition active:bg-stone-100"
              aria-label={view === 'week' ? 'Cambiar a vista diaria' : 'Cambiar a vista semanal'}
            >
              <Filter className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-7 gap-1">
          {weekDays.map(day => {
            const key = format(day, 'yyyy-MM-dd')
            const active = key === dateKey
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDate(day)}
                className="flex min-w-0 flex-col items-center gap-3 py-1 text-center transition active:scale-[0.98]"
              >
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-stone-400">
                  {format(day, 'EEE', { locale: es }).replace('.', '')}
                </span>
                <span
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold tabular-nums transition',
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-stone-950'
                  )}
                >
                  {format(day, 'd', { locale: es })}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex justify-center">
          <ChevronRight className="h-7 w-7 rotate-90 text-stone-950" />
        </div>
      </div>

      <div className="bg-white">
        {dayAppointments.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-stone-500">
            Sin turnos para este día.
          </div>
        ) : (
          <div className="px-3 pb-7 pt-6">
            <div className="relative" style={{ height: timelineHeight }}>
              {hours.map(hour => {
                const top = ((hour - bounds.start) / 60) * MOBILE_HOUR_HEIGHT
                return (
                  <div key={hour} className="absolute left-0 right-0" style={{ top }}>
                    <p className="-translate-y-2 pr-3 text-right text-xl font-medium tabular-nums text-stone-400" style={{ width: 78 }}>
                      {fromMinutes(hour)}
                    </p>
                    <div className="absolute left-[82px] right-0 top-0 border-t border-stone-200" />
                    <div className="absolute left-[82px] right-0 top-[calc(50%+52px)] border-t border-stone-200/80" />
                  </div>
                )
              })}
              <div className="absolute inset-y-0 left-[82px] right-0">
                {eventLayouts.map(layout => (
                  <MobileTimelineEvent
                    key={layout.appointment.id}
                    appointment={layout.appointment}
                    showBarber={showBarber}
                    onOpen={onOpen}
                    top={layout.top}
                    height={layout.height}
                    lane={layout.lane}
                    lanes={layout.lanes}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+28px)] right-6 z-30 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-[0_14px_34px_rgba(37,99,235,0.38)] transition active:scale-95"
        aria-label="Crear turno"
      >
        <Plus className="h-9 w-9" />
      </button>
    </div>
  )
}

function MobileTimelineEvent({
  appointment,
  showBarber,
  onOpen,
  top,
  height,
  lane,
  lanes,
}: {
  appointment: Appointment
  showBarber: boolean
  onOpen: (appointment: Appointment) => void
  top: number
  height: number
  lane: number
  lanes: number
}) {
  const clientName = `${appointment.client?.first_name ?? ''} ${appointment.client?.last_name ?? ''}`.trim() || 'Cliente'
  const price = Number(appointment.service_price ?? appointment.service?.price ?? 0)
  const laneWidth = 100 / lanes
  const left = `calc(${lane * laneWidth}% + ${lane > 0 ? 3 : 0}px)`
  const width = `calc(${laneWidth}% - ${lanes > 1 ? 6 : 0}px)`

  return (
    <button
      type="button"
      onClick={() => onOpen(appointment)}
      className="absolute overflow-hidden rounded-[18px] border border-[#b9dc56] bg-[#d9f57d] pl-5 pr-3 text-left shadow-sm transition active:scale-[0.99]"
      style={{ top, height, left, width }}
      aria-label={`${clientName}, ${appointment.start_time.slice(0, 5)} a ${appointment.end_time.slice(0, 5)}`}
    >
      <span className="absolute inset-y-0 left-0 w-1.5 bg-[#8bc80e]" />
      <div className="flex h-full min-w-0 gap-3 py-3">
        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#bee735]">
          <span className="relative h-4 w-5 rounded-sm bg-stone-950">
            <span className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-t-full border-2 border-stone-950 border-b-0" />
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="min-w-0 truncate text-[17px] font-bold leading-tight text-stone-950">{clientName}</p>
          <p className="mt-2 truncate text-base font-medium tabular-nums leading-tight text-stone-950">
            {appointment.start_time.slice(0, 5)} - {appointment.end_time.slice(0, 5)}
          </p>
          <p className="mt-1 truncate text-[15px] font-medium leading-tight text-stone-950">
            {showBarber && appointment.barber?.name ? `${appointment.barber.name}: ` : ''}
            {appointment.service?.name ?? 'Servicio'}
          </p>
          <p className="mt-auto truncate pt-2 text-[12px] font-semibold text-stone-700">
            {appointment.branch?.name ?? formatPrice(price)}
          </p>
        </div>
      </div>
    </button>
  )
}

function DayCalendar({
  appointments,
  resources,
  hours,
  bounds,
  showBarber,
  onOpen,
}: {
  date: string
  appointments: Appointment[]
  resources: CalendarResource[]
  hours: number[]
  bounds: { start: number; end: number }
  showBarber: boolean
  onOpen: (appointment: Appointment) => void
  onPay?: (appointment: Appointment) => void
}) {
  const safeResources = resources.length > 0 ? resources : [{ id: 'agenda', name: 'Agenda' }]
  const height = ((bounds.end - bounds.start) / 60) * HOUR_HEIGHT
  const gridTemplateColumns = `72px repeat(${safeResources.length}, minmax(190px, 1fr))`

  return (
    <div className="hidden overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-sm md:block">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]" style={{ width: safeResources.length > 3 ? `${72 + safeResources.length * 220}px` : undefined }}>
          <div className="grid border-b border-stone-200 bg-stone-50" style={{ gridTemplateColumns }}>
            <div className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">Hora</div>
            {safeResources.map(resource => (
              <div key={resource.id} className="border-l border-stone-200 px-4 py-3">
                <p className="truncate text-sm font-semibold text-stone-950">{resource.name}</p>
              </div>
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns }}>
            <CalendarTimeColumn hours={hours} bounds={bounds} />
            {safeResources.map(resource => {
              const columnAppointments = appointments.filter(appointment => {
                if (resource.id === 'agenda') return true
                return appointment.barber_id === resource.id
              })

              return (
                <div key={resource.id} className="relative border-l border-stone-100" style={{ height }}>
                  <CalendarLines hours={hours} bounds={bounds} />
                  {columnAppointments.map(appointment => (
                    <CalendarEvent
                      key={appointment.id}
                      appointment={appointment}
                      bounds={bounds}
                      showBarber={showBarber}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function WeekCalendar({
  days,
  groupedByDay,
  hours,
  bounds,
  showBarber,
  onOpen,
}: {
  days: Date[]
  groupedByDay: Record<string, Appointment[]>
  hours: number[]
  bounds: { start: number; end: number }
  showBarber: boolean
  onOpen: (appointment: Appointment) => void
  onPay?: (appointment: Appointment) => void
}) {
  const height = ((bounds.end - bounds.start) / 60) * HOUR_HEIGHT
  const gridTemplateColumns = '72px repeat(7, minmax(150px, 1fr))'

  return (
    <div className="hidden overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-sm md:block">
      <div className="overflow-x-auto">
        <div className="min-w-[1120px]">
          <div className="grid border-b border-stone-200 bg-stone-50" style={{ gridTemplateColumns }}>
            <div className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">Hora</div>
            {days.map(day => (
              <div key={day.toISOString()} className="border-l border-stone-200 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                  {format(day, 'EEE', { locale: es })}
                </p>
                <p className="mt-1 text-sm font-semibold text-stone-950">{format(day, 'd MMM', { locale: es })}</p>
              </div>
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns }}>
            <CalendarTimeColumn hours={hours} bounds={bounds} />
            {days.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd')
              const dayAppointments = groupedByDay[dateKey] ?? []
              return (
                <div key={dateKey} className="relative border-l border-stone-100" style={{ height }}>
                  <CalendarLines hours={hours} bounds={bounds} />
                  {dayAppointments.map(appointment => (
                    <CalendarEvent
                      key={appointment.id}
                      appointment={appointment}
                      bounds={bounds}
                      showBarber={showBarber}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function CalendarEvent({
  appointment,
  bounds,
  showBarber,
  onOpen,
}: {
  appointment: Appointment
  bounds: { start: number; end: number }
  showBarber: boolean
  onOpen: (appointment: Appointment) => void
}) {
  const { top, height } = getEventStyle(appointment, bounds)
  const clientName = `${appointment.client?.first_name ?? ''} ${appointment.client?.last_name ?? ''}`.trim() || 'Cliente'

  return (
    <button
      type="button"
      onClick={() => onOpen(appointment)}
      className="absolute left-2 right-2 overflow-hidden rounded-xl border border-lime-200 bg-lime-50 px-3 py-2 text-left shadow-sm transition hover:border-lime-300 hover:bg-lime-100 focus:outline-none focus:ring-2 focus:ring-stone-950/20"
      style={{ top, height }}
      title={`${clientName} · ${appointment.start_time.slice(0, 5)}-${appointment.end_time.slice(0, 5)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-stone-950">{clientName}</p>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-lime-800">
            {appointment.start_time.slice(0, 5)} - {appointment.end_time.slice(0, 5)}
          </p>
        </div>
        {appointment.payment && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Pago</span>
        )}
      </div>
      <p className="mt-1 truncate text-[11px] font-medium text-stone-600">{appointment.service?.name ?? 'Servicio'}</p>
      {showBarber && (
        <p className="mt-0.5 truncate text-[11px] text-stone-500">{appointment.barber?.name ?? 'Barbero'}</p>
      )}
    </button>
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
