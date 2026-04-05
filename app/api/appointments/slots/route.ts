import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { generateTimeSlots } from '@/lib/utils'
import { slotsQuerySchema } from '@/lib/validations'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  // Rate limiting - public endpoint but rate limited
  const rateLimit = checkRateLimit(req, 'slots:read', RateLimitConfigs.read)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  const { searchParams } = new URL(req.url)
  const queryParams = {
    barberId: searchParams.get('barberId'),
    date: searchParams.get('date'),
    duration: searchParams.get('duration'),
  }

  // Validate query params
  const result = slotsQuerySchema.safeParse(queryParams)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { barberId, date, duration } = result.data

  const supabase = createSupabaseAdmin()

  // Fetch barber availability
  const { data: barber, error: barberError } = await supabase
    .from('barbers')
    .select('availability')
    .eq('id', barberId)
    .single()

  if (barberError || !barber) {
    return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 })
  }

  // Fetch existing appointments for this barber on this date
  const { data: appointments = [] } = await supabase
    .from('appointments')
    .select('start_time, end_time, status')
    .eq('barber_id', barberId)
    .eq('date', date)
    .neq('status', 'cancelada')

  const slots = generateTimeSlots(date, barber.availability, duration, appointments as any)

  const response = NextResponse.json({ slots })
  
  // Add rate limit headers
  const headers = getRateLimitHeaders(rateLimit)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}
