'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Calculator,
  ChevronRight,
  DollarSign,
  FileText,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Unlock,
} from 'lucide-react'
import { Button, EmptyState, Input, Modal, PageHeader, Spinner } from '@/components/ui'
import { cn, formatDate, formatPrice } from '@/lib/utils'
import { useAdmin } from '../layout'
import type {
  CashMovement,
  CashMovementPaymentMethod,
  CashMovementType,
  CashRegister,
} from '@/types'

const MOVEMENT_TYPE_OPTIONS: { value: CashMovementType; label: string }[] = [
  { value: 'income_service', label: 'Servicio' },
  { value: 'income_product', label: 'Producto' },
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

  useEffect(() => {
    const nextBranchId = activeBranch?.id ?? allowedBranches[0]?.id ?? ''
    setBranchFilter(current => (
      current && allowedBranches.some(branch => branch.id === current)
        ? current
        : nextBranchId
    ))
    setOpenForm(current => ({
      ...current,
      branch_id: current.branch_id && allowedBranches.some(branch => branch.id === current.branch_id)
        ? current.branch_id
        : nextBranchId,
    }))
  }, [activeBranch?.id, allowedBranches])

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
  // Depend on .id, not the object reference — avoids refetch on unrelated state changes
  }, [currentOpenRegister, currentOpenRegister?.id])

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
            {can('cash.open') && !currentOpenRegister && (
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
        <div className="space-y-5">

          {/* ── Open register ────────────────────────────────── */}
          {currentOpenRegister ? (
            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">

              {/* Header strip */}
              <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-950 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500">
                      <div className="h-2 w-2 rounded-full bg-white" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Caja abierta</span>
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                    {liveRegister?.branch?.name ?? currentOpenRegister.branch?.name ?? 'Sucursal'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Abierta por{' '}
                    <span className="text-slate-200">
                      {liveRegister?.opened_by_user?.name ?? liveRegister?.opened_by_user?.email ?? currentOpenRegister.opened_by_user?.name ?? 'usuario'}
                    </span>
                    {' · '}{formatDate(liveRegister?.opened_at ?? currentOpenRegister.opened_at)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {can('cash.add_movement') && (
                    <button
                      onClick={() => { setError(''); setMovementModal(true) }}
                      className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100 active:scale-[0.98]"
                    >
                      <Plus className="h-4 w-4" />
                      Movimiento
                    </button>
                  )}
                  {can('cash.close') && (
                    <button
                      onClick={() => {
                        setError('')
                        setCloseForm({ counted_cash_amount: String(expectedCash), closing_notes: '' })
                        setCloseModal(true)
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-transparent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-[0.98]"
                    >
                      <Lock className="h-4 w-4" />
                      Cerrar caja
                    </button>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
                {[
                  { label: 'Apertura',   value: formatPrice(openingAmount),  sub: 'inicial',     muted: true },
                  { label: 'Ingresos',   value: formatPrice(cashIncome),     sub: 'en efectivo',  color: 'text-emerald-600' },
                  { label: 'Egresos',    value: formatPrice(cashExpense),    sub: 'en efectivo',  color: 'text-red-500' },
                  { label: 'Esperado',   value: formatPrice(expectedCash),   sub: 'en caja',      bold: true },
                ].map(m => (
                  <div key={m.label} className="bg-white px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{m.label}</p>
                    <p className={cn(
                      'mt-2 text-2xl font-semibold tabular-nums',
                      m.color ?? (m.bold ? 'text-slate-950' : 'text-slate-700')
                    )}>
                      {m.value}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">{m.sub}</p>
                  </div>
                ))}
              </div>

              {otherPayments > 0 && (
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
                  <p className="text-sm text-slate-500">
                    Otros medios (tarjeta / transferencia):{' '}
                    <span className="font-semibold text-slate-900">{formatPrice(otherPayments)}</span>
                  </p>
                </div>
              )}

              {/* Movements list */}
              <div className="border-t border-slate-100 px-5 py-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-950">
                      Movimientos
                      <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        {movementRows.length}
                      </span>
                    </p>
                  </div>
                </div>

                {movementRows.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
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
              action={can('cash.open') ? (
                <Button onClick={() => {
                  setOpenForm(f => ({ ...f, branch_id: branchFilter || activeBranch?.id || allowedBranches[0]?.id || '' }))
                  setOpenModal(true)
                }}>
                  <Plus className="h-4 w-4" />
                  Abrir caja
                </Button>
              ) : undefined}
            />
          )}

          {/* ── History ──────────────────────────────────────── */}
          <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Historial</p>
              <h3 className="mt-1 text-base font-semibold text-slate-950">Cajas anteriores</h3>
            </div>

            {registers.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                No hay registros para los filtros aplicados.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {registers.map(register => (
                  <div key={register.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-950">
                          {register.branch?.name ?? 'Sucursal'}
                        </p>
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          register.status === 'open'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        )}>
                          {register.status === 'open' ? 'Abierta' : 'Cerrada'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {register.opened_by_user?.name ?? register.opened_by_user?.email}
                        {' · Abierta '}{formatDate(register.opened_at)}
                      </p>
                      {register.closed_at && (
                        <p className="text-xs text-slate-400">
                          Cerrada · {formatDate(register.closed_at)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Esperado</p>
                        <p className="text-base font-semibold tabular-nums text-slate-950">
                          {formatPrice(register.summary?.expected_cash_amount ?? 0)}
                        </p>
                      </div>

                      <Link
                        href={`/admin/caja/${register.id}`}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <FileText className="h-4 w-4" />
                        Ver
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      </Link>

                      {register.status === 'closed' && can('cash.reopen') && (
                        <Button variant="outline" size="sm" onClick={() => void handleReopenRegister(register.id)}>
                          <Unlock className="h-4 w-4" />
                          Reabrir
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Open modal ───────────────────────────────────────── */}
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
            label="Monto inicial en efectivo"
            type="number"
            value={openForm.opening_amount}
            onChange={e => setOpenForm(f => ({ ...f, opening_amount: e.target.value }))}
            placeholder="0"
          />
          <div>
            <label className="label">Observación (opcional)</label>
            <textarea
              value={openForm.opening_notes}
              onChange={e => setOpenForm(f => ({ ...f, opening_notes: e.target.value }))}
              className="input min-h-20 resize-none"
              placeholder="Ej: apertura normal, sin novedad"
            />
          </div>
          {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setOpenModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleOpenRegister} loading={saving}>
              <Plus className="h-4 w-4" />
              Abrir caja
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Movement modal ───────────────────────────────────── */}
      <Modal open={movementModal} onClose={() => setMovementModal(false)} title="Agregar movimiento">
        <div className="space-y-4">
          {/* Type pills */}
          <div>
            <label className="label">Tipo de movimiento</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MOVEMENT_TYPE_OPTIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setMovementForm(f => ({ ...f, type: o.value }))}
                  className={cn(
                    'rounded-2xl border px-3 py-2.5 text-sm font-semibold transition',
                    movementForm.type === o.value
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Method pills */}
          <div>
            <label className="label">Medio de pago</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MOVEMENT_METHOD_OPTIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setMovementForm(f => ({ ...f, payment_method: o.value }))}
                  className={cn(
                    'rounded-2xl border px-3 py-2.5 text-sm font-semibold transition',
                    movementForm.payment_method === o.value
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Monto *"
              type="number"
              min="0"
              step="1"
              value={movementForm.amount}
              onChange={e => setMovementForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0"
            />
            <Input
              label="Descripción *"
              value={movementForm.description}
              onChange={e => setMovementForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Ej: Corte + barba, Juan"
            />
          </div>

          {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setMovementModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleAddMovement} loading={saving}>
              Guardar movimiento
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Close modal ──────────────────────────────────────── */}
      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="Cerrar caja">
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Esperado</p>
              <p className="mt-2 text-xl font-semibold tabular-nums text-slate-950">{formatPrice(expectedCash)}</p>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Otros medios</p>
              <p className="mt-2 text-xl font-semibold tabular-nums text-slate-950">{formatPrice(otherPayments)}</p>
            </div>
          </div>

          <Input
            label="Monto contado real en efectivo"
            type="number"
            min="0"
            step="1"
            value={closeForm.counted_cash_amount}
            onChange={e => setCloseForm(f => ({ ...f, counted_cash_amount: e.target.value }))}
            placeholder={String(expectedCash)}
          />

          {closeForm.counted_cash_amount !== '' && (
            <div className={cn(
              'flex items-center justify-between rounded-2xl border px-4 py-3',
              Number(closeForm.counted_cash_amount) === expectedCash
                ? 'border-emerald-200 bg-emerald-50'
                : Math.abs(Number(closeForm.counted_cash_amount) - expectedCash) < 50
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-red-200 bg-red-50'
            )}>
              <p className={cn(
                'text-sm font-semibold',
                Number(closeForm.counted_cash_amount) === expectedCash
                  ? 'text-emerald-700'
                  : Math.abs(Number(closeForm.counted_cash_amount) - expectedCash) < 50
                    ? 'text-amber-700'
                    : 'text-red-700'
              )}>
                Diferencia
              </p>
              <p className={cn(
                'text-sm font-bold tabular-nums',
                Number(closeForm.counted_cash_amount) === expectedCash
                  ? 'text-emerald-700'
                  : Math.abs(Number(closeForm.counted_cash_amount) - expectedCash) < 50
                    ? 'text-amber-700'
                    : 'text-red-700'
              )}>
                {Number(closeForm.counted_cash_amount) >= expectedCash ? '+' : ''}
                {formatPrice(Number(closeForm.counted_cash_amount) - expectedCash)}
              </p>
            </div>
          )}

          <div>
            <label className="label">Observación (opcional)</label>
            <textarea
              value={closeForm.closing_notes}
              onChange={e => setCloseForm(f => ({ ...f, closing_notes: e.target.value }))}
              className="input min-h-20 resize-none"
              placeholder="Ej: diferencia por vuelto pendiente"
            />
          </div>

          {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setCloseModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleCloseRegister} loading={saving}>
              <Lock className="h-4 w-4" />
              Confirmar cierre
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function MovementRow({ movement }: { movement: CashMovement }) {
  const isExpense  = movement.type === 'expense'
  const isAdjust   = movement.type === 'adjustment'

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:border-slate-200 hover:bg-white">
      {/* Icon */}
      <div className={cn(
        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl',
        isExpense ? 'bg-red-50 text-red-500' :
        isAdjust  ? 'bg-amber-50 text-amber-500' :
                    'bg-emerald-50 text-emerald-600'
      )}>
        {isExpense
          ? <TrendingDown className="h-4 w-4" />
          : isAdjust
            ? <Calculator className="h-4 w-4" />
            : <TrendingUp className="h-4 w-4" />
        }
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {movement.description || movement.type}
        </p>
        <p className="mt-0.5 text-xs text-slate-400 capitalize">
          {movement.payment_method} · {movement.created_by_user?.name ?? movement.created_by_user?.email ?? 'Sistema'}
        </p>
      </div>

      {/* Amount */}
      <p className={cn(
        'flex-shrink-0 text-sm font-bold tabular-nums',
        isExpense ? 'text-red-500' : isAdjust ? 'text-amber-600' : 'text-emerald-600'
      )}>
        {isExpense ? <span className="inline-flex items-center gap-0.5"><Minus className="h-3 w-3" />{formatPrice(Number(movement.amount))}</span>
                   : <span className="inline-flex items-center gap-0.5"><Plus className="h-3 w-3" />{formatPrice(Number(movement.amount))}</span>}
      </p>
    </div>
  )
}
