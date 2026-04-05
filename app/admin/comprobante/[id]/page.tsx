'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Scissors, Download, ArrowLeft, CheckCircle, MapPin, Clock } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS, type Payment, type PaymentMethod } from '@/types'
import { Spinner } from '@/components/ui'

interface FullPayment extends Payment {
  appointment: {
    id: string; date: string; start_time: string; end_time: string
    client: { first_name: string; last_name: string; email: string; phone: string }
    barber: { name: string }
    service: { name: string; price: number; duration_minutes: number }
    branch: { name: string; address: string }
  }
}

export default function ComprobantePage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const [payment, setPayment] = useState<FullPayment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    fetch(`/api/payments/${id}`)
      .then(r => r.json())
      .then(d => { setPayment(d.payment); setLoading(false) })
      .catch(() => { setError('No se pudo cargar el comprobante'); setLoading(false) })
  }, [id])

  const handlePrint = () => window.print()

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <Spinner className="w-8 h-8" />
    </div>
  )

  if (error || !payment) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <p className="text-red-400">{error || 'Comprobante no encontrado'}</p>
    </div>
  )

  const appt   = payment.appointment
  const date   = format(new Date(appt.date + 'T12:00:00'), "EEEE d 'de' MMMM yyyy", { locale: es })
  const paid   = format(new Date(payment.created_at), "d/MM/yyyy HH:mm", { locale: es })

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8 px-4 print:bg-white print:p-0 print:py-0">

      {/* Actions — hidden when printing */}
      <div className="print:hidden max-w-md mx-auto mb-4 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-cream/40 hover:text-cream transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gold/30 bg-gold/10 text-gold text-sm hover:bg-gold/15 transition-all"
        >
          <Download className="w-4 h-4" /> Descargar / Imprimir
        </button>
      </div>

      {/* Receipt card */}
      <div
        ref={printRef}
        className="max-w-md mx-auto bg-[#0f0f0f] print:bg-white rounded-[28px] print:rounded-none border border-white/[0.08] print:border-0 overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="px-8 py-8 text-center border-b border-white/[0.06] print:border-gray-200">
          <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-4 print:bg-yellow-50 print:border-yellow-200">
            <Scissors className="w-6 h-6 text-gold print:text-yellow-600" />
          </div>
          <h1 className="font-serif text-2xl text-cream print:text-black">Felito Barber Studio</h1>
          {appt.branch && (
            <p className="flex items-center justify-center gap-1 text-xs text-cream/40 print:text-gray-500 mt-1">
              <MapPin className="w-3 h-3" /> {appt.branch.name}
              {appt.branch.address && ` · ${appt.branch.address}`}
            </p>
          )}
        </div>

        {/* Success badge */}
        <div className="px-8 pt-6 pb-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle className="w-4 h-4 text-emerald-400 print:text-green-600" />
            <span className="text-sm font-medium text-emerald-300 print:text-green-700">
              ¡Pago registrado exitosamente!
            </span>
          </div>
        </div>

        {/* Amount */}
        <div className="px-8 pb-6 text-center">
          <p className="text-5xl font-bold text-cream print:text-black tracking-tight">
            {formatPrice(payment.amount)}
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-2xl">{PAYMENT_METHOD_ICONS[payment.method as PaymentMethod]}</span>
            <span className="text-sm text-cream/60 print:text-gray-600">
              {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod]}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="px-8 pb-6 space-y-0 border-t border-white/[0.06] print:border-gray-200 pt-6">
          {[
            { label: 'Cliente',    value: `${appt.client.first_name} ${appt.client.last_name}` },
            { label: 'Servicio',   value: appt.service.name },
            { label: 'Profesional', value: appt.barber.name },
            { label: 'Fecha',      value: <span className="capitalize">{date}</span> },
            { label: 'Hora',       value: (
              <span className="flex items-center gap-1 justify-end">
                <Clock className="w-3 h-3" />
                {appt.start_time.slice(0,5)} – {appt.end_time.slice(0,5)}
              </span>
            )},
            { label: 'N° Comprobante', value: <span className="font-mono text-gold print:text-yellow-700">{payment.receipt_number}</span> },
            { label: 'Fecha de pago',  value: paid },
          ].map((row, i) => (
            <div key={i} className="flex items-start justify-between py-2.5 border-b border-white/[0.04] print:border-gray-100 last:border-0">
              <span className="text-sm text-cream/40 print:text-gray-500">{row.label}</span>
              <span className="text-sm text-cream print:text-black text-right max-w-[60%]">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 text-center bg-white/[0.02] print:bg-gray-50 border-t border-white/[0.06] print:border-gray-200">
          <p className="text-xs text-cream/25 print:text-gray-400">
            Felito Barber Studio · Montevideo, Uruguay
          </p>
          <p className="text-xs text-cream/15 print:text-gray-300 mt-1">
            Este comprobante es válido como constancia de pago
          </p>
        </div>
      </div>
    </div>
  )
}
