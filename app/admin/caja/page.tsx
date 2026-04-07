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
  Branch,
  CashMovement,
  CashMovementPaymentMethod,
  CashMovementType,
  CashRegister,
  Company,
  UserWithRole,
} from '@/types'

interface FiltersState {
  branch_id: string
  company_id: string
  opened_by_user_id: string
  status: '' | 'open' | 'closed'
  from: string
  to: string
}

const DEFAULT_FILTERS: FiltersState = {
  branch_id: '',
  company_id: '',
  opened_by_user_id: '',
  status: '',
  from: '',
  to: '',
}

const MOVEMENT_TYPE_OPTIONS: { value: CashMovementType; label: string }[] = [
  { value: 'income_service', label: 'Ingreso servicio' },
  { value: 'income_product', label: 'Ingreso producto' },
  { value: 'income_extra', label: 'Ingreso extra' },
  { value: 'expense', label: 'Egreso' },
  { value: 'adjustment', label: 'Ajuste' },
]

const MOVEMENT_METHOD_OPTIONS: { value: CashMovementPaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'other', label: 'Otro' },
]

export default function CajaPage() {
  const { activeBranch, branches: allowedBranches, can } = useAdmin()
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [activeRegisterDetails, setActiveRegisterDetails] = useState<CashRegister | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS)
  const [openModal, setOpenModal] = useState(false)
  const [movementModal, setMovementModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [openForm, setOpenForm] = useState({ branch_id: '', opening_amount: '0', opening_notes: '' })
  const [movementForm, setMovementForm] = useState({
    type: 'income_extra' as CashMovementType,
    payment_method: 'cash' as CashMovementPaymentMethod,
    amount: '',
    description: '',
    reference_type: '',
    reference_id: '',
  })
  const [closeForm, setCloseForm] = useState({ counted_cash_amount: '', closing_notes: '' })

  useEffect(() => {
    if (activeBranch && !filters.branch_id) {
      setFilters(current => ({ ...current, branch_id: activeBranch.id }))
      setOpenForm(current => ({ ...current, branch_id: activeBranch.id }))
    }
  }, [activeBranch, filters.branch_id])

  const loadRegisters = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })

    const response = await fetch(`/api/cash-registers?${params.toString()}`, { cache: 'no-store' })
    const data = await response.json()
    setRegisters(data.cash_registers ?? [])
    setLoading(false)
  }, [filters])

  useEffect(() => {
    void Promise.all([loadRegisters(), loadSupportingData()])
  }, [loadRegisters])

  async function loadSupportingData() {
    const [companiesRes, usersRes] = await Promise.all([
      fetch('/api/companies', { cache: 'no-store' }),
      fetch('/api/users', { cache: 'no-store' }),
    ])
    const [companiesData, usersData] = await Promise.all([companiesRes.json(), usersRes.json()])
    setCompanies(companiesData.companies ?? [])
    setUsers(usersData.users ?? [])
  }

  const currentOpenRegister = useMemo(() => {
    if (filters.branch_id) {
      return registers.find(register => register.status === 'open' && register.branch_id === filters.branch_id) ?? null
    }
    return registers.find(register => register.status === 'open') ?? null
  }, [filters.branch_id, registers])

  useEffect(() => {
    if (!currentOpenRegister) {
      setActiveRegisterDetails(null)
      return
    }

    let cancelled = false

    fetch(`/api/cash-registers/${currentOpenRegister.id}`, { cache: 'no-store' })
      .then(response => response.json())
      .then(data => {
        if (!cancelled) {
          setActiveRegisterDetails(data.cash_register ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveRegisterDetails(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [currentOpenRegister])

  async function handleOpenRegister() {
    setSaving(true)
    setError('')
    const response = await fetch('/api/cash-registers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: openForm.branch_id,
        opening_amount: Number(openForm.opening_amount),
        opening_notes: openForm.opening_notes || null,
      }),
    })
    const data = await response.json()
    setSaving(false)

    if (!response.ok) {
      setError(data.error ?? 'No se pudo abrir la caja')
      return
    }

    setOpenModal(false)
    await loadRegisters()
  }

  async function handleAddMovement() {
    if (!currentOpenRegister) return
    setSaving(true)
    setError('')

    const response = await fetch(`/api/cash-registers/${currentOpenRegister.id}/movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...movementForm,
        amount: Number(movementForm.amount),
        reference_type: movementForm.reference_type || null,
        reference_id: movementForm.reference_id || null,
      }),
    })
    const data = await response.json()
    setSaving(false)

    if (!response.ok) {
      setError(data.error ?? 'No se pudo agregar el movimiento')
      return
    }

    setMovementModal(false)
    setMovementForm({
      type: 'income_extra',
      payment_method: 'cash',
      amount: '',
      description: '',
      reference_type: '',
      reference_id: '',
    })
    await loadRegisters()
  }

  async function handleCloseRegister() {
    if (!currentOpenRegister) return
    setSaving(true)
    setError('')

    const response = await fetch(`/api/cash-registers/${currentOpenRegister.id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        counted_cash_amount: Number(closeForm.counted_cash_amount),
        closing_notes: closeForm.closing_notes || null,
      }),
    })
    const data = await response.json()
    setSaving(false)

    if (!response.ok) {
      setError(data.error ?? 'No se pudo cerrar la caja')
      return
    }

    setCloseModal(false)
    await loadRegisters()
  }

  async function handleReopenRegister(registerId: string) {
    await fetch(`/api/cash-registers/${registerId}/reopen`, { method: 'POST' })
    await loadRegisters()
  }

  const liveRegister = activeRegisterDetails ?? currentOpenRegister
  const movementRows = liveRegister?.movements ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Caja diaria"
        subtitle="Apertura, movimientos, arqueo, cierre y comprobante por sucursal con trazabilidad completa."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void loadRegisters()}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {can('cash.open') && (
              <Button onClick={() => {
                setError('')
                setOpenForm(current => ({ ...current, branch_id: filters.branch_id || activeBranch?.id || allowedBranches[0]?.id || '' }))
                setOpenModal(true)
              }}>
                <Plus className="h-4 w-4" />
                Abrir caja
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5 xl:grid-cols-6">
          <select
            value={filters.company_id}
            onChange={event => setFilters(current => ({ ...current, company_id: event.target.value }))}
            className="input"
          >
            <option value="">Todas las empresas</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
          <select
            value={filters.branch_id}
            onChange={event => setFilters(current => ({ ...current, branch_id: event.target.value }))}
            className="input"
          >
            <option value="">Todas las sucursales</option>
            {allowedBranches.map(branch => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
          <select
            value={filters.opened_by_user_id}
            onChange={event => setFilters(current => ({ ...current, opened_by_user_id: event.target.value }))}
            className="input"
          >
            <option value="">Todos los usuarios</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.name ?? user.email}</option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={event => setFilters(current => ({ ...current, status: event.target.value as FiltersState['status'] }))}
            className="input"
          >
            <option value="">Todos los estados</option>
            <option value="open">Abierta</option>
            <option value="closed">Cerrada</option>
          </select>
          <input type="date" value={filters.from} onChange={event => setFilters(current => ({ ...current, from: event.target.value }))} className="input" />
          <input type="date" value={filters.to} onChange={event => setFilters(current => ({ ...current, to: event.target.value }))} className="input" />
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="outline" onClick={() => void loadRegisters()}>
            Aplicar filtros
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : (
        <div className="space-y-6">
          {currentOpenRegister ? (
            <section className="rounded-[32px] border border-slate-950 bg-slate-950 p-6 text-white shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Caja abierta</p>
                  <h2 className="mt-2 text-3xl font-semibold">{liveRegister?.branch?.name ?? currentOpenRegister.branch?.name ?? 'Sucursal'}</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Abierta por {liveRegister?.opened_by_user?.name ?? liveRegister?.opened_by_user?.email ?? currentOpenRegister.opened_by_user?.name ?? currentOpenRegister.opened_by_user?.email} · {formatDate(liveRegister?.opened_at ?? currentOpenRegister.opened_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {can('cash.add_movement') && (
                    <Button className="bg-white text-slate-950 hover:bg-slate-100" onClick={() => { setError(''); setMovementModal(true) }}>
                      <Plus className="h-4 w-4" />
                      Agregar movimiento
                    </Button>
                  )}
                  {can('cash.close') && (
                    <Button variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => { setError(''); setCloseForm({ counted_cash_amount: String(liveRegister?.summary?.expected_cash_amount ?? currentOpenRegister.summary?.expected_cash_amount ?? 0), closing_notes: '' }); setCloseModal(true) }}>
                      <Lock className="h-4 w-4" />
                      Cerrar caja
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="Monto inicial" value={formatPrice(Number(liveRegister?.opening_amount ?? currentOpenRegister.opening_amount))} />
                <MetricCard label="Ingresos efectivo" value={formatPrice(liveRegister?.summary?.cash_income_total ?? currentOpenRegister.summary?.cash_income_total ?? 0)} />
                <MetricCard label="Egresos efectivo" value={formatPrice(liveRegister?.summary?.cash_expense_total ?? currentOpenRegister.summary?.cash_expense_total ?? 0)} />
                <MetricCard label="Ajustes efectivo" value={formatPrice(liveRegister?.summary?.cash_adjustment_total ?? currentOpenRegister.summary?.cash_adjustment_total ?? 0)} />
                <MetricCard label="Caja esperada" value={formatPrice(liveRegister?.summary?.expected_cash_amount ?? currentOpenRegister.summary?.expected_cash_amount ?? 0)} emphasis />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <MetricCard label="Otros medios" value={formatPrice(liveRegister?.summary?.other_payment_total ?? currentOpenRegister.summary?.other_payment_total ?? 0)} />
                <MetricCard label="Observación apertura" value={liveRegister?.opening_notes || currentOpenRegister.opening_notes || 'Sin observaciones'} />
                <MetricCard label="Movimientos" value={String(movementRows.length)} />
              </div>

              <div className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Movimientos</p>
                    <p className="mt-1 text-sm text-slate-300">Actualizados en tiempo real desde esta caja.</p>
                  </div>
                  <Calculator className="h-5 w-5 text-slate-400" />
                </div>

                {movementRows.length === 0 ? (
                  <p className="rounded-2xl bg-white/5 px-4 py-5 text-sm text-slate-300">Todavía no hay movimientos cargados.</p>
                ) : (
                  <div className="space-y-3">
                    {movementRows.slice().reverse().map(movement => (
                      <div key={movement.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-white">{movement.description}</p>
                            <p className="mt-1 text-xs text-slate-300">
                              {movement.type} · {movement.payment_method} · {movement.created_by_user?.name ?? movement.created_by_user?.email ?? 'Sistema'}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-white">{formatPrice(Number(movement.amount))}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <EmptyState
              icon={<DollarSign className="h-6 w-6" />}
              title="No hay caja abierta para esta vista"
              description="Abrí una caja diaria por sucursal para empezar a registrar ingresos, egresos, ajustes y cierres."
              action={can('cash.open') ? <Button onClick={() => setOpenModal(true)}>Abrir caja</Button> : undefined}
            />
          )}

          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Historial</p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-950">Cajas registradas</h3>
              </div>
            </div>

            {registers.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">No hay cajas para los filtros elegidos.</p>
            ) : (
              <div className="space-y-3">
                {registers.map(register => (
                  <div key={register.id} className="rounded-[24px] border border-slate-200 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-slate-950">{register.branch?.name ?? 'Sucursal'}</p>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${register.status === 'open' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {register.status === 'open' ? 'Abierta' : 'Cerrada'}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                          Apertura: {register.opened_by_user?.name ?? register.opened_by_user?.email} · {formatDate(register.opened_at)}
                        </p>
                        {register.closed_at && (
                          <p className="mt-1 text-sm text-slate-500">
                            Cierre: {register.closed_by_user?.name ?? register.closed_by_user?.email} · {formatDate(register.closed_at)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Esperado</p>
                          <p className="text-lg font-semibold text-slate-950">{formatPrice(register.summary?.expected_cash_amount ?? 0)}</p>
                        </div>
                        <Link href={`/admin/caja/${register.id}`} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950">
                          <FileText className="h-4 w-4" />
                          Ver comprobante
                        </Link>
                        {register.status === 'closed' && can('cash.reopen') && (
                          <Button variant="outline" onClick={() => void handleReopenRegister(register.id)}>
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

      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Abrir caja">
        <div className="space-y-4">
          <div>
            <label className="label">Sucursal</label>
            <select value={openForm.branch_id} onChange={event => setOpenForm(current => ({ ...current, branch_id: event.target.value }))} className="input">
              <option value="">Seleccioná sucursal</option>
              {allowedBranches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
          <Input label="Monto inicial" type="number" value={openForm.opening_amount} onChange={event => setOpenForm(current => ({ ...current, opening_amount: event.target.value }))} />
          <div>
            <label className="label">Observación</label>
            <textarea value={openForm.opening_notes} onChange={event => setOpenForm(current => ({ ...current, opening_notes: event.target.value }))} className="input min-h-28 resize-none" />
          </div>
          {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setOpenModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleOpenRegister} loading={saving}>Abrir caja</Button>
          </div>
        </div>
      </Modal>

      <Modal open={movementModal} onClose={() => setMovementModal(false)} title="Agregar movimiento" size="lg">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Tipo</label>
              <select value={movementForm.type} onChange={event => setMovementForm(current => ({ ...current, type: event.target.value as CashMovementType }))} className="input">
                {MOVEMENT_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Medio de pago</label>
              <select value={movementForm.payment_method} onChange={event => setMovementForm(current => ({ ...current, payment_method: event.target.value as CashMovementPaymentMethod }))} className="input">
                {MOVEMENT_METHOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>
          <Input label="Monto" type="number" value={movementForm.amount} onChange={event => setMovementForm(current => ({ ...current, amount: event.target.value }))} />
          <Input label="Descripción" value={movementForm.description} onChange={event => setMovementForm(current => ({ ...current, description: event.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Referencia tipo" value={movementForm.reference_type} onChange={event => setMovementForm(current => ({ ...current, reference_type: event.target.value }))} />
            <Input label="Referencia id" value={movementForm.reference_id} onChange={event => setMovementForm(current => ({ ...current, reference_id: event.target.value }))} />
          </div>
          {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setMovementModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleAddMovement} loading={saving}>Guardar movimiento</Button>
          </div>
        </div>
      </Modal>

      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="Cerrar caja">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Monto esperado</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{formatPrice(liveRegister?.summary?.expected_cash_amount ?? currentOpenRegister?.summary?.expected_cash_amount ?? 0)}</p>
          </div>
          <Input label="Monto contado real" type="number" value={closeForm.counted_cash_amount} onChange={event => setCloseForm(current => ({ ...current, counted_cash_amount: event.target.value }))} />
          <div>
            <label className="label">Observación cierre</label>
            <textarea value={closeForm.closing_notes} onChange={event => setCloseForm(current => ({ ...current, closing_notes: event.target.value }))} className="input min-h-28 resize-none" />
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
    <div className={`rounded-[24px] border p-4 ${emphasis ? 'border-white/10 bg-white text-slate-950' : 'border-white/10 bg-white/5'}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${emphasis ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`mt-3 text-xl font-semibold ${emphasis ? 'text-slate-950' : 'text-white'}`}>{value}</p>
    </div>
  )
}
