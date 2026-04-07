import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'
import { clientQuerySchema } from '@/lib/validations'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

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
