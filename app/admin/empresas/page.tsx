'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Building2, Mail, MapPin, Pencil, Phone, Plus, Power, Trash2, TrendingUp } from 'lucide-react'
import { Button, EmptyState, Input, Modal, PageHeader, Spinner } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useAdmin } from '../layout'
import type { Company } from '@/types'

// Plan tier colors and labels
const PLAN_COLORS: Record<string, string> = {
  starter:    'bg-slate-100 text-slate-600 border-slate-200',
  pro:        'bg-blue-50 text-blue-700 border-blue-200',
  enterprise: 'bg-purple-50 text-purple-700 border-purple-200',
}
const PLAN_LABELS: Record<string, string> = {
  starter:    'Starter',
  pro:        'Pro',
  enterprise: 'Enterprise',
}
const PLAN_DEFAULTS: Record<string, { max_branches: number; max_barbers: number }> = {
  starter:    { max_branches: 1,  max_barbers: 3  },
  pro:        { max_branches: 3,  max_barbers: 10 },
  enterprise: { max_branches: 99, max_barbers: 99 },
}

const EMPTY_COMPANY: Partial<Company> = { name: '', email: '', phone: '', address: '', active: true }

interface CompanyWithStats extends Company {
  branch_count?: number
  barber_count?: number
}

export default function EmpresasPage() {
  const { user } = useAdmin()
  const [companies, setCompanies] = useState<CompanyWithStats[]>([])
  const [loading, setLoading]     = useState(true)
  const [editModal, setEditModal] = useState(false)
  const [planModal, setPlanModal] = useState(false)
  const [editing, setEditing]     = useState<Partial<Company>>(EMPTY_COMPANY)
  const [planTarget, setPlanTarget] = useState<CompanyWithStats | null>(null)
  const [planForm, setPlanForm]   = useState({ plan_tier: 'starter', max_branches: '1', max_barbers: '3' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const isSuperadmin = user?.role === 'superadmin'

  async function fetchCompanies() {
    setLoading(true)
    try {
      const res  = await fetch('/api/companies?include_stats=1')
      const data = await res.json()
      setCompanies(data.companies ?? [])
    } catch {
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCompanies() }, [])

  function openNew() {
    setEditing(EMPTY_COMPANY); setError(''); setEditModal(true)
  }

  function openEdit(c: CompanyWithStats) {
    setEditing({ ...c }); setError(''); setEditModal(true)
  }

  function openPlanEdit(c: CompanyWithStats) {
    setPlanTarget(c)
    setPlanForm({
      plan_tier:    c.plan_tier   ?? 'starter',
      max_branches: String(c.max_branches ?? 1),
      max_barbers:  String(c.max_barbers  ?? 3),
    })
    setError('')
    setPlanModal(true)
  }

  async function saveCompany() {
    if (!editing.name?.trim()) return
    setSaving(true); setError('')
    const isEdit = Boolean(editing.id)
    const res = await fetch(isEdit ? `/api/companies/${editing.id}` : '/api/companies', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
    setEditModal(false)
    fetchCompanies()
  }

  async function savePlan() {
    if (!planTarget) return
    setSaving(true); setError('')
    const res = await fetch(`/api/companies/${planTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_tier:    planForm.plan_tier,
        max_branches: Number(planForm.max_branches),
        max_barbers:  Number(planForm.max_barbers),
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Error al actualizar el plan'); return }
    setPlanModal(false)
    fetchCompanies()
  }

  async function toggleActive(c: CompanyWithStats) {
    await fetch(`/api/companies/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...c, active: !c.active }),
    })
    fetchCompanies()
  }

  async function remove(c: CompanyWithStats) {
    if (!confirm(`¿Eliminar "${c.name}"? Esta acción no se puede deshacer.`)) return
    await fetch(`/api/companies/${c.id}`, { method: 'DELETE' })
    fetchCompanies()
  }

  const activeCount   = companies.filter(c => c.active).length
  const inactiveCount = companies.filter(c => !c.active).length

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Plataforma"
        subtitle="Gestioná todas las barberías y sus planes"
        action={
          isSuperadmin ? (
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Nueva barbería
            </Button>
          ) : undefined
        }
      />

      {/* Stats strip */}
      {!loading && companies.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total',    value: companies.length, color: 'text-slate-950' },
            { label: 'Activas',  value: activeCount,      color: 'text-emerald-600' },
            { label: 'Inactivas',value: inactiveCount,    color: 'text-red-500' },
            { label: 'Planes',   value: `${companies.filter(c=>c.plan_tier==='pro').length} Pro · ${companies.filter(c=>c.plan_tier==='enterprise').length} Ent.`, color: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
              <p className={cn('mt-1 text-2xl font-semibold tabular-nums', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : companies.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No hay barberías registradas"
          description="Creá la primera barbería para comenzar."
          action={isSuperadmin ? <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> Nueva barbería</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {companies.map(company => (
            <div
              key={company.id}
              className={cn(
                'rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition',
                !company.active && 'opacity-60'
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg font-bold text-slate-700">
                    {(company.name ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-950">{company.name}</h3>
                      <span className={cn(
                        'rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                        company.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      )}>
                        {company.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    {company.slug && (
                      <p className="mt-0.5 font-mono text-xs text-slate-400">{company.slug}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-shrink-0 gap-1">
                  <button onClick={() => openEdit(company)} className="rounded-xl border border-slate-200 p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700" title="Editar info">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {isSuperadmin && (
                    <button onClick={() => openPlanEdit(company)} className="rounded-xl border border-blue-200 p-1.5 text-blue-400 transition hover:bg-blue-50 hover:text-blue-700" title="Gestionar plan">
                      <TrendingUp className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => toggleActive(company)}
                    className={cn('rounded-xl border p-1.5 transition',
                      company.active
                        ? 'border-slate-200 text-slate-400 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200'
                        : 'border-slate-200 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'
                    )}
                    title={company.active ? 'Desactivar' : 'Activar'}
                  >
                    <Power className="h-3.5 w-3.5" />
                  </button>
                  {isSuperadmin && (
                    <button onClick={() => remove(company)} className="rounded-xl border border-slate-200 p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 hover:border-red-200" title="Eliminar">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Plan badge + limits */}
              <div className="mb-4 flex items-center gap-2">
                <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', PLAN_COLORS[company.plan_tier ?? 'starter'])}>
                  {PLAN_LABELS[company.plan_tier ?? 'starter'] ?? company.plan_tier}
                </span>
                <span className="text-xs text-slate-400">
                  {company.branch_count ?? 0}/{company.max_branches ?? 1} sucursal{(company.max_branches ?? 1) !== 1 ? 'es' : ''}
                  {' · '}
                  {company.barber_count ?? 0}/{company.max_barbers ?? 3} barbero{(company.max_barbers ?? 3) !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Contact info */}
              <div className="space-y-1.5 text-sm">
                {company.email && (
                  <p className="flex items-center gap-2 text-slate-500">
                    <Mail className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />{company.email}
                  </p>
                )}
                {company.phone && (
                  <p className="flex items-center gap-2 text-slate-500">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />{company.phone}
                  </p>
                )}
                {company.address && (
                  <p className="flex items-center gap-2 text-slate-500">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />{company.address}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Edit company modal ──────────────────────── */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={editing.id ? 'Editar barbería' : 'Nueva barbería'}>
        <div className="space-y-4">
          <Input label="Nombre *" value={editing.name ?? ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} placeholder="Nombre de la barbería" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" type="email" value={editing.email ?? ''} onChange={e => setEditing(p => ({ ...p, email: e.target.value }))} placeholder="contacto@barberia.com" />
            <Input label="Teléfono" value={editing.phone ?? ''} onChange={e => setEditing(p => ({ ...p, phone: e.target.value }))} placeholder="096 000 000" />
          </div>
          <Input label="Dirección" value={editing.address ?? ''} onChange={e => setEditing(p => ({ ...p, address: e.target.value }))} placeholder="Calle 123, Ciudad" />
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input type="checkbox" checked={editing.active ?? true} onChange={e => setEditing(p => ({ ...p, active: e.target.checked }))} className="accent-slate-950" />
            Barbería activa
          </label>
          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setEditModal(false)}>Cancelar</Button>
            <Button className="flex-1" loading={saving} onClick={saveCompany}>{editing.id ? 'Guardar cambios' : 'Crear barbería'}</Button>
          </div>
        </div>
      </Modal>

      {/* ── Plan management modal ───────────────────── */}
      <Modal open={planModal} onClose={() => setPlanModal(false)} title={`Plan · ${planTarget?.name ?? ''}`}>
        <div className="space-y-4">
          <div>
            <label className="label">Plan</label>
            <div className="grid grid-cols-3 gap-2">
              {(['starter', 'pro', 'enterprise'] as const).map(tier => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => {
                    const defaults = PLAN_DEFAULTS[tier]
                    setPlanForm({ plan_tier: tier, max_branches: String(defaults.max_branches), max_barbers: String(defaults.max_barbers) })
                  }}
                  className={cn(
                    'rounded-2xl border px-3 py-3 text-left transition',
                    planForm.plan_tier === tier
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <p className="text-sm font-semibold capitalize">{tier}</p>
                  <p className={cn('mt-0.5 text-xs', planForm.plan_tier === tier ? 'text-slate-300' : 'text-slate-400')}>
                    {tier === 'starter' ? '1 suc · 3 barb' : tier === 'pro' ? '3 suc · 10 barb' : 'Sin límites'}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Máx. sucursales" type="number" min="1" value={planForm.max_branches} onChange={e => setPlanForm(p => ({ ...p, max_branches: e.target.value }))} />
            <Input label="Máx. barberos" type="number" min="1" value={planForm.max_barbers} onChange={e => setPlanForm(p => ({ ...p, max_barbers: e.target.value }))} />
          </div>
          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setPlanModal(false)}>Cancelar</Button>
            <Button className="flex-1" loading={saving} onClick={savePlan}>Aplicar plan</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
