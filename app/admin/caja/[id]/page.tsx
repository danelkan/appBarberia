'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Copy,
  Mail,
  Printer,
  Receipt,
  Share2,
} from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
import { formatDate, formatPrice } from '@/lib/utils'
import type { CashRegister } from '@/types'

export default function CashReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [register, setRegister] = useState<CashRegister | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [currentUrl, setCurrentUrl] = useState('')

  useEffect(() => {
    setCurrentUrl(window.location.href)
    fetch(`/api/cash-registers/${id}`, { cache: 'no-store' })
      .then(response => response.json())
      .then(data => setRegister(data.cash_register ?? null))
      .finally(() => setLoading(false))
  }, [id])

  async function copyLink() {
    await navigator.clipboard.writeText(currentUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  async function shareLink() {
    if (navigator.share) {
      await navigator.share({
        title: `Cierre de caja ${register?.branch?.name ?? ''}`,
        text: 'Comprobante de caja diaria',
        url: currentUrl,
      })
    } else {
      await copyLink()
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!register) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">No encontramos esa caja.</p>
      </div>
    )
  }

  const summary = register.summary

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Descargar PDF
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Receipt className="h-4 w-4" />
              Imprimir
            </Button>
            <Button variant="outline" onClick={copyLink}>
              <Copy className="h-4 w-4" />
              {copied ? 'Link copiado' : 'Copiar link'}
            </Button>
            <a
              href={`mailto:?subject=${encodeURIComponent(`Cierre de caja ${register.branch?.name ?? ''}`)}&body=${encodeURIComponent(currentUrl)}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Mail className="h-4 w-4" />
              Enviar por mail
            </a>
            <Button variant="outline" onClick={shareLink}>
              <Share2 className="h-4 w-4" />
              Compartir
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="border-b border-slate-200 px-8 py-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Comprobante de caja diaria</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">{register.company?.name ?? 'Empresa'}</h1>
            <p className="mt-2 text-sm text-slate-500">{register.branch?.name} · {formatDate(register.opened_at)}</p>
          </div>

          <div className="grid gap-4 border-b border-slate-200 px-8 py-6 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="Usuario apertura" value={register.opened_by_user?.name ?? register.opened_by_user?.email ?? '-'} />
            <InfoCard label="Usuario cierre" value={register.closed_by_user?.name ?? register.closed_by_user?.email ?? '-'} />
            <InfoCard label="Monto inicial" value={formatPrice(Number(register.opening_amount))} />
            <InfoCard label="Diferencia" value={formatPrice(Number(register.difference_amount ?? 0))} />
          </div>

          <div className="grid gap-4 border-b border-slate-200 px-8 py-6 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="Ingresos efectivo" value={formatPrice(summary?.cash_income_total ?? 0)} />
            <InfoCard label="Egresos efectivo" value={formatPrice(summary?.cash_expense_total ?? 0)} />
            <InfoCard label="Ajustes efectivo" value={formatPrice(summary?.cash_adjustment_total ?? 0)} />
            <InfoCard label="Otros medios" value={formatPrice(summary?.other_payment_total ?? 0)} />
            <InfoCard label="Monto esperado" value={formatPrice(Number(register.expected_cash_amount ?? summary?.expected_cash_amount ?? 0))} />
            <InfoCard label="Monto contado" value={formatPrice(Number(register.counted_cash_amount ?? 0))} />
            <InfoCard label="Apertura" value={formatDate(register.opened_at)} />
            <InfoCard label="Cierre" value={register.closed_at ? formatDate(register.closed_at) : '-'} />
          </div>

          <div className="grid gap-6 px-8 py-6 xl:grid-cols-[1.3fr_0.7fr]">
            <div>
              <p className="text-sm font-semibold text-slate-950">Detalle de movimientos</p>
              <div className="mt-4 space-y-3">
                {(register.movements ?? []).length === 0 ? (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Esta caja no tiene movimientos registrados.
                  </div>
                ) : (register.movements ?? []).map(movement => (
                  <div key={movement.id} className="rounded-[24px] border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{movement.description}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {movement.type} · {movement.payment_method} · {movement.created_by_user?.name ?? movement.created_by_user?.email ?? 'Sistema'}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-950">{formatPrice(Number(movement.amount))}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Observación apertura</p>
                <p className="mt-2 text-sm text-slate-700">{register.opening_notes || 'Sin observaciones'}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Observación cierre</p>
                <p className="mt-2 text-sm text-slate-700">{register.closing_notes || 'Sin observaciones'}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Auditoría</p>
                <div className="mt-3 space-y-2">
                  {(register.audit_logs ?? []).slice(0, 8).map(log => (
                    <div key={log.id} className="text-sm text-slate-700">
                      <p className="font-medium">{log.action}</p>
                      <p className="text-xs text-slate-500">
                        {log.performed_by_user?.name ?? log.performed_by_user?.email ?? 'Sistema'} · {formatDate(log.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 print:hidden">
          <Link href="/admin/caja" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" />
            Volver a caja diaria
          </Link>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  )
}
