'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar, Shield } from 'lucide-react'
import { Button, Badge, Spinner, EmptyState, Modal } from '@/components/ui'
import { cn, formatDate, formatPrice, STATUS_CONFIG } from '@/lib/utils'
import { useUserRole } from '../layout'
import type { Appointment, AppointmentStatus } from '@/types'

type View = 'day' | 'week'

export default function AgendaPage() {
  const userRole = useUserRole()
  const [view, setView] = useState<View>('day')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [updating, setUpdating] = useState(false)

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    let from = format(currentDate, 'yyyy-MM-dd')
    let to = from

    if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
      from = format(weekStart, 'yyyy-MM-dd')
      to = format(addDays(weekStart, 6), 'yyyy-MM-dd')
    }

    // Barbero solo ve sus propios turnos
    let url = `/api/appointments?from=${from}&to=${to}`
    if (userRole?.role === 'barber' && userRole.barber?.id) {
      url += `&barber_id=${userRole.barber.id}`
    }

    const res = await fetch(url)
    const data = await res.json()
    setAppointments(data.appointments ?? [])
    setLoading(false)
  }, [currentDate, view, userRole])

  useEffect(() => {
    if (userRole !== undefined) fetchAppointments()
  }, [fetchAppointments, userRole])

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    setUpdating(true)
    await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setUpdating(false)
    setSelected(null)
    fetchAppointments()
  }

  const navigate = (dir: 1 | -1) => {
    setCurrentDate(d => view === 'day' ? addDays(d, dir) : addDays(d, dir * 7))
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

  const isSuperAdmin = userRole?.role === 'superadmin'
  const isBarber = userRole?.role === 'barber'

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl text-cream">
              {isBarber ? 'Mi Agenda' : 'Agenda'}
            </h1>
            {isSuperAdmin && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20">
                <Shield className="w-3 h-3" /> Todas las sucursales
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
                  view === v ? 'bg-surface-2 text-cream' : 'text-cream/40 hover:text-cream'
                )}>
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
        <DayView appointments={getApptForDay(currentDate)} onSelect={setSelected} showBarber={!isBarber} />
      ) : (
        <WeekView days={weekDays} getAppts={getApptForDay} onSelect={setSelected} showBarber={!isBarber} />
      )}

      {/* Appointment detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detalle del turno">
        {selected && (
          <div className="space-y-4">
            <div className="space-y-2">
              {[
                { label: 'Cliente',  value: `${selected.client?.first_name} ${selected.client?.last_name}` },
                { label: 'Email',    value: selected.client?.email },
                { label: 'Tel',      value: selected.client?.phone },
                { label: 'Servicio', value: selected.service?.name },
                ...(!isBarber ? [{ label: 'Barbero', value: selected.barber?.name }] : []),
                { label: 'Fecha',    value: formatDate(selected.date) },
                { label: 'Hora',     value: `${selected.start_time?.slice(0,5)} – ${selected.end_time?.slice(0,5)}` },
              ].map(r => r.value ? (
                <div key={r.label} className="flex justify-between text-sm">
                  <span className="text-cream/40">{r.label}</span>
                  <span className="text-cream capitalize">{r.value}</span>
                </div>
              ) : null)}
            </div>
            <div className="flex items-center gap-2">
              <Badge className={STATUS_CONFIG[selected.status]?.color}>
                {STATUS_CONFIG[selected.status]?.label}
              </Badge>
            </div>
            {selected.status === 'pendiente' && (
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" loading={updating}
                  onClick={() => updateStatus(selected.id, 'completada')}>
                  Marcar completada
                </Button>
                <Button variant="danger" className="flex-1" loading={updating}
                  onClick={() => updateStatus(selected.id, 'cancelada')}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

function AppointmentCard({ appt, onClick, showBarber }: { appt: Appointment; onClick: () => void; showBarber: boolean }) {
  const cfg = STATUS_CONFIG[appt.status]
  return (
    <button onClick={onClick} className="w-full text-left card p-3.5 hover:border-gold/20 transition-all group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-cream truncate">
            {appt.client?.first_name} {appt.client?.last_name}
          </p>
          <p className="text-xs text-cream/40 mt-0.5">
            {appt.service?.name}{showBarber && appt.barber ? ` · ${appt.barber.name}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-xs font-medium text-gold">{appt.start_time?.slice(0,5)}</span>
          <span className={cn('badge text-xs', cfg?.color)}>{cfg?.label}</span>
        </div>
      </div>
    </button>
  )
}

function DayView({ appointments, onSelect, showBarber }: { appointments: Appointment[]; onSelect: (a: Appointment) => void; showBarber: boolean }) {
  if (appointments.length === 0) {
    return <EmptyState icon={<Calendar className="w-6 h-6" />} title="Sin turnos este día" description="No hay citas programadas para esta fecha" />
  }
  return (
    <div className="grid gap-2 max-w-xl">
      {appointments.map(a => <AppointmentCard key={a.id} appt={a} onClick={() => onSelect(a)} showBarber={showBarber} />)}
    </div>
  )
}

function WeekView({ days, getAppts, onSelect, showBarber }: {
  days: Date[]; getAppts: (d: Date) => Appointment[]; onSelect: (a: Appointment) => void; showBarber: boolean
}) {
  const today = new Date()
  return (
    <div className="grid grid-cols-7 gap-2 min-w-0 overflow-x-auto">
      {days.map(day => {
        const appts = getAppts(day)
        const isToday = isSameDay(day, today)
        return (
          <div key={day.toISOString()} className="min-w-0">
            <div className={cn(
              'text-center py-2 mb-2 rounded-lg',
              isToday ? 'bg-gold/10 border border-gold/20' : ''
            )}>
              <p className="text-xs text-cream/40 capitalize">
                {format(day, 'EEE', { locale: es })}
              </p>
              <p className={cn('text-sm font-medium mt-0.5', isToday ? 'text-gold' : 'text-cream')}>
                {format(day, 'd')}
              </p>
            </div>
            <div className="space-y-1.5">
              {appts.map(a => (
                <button key={a.id} onClick={() => onSelect(a)}
                  className="w-full text-left p-2 rounded-lg bg-surface border border-border hover:border-gold/20 transition-all">
                  <p className="text-xs text-gold font-medium">{a.start_time?.slice(0,5)}</p>
                  <p className="text-xs text-cream/60 truncate mt-0.5">{a.client?.first_name}</p>
                  <p className="text-xs text-cream/30 truncate">{a.service?.name}</p>
                  {showBarber && a.barber && (
                    <p className="text-xs text-cream/20 truncate">{a.barber.name}</p>
                  )}
                </button>
              ))}
              {appts.length === 0 && (
                <div className="h-10 rounded-lg border border-dashed border-border/30" />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
