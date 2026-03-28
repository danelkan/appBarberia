'use client'
import { useState, useEffect, useCallback } from 'react'
import { Search, Users, ChevronDown, ChevronRight } from 'lucide-react'
import { Input, Spinner, EmptyState, Badge } from '@/components/ui'
import { cn, formatDate, formatPrice, STATUS_CONFIG } from '@/lib/utils'
import type { Client, Appointment } from '@/types'

interface ClientWithHistory extends Client {
  appointments: (Appointment & { barber: { name: string }; service: { name: string; price: number } })[]
}

export default function ClientesPage() {
  const [clients, setClients] = useState<ClientWithHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetch_ = useCallback(async (query: string) => {
    setLoading(true)
    const res = await fetch(`/api/clients${query ? `?q=${encodeURIComponent(query)}` : ''}`)
    const data = await res.json()
    setClients(data.clients ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => fetch_(q), 300)
    return () => clearTimeout(t)
  }, [q, fetch_])

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-2xl text-cream">Clientes</h1>
          <p className="text-sm text-cream/40 mt-0.5">{clients.length} registrados</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/30" />
          <input className="input pl-9 w-full" placeholder="Buscar por nombre o email..."
            value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : clients.length === 0 ? (
        <EmptyState icon={<Users className="w-6 h-6" />}
          title={q ? 'Sin resultados' : 'Sin clientes aún'}
          description={q ? `No hay clientes que coincidan con "${q}"` : 'Los clientes aparecerán cuando hagan una reserva'} />
      ) : (
        <div className="grid gap-2">
          {clients.map(client => {
            const isOpen = expanded === client.id
            const total = client.appointments?.length ?? 0
            const completadas = client.appointments?.filter(a => a.status === 'completada').length ?? 0
            return (
              <div key={client.id} className="card overflow-hidden">
                <button className="w-full text-left p-4 flex items-center gap-3 hover:bg-surface-2 transition-all"
                  onClick={() => setExpanded(isOpen ? null : client.id)}>
                  <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-serif text-base flex-shrink-0">
                    {client.first_name[0]}{client.last_name?.[0] ?? ''}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cream">{client.first_name} {client.last_name}</p>
                    <p className="text-xs text-cream/40 truncate">{client.email}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-cream/30">{total} turno{total !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-emerald-400">{completadas} completado{completadas !== 1 ? 's' : ''}</p>
                    </div>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-cream/30" /> : <ChevronRight className="w-4 h-4 text-cream/30" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border px-4 pb-4 pt-3 animate-fade-in">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                      {[
                        { label: 'Teléfono', value: client.phone },
                        { label: 'Cliente desde', value: formatDate(client.created_at) },
                        { label: 'Total visitas', value: String(total) },
                      ].map(r => (
                        <div key={r.label} className="bg-surface-2 rounded-lg p-3">
                          <p className="text-xs text-cream/30 mb-1">{r.label}</p>
                          <p className="text-sm text-cream capitalize">{r.value}</p>
                        </div>
                      ))}
                    </div>
                    {client.appointments?.length > 0 && (
                      <>
                        <p className="text-xs text-cream/30 uppercase tracking-wider mb-2">Historial</p>
                        <div className="space-y-2">
                          {client.appointments
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .slice(0, 5)
                            .map(appt => {
                              const cfg = STATUS_CONFIG[appt.status]
                              return (
                                <div key={appt.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                                  <div>
                                    <p className="text-xs text-cream">{appt.service?.name}</p>
                                    <p className="text-xs text-cream/30 mt-0.5 capitalize">{formatDate(appt.date)} · {appt.barber?.name}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gold">{formatPrice(appt.service?.price ?? 0)}</span>
                                    <span className={cn('badge text-xs', cfg?.color)}>{cfg?.label}</span>
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
