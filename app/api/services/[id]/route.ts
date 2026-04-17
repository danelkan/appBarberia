import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'
import { canAccessBranch, resolveCompanyId } from '@/lib/tenant'
import { attachBranchPrices } from '@/lib/service-pricing'
import { updateServiceSchema } from '@/lib/validations'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  // Rate limiting
  const rateLimit = checkRateLimit(req, 'services:write', RateLimitConfigs.write)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  // Authentication required - only admins can update services
  const auth = await requireAdminAuth(req)
  if (!auth) {
    return unauthorizedResponse()
  }
  const denied = requirePermission(auth, 'manage_services')
  if (denied) return denied

  const { id } = params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  // Parse and validate body
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  const result = updateServiceSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const companyId = auth.role === 'superadmin' ? null : await resolveCompanyId(auth, supabase)
  const { branch_prices, ...serviceInput } = result.data
  if (branch_prices && auth.role !== 'superadmin') {
    for (const branchPrice of branch_prices) {
      const allowed = await canAccessBranch(auth, supabase, branchPrice.branch_id)
      if (!allowed) return NextResponse.json({ error: 'No tenés acceso a una de las sucursales' }, { status: 403 })
    }
  }

  let query = supabase
    .from('services')
    .update(serviceInput)
    .eq('id', id)

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data, error } = await query
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (branch_prices) {
    const { error: deleteError } = await supabase
      .from('service_branch_prices')
      .delete()
      .eq('service_id', id)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    if (branch_prices.length > 0) {
      const effectiveCompanyId = companyId ?? data.company_id
      const rows = branch_prices.map(price => ({
        company_id: effectiveCompanyId,
        service_id: id,
        branch_id: price.branch_id,
        price: price.price,
      }))
      const { error: priceError } = await supabase
        .from('service_branch_prices')
        .insert(rows)
      if (priceError) return NextResponse.json({ error: priceError.message }, { status: 500 })
    }
  }

  const [service] = await attachBranchPrices(supabase, [data])
  const response = NextResponse.json({ service })
  
  // Add rate limit headers
  const headers = getRateLimitHeaders(rateLimit)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  // Rate limiting
  const rateLimit = checkRateLimit(_ , 'services:write', RateLimitConfigs.write)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  // Authentication required - only admins can delete services
  const auth = await requireAdminAuth(_)
  if (!auth) {
    return unauthorizedResponse()
  }
  const denied = requirePermission(auth, 'manage_services')
  if (denied) return denied

  const { id } = params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const companyId = auth.role === 'superadmin' ? null : await resolveCompanyId(auth, supabase)

  let query = supabase
    .from('services')
    .update({ active: false })
    .eq('id', id)

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
