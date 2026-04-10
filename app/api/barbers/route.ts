import { NextRequest, NextResponse } from 'next/server'
import { listVisibleBarbers } from '@/lib/barbers'
import { createSupabaseAdmin } from '@/lib/supabase'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimit = checkRateLimit(req, 'barbers:read', RateLimitConfigs.read)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  const supabase = createSupabaseAdmin()
  const branchId = new URL(req.url).searchParams.get('branch_id') ?? undefined
  const { barbers: data, userRoles: activeRoles, branchLinks } = await listVisibleBarbers(
    supabase,
    branchId ? { branchId } : undefined
  )

  const rolesByBarberId = new Map(
    (activeRoles ?? [])
      .filter((row: any) => row.barber_id && row.role)
      .map((row: any) => [row.barber_id, row.role])
  )

  const barbers = (data ?? []).map((barber) => {
    const branches = (branchLinks ?? [])
      .filter((link: any) => link.barber_id === barber.id && (!branchId || link.branch_id === branchId))
      .map((link: any) => link.branch)
      .filter(Boolean)

    return {
      ...barber,
      role: rolesByBarberId.get(barber.id) ?? 'barber',
      branches,
      branch_ids: branches.map((branch: { id: string }) => branch.id),
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
