import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { sendCancellationEmail } from '@/lib/emails'
import { requireAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'
import { canAccessBranch, resolveCompanyId } from '@/lib/tenant'
import { updateAppointmentStatusSchema } from '@/lib/validations'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Rate limiting
  const rateLimit = checkRateLimit(req, 'appointments:write', RateLimitConfigs.write)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)!
  }

  // Authentication required - staff can update only within their scoped agenda.
  const auth = await requireAuth(req)
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
  const permission = status === 'cancelada' ? 'cancel_appointments' : 'edit_appointments'
  const denied = requirePermission(auth, permission)
  if (denied) return denied

  const supabase = createSupabaseAdmin()
  const companyId = auth.role === 'superadmin' ? null : await resolveCompanyId(auth, supabase)

  let existingQuery = supabase
    .from('appointments')
    .select('id, branch_id, barber_id, company_id')
    .eq('id', id)

  if (companyId) {
    existingQuery = existingQuery.eq('company_id', companyId)
  }

  const { data: existingAppointment, error: existingError } = await existingQuery.single()
  if (existingError || !existingAppointment) {
    const statusCode = (existingError as { code?: string } | null)?.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({
      error: statusCode === 404 ? 'Turno no encontrado' : existingError?.message ?? 'Turno no encontrado',
    }, { status: statusCode })
  }

  if (auth.role !== 'superadmin' && existingAppointment.branch_id) {
    const allowed = await canAccessBranch(auth, supabase, existingAppointment.branch_id)
    if (!allowed) {
      return NextResponse.json({ error: 'No tenés acceso a la sucursal de este turno' }, { status: 403 })
    }
  }

  if (auth.role === 'barber' && existingAppointment.barber_id !== auth.barber_id) {
    return NextResponse.json({ error: 'No podés modificar turnos de otro barbero' }, { status: 403 })
  }

  let query = supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data: appointment, error } = await query
    .select('*, client:clients(*), barber:barbers(*), service:services(*)')
    .single()

  if (error) {
    // PGRST116 = no rows found (single() with no result)
    const status = (error as { code?: string }).code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: status === 404 ? 'Turno no encontrado' : error.message }, { status })
  }
  if (!appointment) {
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

  // Authentication required - staff can delete only within their scoped agenda.
  const auth = await requireAuth(req)
  if (!auth) {
    return unauthorizedResponse()
  }
  const denied = requirePermission(auth, 'cancel_appointments')
  if (denied) return denied

  const { id } = params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const companyId = auth.role === 'superadmin' ? null : await resolveCompanyId(auth, supabase)

  let existingQuery = supabase
    .from('appointments')
    .select('id, branch_id, barber_id, company_id')
    .eq('id', id)

  if (companyId) {
    existingQuery = existingQuery.eq('company_id', companyId)
  }

  const { data: existingAppointment, error: existingError } = await existingQuery.single()
  if (existingError || !existingAppointment) {
    const statusCode = (existingError as { code?: string } | null)?.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({
      error: statusCode === 404 ? 'Turno no encontrado' : existingError?.message ?? 'Turno no encontrado',
    }, { status: statusCode })
  }

  if (auth.role !== 'superadmin' && existingAppointment.branch_id) {
    const allowed = await canAccessBranch(auth, supabase, existingAppointment.branch_id)
    if (!allowed) {
      return NextResponse.json({ error: 'No tenés acceso a la sucursal de este turno' }, { status: 403 })
    }
  }

  if (auth.role === 'barber' && existingAppointment.barber_id !== auth.barber_id) {
    return NextResponse.json({ error: 'No podés eliminar turnos de otro barbero' }, { status: 403 })
  }

  let query = supabase
    .from('appointments')
    .delete()
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
