import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { sendCancellationEmail } from '@/lib/emails'
import { requireAdminAuth, unauthorizedResponse } from '@/lib/api-auth'
import { updateAppointmentStatusSchema } from '@/lib/validations'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Rate limiting
  const rateLimit = checkRateLimit(req, 'appointments:write', RateLimitConfigs.write)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  // Authentication required - only admins can update status
  const auth = await requireAdminAuth(req)
  if (!auth) {
    return unauthorizedResponse()
  }

  const { id } = params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  // Parse and validate body
  const body = await req.json()
  const result = updateAppointmentStatusSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { status } = result.data

  const supabase = createSupabaseAdmin()

  const { data: appointment, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .select('*, client:clients(*), barber:barbers(*), service:services(*)')
    .single()

  if (error || !appointment) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  }

  // Send cancellation email
  if (status === 'cancelada' && appointment.client) {
    sendCancellationEmail(
      appointment.client,
      appointment.barber,
      appointment.service,
      appointment
    ).catch(console.error)
  }

  const response = NextResponse.json({ appointment })
  
  // Add rate limit headers
  const headers = getRateLimitHeaders(rateLimit)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Rate limiting
  const rateLimit = checkRateLimit(req, 'appointments:write', RateLimitConfigs.write)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  // Authentication required - only admins can delete
  const auth = await requireAdminAuth(req)
  if (!auth) {
    return unauthorizedResponse()
  }

  const { id } = params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
