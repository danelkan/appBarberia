'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  DollarSign, TrendingUp, MapPin, Receipt, Calendar,
  Plus, X, CheckCircle, Search,
} from 'lucide-react'
import { Button, Spinner, EmptyState, Modal } from '@/components/ui'
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
    date: string
    start_time: string
    client: { first_name: string; last_name: string }
    barber: { name: string }
    service: { name: string }
    branch: { name: string }
  }
}

interface Totals {
  efectivo: number
  mercado_pago: number
  debito: number
  transferencia: number
  total: number
}

interface PendingAppt {
  id: string
  date: string
  start_time: string
  client: { first_name: string; last_name: string }
  service: { name: string; price: number }
  barber: { name: string }
  branch?: { name: string }
}

const METHODS: PaymentMethod[] = ['efectivo', 'mercado_pago', 'debito', 'transferencia']

const METHOD_COLORS: Record<PaymentMethod, string> = {
  efectivo:      'text-emerald-700 bg-emerald-50 border-emerald-200',
  mercado_pago:  'text-blue-700 bg-blue-50 border-blue-200',
  debito:        'text-purple-700 bg-purple-50 border-purple-200',
  transferencia: 'text-orange-700 bg-orange-50 border-orange-200',
}

const METHOD_ACTIVE: Record<PaymentMethod, string> = {
  efectivo:      'text-emerald-700 bg-emerald-100 border-emerald-400 ring-2 ring-emerald-200',
  mercado_pago:  'text-blue-700 bg-blue-100 border-blue-400 ring-2 ring-blue-200',
  debito:        'text-purple-700 bg-purple-100 border-purple-400 ring-2 ring-purple-200',
  transferencia: 'text-orange-700 bg-orange-100 border-orange-400 ring-2 ring-orange-200',
}

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoy', week: 'Esta semana', month: 'Este mes', custom: 'Personalizado',
}

export default function CajaPage() {
  const { activeBranch } = useAdmin()
  const [period, setPeriod]         = useState<Period>('today')
  const [customFrom, setCustomFrom] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [customTo, setCustomTo]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [payments, setPayments]     = useState<PaymentRow[]>([])
  const [totals, setTotals]         = useState<Totals | null>(null)
  const [loading, setLoading]       = useState(true)

  // New payment modal
  const [showNew, setShowNew]             = useState(false)
  const [pendingAppts, setPendingAppts]   = useState<PendingAppt[]>([])
  const [loadingAppts, setLoadingAppts]   = useState(false)
  const [apptSearch, setApptSearch]       = useState('')
  const [selectedAppt, setSelectedAppt]   = useState<PendingAppt | null>(null)
  const [newAmount, setNewAmount]         = useState('')
  const [newMethod, setNewMethod]         = useState<PaymentMethod | null>(null)
  const [paying, setPaying]               = useState(false)
  const [payError, setPayError]           = useState('')
  const [newPaidId, setNewPaidId]         = useState<string | null>(null)

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
    try {
      const res  = await fetch(url)
      const data = await res.json()
      setPayments(data.payments ?? [])
      setTotals(data.totals ?? null)
    } catch {
      setPayments([])
    } finally {
      setLoading(false)
    }
  }, [getDateRange, activeBranch])

  useEffect(() => { fetchData() }, [fetchData])

  const openNewPayment = async () => {
    setShowNew(true)
    setSelectedAppt(null)
    setNewAmount('')
    setNewMethod(null)
    setPayError('')
    setNewPaidId(null)
    setApptSearch('')
    setLoadingAppts(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const from30  = format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
      let url = `/api/appointments?from=${from30}&to=${today}&status=pendiente`
      if (activeBranch) url += `&branch_id=${activeBranch.id}`
      const res  = await fetch(url)
      const data = await res.json()
      // Filter to only pending, unpaid appointments
      const pending = (data.appointments ?? []).filter(
        (a: any) => a.status === 'pendiente' && !a.payment
      )
      setPendingAppts(pending)
    } catch {
      setPendingAppts([])
    } finally {
      setLoadingAppts(false)
    }
  }

  const handleSelectAppt = (appt: PendingAppt) => {
    setSelectedAppt(appt)
    setNewAmount(String(appt.service?.price ?? ''))
    setPayError('')
  }

  const handlePay = async () => {
    if (!selectedAppt || !newMethod || !newAmount) {
      setPayError('Completá todos los campos')
      return
    }
    const amount = Number(newAmount)
    if (isNaN(amount) || amount <= 0) {
      setPayError('Ingresá un monto válido')
      return
    }
    setPaying(true)
    setPayError('')
    try {
      const res  = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: selectedAppt.id, amount, method: newMethod }),
      })
      const data = await res.json()
      if (!res.ok) { setPayError(data.error || 'Error al registrar el pago'); return }
      setNewPaidId(data.payment.id)
      fetchData()
    } catch {
      setPayError('Error de conexión. Intentá de nuevo.')
    } finally {
      setPaying(false)
    }
  }

  const closeNew = () => {
    setShowNew(false)
    setSelectedAppt(null)
    setNewAmount('')
    setNewMethod(null)
    setPayError('')
    setPaying(false)
    setNewPaidId(null)
  }

  const filteredAppts = pendingAppts.filter(a => {
    if (!apptSearch) return true
    const q = apptSearch.toLowerCase()
    return (
      a.client.first_name.toLowerCase().includes(q) ||
      a.client.last_name.toLowerCase().includes(q) ||
      a.service.name.toLowerCase().includes(q) ||
      a.barber.name.toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-2xl text-cream">Caja</h1>
            {activeBranch && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-surface-2 text-cream/55 border border-border font-medium">
                <MapPin className="w-2.5 h-2.5" /> {activeBranch.name}
              </span>
            )}
          </div>
          <p className="text-sm text-cream/45 mt-0.5">Resumen de cobros y comprobantes</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex items-center gap-1 flex-wrap">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border',
                  period === p
                    ? 'bg-gold/10 text-gold-dark border-gold/25'
                    : 'text-cream/45 border-border bg-white hover:text-cream hover:bg-surface-2'
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <Button size="sm" onClick={openNewPayment}>
            <Plus className="w-4 h-4" /> Registrar cobro
          </Button>
        </div>
      </div>

      {/* Custom date range */}
      {period === 'custom' && (
        <div className="flex items-center gap-3 mb-6 animate-fade-up">
          <input
            type="date"
            className="input flex-1"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
          />
          <span className="text-cream/30 text-sm font-bold">→</span>
          <input
            type="date"
            className="input flex-1"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : (
        <>
          {/* Totals grid */}
          {totals && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {METHODS.map(m => (
                <div key={m} className={cn('rounded-2xl border p-4 shadow-card', METHOD_COLORS[m])}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{PAYMENT_METHOD_ICONS[m]}</span>
                    <TrendingUp className="w-3.5 h-3.5 opacity-40" />
                  </div>
                  <p className="text-xl font-bold text-cream">{formatPrice(totals[m])}</p>
                  <p className="text-xs font-medium opacity-60 mt-0.5">{PAYMENT_METHOD_LABELS[m]}</p>
                </div>
              ))}
            </div>
          )}

          {/* Total banner */}
          {totals && (
            <div className="rounded-2xl border border-gold/25 bg-gradient-to-r from-gold/8 to-gold/5 px-5 py-4 flex items-center justify-between mb-6 shadow-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/25 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-gold-dark/80 font-semibold">Total recaudado</p>
                  <p className="text-2xl font-bold text-cream mt-0.5">{formatPrice(totals.total)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-cream/80">{payments.length}</p>
                <p className="text-xs text-cream/40 font-medium">cobros · {PERIOD_LABELS[period].toLowerCase()}</p>
              </div>
            </div>
          )}

          {/* Payments list */}
          {payments.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-6 h-6" />}
              title="Sin cobros en este período"
              description="Los cobros registrados aparecerán aquí"
              action={
                <Button size="sm" onClick={openNewPayment}>
                  <Plus className="w-4 h-4" /> Registrar cobro
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-cream/35 font-semibold mb-3">
                Detalle de cobros
              </p>
              {payments.map(p => (
                <div
                  key={p.id}
                  className="card p-4 flex items-center gap-4 hover:shadow-card-hover transition-all"
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 text-lg shadow-sm',
                    METHOD_COLORS[p.method]
                  )}>
                    {PAYMENT_METHOD_ICONS[p.method]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-cream">
                        {p.appointment?.client?.first_name} {p.appointment?.client?.last_name}
                      </p>
                      {p.appointment?.branch && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-2 text-cream/45 border border-border font-medium">
                          {p.appointment.branch.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-cream/45 mt-0.5 font-medium">
                      {p.appointment?.service?.name} · {p.appointment?.barber?.name}
                    </p>
                    <p className="text-xs text-cream/30 mt-0.5 font-mono">{p.receipt_number}</p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-cream">{formatPrice(p.amount)}</p>
                    <p className="text-xs text-cream/35 mt-0.5 font-medium">
                      {format(new Date(p.created_at), 'HH:mm', { locale: es })}
                    </p>
                  </div>

                  <Link
                    href={`/admin/comprobante/${p.id}`}
                    className="p-2 rounded-xl border border-border bg-surface-2 text-cream/35 hover:text-gold hover:border-gold/30 transition-all flex-shrink-0"
                    title="Ver comprobante"
                  >
                    <Receipt className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── New payment modal ──────────────────────── */}
      <Modal
        open={showNew}
        onClose={closeNew}
        title={newPaidId ? '¡Pago registrado!' : 'Registrar cobro'}
        size="md"
      >
        {newPaidId ? (
          <div className="space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <p className="text-cream font-bold text-2xl">{formatPrice(Number(newAmount))}</p>
              <p className="text-cream/50 text-sm mt-1 font-medium">
                {newMethod && PAYMENT_METHOD_ICONS[newMethod]} {newMethod && PAYMENT_METHOD_LABELS[newMethod]}
              </p>
              {selectedAppt && (
                <p className="text-cream/40 text-xs mt-1">
                  {selectedAppt.client.first_name} {selectedAppt.client.last_name} · {selectedAppt.service.name}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href={`/admin/comprobante/${newPaidId}`}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-gold/25 bg-gold/10 text-gold-dark text-sm hover:bg-gold/15 transition-all font-semibold"
              >
                <Receipt className="w-4 h-4" /> Ver comprobante
              </Link>
              <Button variant="outline" className="w-full" onClick={closeNew}>
                Cerrar
              </Button>
            </div>
          </div>
        ) : !selectedAppt ? (
          /* Step 1: Select appointment */
          <div className="space-y-4">
            <p className="text-sm text-cream/55 font-medium">
              Seleccioná el turno pendiente a cobrar:
            </p>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/35" />
              <input
                className="input pl-9"
                placeholder="Buscar por cliente, servicio..."
                value={apptSearch}
                onChange={e => setApptSearch(e.target.value)}
              />
            </div>

            {loadingAppts ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : filteredAppts.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-8 h-8 text-cream/20 mx-auto mb-2" />
                <p className="text-sm text-cream/45 font-medium">
                  {apptSearch ? 'Sin resultados' : 'No hay turnos pendientes de cobro'}
                </p>
                {!apptSearch && (
                  <p className="text-xs text-cream/30 mt-1">
                    Los turnos pendientes de pago aparecerán aquí
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {filteredAppts.map(a => (
                  <button
                    key={a.id}
                    onClick={() => handleSelectAppt(a)}
                    className="w-full text-left p-3.5 rounded-xl border border-border bg-surface-2 hover:border-gold/30 hover:bg-gold/5 transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-cream">
                          {a.client.first_name} {a.client.last_name}
                        </p>
                        <p className="text-xs text-cream/50 mt-0.5 font-medium">
                          {a.service.name} · {a.barber.name}
                        </p>
                        <p className="text-xs text-cream/35 mt-0.5">
                          {format(new Date(a.date + 'T12:00:00'), "d MMM", { locale: es })} · {a.start_time.slice(0,5)}
                          {a.branch && ` · ${a.branch.name}`}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-gold-dark flex-shrink-0">
                        {formatPrice(a.service.price)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Step 2: Enter payment details */
          <div className="space-y-5">
            {/* Selected appointment */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-2 border border-border">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-cream">
                  {selectedAppt.client.first_name} {selectedAppt.client.last_name}
                </p>
                <p className="text-xs text-cream/50 mt-0.5 font-medium">
                  {selectedAppt.service.name} · {selectedAppt.start_time.slice(0,5)}
                </p>
              </div>
              <button
                onClick={() => { setSelectedAppt(null); setNewAmount('') }}
                className="p-1.5 rounded-lg hover:bg-surface-3 text-cream/30 hover:text-cream transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Amount */}
            <div>
              <label className="label">Monto cobrado (UYU)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cream/40 text-sm font-medium">$</span>
                <input
                  type="number"
                  className="input pl-8"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="1"
                />
              </div>
            </div>

            {/* Method */}
            <div>
              <label className="label">Método de cobro</label>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map(m => (
                  <button
                    key={m}
                    onClick={() => setNewMethod(m)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3.5 rounded-xl border text-sm transition-all duration-150 font-medium',
                      newMethod === m ? METHOD_ACTIVE[m] : METHOD_COLORS[m] + ' hover:opacity-80'
                    )}
                  >
                    <span className="text-xl">{PAYMENT_METHOD_ICONS[m]}</span>
                    <span className="text-xs text-center leading-tight text-cream/70">{PAYMENT_METHOD_LABELS[m]}</span>
                  </button>
                ))}
              </div>
            </div>

            {payError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 font-medium">
                <X className="w-4 h-4 flex-shrink-0" />
                {payError}
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              loading={paying}
              onClick={handlePay}
              disabled={!newMethod || !newAmount || paying}
            >
              <DollarSign className="w-4 h-4" />
              Confirmar cobro {newAmount && Number(newAmount) > 0 ? `· ${formatPrice(Number(newAmount))}` : ''}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
