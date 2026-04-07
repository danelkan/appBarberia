'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Calendar, DollarSign, Plus, Receipt, Search, TrendingUp } from 'lucide-react'
import { Button, EmptyState, Modal, PageHeader, Spinner } from '@/components/ui'
import { formatPrice } from '@/lib/utils'
import { useAdmin } from '../layout'
import { PAYMENT_METHOD_LABELS, type PaymentMethod, type PaymentTotals } from '@/types'

type Period = 'today' | 'week' | 'month' | 'year' | 'custom'

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
    branch?: { name: string }
  }
}

interface PendingAppointment {
  id: string
  date: string
  start_time: string
  client: { first_name: string; last_name: string }
  service: { name: string; price: number }
  barber: { name: string }
  branch?: { name: string }
}

const EMPTY_TOTALS: PaymentTotals = { efectivo: 0, mercado_pago: 0, debito: 0, transferencia: 0, total: 0 }
const PERIODS: Period[] = ['today', 'week', 'month', 'year', 'custom']
const METHODS: PaymentMethod[] = ['efectivo', 'mercado_pago', 'debito', 'transferencia']

export default function CajaPage() {
  const { activeBranch, can } = useAdmin()
  const [period, setPeriod] = useState<Period>('today')
  const [customFrom, setCustomFrom] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [totals, setTotals] = useState<PaymentTotals>(EMPTY_TOTALS)
  const [summary, setSummary] = useState<Record<string, { total: number; count: number }> | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingAppointments, setPendingAppointments] = useState<PendingAppointment[]>([])
  const [appointmentSearch, setAppointmentSearch] = useState('')
  const [selectedAppointment, setSelectedAppointment] = useState<PendingAppointment | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('efectivo')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [paidId, setPaidId] = useState<string | null>(null)

  const getDateRange = useCallback(() => {
    const now = new Date()
    const toString = (date: Date, end = false) => `${format(date, 'yyyy-MM-dd')}T${end ? '23:59:59' : '00:00:00'}`

    if (period === 'today') return [toString(now), toString(now, true)]
    if (period === 'week') {
      const start = new Date(now)
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      return [toString(start), toString(end, true)]
    }
    if (period === 'month') {
      return [toString(new Date(now.getFullYear(), now.getMonth(), 1)), toString(new Date(now.getFullYear(), now.getMonth() + 1, 0), true)]
    }
    if (period === 'year') {
      return [`${now.getFullYear()}-01-01T00:00:00`, `${now.getFullYear()}-12-31T23:59:59`]
    }
    return [`${customFrom}T00:00:00`, `${customTo}T23:59:59`]
  }, [customFrom, customTo, period])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [from, to] = getDateRange()
    let paymentsUrl = `/api/payments?date_from=${from}&date_to=${to}`
    let summaryUrl = '/api/payments/summary'

    if (activeBranch) {
      paymentsUrl += `&branch_id=${activeBranch.id}`
      summaryUrl += `?branch_id=${activeBranch.id}`
    }

    try {
      const [paymentsRes, summaryRes] = await Promise.all([
        fetch(paymentsUrl, { cache: 'no-store' }),
        fetch(summaryUrl, { cache: 'no-store' }),
      ])
      const [paymentsData, summaryData] = await Promise.all([paymentsRes.json(), summaryRes.json()])
      setPayments(paymentsData.payments ?? [])
      setTotals(paymentsData.totals ?? EMPTY_TOTALS)
      setSummary(summaryData.summary ?? null)
    } finally {
      setLoading(false)
    }
  }, [activeBranch, getDateRange])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  async function openNewPayment() {
    setModalOpen(true)
    setSelectedAppointment(null)
    setAmount('')
    setMethod('efectivo')
    setAppointmentSearch('')
    setError('')
    setPaidId(null)

    const today = format(new Date(), 'yyyy-MM-dd')
    const fromDate = format(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), 'yyyy-MM-dd')
    let url = `/api/appointments?from=${fromDate}&to=${today}`
    if (activeBranch) url += `&branch_id=${activeBranch.id}`

    const response = await fetch(url, { cache: 'no-store' })
    const data = await response.json()
    setPendingAppointments((data.appointments ?? []).filter((appointment: PaymentRow & { payment?: unknown; status: string }) => appointment.status !== 'cancelada' && !appointment.payment))
  }

  async function submitPayment() {
    if (!selectedAppointment) return
    setSaving(true)
    setError('')

    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointment_id: selectedAppointment.id,
        amount: Number(amount),
        method,
      }),
    })
    const data = await response.json()
    setSaving(false)

    if (!response.ok) {
      setError(data.error ?? 'No se pudo registrar el cobro')
      return
    }

    setPaidId(data.payment?.id ?? null)
    await fetchData()
  }

  const filteredAppointments = useMemo(() => {
    if (!appointmentSearch) return pendingAppointments
    const query = appointmentSearch.toLowerCase()
    return pendingAppointments.filter(appointment =>
      `${appointment.client.first_name} ${appointment.client.last_name}`.toLowerCase().includes(query) ||
      appointment.service.name.toLowerCase().includes(query) ||
      appointment.barber.name.toLowerCase().includes(query)
    )
  }, [appointmentSearch, pendingAppointments])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Caja"
        subtitle={`Controlá cobros, comprobantes y recaudación por período.${activeBranch ? ` Sucursal activa: ${activeBranch.name}.` : ''}`}
        action={can('edit_caja') ? (
          <Button onClick={openNewPayment}>
            <Plus className="h-4 w-4" />
            Registrar cobro
          </Button>
        ) : undefined}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {PERIODS.map(item => (
          <button
            key={item}
            onClick={() => setPeriod(item)}
            className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${period === item ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}
          >
            {item === 'today' ? 'Hoy' : item === 'week' ? 'Semana' : item === 'month' ? 'Mes' : item === 'year' ? 'Año' : 'Rango'}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <input type="date" value={customFrom} onChange={event => setCustomFrom(event.target.value)} className="input" />
          <input type="date" value={customTo} onChange={event => setCustomTo(event.target.value)} className="input" />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <>
          {summary && (
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { key: 'today', label: 'Hoy' },
                { key: 'week', label: 'Semana' },
                { key: 'month', label: 'Mes' },
                { key: 'year', label: 'Año' },
              ].map(card => (
                <div key={card.key} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{card.label}</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-950">{formatPrice(summary[card.key]?.total ?? 0)}</p>
                  <p className="mt-1 text-sm text-slate-500">{summary[card.key]?.count ?? 0} cobros</p>
                </div>
              ))}
            </div>
          )}

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {METHODS.map(paymentMethod => (
              <div key={paymentMethod} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-950">{PAYMENT_METHOD_LABELS[paymentMethod]}</p>
                <p className="mt-3 text-xl font-semibold text-slate-950">{formatPrice(totals[paymentMethod])}</p>
              </div>
            ))}
            <div className="rounded-[28px] border border-slate-950 bg-slate-950 p-5 text-white shadow-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                <p className="text-sm font-semibold">Total</p>
              </div>
              <p className="mt-3 text-2xl font-semibold">{formatPrice(totals.total)}</p>
              <p className="mt-1 text-sm text-slate-300">{payments.length} cobros</p>
            </div>
          </div>

          {payments.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-6 w-6" />}
              title="No hay cobros en este período"
              description="Los cobros registrados aparecen acá con acceso directo a cada comprobante."
              action={can('edit_caja') ? <Button onClick={openNewPayment}>Registrar cobro</Button> : undefined}
            />
          ) : (
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-[1.6fr_0.9fr_0.8fr_0.8fr] gap-4 border-b border-slate-200 px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                <p>Detalle</p>
                <p>Método</p>
                <p>Monto</p>
                <p className="text-right">Comprobante</p>
              </div>
              <div className="divide-y divide-slate-200">
                {payments.map(payment => (
                  <div key={payment.id} className="grid grid-cols-[1.6fr_0.9fr_0.8fr_0.8fr] gap-4 px-6 py-5">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {payment.appointment.client.first_name} {payment.appointment.client.last_name}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {payment.appointment.service.name} · {payment.appointment.barber.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {payment.appointment.branch?.name ? `${payment.appointment.branch.name} · ` : ''}
                        {payment.appointment.date} · {payment.appointment.start_time.slice(0, 5)}
                      </p>
                    </div>
                    <div className="text-sm text-slate-600">{PAYMENT_METHOD_LABELS[payment.method]}</div>
                    <div className="text-sm font-semibold text-slate-950">{formatPrice(payment.amount)}</div>
                    <div className="text-right">
                      <Link href={`/admin/comprobante/${payment.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-slate-950">
                        <Receipt className="h-4 w-4" />
                        Ver
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={paidId ? 'Cobro registrado' : 'Registrar cobro'} size="lg">
        {paidId ? (
          <div className="space-y-4 text-center">
            <p className="text-3xl font-semibold text-slate-950">{formatPrice(Number(amount || 0))}</p>
            <Link href={`/admin/comprobante/${paidId}`} className="btn-gold w-full">
              <Receipt className="h-4 w-4" />
              Abrir comprobante
            </Link>
            <Button variant="outline" className="w-full" onClick={() => setModalOpen(false)}>
              Cerrar
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="label">Buscar turno pendiente</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={appointmentSearch}
                  onChange={event => setAppointmentSearch(event.target.value)}
                  className="input pl-10"
                  placeholder="Cliente, servicio o barbero"
                />
              </div>
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto">
              {filteredAppointments.map(appointment => (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => {
                    setSelectedAppointment(appointment)
                    setAmount(String(appointment.service.price))
                  }}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${selectedAppointment?.id === appointment.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  <p className="text-sm font-semibold">
                    {appointment.client.first_name} {appointment.client.last_name}
                  </p>
                  <p className={`mt-1 text-sm ${selectedAppointment?.id === appointment.id ? 'text-slate-300' : 'text-slate-500'}`}>
                    {appointment.service.name} · {appointment.barber.name} · {appointment.start_time.slice(0, 5)}
                  </p>
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Monto</label>
                <input type="number" value={amount} onChange={event => setAmount(event.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Método</label>
                <select value={method} onChange={event => setMethod(event.target.value as PaymentMethod)} className="input">
                  {METHODS.map(item => (
                    <option key={item} value={item}>
                      {PAYMENT_METHOD_LABELS[item]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={submitPayment} loading={saving} disabled={!selectedAppointment}>
                Confirmar cobro
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
