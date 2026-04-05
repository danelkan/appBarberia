'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { DollarSign, TrendingUp, MapPin, Receipt, Calendar } from 'lucide-react'
import { Spinner } from '@/components/ui'
import { cn, formatPrice } from '@/lib/utils'
import { useAdmin } from '../layout'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS, type PaymentMethod } from '@/types'
import Link from 'next/link'

type Period = 'today' | 'week' | 'month' | 'custom'

interface PaymentRow {
  id: string
  amount: number
  method: PaymentMethod
  receipt_number: string
  created_at: string
  appointment: {
    date: string; start_time: string
    client: { first_name: string; last_name: string }
    barber: { name: string }
    service: { name: string }
    branch: { name: string }
  }
}

interface Totals {
  efectivo: number; mercado_pago: number; debito: number; transferencia: number; total: number
}

const METHODS: PaymentMethod[] = ['efectivo', 'mercado_pago', 'debito', 'transferencia']

const METHOD_COLORS: Record<PaymentMethod, string> = {
  efectivo:       'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  mercado_pago:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
  debito:         'text-purple-400 bg-purple-500/10 border-purple-500/20',
  transferencia:  'text-orange-400 bg-orange-500/10 border-orange-500/20',
}

export default function CajaPage() {
  const { activeBranch } = useAdmin()
  const [period, setPeriod]     = useState<Period>('today')
  const [customFrom, setCustomFrom] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [customTo,   setCustomTo]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [totals, setTotals]     = useState<Totals | null>(null)
  const [loading, setLoading]   = useState(true)

  const getDateRange = useCallback((): [string, string] => {
    const now = new Date()
    if (period === 'today')  return [format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"), format(endOfDay(now), "yyyy-MM-dd'T'HH:mm:ss")]
    if (period === 'week') {
      const ws = startOfWeek(now, { weekStartsOn: 1 })
      return [format(ws, "yyyy-MM-dd'T'00:00:00"), format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd'T'23:59:59")]
    }
    if (period === 'month')  return [format(startOfMonth(now), "yyyy-MM-dd'T'00:00:00"), format(endOfMonth(now), "yyyy-MM-dd'T'23:59:59")]
    return [customFrom + 'T00:00:00', customTo + 'T23:59:59']
  }, [period, customFrom, customTo])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [from, to] = getDateRange()
    let url = `/api/payments?date_from=${from}&date_to=${to}`
    if (activeBranch) url += `&branch_id=${activeBranch.id}`
    const res  = await fetch(url)
    const data = await res.json()
    setPayments(data.payments ?? [])
    setTotals(data.totals ?? null)
    setLoading(false)
  }, [getDateRange, activeBranch])

  useEffect(() => { fetchData() }, [fetchData])

  const periodLabel: Record<Period, string> = {
    today: 'Hoy', week: 'Esta semana', month: 'Este mes', custom: 'Personalizado',
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl text-cream">Caja</h1>
            {activeBranch && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-cream/50 border border-white/10">
                <MapPin className="w-2.5 h-2.5" /> {activeBranch.name}
              </span>
            )}
          </div>
          <p className="text-sm text-cream/40 mt-0.5">Resumen de cobros y comprobantes</p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['today', 'week', 'month', 'custom'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn('px-3 py-1.5 rounded-lg text-xs transition-all',
                period === p ? 'bg-gold/10 text-gold border border-gold/20' : 'text-cream/40 border border-white/[0.08] hover:text-cream'
              )}>
              {periodLabel[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      {period === 'custom' && (
        <div className="flex items-center gap-3 mb-6 animate-fade-up">
          <input type="date" className="input flex-1" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
          <span className="text-cream/30 text-sm">→</span>
          <input type="date" className="input flex-1" value={customTo} onChange={e => setCustomTo(e.target.value)} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : (
        <>
          {/* Totals grid */}
          {totals && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {METHODS.map(m => (
                <div key={m} className={cn('rounded-2xl border p-4', METHOD_COLORS[m])}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl">{PAYMENT_METHOD_ICONS[m]}</span>
                    <TrendingUp className="w-3.5 h-3.5 opacity-50" />
                  </div>
                  <p className="text-xl font-bold text-cream">{formatPrice(totals[m])}</p>
                  <p className="text-xs opacity-60 mt-0.5">{PAYMENT_METHOD_LABELS[m]}</p>
                </div>
              ))}
            </div>
          )}

          {/* Total banner */}
          {totals && (
            <div className="rounded-2xl border border-gold/20 bg-gold/10 px-5 py-4 flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gold/20 flex items-center justify-center">
                  <DollarSign className="w-4.5 h-4.5 text-gold" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-gold/70">Total recaudado</p>
                  <p className="text-2xl font-bold text-cream mt-0.5">{formatPrice(totals.total)}</p>
                </div>
              </div>
              <p className="text-xs text-cream/40 text-right">{payments.length} cobros<br/>{periodLabel[period].toLowerCase()}</p>
            </div>
          )}

          {/* Payments list */}
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center text-cream/20 mb-4">
                <Calendar className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-cream/50">Sin cobros en este período</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-cream/30 mb-3">Detalle de cobros</p>
              {payments.map(p => (
                <div key={p.id} className="card p-4 flex items-center gap-4 hover:border-white/15 transition-all">
                  <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 text-lg', METHOD_COLORS[p.method])}>
                    {PAYMENT_METHOD_ICONS[p.method as PaymentMethod]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-cream">
                        {p.appointment?.client?.first_name} {p.appointment?.client?.last_name}
                      </p>
                      {p.appointment?.branch && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-cream/40 border border-white/10">
                          {p.appointment.branch.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-cream/40 mt-0.5">
                      {p.appointment?.service?.name} · {p.appointment?.barber?.name}
                    </p>
                    <p className="text-xs text-cream/25 mt-0.5 font-mono">{p.receipt_number}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-cream">{formatPrice(p.amount)}</p>
                    <p className="text-xs text-cream/30 mt-0.5">
                      {format(new Date(p.created_at), 'HH:mm', { locale: es })}
                    </p>
                  </div>
                  <Link
                    href={`/admin/comprobante/${p.id}`}
                    className="p-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-cream/30 hover:text-gold hover:border-gold/20 transition-all flex-shrink-0"
                  >
                    <Receipt className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
