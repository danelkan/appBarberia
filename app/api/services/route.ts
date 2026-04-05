import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, unauthorizedResponse } from '@/lib/api-auth'
import { createServiceSchema } from '@/lib/validations'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimit = checkRateLimit(req, 'services:read', RateLimitConfigs.read)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('services').select('*').eq('active', true).order('price')

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

  // Parse and validate body
  const body = await req.json()
  const result = createServiceSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('services').insert(result.data).select('*').single()

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
