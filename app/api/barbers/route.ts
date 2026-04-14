import { NextRequest, NextResponse } from 'next/server'
import { getAssignedBranchIdsByBarber, listVisibleBarbers } from '@/lib/barbers'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/api-auth'
import { resolveBranchCompanyScope, resolveCompanyId, resolveSingleCompanyLegacyScope } from '@/lib/tenant'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimit = checkRateLimit(req, 'barbers:read', RateLimitConfigs.read)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  const supabase = createSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branch_id') ?? undefined
  const companyIdParam = searchParams.get('company_id') ?? undefined

  // If an authenticated admin/barber is calling, scope by their company.
  // For public booking flow (unauthenticated), use the company_id query param.
  const auth = await requireAuth(req).catch(() => null)
  const authCompanyId = auth ? (await resolveCompanyId(auth, supabase)) ?? undefined : undefined
  const publicCompanyScope = auth
    ? { companyId: null, allowLegacyUnscoped: false }
    : branchId
      ? await resolveBranchCompanyScope(supabase, branchId)
      : await resolveSingleCompanyLegacyScope(supabase, companyIdParam)
  const companyId = authCompanyId ?? publicCompanyScope.companyId ?? undefined

  if (!auth && !branchId && !companyId) {
    return NextResponse.json({ barbers: [] })
  }
  if (auth && auth.role !== 'superadmin' && !companyId) {
    return NextResponse.json({ barbers: [] })
  }

  const { barbers: data, userRoles: activeRoles, branchLinks } = await listVisibleBarbers(
    supabase,
    {
      branchId,
      companyId,
      allowLegacyUnscoped: !auth && publicCompanyScope.allowLegacyUnscoped,
    }
  )
  const assignedBranchIdsByBarber = getAssignedBranchIdsByBarber({
    userRoles: activeRoles ?? [],
    branchLinks: branchLinks ?? [],
  })
  const allAssignedBranchIds = Array.from(
    new Set(
      Array.from(assignedBranchIdsByBarber.values()).flatMap(branchIds => branchIds)
    )
  )
  const assignedBranchesResult = allAssignedBranchIds.length > 0
    ? await (async () => {
        let query = supabase.from('branches').select('*').in('id', allAssignedBranchIds)
        if (companyId) {
          query = query.eq('company_id', companyId)
        }
        return query
      })()
    : { data: [] }
  const assignedBranches = assignedBranchesResult.data ?? []
  const branchesById = new Map((assignedBranches ?? []).map((branch: any) => [branch.id, branch]))

  const rolesByBarberId = new Map(
    (activeRoles ?? [])
      .filter((row: any) => row.barber_id && row.role)
      .map((row: any) => [row.barber_id, row.role])
  )

  const barbers = (data ?? []).map((barber) => {
    const assignedBranchIds = (assignedBranchIdsByBarber.get(barber.id) ?? [])
      .filter(id => !branchId || id === branchId)
    const branches = assignedBranchIds
      .map(branchId => branchesById.get(branchId))
      .filter(Boolean)

    return {
      ...barber,
      role: rolesByBarberId.get(barber.id) ?? 'barber',
      branches,
      branch_ids: assignedBranchIds,
    }
  })

  const response = NextResponse.json({ barbers })
  response.headers.set('Cache-Control', 'no-store')
  
  // Add rate limit headers
  const headers = getRateLimitHeaders(rateLimit)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}
