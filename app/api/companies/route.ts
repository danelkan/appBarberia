import { NextRequest, NextResponse } from 'next/server'
import { COMPANY_PLAN_TIERS, getCompanyPlanDefaults, normalizeOptionalBoolean, normalizeOptionalText, normalizePositiveInt, slugifyCompanyName } from '@/lib/companies'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'manage_companies')
  if (denied) return denied

  const supabase = createSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const withBranches   = searchParams.get('branches')      === '1'
  const includeStats   = searchParams.get('include_stats') === '1'

  // include_stats adds branch/barber counts — superadmin only (master panel)
  if (includeStats && auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Solo el superadmin puede ver estadísticas globales' }, { status: 403 })
  }

  const selectQuery = (withBranches || includeStats)
    ? 'id, name, slug, email, phone, address, active, created_at, plan_tier, max_branches, max_barbers, billing_email, branches(id, name, address, active, company_id)'
    : 'id, name, slug, email, phone, address, active, created_at, plan_tier, max_branches, max_barbers, billing_email'

  const { data, error } = await supabase
    .from('companies')
    .select(selectQuery)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let companies = data ?? []

  if (includeStats) {
    const companyIds = companies.map((company: any) => company.id)
    const [{ data: companyBarbers }, { data: companyUsers }] = await Promise.all([
      companyIds.length > 0
        ? supabase.from('barbers').select('id, company_id').in('company_id', companyIds)
        : Promise.resolve({ data: [] as any[] }),
      companyIds.length > 0
        ? supabase.from('user_roles').select('user_id, company_id, active').in('company_id', companyIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    companies = companies.map((c: any) => {
      const activeBranches = (c.branches ?? []).filter((b: any) => b.active)
      const barberCount = (companyBarbers ?? []).filter((barber: any) => barber.company_id === c.id).length
      const userCount = (companyUsers ?? []).filter((role: any) => role.company_id === c.id && role.active !== false).length
      const defaults = getCompanyPlanDefaults(c.plan_tier)

      return {
        ...c,
        plan_tier: c.plan_tier ?? 'starter',
        max_branches: c.max_branches ?? defaults.max_branches,
        max_barbers: c.max_barbers ?? defaults.max_barbers,
        branch_count: activeBranches.length,
        barber_count: barberCount,
        user_count: userCount,
      }
    })
  }

  return NextResponse.json({ companies })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'manage_companies')
  if (denied) return denied
  if (auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Solo el superadmin puede crear barberías' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = normalizeOptionalText(body.email)
  const phone = normalizeOptionalText(body.phone)
  const address = normalizeOptionalText(body.address)
  const active = normalizeOptionalBoolean(body.active, true)
  const requestedPlanTier = typeof body.plan_tier === 'string' ? body.plan_tier : 'starter'
  const planTier = COMPANY_PLAN_TIERS.includes(requestedPlanTier) ? requestedPlanTier : 'starter'
  const planDefaults = getCompanyPlanDefaults(planTier)
  const maxBranches = normalizePositiveInt(body.max_branches, planDefaults.max_branches)
  const maxBarbers = normalizePositiveInt(body.max_barbers, planDefaults.max_barbers)

  if (!name) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  }

  const slug = slugifyCompanyName(name)
  if (!slug) {
    return NextResponse.json({ error: 'No se pudo generar un slug válido para la barbería' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { data: existingSlug } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existingSlug) {
    return NextResponse.json({ error: 'Ya existe una barbería con ese nombre/slug' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('companies')
    .insert({
      name,
      slug,
      email,
      phone,
      address,
      active,
      plan_tier: planTier,
      max_branches: maxBranches,
      max_barbers: maxBarbers,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ company: data }, { status: 201 })
}
