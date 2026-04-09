'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Scissors, Printer, ArrowLeft, CheckCircle, MapPin, Clock, Share2, Download } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS, type Payment, type PaymentMethod } from '@/types'
import { Spinner } from '@/components/ui'

interface FullPayment extends Payment {
  appointment: {
    id: string
    date: string
    start_time: string
    end_time: string
    client: { first_name: string; last_name: string; email: string; phone: string }
    barber: { name: string }
    service: { name: string; price: number; duration_minutes: number }
    branch: { name: string; address: string }
  }
}

export default function ComprobantePage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const [payment, setPayment] = useState<FullPayment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    fetch(`/api/payments/${id}`)
      .then(r => r.json())
      .then(d => { setPayment(d.payment); setLoading(false) })
      .catch(() => { setError('No se pudo cargar el comprobante'); setLoading(false) })
  }, [id])

  async function handleShare() {
    if (!payment) return
    const appt = payment.appointment
    const shareData = {
      title: `Comprobante Felito · ${payment.receipt_number}`,
      text: `Pago de ${formatPrice(payment.amount)} por ${appt.service.name} — ${appt.client.first_name} ${appt.client.last_name}`,
      url: window.location.href,
    }

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        setSharing(true)
        await navigator.share(shareData)
      } catch {
        // User cancelled or not supported
      } finally {
        setSharing(false)
      }
    } else {
      // Fallback: copy URL to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href)
        alert('Enlace copiado al portapapeles')
      } catch {
        alert(window.location.href)
      }
    }
  }

  function handleDownload() {
    window.print()
  }

  if (loading) return (
    <div className="min-h-screen bg-page flex items-center justify-center">
      <Spinner className="w-8 h-8" />
    </div>
  )

  if (error || !payment) return (
    <div className="min-h-screen bg-page flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 font-medium">{error || 'Comprobante no encontrado'}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm text-cream/45 hover:text-cream underline"
        >
          Volver
        </button>
      </div>
    </div>
  )

  const appt = payment.appointment
  const date = format(new Date(appt.date + 'T12:00:00'), "EEEE d 'de' MMMM yyyy", { locale: es })
  const paid = format(new Date(payment.created_at), "d/MM/yyyy HH:mm", { locale: es })

  return (
    <div className="min-h-screen bg-page py-8 px-4 print:bg-white print:p-0 print:py-0">

      {/* Actions — hidden when printing */}
      <div className="print:hidden max-w-md mx-auto mb-5 flex items-center justify-between gap-2">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-cream/45 hover:text-cream transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        <div className="flex items-center gap-2">
          {/* Share button — Web Share API with clipboard fallback */}
          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-white shadow-card text-cream/70 text-sm hover:text-cream hover:shadow-card-hover transition-all font-semibold disabled:opacity-60"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Compartir</span>
          </button>

          {/* Download / print-to-PDF */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-white shadow-card text-cream/70 text-sm hover:text-cream hover:shadow-card-hover transition-all font-semibold"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Descargar</span>
          </button>

          {/* Print */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-white shadow-card text-cream/70 text-sm hover:text-cream hover:shadow-card-hover transition-all font-semibold"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>
      </div>

      {/* Receipt card */}
      <div className="max-w-md mx-auto bg-white print:bg-white rounded-2xl print:rounded-none border border-border print:border-0 overflow-hidden shadow-modal print:shadow-none">

        {/* Header */}
        <div className="px-8 py-7 text-center border-b border-border">
          <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-4">
            <Scissors className="w-6 h-6 text-gold" />
          </div>
          <h1 className="font-serif text-2xl text-cream">Felito Barber Studio</h1>
          {appt.branch && (
            <p className="flex items-center justify-center gap-1 text-xs text-cream/40 mt-1.5 font-medium">
              <MapPin className="w-3 h-3" />
              {appt.branch.name}
              {appt.branch.address && ` · ${appt.branch.address}`}
            </p>
          )}
        </div>

        {/* Success badge */}
        <div className="px-8 pt-6 pb-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-700">
              Pago registrado exitosamente
            </span>
          </div>
        </div>

        {/* Amount */}
        <div className="px-8 pb-6 text-center">
          <p className="text-5xl font-bold text-cream tracking-tight">
            {formatPrice(payment.amount)}
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-2xl">{PAYMENT_METHOD_ICONS[payment.method as PaymentMethod]}</span>
            <span className="text-sm text-cream/55 font-semibold">
              {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod]}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="px-8 pb-6 pt-5 border-t border-border space-y-0">
          {[
            { label: 'Cliente',        value: `${appt.client.first_name} ${appt.client.last_name}` },
            { label: 'Servicio',       value: appt.service.name },
            { label: 'Profesional',    value: appt.barber.name },
            { label: 'Fecha',          value: <span className="capitalize">{date}</span> },
            { label: 'Hora',           value: (
              <span className="flex items-center gap-1 justify-end">
                <Clock className="w-3 h-3" />
                {appt.start_time.slice(0,5)} – {appt.end_time.slice(0,5)}
              </span>
            )},
            { label: 'N° Comprobante', value: <span className="font-mono font-bold text-gold-dark">{payment.receipt_number}</span> },
            { label: 'Fecha de pago',  value: paid },
          ].map((row, i) => (
            <div
              key={i}
              className="flex items-start justify-between py-3 border-b border-surface-2 last:border-0"
            >
              <span className="text-sm text-cream/40 font-medium">{row.label}</span>
              <span className="text-sm text-cream font-semibold text-right max-w-[60%]">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 text-center bg-surface-2 border-t border-border">
          <p className="text-xs text-cream/35 font-medium">
            Felito Barber Studio · Montevideo, Uruguay
          </p>
          <p className="text-xs text-cream/25 mt-1">
            Este comprobante es válido como constancia de pago
          </p>
        </div>
      </div>
    </div>
  )
}
