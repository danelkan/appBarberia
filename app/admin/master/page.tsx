'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  CheckCircle2,
  Crown,
  DollarSign,
  Lock,
  Settings,
  Store,
  Users,
  XCircle,
} from 'lucide-react'
import { Button, PageHeader, Spinner } from '@/components/ui'
import { formatPrice } from '@/lib/utils'
import { useAdmin } from '../layout'
import { PLAN_LABELS, PLAN_LIMITS, type PlanTier, type Company } from '@/types'

interface CompanyWithStats extends Company {
  plan_tier: PlanTier
  max_branches: number
  max_barbers: number
  whatsapp_enabled: boolean
  owner_user_id?: string | null
  billing_email?: string | null
  plan_expires_at?: string | null
  branch_count?: number
  barber_count?: number
}

export default function MasterAdminPage() {
  const { user } = useAdmin()
  const router = useRouter()
  const [companies, setCompanies] = useState<CompanyWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Only superadmin can access this page
  useEffect(() => {
    if (user && user.role !== 'superadmin') {
      router.replace('/admin/dashboard')
    }
  }, [user, router])

  useEffect(() => {
    if (!user || user.role !== 'superadmin') return
    fetch('/api/companies?include_stats=1', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setCompanies(d.companies ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user])

  async function updatePlan(companyId: string, tier: PlanTier) {
    setSaving(companyId)
    const limits = PLAN_LIMITS[tier]
    const res = await fetch(`/api/companies/${companyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_tier: tier,
        max_branches: limits.max_branches,
        max_barbers: limits.max_barbers,
        whatsapp_enabled: limits.whatsapp_enabled,
      }),
    })
    setSaving(null)
    if (res.ok) {
      setCompanies(prev => prev.map(c => c.id === companyId
        ? { ...c, plan_tier: tier, max_branches: limits.max_branches, max_barbers: limits.max_barbers, whatsapp_enabled: limits.whatsapp_enabled }
        : c
      ))
    }
  }

  if (!user || user.role !== 'superadmin') {
    return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>
  }

  const TIER_COLORS: Record<PlanTier, string> = {
    starter:    'bg-slate-100 text-slate-700 border-slate-200',
    pro:        'bg-blue-50 text-blue-700 border-blue-200',
    enterprise: 'bg-amber-50 text-amber-700 border-amber-200',
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title={<span className="flex items-center gap-2"><Crown className="h-7 w-7 text-amber-500" /> Panel Maestro</span>}
        subtitle="Control global de todas las barberías. Solo visible para el dueño del software."
      />

      {/* Identity card */}
      <div className="mb-6 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">Acceso Maestro Activo</p>
            <p className="text-xs text-amber-700">
              {user.email} · Superadmin · Acceso completo a todas las barberías
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : (
        <div className="space-y-4">
          {companies.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <Building2 className="mx-auto h-10 w-10 text-slate-400 mb-3" />
              <p className="font-semibold text-slate-700">No hay empresas registradas</p>
              <p className="mt-1 text-sm text-slate-500">Creá la primera empresa en la sección Empresas.</p>
            </div>
          ) : (
            companies.map(company => (
              <div key={company.id} className="rounded-[28px] border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Store className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-slate-950">{company.name}</p>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TIER_COLORS[company.plan_tier ?? 'starter']}`}>
                          {(company.plan_tier ?? 'starter').toUpperCase()}
                        </span>
                        {!company.active && (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                            INACTIVA
                          </span>
                        )}
                      </div>
                      {company.billing_email && (
                        <p className="text-xs text-slate-500">{company.billing_email}</p>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex flex-wrap items-center gap-4">
                    <StatChip
                      icon={<Store className="h-3.5 w-3.5" />}
                      value={`${company.branch_count ?? '?'} / ${company.max_branches}`}
                      label="sucursales"
                      warn={(company.branch_count ?? 0) >= company.max_branches}
                    />
                    <StatChip
                      icon={<Users className="h-3.5 w-3.5" />}
                      value={`${company.barber_count ?? '?'} / ${company.max_barbers}`}
                      label="barberos"
                      warn={(company.barber_count ?? 0) >= company.max_barbers}
                    />
                    <StatChip
                      icon={company.whatsapp_enabled ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-slate-400" />}
                      value={company.whatsapp_enabled ? 'Activo' : 'Inactivo'}
                      label="WhatsApp"
                    />
                  </div>
                </div>

                {/* Plan control */}
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Cambiar plan</p>
                  <div className="flex flex-wrap gap-2">
                    {(['starter', 'pro', 'enterprise'] as PlanTier[]).map(tier => (
                      <Button
                        key={tier}
                        size="sm"
                        variant={company.plan_tier === tier ? 'gold' : 'outline'}
                        onClick={() => void updatePlan(company.id, tier)}
                        loading={saving === company.id}
                      >
                        {PLAN_LABELS[tier]}
                      </Button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Plan actual: máx. {company.max_branches} sucursal{company.max_branches !== 1 ? 'es' : ''} ·
                    máx. {company.max_barbers} barbero{company.max_barbers !== 1 ? 's' : ''} ·
                    WhatsApp: {company.whatsapp_enabled ? 'sí' : 'no'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Architecture notes */}
      <div className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <Settings className="h-5 w-5 text-slate-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Notas de arquitectura</p>
            <p>• Tu acceso maestro está protegido por <code className="rounded bg-slate-200 px-1 text-xs">SUPERADMIN_UUID</code> en las variables de entorno del servidor.</p>
            <p>• Los admins de cada barbería no pueden ver este panel ni modificar sus propios límites de plan.</p>
            <p>• Para agregar una nueva barbería cliente: crear empresa → asignar plan → crear sucursales dentro del límite.</p>
            <p>• Migrá <code className="rounded bg-slate-200 px-1 text-xs">supabase-migration-v6.sql</code> para activar las columnas de plan y la cola de WhatsApp.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatChip({
  icon,
  value,
  label,
  warn,
}: {
  icon: React.ReactNode
  value: string
  label: string
  warn?: boolean
}) {
  return (
    <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium ${
      warn ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'
    }`}>
      {icon}
      <span>{value}</span>
      <span className="text-slate-400">{label}</span>
    </div>
  )
}
