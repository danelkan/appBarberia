'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { Search, Users, ChevronDown, ChevronRight, Phone, Mail, Calendar } from 'lucide-react'
import { Input, Spinner, EmptyState, Badge } from '@/components/ui'
import { cn, formatDate, formatPrice, STATUS_CONFIG } from '@/lib/utils'
import type { Client, Appointment } from '@/types'

interface ClientWithHistory extends Client {
  appointments: (Appointment & { barber: { name: string }; service: { name: string; price: number } })[]
}

export default function ClientesPage() {
  const [clients, setClients]   = useState<ClientWithHistory[]>([])
  const [loading, setLoading]   = useState(true)
  const [q, setQ]               = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchClients = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/clients${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      const data = await res.json()
      setClients(data.clients ?? [])
    } catch {
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchClients(q), 300)
    return () => clearTimeout(t)
  }, [q, fetchClients])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-2xl text-cream">Clientes</h1>
          <p className="text-sm text-cream/45 mt-0.5">
            {clients.length} registrado{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/35" />
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
          icon={<Users className="w-6 h-6" />}
          title={q ? 'Sin resultados' : 'Sin clientes aún'}
          description={q
            ? `No hay clientes que coincidan con "${q}"`
            : 'Los clientes aparecerán cuando hagan una reserva'
          }
        />
      ) : (
        <div className="space-y-2">
          {clients.map(client => {
            const isOpen      = expanded === client.id
            const total       = client.appointments?.length ?? 0
            const completadas = client.appointments?.filter(a => a.status === 'completada').length ?? 0

            return (
              <div key={client.id} className="card overflow-hidden">
                <button
                  className="w-full text-left p-4 flex items-center gap-3 hover:bg-surface-2 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : client.id)}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-bold text-sm flex-shrink-0">
                    {client.first_name[0]}{client.last_name?.[0] ?? ''}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-cream">
                      {client.first_name} {client.last_name}
                    </p>
                    <p className="text-xs text-cream/45 truncate font-medium">{client.email}</p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-semibold text-cream/60">
                        {total} turno{total !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-emerald-600 font-semibold">
                        {completadas} completado{completadas !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-cream/30" />
                      : <ChevronRight className="w-4 h-4 text-cream/30" />
                    }
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border px-4 pb-4 pt-4 animate-fade-in">
                    {/* Contact info */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                      {client.phone && (
                        <div className="flex items-center gap-2 bg-surface-2 rounded-xl p-3">
                          <Phone className="w-3.5 h-3.5 text-cream/40 flex-shrink-0" />
                          <div>
                            <p className="text-[10px] text-cream/35 font-semibold uppercase tracking-wider">Teléfono</p>
                            <p className="text-sm text-cream font-medium">{client.phone}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 bg-surface-2 rounded-xl p-3">
                        <Calendar className="w-3.5 h-3.5 text-cream/40 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-cream/35 font-semibold uppercase tracking-wider">Cliente desde</p>
                          <p className="text-sm text-cream font-medium capitalize">{formatDate(client.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-surface-2 rounded-xl p-3">
                        <Users className="w-3.5 h-3.5 text-cream/40 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-cream/35 font-semibold uppercase tracking-wider">Total visitas</p>
                          <p className="text-sm text-cream font-bold">{total}</p>
                        </div>
                      </div>
                    </div>

                    {/* History */}
                    {client.appointments?.length > 0 && (
                      <>
                        <p className="text-xs text-cream/35 uppercase tracking-wider font-semibold mb-2">
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
                                  className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-surface-2 hover:bg-surface-3 transition-colors"
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-cream">{appt.service?.name}</p>
                                    <p className="text-xs text-cream/40 mt-0.5 capitalize font-medium">
                                      {formatDate(appt.date)} · {appt.barber?.name}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-xs font-bold text-gold-dark">
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
