'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Calculator,
  DollarSign,
  FileText,
  Lock,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { Button, EmptyState, Input, Modal, PageHeader, Spinner } from '@/components/ui'
import { formatDate, formatPrice } from '@/lib/utils'
import { useAdmin } from '../layout'
import type {
  CashMovement,
  CashMovementPaymentMethod,
  CashMovementType,
  CashRegister,
} from '@/types'

const MOVEMENT_TYPE_OPTIONS: { value: CashMovementType; label: string }[] = [
  { value: 'income_service', label: 'Ingreso servicio' },
  { value: 'income_product', label: 'Ingreso producto' },
  { value: 'income_extra',   label: 'Ingreso extra' },
  { value: 'expense',        label: 'Egreso' },
  { value: 'adjustment',     label: 'Ajuste' },
]

const MOVEMENT_METHOD_OPTIONS: { value: CashMovementPaymentMethod; label: string }[] = [
  { value: 'cash',     label: 'Efectivo' },
  { value: 'card',     label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'other',    label: 'Otro' },
]

export default function CajaPage() {
  const { activeBranch, branches: allowedBranches, can } = useAdmin()

  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [activeRegisterDetails, setActiveRegisterDetails] = useState<CashRegister | null>(null)
  const [loading, setLoading] = useState(true)
  // Admin layout only renders children after bootstrap, so activeBranch is already
  // set on first render — initialize directly to avoid a wasted first fetch.
  const [branchFilter, setBranchFilter] = useState(activeBranch?.id ?? '')
  const [statusFilter, setStatusFilter] = useState<'' | 'open' | 'closed'>('')

  const [openModal,     setOpenModal]     = useState(false)
  const [movementModal, setMovementModal] = useState(false)
  const [closeModal,    setCloseModal]    = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')

  const [openForm, setOpenForm] = useState({ branch_id: activeBranch?.id ?? '', opening_amount: '0', opening_notes: '' })
  const [movementForm, setMovementForm] = useState({
    type: 'income_extra' as CashMovementType,
    payment_method: 'cash' as CashMovementPaymentMethod,
    amount: '',
    description: '',
  })
  const [closeForm, setCloseForm] = useState({ counted_cash_amount: '', closing_notes: '' })

  const loadRegisters = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (branchFilter) params.set('branch_id', branchFilter)
    if (statusFilter) params.set('status', statusFilter)

    const res = await fetch(`/api/cash-registers?${params.toString()}`, { cache: 'no-store' })
    const data = await res.json()
    setRegisters(data.cash_registers ?? [])
    setLoading(false)
  }, [branchFilter, statusFilter])

  useEffect(() => {
    void loadRegisters()
  }, [loadRegisters])

  const currentOpenRegister = useMemo(() => {
    if (branchFilter) {
      return registers.find(r => r.status === 'open' && r.branch_id === branchFilter) ?? null
    }
    return registers.find(r => r.status === 'open') ?? null
  }, [branchFilter, registers])

  useEffect(() => {
    if (!currentOpenRegister) { setActiveRegisterDetails(null); return }
    let cancelled = false
    fetch(`/api/cash-registers/${currentOpenRegister.id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => { if (!cancelled) setActiveRegisterDetails(data.cash_register ?? null) })
      .catch(() => { if (!cancelled) setActiveRegisterDetails(null) })
    return () => { cancelled = true }
  }, [currentOpenRegister])

  async function handleOpenRegister() {
    setSaving(true); setError('')
    const res = await fetch('/api/cash-registers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: openForm.branch_id,
        opening_amount: Number(openForm.opening_amount),
        opening_notes: openForm.opening_notes || null,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'No se pudo abrir la caja'); return }
    setOpenModal(false)
    await loadRegisters()
  }

  async function handleAddMovement() {
    if (!currentOpenRegister) return
    setSaving(true); setError('')
    const res = await fetch(`/api/cash-registers/${currentOpenRegister.id}/movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...movementForm,
        amount: Number(movementForm.amount),
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'No se pudo agregar el movimiento'); return }
    setMovementModal(false)
    setMovementForm({ type: 'income_extra', payment_method: 'cash', amount: '', description: '' })
    await loadRegisters()
  }

  async function handleCloseRegister() {
    if (!currentOpenRegister) return
    setSaving(true); setError('')
    const res = await fetch(`/api/cash-registers/${currentOpenRegister.id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        counted_cash_amount: Number(closeForm.counted_cash_amount),
        closing_notes: closeForm.closing_notes || null,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'No se pudo cerrar la caja'); return }
    setCloseModal(false)
    await loadRegisters()
  }

  async function handleReopenRegister(registerId: string) {
    await fetch(`/api/cash-registers/${registerId}/reopen`, { method: 'POST' })
    await loadRegisters()
  }

  const liveRegister  = activeRegisterDetails ?? currentOpenRegister
  const movementRows  = liveRegister?.movements ?? []

  const expectedCash  = liveRegister?.summary?.expected_cash_amount ?? currentOpenRegister?.summary?.expected_cash_amount ?? 0
  const cashIncome    = liveRegister?.summary?.cash_income_total    ?? currentOpenRegister?.summary?.cash_income_total    ?? 0
  const cashExpense   = liveRegister?.summary?.cash_expense_total   ?? currentOpenRegister?.summary?.cash_expense_total   ?? 0
  const otherPayments = liveRegister?.summary?.other_payment_total  ?? currentOpenRegister?.summary?.other_payment_total  ?? 0
  const openingAmount = Number(liveRegister?.opening_amount ?? currentOpenRegister?.opening_amount ?? 0)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Caja"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadRegisters()}>
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
            {can('cash.open') && (
              <Button size="sm" onClick={() => {
                setError('')
                setOpenForm(f => ({ ...f, branch_id: branchFilter || activeBranch?.id || allowedBranches[0]?.id || '' }))
                setOpenModal(true)
              }}>
                <Plus className="h-4 w-4" />
                Abrir caja
              </Button>
            )}
          </div>
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={branchFilter}
          onChange={e => setBranchFilter(e.target.value)}
          className="input w-auto min-w-[160px]"
        >
          <option value="">Todas las sucursales</option>
          {allowedBranches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as '' | 'open' | 'closed')}
          className="input w-auto min-w-[140px]"
        >
          <option value="">Todos los estados</option>
          <option value="open">Abierta</option>
          <option value="closed">Cerrada</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : (
        <div className="space-y-6">
          {/* Open register */}
          {currentOpenRegister ? (
            <section className="rounded-[32px] border border-slate-950 bg-slate-950 p-5 sm:p-6 text-white shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Caja abierta</p>
                  <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
                    {liveRegister?.branch?.name ?? currentOpenRegister.branch?.name ?? 'Sucursal'}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-300">
                    Abierta por{' '}
                    {liveRegister?.opened_by_user?.name ?? liveRegister?.opened_by_user?.email ?? currentOpenRegister.opened_by_user?.name ?? 'usuario'}{' '}
                    · {formatDate(liveRegister?.opened_at ?? currentOpenRegister.opened_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {can('cash.add_movement') && (
                    <Button
                      className="bg-white text-slate-950 hover:bg-slate-100"
                      size="sm"
                      onClick={() => { setError(''); setMovementModal(true) }}
                    >
                      <Plus className="h-4 w-4" />
                      Movimiento
                    </Button>
                  )}
                  {can('cash.close') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                      onClick={() => {
                        setError('')
                        setCloseForm({ counted_cash_amount: String(expectedCash), closing_notes: '' })
                        setCloseModal(true)
                      }}
                    >
                      <Lock className="h-4 w-4" />
                      Cerrar
                    </Button>
                  )}
                </div>
              </div>

              {/* Metrics grid */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard label="Inicial"   value={formatPrice(openingAmount)} />
                <MetricCard label="Ingresos"  value={formatPrice(cashIncome)} />
                <MetricCard label="Egresos"   value={formatPrice(cashExpense)} />
                <MetricCard label="Esperado"  value={formatPrice(expectedCash)} emphasis />
              </div>
              {otherPayments > 0 && (
                <p className="mt-3 text-sm text-slate-400">
                  Otros medios (tarjeta/transferencia): <span className="font-semibold text-white">{formatPrice(otherPayments)}</span>
                </p>
              )}

              {/* Movements */}
              <div className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Movimientos ({movementRows.length})
                  </p>
                  <Calculator className="h-4 w-4 text-slate-400" />
                </div>

                {movementRows.length === 0 ? (
                  <p className="rounded-2xl bg-white/5 px-4 py-5 text-sm text-slate-300">
                    Sin movimientos todavía.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {movementRows.slice().reverse().map(movement => (
                      <MovementRow key={movement.id} movement={movement} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <EmptyState
              icon={<DollarSign className="h-6 w-6" />}
              title="No hay caja abierta"
              description="Abrí una caja para registrar ingresos, egresos y cerrar con arqueo."
              action={can('cash.open') ? <Button size="sm" onClick={() => setOpenModal(true)}>Abrir caja</Button> : undefined}
            />
          )}

          {/* History */}
          <section className="rounded-[32px] border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Historial</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">Cajas anteriores</h3>
            </div>

            {registers.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                No hay registros para los filtros aplicados.
              </p>
            ) : (
              <div className="space-y-3">
                {registers.map(register => (
                  <div key={register.id} className="rounded-[24px] border border-slate-200 p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-slate-950">
                            {register.branch?.name ?? 'Sucursal'}
                          </p>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${register.status === 'open' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {register.status === 'open' ? 'Abierta' : 'Cerrada'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {register.opened_by_user?.name ?? register.opened_by_user?.email} · {formatDate(register.opened_at)}
                        </p>
                        {register.closed_at && (
                          <p className="mt-0.5 text-sm text-slate-500">
                            Cerrada · {formatDate(register.closed_at)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Esperado</p>
                          <p className="text-lg font-semibold text-slate-950">
                            {formatPrice(register.summary?.expected_cash_amount ?? 0)}
                          </p>
                        </div>
                        <Link
                          href={`/admin/caja/${register.id}`}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <FileText className="h-4 w-4" />
                          Ver
                        </Link>
                        {register.status === 'closed' && can('cash.reopen') && (
                          <Button variant="outline" size="sm" onClick={() => void handleReopenRegister(register.id)}>
                            Reabrir
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Open modal */}
      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Abrir caja">
        <div className="space-y-4">
          <div>
            <label className="label">Sucursal</label>
            <select
              value={openForm.branch_id}
              onChange={e => setOpenForm(f => ({ ...f, branch_id: e.target.value }))}
              className="input"
            >
              <option value="">Seleccioná sucursal</option>
              {allowedBranches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <Input
            label="Monto inicial"
            type="number"
            value={openForm.opening_amount}
            onChange={e => setOpenForm(f => ({ ...f, opening_amount: e.target.value }))}
          />
          <div>
            <label className="label">Observación (opcional)</label>
            <textarea
              value={openForm.opening_notes}
              onChange={e => setOpenForm(f => ({ ...f, opening_notes: e.target.value }))}
              className="input min-h-20 resize-none"
            />
          </div>
          {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setOpenModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleOpenRegister} loading={saving}>Abrir caja</Button>
          </div>
        </div>
      </Modal>

      {/* Movement modal */}
      <Modal open={movementModal} onClose={() => setMovementModal(false)} title="Agregar movimiento">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Tipo</label>
              <select
                value={movementForm.type}
                onChange={e => setMovementForm(f => ({ ...f, type: e.target.value as CashMovementType }))}
                className="input"
              >
                {MOVEMENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Medio de pago</label>
              <select
                value={movementForm.payment_method}
                onChange={e => setMovementForm(f => ({ ...f, payment_method: e.target.value as CashMovementPaymentMethod }))}
                className="input"
              >
                {MOVEMENT_METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <Input
            label="Monto"
            type="number"
            value={movementForm.amount}
            onChange={e => setMovementForm(f => ({ ...f, amount: e.target.value }))}
          />
          <Input
            label="Descripción"
            value={movementForm.description}
            onChange={e => setMovementForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Ej: Corte + barba, Juan"
          />
          {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setMovementModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleAddMovement} loading={saving}>Guardar</Button>
          </div>
        </div>
      </Modal>

      {/* Close modal */}
      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="Cerrar caja">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Monto esperado en efectivo</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{formatPrice(expectedCash)}</p>
          </div>
          <Input
            label="Monto contado real"
            type="number"
            value={closeForm.counted_cash_amount}
            onChange={e => setCloseForm(f => ({ ...f, counted_cash_amount: e.target.value }))}
          />
          {closeForm.counted_cash_amount && (
            <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              Number(closeForm.counted_cash_amount) === expectedCash
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}>
              Diferencia: {formatPrice(Number(closeForm.counted_cash_amount) - expectedCash)}
            </div>
          )}
          <div>
            <label className="label">Observación (opcional)</label>
            <textarea
              value={closeForm.closing_notes}
              onChange={e => setCloseForm(f => ({ ...f, closing_notes: e.target.value }))}
              className="input min-h-20 resize-none"
            />
          </div>
          {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setCloseModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleCloseRegister} loading={saving}>Confirmar cierre</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function MetricCard({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-[20px] border p-4 ${emphasis ? 'border-white/20 bg-white text-slate-950' : 'border-white/10 bg-white/5'}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${emphasis ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`mt-2 text-xl font-semibold ${emphasis ? 'text-slate-950' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function MovementRow({ movement }: { movement: CashMovement }) {
  const isExpense = movement.type === 'expense'
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{movement.description || movement.type}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {movement.payment_method} · {movement.created_by_user?.name ?? movement.created_by_user?.email ?? 'Sistema'}
          </p>
        </div>
        <p className={`text-sm font-semibold flex-shrink-0 ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>
          {isExpense ? '−' : '+'}{formatPrice(Number(movement.amount))}
        </p>
      </div>
    </div>
  )
}
