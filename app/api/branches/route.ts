import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { type AuthRoleContext, requireAuth, requireAdminAuth, requirePermission, unauthorizedResponse, forbiddenResponse, hasPermission } from '@/lib/api-auth'
import { buildCompanyScopeFilter, resolveAccessibleBranchIds, resolveCompanyIdFromBranch, resolveSingleCompanyLegacyScope } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

async function getCompanyIdForAuth(supabase: ReturnType<typeof createSupabaseAdmin>, auth: AuthRoleContext) {
  if (auth.role === 'superadmin') return auth.company_id ?? null
  if (auth.company_id) return auth.company_id

  if (auth.branch_ids.length === 0) {
    const { data: companies } = await supabase
      .from('companies')
      .select('id')
      .eq('active', true)

    return (companies ?? []).length === 1 ? (companies![0].id as string) : null
  }

  const { data: branch } = await supabase
    .from('branches')
    .select('company_id')
    .eq('id', auth.branch_ids[0])
    .maybeSingle()

  const companyId = (branch?.company_id as string | null) ?? null
  if (companyId) return companyId

  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('active', true)

  return (companies ?? []).length === 1 ? (companies![0].id as string) : null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const includeInactive = searchParams.get('all') === '1'
  const companyIdParam = searchParams.get('company_id')

  const supabase = createSupabaseAdmin()

  if (includeInactive) {
    // Any authenticated user can call ?all=1 from the admin layout.
    // Only users with manage_branches see inactive branches; others get active-only.
    const auth = await requireAuth(req)
    if (!auth) return unauthorizedResponse()

    const canManage = hasPermission(auth, 'manage_branches')
    let query = supabase.from('branches').select('*, company:companies(id, name)').order('name')
    if (!canManage) query = query.eq('active', true)
    if (auth.role !== 'superadmin') {
      const companyId = await getCompanyIdForAuth(supabase, auth)
      if (companyId) {
        query = query.eq('company_id', companyId)
      } else if (auth.branch_ids.length > 0) {
        query = query.in('id', auth.branch_ids)
      } else {
        return NextResponse.json({ branches: [] })
      }
      const accessibleBranchIds = await resolveAccessibleBranchIds(auth, supabase)
      if (accessibleBranchIds.length > 0) {
        query = query.in('id', accessibleBranchIds)
      }
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ branches: data ?? [] })
  }

  // Public: active branches only — no auth required
  const effectiveCompanyId = companyIdParam
    ?? await resolveCompanyIdFromBranch(supabase, null)
  const publicCompanyScope = await resolveSingleCompanyLegacyScope(supabase, effectiveCompanyId)

  if (!effectiveCompanyId) {
    return NextResponse.json({ branches: [] })
  }

  const { data, error } = await supabase
    .from('branches')
    .select('*, company:companies(id, name)')
    .eq('active', true)
    .or(buildCompanyScopeFilter('company_id', effectiveCompanyId, publicCompanyScope.allowLegacyUnscoped))
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ branches: data ?? [] })
}

export async function POST(req: NextRequest) {
  // Only superadmin can create branches. Admins can only edit existing ones.
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()
  if (auth.role !== 'superadmin') {
    return forbiddenResponse('Solo el superadmin puede crear sucursales')
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  const { name, address, phone, active, company_id } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const scopedCompanyId = auth.role === 'superadmin'
    ? company_id ?? null
    : await getCompanyIdForAuth(supabase, auth)

  // Plan enforcement: non-superadmins are subject to their company's max_branches limit
  if (auth.role !== 'superadmin' && scopedCompanyId) {
    const { data: company } = await supabase
      .from('companies')
      .select('max_branches')
      .eq('id', scopedCompanyId)
      .maybeSingle()

    if (company) {
      const { count } = await supabase
        .from('branches')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', scopedCompanyId)
        .eq('active', true)

      const maxBranches = company.max_branches ?? 1
      if ((count ?? 0) >= maxBranches) {
        return NextResponse.json({
          error: `Tu plan no permite más de ${maxBranches} sucursal${maxBranches !== 1 ? 'es' : ''}. Contactá al administrador del software para actualizar tu plan.`
        }, { status: 403 })
      }
    }
  }

  const { data, error } = await supabase
    .from('branches')
    .insert({ name: name.trim(), address: address?.trim() || null, phone: phone?.trim() || null, active: active ?? true, company_id: scopedCompanyId })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ branch: data })
}
