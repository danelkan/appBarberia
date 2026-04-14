import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, requireAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'
import { buildCompanyScopeFilter, resolveBranchCompanyScope, resolveCompanyId, resolveSingleCompanyLegacyScope } from '@/lib/tenant'
import { createServiceSchema } from '@/lib/validations'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimit = checkRateLimit(req, 'services:read', RateLimitConfigs.read)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  const supabase = createSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  // Prefer explicit param (public booking flow); fall back to auth context if present
  const companyIdParam = searchParams.get('company_id') ?? undefined
  const branchIdParam = searchParams.get('branch_id') ?? undefined

  const auth = await requireAuth(req).catch(() => null)
  const authCompanyId = auth
    ? await resolveCompanyId(auth, supabase)
    : null
  const publicCompanyScope = auth
    ? { companyId: null, allowLegacyUnscoped: false }
    : branchIdParam
      ? await resolveBranchCompanyScope(supabase, branchIdParam)
      : await resolveSingleCompanyLegacyScope(supabase, companyIdParam)
  const effectiveCompanyId = authCompanyId ?? publicCompanyScope.companyId

  let query = supabase.from('services').select('*').eq('active', true).order('price')
  if (effectiveCompanyId) {
    query = auth
      ? query.eq('company_id', effectiveCompanyId)
      : query.or(buildCompanyScopeFilter('company_id', effectiveCompanyId, publicCompanyScope.allowLegacyUnscoped))
  } else if (auth && auth.role !== 'superadmin') {
    return NextResponse.json({ services: [] })
  } else if (!auth) {
    return NextResponse.json({ services: [] })
  }
  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const response = NextResponse.json({ services: data })
  
  // Add rate limit headers
  const headers = getRateLimitHeaders(rateLimit)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimit = checkRateLimit(req, 'services:write', RateLimitConfigs.write)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  // Authentication required - only admins can create services
  const auth = await requireAdminAuth(req)
  if (!auth) {
    return unauthorizedResponse()
  }
  const denied = requirePermission(auth, 'manage_services')
  if (denied) return denied

  // Parse and validate body
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  const result = createServiceSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const companyId = await resolveCompanyId(auth, supabase)
  if (!companyId) {
    return NextResponse.json({ error: 'Empresa no resuelta para este usuario' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('services')
    .insert({ ...result.data, company_id: companyId })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const response = NextResponse.json({ service: data })
  
  // Add rate limit headers
  const headers = getRateLimitHeaders(rateLimit)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}
