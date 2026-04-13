import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'
import { resolveCompanyId } from '@/lib/tenant'
import { clientQuerySchema } from '@/lib/validations'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const rateLimit = checkRateLimit(req, 'clients:read', RateLimitConfigs.read)
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)!

  // Barbers and admins can access this endpoint — barbers see their branch's clients
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'view_clients')
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const queryParams = {
    q: searchParams.get('q') ?? undefined,
    branch_id: searchParams.get('branch_id') ?? undefined,
  }

  const result = clientQuerySchema.safeParse(queryParams)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { q, branch_id } = result.data

  const supabase = createSupabaseAdmin()

  // Determine which branch(es) to filter by.
  // Barbers are always scoped to their own branches regardless of query param.
  // Admins can optionally filter by branch_id param.
  const filterBranchIds: string[] | null =
    auth.role === 'barber'
      ? auth.branch_ids.length > 0 ? auth.branch_ids : null
      : branch_id ? [branch_id] : null

  // If a branch filter is active, resolve client IDs that have appointments there
  let allowedClientIds: string[] | null = null
  if (filterBranchIds !== null) {
    if (filterBranchIds.length === 0) {
      // Barber with no branches assigned → no clients visible
      return NextResponse.json({ clients: [] })
    }

    const { data: appts } = await supabase
      .from('appointments')
      .select('client_id')
      .in('branch_id', filterBranchIds)

    const allIds = (appts ?? [])
      .map((a: { client_id: string | null }) => a.client_id)
      .filter((id): id is string => Boolean(id))
    allowedClientIds = Array.from(new Set(allIds))

    if (allowedClientIds.length === 0) {
      return NextResponse.json({ clients: [] })
    }
  }

  // When no branch filter is active (admin listing all clients), scope to
  // the caller's company so admins from different tenants can't see each other's data.
  const companyId = filterBranchIds === null
    ? await resolveCompanyId(auth, supabase)
    : null

  let query = supabase
    .from('clients')
    .select('*, appointments(*, barber:barbers(name), service:services(name,price))')
    .order('created_at', { ascending: false })

  if (allowedClientIds !== null) {
    query = query.in('id', allowedClientIds)
  }

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  if (q) {
    const sanitizedQ = q.replace(/[%_]/g, '\\$&')
    query = query.or(`first_name.ilike.%${sanitizedQ}%,last_name.ilike.%${sanitizedQ}%,email.ilike.%${sanitizedQ}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const response = NextResponse.json({ clients: data })
  const headers = getRateLimitHeaders(rateLimit)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

// POST /api/clients — create a client manually (barbers and admins)
export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, 'clients:write', RateLimitConfigs.write)
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)!

  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()
  const supabase = createSupabaseAdmin()

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const { first_name, last_name, email, phone, birthday } = body

  if (!first_name?.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  }

  // Validate birthday format if provided
  if (birthday !== undefined && birthday !== null && birthday !== '') {
    const bdRe = /^\d{4}-\d{2}-\d{2}$/
    if (!bdRe.test(birthday)) {
      return NextResponse.json({ error: 'Formato de fecha de cumpleaños inválido (YYYY-MM-DD)' }, { status: 400 })
    }
  }

  const companyId = await resolveCompanyId(auth, supabase)

  // Check for existing client by email (if provided)
  if (email?.trim()) {
    const { data: existing } = await supabase
      .from('clients')
      .select('id, first_name, last_name, email')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ client: existing, existing: true })
    }
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      first_name: first_name.trim(),
      last_name: last_name?.trim() ?? '',
      email: email?.trim().toLowerCase() ?? null,
      phone: phone?.trim() ?? null,
      birthday: (birthday?.trim() ?? null) || null,
      ...(companyId ? { company_id: companyId } : {}),
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ client: data })
}
