'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ChevronLeft, ChevronRight, Calendar, Shield,
  DollarSign, MapPin, Clock, CheckCircle, X, Receipt,
} from 'lucide-react'
import { Button, Badge, Spinner, EmptyState, Modal } from '@/components/ui'
import { cn, formatDate, formatPrice, STATUS_CONFIG } from '@/lib/utils'
import { useAdmin } from '../layout'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS, type Appointment, type AppointmentStatus, type PaymentMethod } from '@/types'
import Link from 'next/link'

type View = 'day' | 'week'

const METHODS: { key: PaymentMethod; label: string; icon: string; color: string }[] = [
  { key: 'efectivo',       label: 'Efectivo',              icon: '💵', color: 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20' },
  { key: 'mercado_pago',   label: 'Mercado Pago',          icon: '💳', color: 'border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20' },
  { key: 'debito',         label: 'Débito',                icon: '🏦', color: 'border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20' },
  { key: 'transferencia',  label: 'Transferencia bancaria',icon: '🔄', color: 'border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20' },
]

export default function AgendaPage() {
  const { user, activeBranch } = useAdmin()
  const [view, setView]               = useState<View>('day')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState<Appointment | null>(null)
  // Payment modal state
  const [showPayment, setShowPayment] = useState(false)
  const [payMethod, setPayMethod]     = useState<PaymentMethod | null>(null)
  const [payAmount, setPayAmount]     = useState('')
  const [paying, setPaying]           = useState(false)
  const [payError, setPayError]       = useState('')
  const [paidId, setPaidId]           = useState<string | null>(null)

  const isBarber     = user?.role === 'barber'
  const isSuperAdmin = user?.role === 'superadmin'

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    let from = format(currentDate, 'yyyy-MM-dd')
    let to   = from
    if (view === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
      from = format(ws, 'yyyy-MM-dd')
      to   = format(addDays(ws, 6), 'yyyy-MM-dd')
    }
    let url = `/api/appointments?from=${from}&to=${to}`
    if (isBarber && user?.barber_id) url += `&barber_id=${user.barber_id}`
    if (activeBranch) url += `&branch_id=${activeBranch.id}`

    const res  = await fetch(url)
    const data = await res.json()
    setAppointments(data.appointments ?? [])
    setLoading(false)
  }, [currentDate, view, user, activeBranch])

  useEffect(() => { if (user !== null) fetchAppointments() }, [fetchAppointments, user])

  const navigate = (dir: 1 | -1) =>
    setCurrentDate(d => view === 'day' ? addDays(d, dir) : addDays(d, dir * 7))

  const openPayment = (appt: Appointment) => {
    setSelected(appt)
    setPayAmount(String(appt.service?.price ?? ''))
    setPayMethod(null)
    setPayError('')
    setShowPayment(true)
  }

  const handlePay = async () => {
    if (!payMethod || !payAmount || !selected) { setPayError('Completá todos los campos'); return }
    setPaying(true); setPayError('')
    const res  = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_id: selected.id, amount: Number(payAmount), method: payMethod }),
    })
    const data = await res.json()
    if (!res.ok) { setPayError(data.error || 'Error al registrar pago'); setPaying(false); return }
    setPaidId(data.payment.id)
    setPaying(false)
    fetchAppointments()
  }

  const closePayment = () => {
    setShowPayment(false); setSelected(null); setPayMethod(null)
    setPayAmount(''); setPayError(''); setPaying(false); setPaidId(null)
  }

  const dayTitle = view === 'day'
    ? format(currentDate, "EEEE d 'de' MMMM", { locale: es })
    : (() => {
        const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
        return `${format(ws, 'd MMM', { locale: es })} – ${format(addDays(ws, 6), 'd MMM yyyy', { locale: es })}`
      })()

  const weekDays = view === 'week'
    ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i))
    : []

  const getApptForDay = (date: Date) =>
    appointments.filter(a => a.date === format(date, 'yyyy-MM-dd'))
      .sort((a, b) => a.start_time.localeCompare(b.start_time))

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-2xl text-cream">{isBarber ? 'Mi Agenda' : 'Agenda'}</h1>
            {isSuperAdmin && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20">
                <Shield className="w-2.5 h-2.5" /> Superadmin
              </span>
            )}
            {activeBranch && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-cream/50 border border-white/10">
                <MapPin className="w-2.5 h-2.5" /> {activeBranch.name}
              </span>
            )}
          </div>
          <p className="text-sm text-cream/40 mt-0.5 capitalize">{dayTitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['day', 'week'] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('px-3 py-1.5 text-xs transition-all',
                  view === v ? 'bg-surface-2 text-cream' : 'text-cream/40 hover:text-cream')}>
                {v === 'day' ? 'Día' : 'Semana'}
              </button>
            ))}
          </div>
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg border border-border hover:bg-surface-2 text-cream/60 hover:text-cream transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-surface-2 text-cream/60 hover:text-cream transition-all">
            Hoy
          </button>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg border border-border hover:bg-surface-2 text-cream/60 hover:text-cream transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : view === 'day' ? (
        <DayView appointments={getApptForDay(currentDate)} onSelect={setSelected} onPay={openPayment} showBarber={!isBarber} />
      ) : (
        <WeekView days={weekDays} getAppts={getApptForDay} onSelect={setSelected} showBarber={!isBarber} />
      )}

      {/* ── Detail modal ─────────────────────────────── */}
      <Modal open={!!selected && !showPayment} onClose={() => setSelected(null)} title="Detalle del turno">
        {selected && (
          <div className="space-y-4">
            <div className="space-y-2.5">
              {[
                { label: 'Cliente',   value: `${selected.client?.first_name} ${selected.client?.last_name}` },
                { label: 'Email',     value: selected.client?.email },
                { label: 'Teléfono', value: selected.client?.phone },
                { label: 'Servicio',  value: `${selected.service?.name} — ${formatPrice(selected.service?.price ?? 0)}` },
                ...(!isBarber ? [{ label: 'Barbero', value: selected.barber?.name }] : []),
                { label: 'Fecha',     value: formatDate(selected.date) },
                { label: 'Hora',      value: `${selected.start_time?.slice(0,5)} – ${selected.end_time?.slice(0,5)}` },
                ...(selected.branch ? [{ label: 'Sede', value: selected.branch.name }] : []),
              ].map(r => r.value ? (
                <div key={r.label} className="flex justify-between gap-4 text-sm">
                  <span className="text-cream/40 flex-shrink-0">{r.label}</span>
                  <span className="text-cream text-right capitalize">{r.value}</span>
                </div>
              ) : null)}
            </div>

            <div className="flex items-center gap-2">
              <Badge className={STATUS_CONFIG[selected.status]?.color}>
                {STATUS_CONFIG[selected.status]?.label}
              </Badge>
              {selected.payment && (
                <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                  Cobrado · {PAYMENT_METHOD_LABELS[selected.payment.method as PaymentMethod]}
                </Badge>
              )}
            </div>

            {selected.status === 'pendiente' && !selected.payment && (
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button variant="gold" className="flex-1 gap-2" onClick={() => openPayment(selected)}>
                  <DollarSign className="w-4 h-4" /> Cobrar turno
                </Button>
                <Button variant="danger" className="flex-1" onClick={async () => {
                  await fetch(`/api/appointments/${selected.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'cancelada' }),
                  })
                  setSelected(null); fetchAppointments()
                }}>
                  Cancelar
                </Button>
              </div>
            )}

            {selected.payment && (
              <Link
                href={`/admin/comprobante/${selected.payment.id}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gold/20 bg-gold/10 text-gold text-sm hover:bg-gold/15 transition-all"
              >
                <Receipt className="w-4 h-4" /> Ver comprobante
              </Link>
            )}
          </div>
        )}
      </Modal>

      {/* ── Payment modal ────────────────────────────── */}
      <Modal open={showPayment} onClose={closePayment} title={paidId ? '¡Pago registrado!' : 'Cobrar turno'}>
        {paidId ? (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <p className="text-cream font-semibold text-lg">{formatPrice(Number(payAmount))}</p>
              <p className="text-cream/50 text-sm mt-1">
                {PAYMENT_METHOD_ICONS[payMethod!]} {PAYMENT_METHOD_LABELS[payMethod!]}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href={`/admin/comprobante/${paidId}`}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-gold/30 bg-gold/10 text-gold text-sm hover:bg-gold/15 transition-all"
              >
                <Receipt className="w-4 h-4" /> Ver y descargar comprobante
              </Link>
              <Button variant="outline" className="w-full" onClick={closePayment}>
                <X className="w-4 h-4" /> Cerrar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {selected && (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 space-y-1.5">
                <p className="text-sm font-medium text-cream">
                  {selected.client?.first_name} {selected.client?.last_name}
                </p>
                <p className="text-xs text-cream/50">{selected.service?.name} · {selected.start_time?.slice(0,5)}</p>
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="label">Monto cobrado ($UYU)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/30 text-sm">$</span>
                <input
                  type="number"
                  className="input pl-7"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Method */}
            <div>
              <label className="label">Método de cobro</label>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map(m => (
                  <button
                    key={m.key}
                    onClick={() => setPayMethod(m.key)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-2xl border text-sm transition-all duration-200',
                      payMethod === m.key
                        ? 'border-gold/50 bg-gold/15 text-cream'
                        : cn('border-white/8 bg-white/[0.02] text-cream/60', m.color)
                    )}
                  >
                    <span className="text-xl">{m.icon}</span>
                    <span className="text-xs font-medium text-center leading-tight">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {payError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                {payError}
              </p>
            )}

            <Button className="w-full" size="lg" loading={paying} onClick={handlePay}
              disabled={!payMethod || !payAmount}>
              <DollarSign className="w-4 h-4" />
              Confirmar cobro {payAmount ? `· ${formatPrice(Number(payAmount))}` : ''}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}

function AppointmentCard({ appt, onClick, onPay, showBarber }: {
  appt: Appointment; onClick: () => void; onPay: (a: Appointment) => void; showBarber: boolean
}) {
  const cfg   = STATUS_CONFIG[appt.status]
  const paid  = !!appt.payment
  return (
    <div className={cn(
      'card p-4 transition-all group animate-fade-up',
      appt.status === 'completada' ? 'opacity-60' : 'hover:border-gold/20'
    )}>
      <div className="flex items-start justify-between gap-3">
        <button onClick={onClick} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-cream">
              {appt.client?.first_name} {appt.client?.last_name}
            </p>
            <span className={cn('badge text-xs', cfg?.color)}>{cfg?.label}</span>
            {paid && (
              <span className="badge text-xs bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                Cobrado
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gold font-medium">
              <Clock className="w-3 h-3" /> {appt.start_time?.slice(0,5)}
            </span>
            <span className="text-xs text-cream/40">{appt.service?.name}</span>
            {showBarber && appt.barber && (
              <span className="text-xs text-cream/30">· {appt.barber.name}</span>
            )}
            {appt.branch && (
              <span className="flex items-center gap-1 text-xs text-cream/25">
                <MapPin className="w-2.5 h-2.5" /> {appt.branch.name}
              </span>
            )}
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          {appt.service && (
            <span className="text-sm font-semibold text-cream/70">{formatPrice(appt.service.price)}</span>
          )}
          {appt.status === 'pendiente' && !paid && (
            <button
              onClick={() => onPay(appt)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gold/10 border border-gold/20 text-gold text-xs font-medium hover:bg-gold/20 transition-all"
            >
              <DollarSign className="w-3.5 h-3.5" /> Cobrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DayView({ appointments, onSelect, onPay, showBarber }: {
  appointments: Appointment[]; onSelect: (a: Appointment) => void
  onPay: (a: Appointment) => void; showBarber: boolean
}) {
  if (appointments.length === 0) {
    return <EmptyState icon={<Calendar className="w-6 h-6" />} title="Sin turnos este día" description="No hay citas programadas para esta fecha" />
  }
  return (
    <div className="space-y-2 max-w-2xl">
      {appointments.map(a => (
        <AppointmentCard key={a.id} appt={a} onClick={() => onSelect(a)} onPay={onPay} showBarber={showBarber} />
      ))}
    </div>
  )
}

function WeekView({ days, getAppts, onSelect, showBarber }: {
  days: Date[]; getAppts: (d: Date) => Appointment[]
  onSelect: (a: Appointment) => void; showBarber: boolean
}) {
  const today = new Date()
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="grid grid-cols-7 gap-1.5 min-w-[640px] px-4 sm:px-0">
        {days.map(day => {
          const appts  = getAppts(day)
          const isToday = isSameDay(day, today)
          return (
            <div key={day.toISOString()}>
              <div className={cn('text-center py-2 mb-1.5 rounded-xl',
                isToday ? 'bg-gold/10 border border-gold/20' : '')}>
                <p className="text-[10px] text-cream/40 capitalize">{format(day, 'EEE', { locale: es })}</p>
                <p className={cn('text-sm font-semibold mt-0.5', isToday ? 'text-gold' : 'text-cream')}>{format(day, 'd')}</p>
              </div>
              <div className="space-y-1">
                {appts.map(a => (
                  <button key={a.id} onClick={() => onSelect(a)}
                    className="w-full text-left p-2 rounded-xl bg-surface border border-border hover:border-gold/20 transition-all">
                    <p className="text-[11px] text-gold font-semibold">{a.start_time?.slice(0,5)}</p>
                    <p className="text-[11px] text-cream/70 truncate mt-0.5">{a.client?.first_name}</p>
                    <p className="text-[10px] text-cream/30 truncate">{a.service?.name}</p>
                  </button>
                ))}
                {appts.length === 0 && <div className="h-8 rounded-xl border border-dashed border-white/[0.06]" />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
