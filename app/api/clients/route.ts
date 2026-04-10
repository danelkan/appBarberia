import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, requireAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'
import { clientQuerySchema } from '@/lib/validations'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimit = checkRateLimit(req, 'clients:read', RateLimitConfigs.read)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  // Authentication required - only admins can view all clients
  const auth = await requireAdminAuth(req)
  if (!auth) {
    return unauthorizedResponse()
  }
  const denied = requirePermission(auth, 'view_clients')
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const queryParams = {
    q: searchParams.get('q') ?? undefined,
  }

  // Validate query params
  const result = clientQuerySchema.safeParse(queryParams)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { q } = result.data

  const supabase = createSupabaseAdmin()

  let query = supabase
    .from('clients')
    .select('*, appointments(*, barber:barbers(name), service:services(name,price))')
    .order('created_at', { ascending: false })

  if (q) {
    // Sanitize search query to prevent injection
    const sanitizedQ = q.replace(/[%_]/g, '\\$&')
    query = query.or(`first_name.ilike.%${sanitizedQ}%,last_name.ilike.%${sanitizedQ}%,email.ilike.%${sanitizedQ}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const response = NextResponse.json({ clients: data })
  
  // Add rate limit headers
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

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const { first_name, last_name, email, phone } = body

  if (!first_name?.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

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
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ client: data })
}
