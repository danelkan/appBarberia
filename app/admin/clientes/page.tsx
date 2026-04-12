'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Cake, ChevronDown, ChevronRight, Phone, Search, Users } from 'lucide-react'
import { Badge, EmptyState, Input, Spinner } from '@/components/ui'
import { cn, formatDate, formatPrice, STATUS_CONFIG } from '@/lib/utils'
import { useAdmin } from '../layout'
import type { Client, Appointment } from '@/types'

interface ClientWithHistory extends Client {
  appointments: (Appointment & { barber: { name: string }; service: { name: string; price: number } })[]
}

function formatBirthday(birthday: string | null | undefined): string {
  if (!birthday) return ''
  // birthday is YYYY-MM-DD, format as DD/MM
  const [, month, day] = birthday.split('-')
  return `${day}/${month}`
}

export default function ClientesPage() {
  const { activeBranch, user } = useAdmin()
  const [clients,  setClients]  = useState<ClientWithHistory[]>([])
  const [loading,  setLoading]  = useState(true)
  const [q,        setQ]        = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchClients = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      // Pass active branch for admins so they can filter per-branch too.
      // Barbers are auto-filtered on the backend by their own branch_ids.
      if (activeBranch && user?.role !== 'barber') {
        params.set('branch_id', activeBranch.id)
      }
      const res  = await fetch(`/api/clients?${params.toString()}`)
      const data = await res.json()
      setClients(data.clients ?? [])
    } catch {
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [activeBranch, user?.role])

  useEffect(() => {
    const t = setTimeout(() => fetchClients(q), 300)
    return () => clearTimeout(t)
  }, [q, fetchClients])

  const scopeLabel = activeBranch?.name ?? (user?.role === 'barber' ? 'tu sucursal' : 'todas las sucursales')

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">Clientes</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {clients.length} registrado{clients.length !== 1 ? 's' : ''} · {scopeLabel}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Buscar por nombre o email..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={q ? 'Sin resultados' : 'Sin clientes aún'}
          description={q
            ? `No hay clientes que coincidan con "${q}"`
            : 'Los clientes aparecen cuando hacen una reserva o son cargados manualmente.'
          }
        />
      ) : (
        <div className="space-y-2">
          {clients.map(client => {
            const isOpen      = expanded === client.id
            const total       = client.appointments?.length ?? 0
            const completadas = client.appointments?.filter(a => a.status === 'completada').length ?? 0

            return (
              <div key={client.id} className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button
                  className="w-full text-left p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : client.id)}
                >
                  {/* Avatar */}
                  <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-700">
                    {client.first_name[0]}{client.last_name?.[0] ?? ''}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-950">
                      {client.first_name} {client.last_name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {client.email ?? client.phone ?? '—'}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {client.birthday && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400">
                        <Cake className="h-3.5 w-3.5" />
                        {formatBirthday(client.birthday)}
                      </span>
                    )}
                    <div className="hidden text-right sm:block">
                      <p className="text-xs font-semibold text-slate-500">
                        {total} turno{total !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs font-semibold text-emerald-600">
                        {completadas} completado{completadas !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {isOpen
                      ? <ChevronDown className="h-4 w-4 text-slate-300" />
                      : <ChevronRight className="h-4 w-4 text-slate-300" />
                    }
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-4">
                    {/* Contact info */}
                    <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {client.phone && (
                        <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                          <Phone className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Teléfono</p>
                            <p className="text-sm font-medium text-slate-950">{client.phone}</p>
                          </div>
                        </div>
                      )}
                      {client.birthday && (
                        <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                          <Cake className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Cumpleaños</p>
                            <p className="text-sm font-medium text-slate-950">
                              {new Date(client.birthday + 'T00:00:00').toLocaleDateString('es-UY', { day: 'numeric', month: 'long' })}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                        <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Cliente desde</p>
                          <p className="text-sm font-medium text-slate-950 capitalize">{formatDate(client.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                        <Users className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total visitas</p>
                          <p className="text-sm font-semibold text-slate-950">{total}</p>
                        </div>
                      </div>
                    </div>

                    {/* History */}
                    {client.appointments?.length > 0 && (
                      <>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Últimas visitas
                        </p>
                        <div className="space-y-1.5">
                          {client.appointments
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .slice(0, 5)
                            .map(appt => {
                              const cfg = STATUS_CONFIG[appt.status]
                              return (
                                <div
                                  key={appt.id}
                                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 transition hover:bg-slate-100"
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-950">{appt.service?.name}</p>
                                    <p className="mt-0.5 text-xs font-medium text-slate-400 capitalize">
                                      {formatDate(appt.date)}{appt.barber?.name ? ` · ${appt.barber.name}` : ''}
                                    </p>
                                  </div>
                                  <div className="flex flex-shrink-0 items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-700">
                                      {formatPrice(appt.service?.price ?? 0)}
                                    </span>
                                    <Badge className={cn('text-xs', cfg?.color)}>{cfg?.label}</Badge>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
