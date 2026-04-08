'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Calendar, DollarSign, Users, TrendingUp, Clock,
  CheckCircle, XCircle, Scissors, MapPin, ArrowRight,
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
    total: number
    pendiente: number
    completada: number
    cancelada: number
  }
  recentAppointments: any[]
}

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  accent?: string
}) {
  return (
    <div className="card p-5 flex items-start gap-4 shadow-card">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', accent ?? 'bg-gold/10 border border-gold/20')}>
        <Icon className={cn('w-5 h-5', accent ? 'text-white' : 'text-gold')} />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-cream/40 font-semibold">{label}</p>
        <p className="text-2xl font-bold text-cream mt-1 leading-none">{value}</p>
        {sub && <p className="text-xs text-cream/45 mt-1 font-medium">{sub}</p>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user, activeBranch } = useAdmin()
  const [data, setData]   = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const today = new Date()

  useEffect(() => {
    if (!user) return
    let mounted = true

    async function load() {
      const todayStr = format(today, 'yyyy-MM-dd')
      const branchParam = activeBranch ? `branch_id=${activeBranch.id}` : ''
      const barberParam = user?.role === 'barber' && user.barber_id ? `&barber_id=${user.barber_id}` : ''
      const [summaryRes, apptRes] = await Promise.all([
        fetch(`/api/payments/summary${branchParam ? '?' + branchParam : ''}`),
        fetch(`/api/appointments?from=${todayStr}&to=${todayStr}${barberParam}${branchParam ? '&' + branchParam : ''}`),
      ])

      const [summaryData, apptData] = await Promise.all([
        summaryRes.json(),
        apptRes.json(),
      ])

      if (!mounted) return

      const appts: any[] = apptData.appointments ?? []
      setData({
        summary: summaryData.summary ?? { today: { total: 0, count: 0 }, week: { total: 0, count: 0 }, month: { total: 0, count: 0 }, year: { total: 0, count: 0 } },
        todayAppointments: {
          total:     appts.length,
          pendiente: appts.filter(a => a.status === 'pendiente').length,
          completada: appts.filter(a => a.status === 'completada').length,
          cancelada: appts.filter(a => a.status === 'cancelada').length,
        },
        recentAppointments: appts.slice(0, 8),
      })
      setLoading(false)
    }

    load()
    return () => { mounted = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeBranch])

  const greeting = () => {
    const h = today.getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-7">
        <p className="text-xs uppercase tracking-widest text-cream/35 font-semibold mb-1 capitalize">
          {format(today, "EEEE d 'de' MMMM", { locale: es })}
        </p>
        <h1 className="font-serif text-2xl sm:text-3xl text-cream">
          {greeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
        </h1>
        {activeBranch && (
          <p className="text-sm text-cream/45 mt-1 flex items-center gap-1.5 font-medium">
            <MapPin className="w-3.5 h-3.5 text-gold" />
            {activeBranch.name}
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : data ? (
        <div className="space-y-6">

          {/* Revenue stats */}
          <div>
            <p className="text-xs uppercase tracking-widest text-cream/35 font-semibold mb-3">Recaudación</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Hoy"       value={formatPrice(data.summary.today.total)} sub={`${data.summary.today.count} cobros`}    icon={DollarSign} />
              <StatCard label="Semana"    value={formatPrice(data.summary.week.total)}  sub={`${data.summary.week.count} cobros`}     icon={TrendingUp} />
              <StatCard label="Mes"       value={formatPrice(data.summary.month.total)} sub={`${data.summary.month.count} cobros`}    icon={Calendar} />
              <StatCard label="Año"       value={formatPrice(data.summary.year.total)}  sub={`${data.summary.year.count} cobros`}     icon={Scissors} />
            </div>
          </div>

          {/* Today appointments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-widest text-cream/35 font-semibold">Turnos de hoy</p>
              <Link href="/admin/agenda" className="text-xs text-gold-dark font-semibold flex items-center gap-1 hover:text-gold transition-colors">
                Ver agenda <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total',     value: data.todayAppointments.total,     icon: Calendar,     color: 'bg-surface-2 border-border text-cream' },
                { label: 'Pendientes',value: data.todayAppointments.pendiente, icon: Clock,        color: 'bg-amber-50 border-amber-200 text-amber-700' },
                { label: 'Completados',value: data.todayAppointments.completada,icon: CheckCircle, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                { label: 'Cancelados',value: data.todayAppointments.cancelada, icon: XCircle,     color: 'bg-red-50 border-red-200 text-red-600' },
              ].map(item => (
                <div key={item.label} className={cn('rounded-xl border p-4 flex items-center gap-3 shadow-card', item.color)}>
                  <item.icon className="w-5 h-5 flex-shrink-0 opacity-70" />
                  <div>
                    <p className="text-2xl font-bold leading-none">{item.value}</p>
                    <p className="text-xs font-medium opacity-70 mt-0.5">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent appointments */}
          {data.recentAppointments.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-widest text-cream/35 font-semibold">Próximos turnos</p>
              </div>
              <div className="space-y-1.5">
                {data.recentAppointments.map((appt: any) => (
                  <div key={appt.id} className="card p-3.5 flex items-center gap-3 shadow-card hover:shadow-card-hover transition-all">
                    <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-bold text-sm flex-shrink-0">
                      {appt.client?.first_name?.[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-cream">
                        {appt.client?.first_name} {appt.client?.last_name}
                      </p>
                      <p className="text-xs text-cream/45 font-medium">
                        {appt.service?.name} · {appt.barber?.name}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gold-dark">{appt.start_time?.slice(0,5)}</p>
                      {appt.service?.price && (
                        <p className="text-xs text-cream/40 font-medium">{formatPrice(appt.service.price)}</p>
                      )}
                    </div>
                    <div className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      appt.status === 'pendiente'  ? 'bg-amber-400'  :
                      appt.status === 'completada' ? 'bg-emerald-400' : 'bg-red-400'
                    )} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div>
            <p className="text-xs uppercase tracking-widest text-cream/35 font-semibold mb-3">Acciones rápidas</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { href: '/admin/agenda',   label: 'Agenda',   icon: Calendar,  desc: 'Ver turnos' },
                { href: '/admin/caja',     label: 'Caja',     icon: DollarSign,desc: 'Registrar cobros' },
                { href: '/admin/usuarios', label: 'Usuarios', icon: Users,     desc: 'Gestionar equipo' },
                { href: '/admin/clientes', label: 'Clientes', icon: Users,     desc: 'Ver clientes' },
              ].map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="card p-4 flex flex-col gap-2 hover:shadow-card-hover hover:border-gold/20 transition-all group shadow-card"
                >
                  <item.icon className="w-5 h-5 text-gold/70 group-hover:text-gold transition-colors" />
                  <div>
                    <p className="text-sm font-semibold text-cream">{item.label}</p>
                    <p className="text-xs text-cream/40 font-medium">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
