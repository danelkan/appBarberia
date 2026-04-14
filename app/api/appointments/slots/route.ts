import { NextRequest, NextResponse } from 'next/server'
import { getVisibleBarberById } from '@/lib/barbers'
import { generateTimeSlots } from '@/lib/booking-availability'
import { createSupabaseAdmin } from '@/lib/supabase'
import { resolveCompanyIdFromBranch } from '@/lib/tenant'
import { slotsQuerySchema } from '@/lib/validations'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Rate limiting - public endpoint but rate limited
  const rateLimit = checkRateLimit(req, 'slots:read', RateLimitConfigs.read)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  const { searchParams } = new URL(req.url)
  const queryParams = {
    barberId: searchParams.get('barberId'),
    branchId: searchParams.get('branchId'),
    date: searchParams.get('date'),
    duration: searchParams.get('duration'),
  }

  // Validate query params
  const result = slotsQuerySchema.safeParse(queryParams)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { barberId, branchId, date, duration } = result.data

  const supabase = createSupabaseAdmin()
  const companyId = await resolveCompanyIdFromBranch(supabase, branchId)
  if (!companyId) {
    return NextResponse.json({ error: 'No se pudo resolver la barbería' }, { status: 400 })
  }

  const barber = await getVisibleBarberById(supabase, barberId, { branchId, companyId })

  if (!barber) {
    return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 })
  }

  const { data: appointments = [] } = await supabase
    .from('appointments')
    .select('start_time, end_time, status')
    .eq('company_id', companyId)
    .eq('barber_id', barberId)
    .eq('date', date)
    .neq('status', 'cancelada')

  const slots = generateTimeSlots(date, barber.availability, duration, appointments as any)

  const response = NextResponse.json({ slots })

  // Slot availability is time-sensitive to the current minute, so never serve stale results.
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')

  const headers = getRateLimitHeaders(rateLimit)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}
