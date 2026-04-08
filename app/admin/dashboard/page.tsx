'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Calendar,
  CheckCircle2,
  Clock3,
  DollarSign,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { Spinner } from '@/components/ui'
import { cn, formatPrice } from '@/lib/utils'
import { useAdmin } from '../layout'
import Link from 'next/link'

interface DashboardData {
  summary: {
    today: { total: number; count: number }
    week:  { total: number; count: number }
    month: { total: number; count: number }
    year:  { total: number; count: number }
  }
  todayAppointments: {
    total:     number
    pendiente: number
    completada: number
    cancelada: number
  }
  recentAppointments: any[]
}

export default function DashboardPage() {
  const { user, activeBranch } = useAdmin()
  const [data,    setData]    = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const today = new Date()

  useEffect(() => {
    if (!user) return
    let mounted = true

    async function load() {
      const todayStr    = format(today, 'yyyy-MM-dd')
      const branchParam = activeBranch ? `branch_id=${activeBranch.id}` : ''
      const barberParam = user?.role === 'barber' && user.barber_id ? `&barber_id=${user.barber_id}` : ''

      const [summaryRes, apptRes] = await Promise.all([
        fetch(`/api/payments/summary${branchParam ? '?' + branchParam : ''}`),
        fetch(`/api/appointments?from=${todayStr}&to=${todayStr}${barberParam}${branchParam ? '&' + branchParam : ''}`),
      ])

      const [summaryData, apptData] = await Promise.all([summaryRes.json(), apptRes.json()])
      if (!mounted) return

      const appts: any[] = apptData.appointments ?? []
      setData({
        summary: summaryData.summary ?? { today: { total: 0, count: 0 }, week: { total: 0, count: 0 }, month: { total: 0, count: 0 }, year: { total: 0, count: 0 } },
        todayAppointments: {
          total:      appts.length,
          pendiente:  appts.filter(a => a.status === 'pendiente').length,
          completada: appts.filter(a => a.status === 'completada').length,
          cancelada:  appts.filter(a => a.status === 'cancelada').length,
        },
        recentAppointments: appts.slice(0, 8),
      })
      setLoading(false)
    }

    load()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeBranch])

  const firstName = user?.name ? user.name.split(' ')[0] : null

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 capitalize">
          {format(today, "EEEE d 'de' MMMM", { locale: es })}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">
          {firstName ? `Hola, ${firstName}` : 'Resumen'}
        </h1>
        {activeBranch && (
          <p className="mt-0.5 text-sm text-slate-500">{activeBranch.name}</p>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : data ? (
        <div className="space-y-6">

          {/* Revenue stats */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Recaudación</p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Hoy',   value: data.summary.today.total,  sub: `${data.summary.today.count} cobros`,  icon: DollarSign },
                { label: 'Semana',value: data.summary.week.total,   sub: `${data.summary.week.count} cobros`,   icon: TrendingUp },
                { label: 'Mes',   value: data.summary.month.total,  sub: `${data.summary.month.count} cobros`,  icon: Calendar },
                { label: 'Año',   value: data.summary.year.total,   sub: `${data.summary.year.count} cobros`,   icon: DollarSign },
              ].map(item => (
                <div key={item.label} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-semibold text-slate-400">{item.label}</p>
                  </div>
                  <p className="mt-3 text-xl font-semibold text-slate-950">{formatPrice(item.value)}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Today's turnos */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Turnos de hoy</p>
              <Link href="/admin/agenda" className="text-xs font-semibold text-slate-600 transition hover:text-slate-950">
                Ver agenda →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Total',      value: data.todayAppointments.total,      icon: Calendar,     color: 'bg-slate-50 border-slate-200 text-slate-950' },
                { label: 'Pendientes', value: data.todayAppointments.pendiente,  icon: Clock3,       color: 'bg-amber-50 border-amber-200 text-amber-800' },
                { label: 'Completados',value: data.todayAppointments.completada, icon: CheckCircle2, color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                { label: 'Cancelados', value: data.todayAppointments.cancelada,  icon: XCircle,      color: 'bg-red-50 border-red-200 text-red-700' },
              ].map(item => (
                <div key={item.label} className={cn('rounded-[20px] border p-4 flex items-center gap-3', item.color)}>
                  <item.icon className="h-5 w-5 flex-shrink-0 opacity-70" />
                  <div>
                    <p className="text-2xl font-semibold leading-none">{item.value}</p>
                    <p className="mt-0.5 text-xs font-medium opacity-60">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent appointments */}
          {data.recentAppointments.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Próximos turnos</p>
              <div className="space-y-2">
                {data.recentAppointments.map((appt: any) => (
                  <div
                    key={appt.id}
                    className="flex items-center gap-4 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">
                      {appt.client?.first_name?.[0] ?? '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-950">
                        {appt.client?.first_name} {appt.client?.last_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {appt.service?.name}{appt.barber?.name ? ` · ${appt.barber.name}` : ''}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-semibold text-slate-950">{appt.start_time?.slice(0, 5)}</p>
                      {appt.service?.price && (
                        <p className="text-xs text-slate-400">{formatPrice(appt.service.price)}</p>
                      )}
                    </div>
                    <div className={cn(
                      'h-2 w-2 flex-shrink-0 rounded-full',
                      appt.status === 'pendiente'  ? 'bg-amber-400'   :
                      appt.status === 'completada' ? 'bg-emerald-400' : 'bg-red-400'
                    )} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Acciones rápidas</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { href: '/admin/agenda',   label: 'Agenda',    desc: 'Ver turnos del día' },
                { href: '/admin/caja',     label: 'Caja',      desc: 'Registrar cobros' },
                { href: '/admin/usuarios', label: 'Usuarios',  desc: 'Gestionar equipo' },
                { href: '/admin/clientes', label: 'Clientes',  desc: 'Ver clientes' },
              ].map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{item.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
