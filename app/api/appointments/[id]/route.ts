import { NextRequest, NextResponse } from 'next/server'
import { getVisibleBarberById } from '@/lib/barbers'
import { calcEndTime, isSlotAvailable } from '@/lib/booking-availability'
import { createSupabaseAdmin } from '@/lib/supabase'
import { sendCancellationEmail } from '@/lib/emails'
import { requireAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'
import { canAccessBranch, resolveCompanyId } from '@/lib/tenant'
import { updateAppointmentStatusSchema } from '@/lib/validations'
import { resolveServiceForBranch } from '@/lib/service-pricing'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const timeRegex = /^\d{2}:\d{2}$/

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

  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  // Parse and validate body
  const body = await req.json()
  const hasScheduleUpdate = ['start_time', 'service_id', 'barber_id'].some(key => body[key] !== undefined)
  const statusResult = body.status !== undefined ? updateAppointmentStatusSchema.safeParse({ status: body.status }) : null

  if (body.status !== undefined && !statusResult?.success) {
    return NextResponse.json({ error: statusResult?.error.flatten() }, { status: 400 })
  }

  if (!hasScheduleUpdate && body.status === undefined) {
    return NextResponse.json({ error: 'No hay cambios para guardar' }, { status: 400 })
  }

  if (body.start_time !== undefined && (typeof body.start_time !== 'string' || !timeRegex.test(body.start_time))) {
    return NextResponse.json({ error: 'Hora inválida' }, { status: 400 })
  }

  if (body.service_id !== undefined && (typeof body.service_id !== 'string' || !uuidRegex.test(body.service_id))) {
    return NextResponse.json({ error: 'Servicio inválido' }, { status: 400 })
  }

  if (body.barber_id !== undefined && (typeof body.barber_id !== 'string' || !uuidRegex.test(body.barber_id))) {
    return NextResponse.json({ error: 'Barbero inválido' }, { status: 400 })
  }

  const status = statusResult?.success ? statusResult.data.status : undefined
  const permission = status === 'cancelada' ? 'cancel_appointments' : 'edit_appointments'
  const denied = requirePermission(auth, permission)
  if (denied) return denied

  const supabase = createSupabaseAdmin()
  const companyId = auth.role === 'superadmin' ? null : await resolveCompanyId(auth, supabase)

  let existingQuery = supabase
    .from('appointments')
    .select('id, branch_id, barber_id, service_id, company_id, date, start_time, end_time')
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

  const updatePayload: Record<string, unknown> = {}
  if (status) updatePayload.status = status

  if (hasScheduleUpdate) {
    const branchId = existingAppointment.branch_id
    const effectiveCompanyId = existingAppointment.company_id ?? companyId
    const nextServiceId = body.service_id ?? existingAppointment.service_id
    const nextBarberId = body.barber_id ?? existingAppointment.barber_id
    const nextStartTime = body.start_time ?? existingAppointment.start_time

    if (!branchId || !effectiveCompanyId) {
      return NextResponse.json({ error: 'No se pudo resolver la sucursal del turno' }, { status: 400 })
    }

    if (auth.role === 'barber' && nextBarberId !== auth.barber_id) {
      return NextResponse.json({ error: 'No podés asignar turnos a otro barbero' }, { status: 403 })
    }

    const [{ service, error: serviceError }, barber] = await Promise.all([
      resolveServiceForBranch(supabase, { serviceId: nextServiceId, branchId, companyId: effectiveCompanyId }),
      getVisibleBarberById(supabase, nextBarberId, { branchId, companyId: effectiveCompanyId }),
    ])

    if (serviceError || !service) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
    if (!barber) return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 })

    const nextEndTime = calcEndTime(nextStartTime, service.duration_minutes)
    const { data: appointmentsForDay = [] } = await supabase
      .from('appointments')
      .select('id, start_time, end_time, status')
      .eq('company_id', effectiveCompanyId)
      .eq('barber_id', nextBarberId)
      .eq('date', existingAppointment.date)
      .neq('status', 'cancelada')

    const availabilityCheck = isSlotAvailable({
      date: existingAppointment.date,
      startTime: nextStartTime,
      durationMinutes: service.duration_minutes,
      availability: barber.availability,
      existingAppointments: (appointmentsForDay as any[])
        .filter(appointment => appointment.id !== id)
        .map(({ start_time, end_time, status }) => ({ start_time, end_time, status })),
      skipCutoff: true,
    })

    if (!availabilityCheck.available) {
      if (availabilityCheck.reason === 'day_unavailable' || availabilityCheck.reason === 'outside_schedule') {
        return NextResponse.json({ error: 'Ese horario no pertenece a la disponibilidad actual del barbero.' }, { status: 400 })
      }

      return NextResponse.json({ error: 'El horario ya está ocupado. Elegí otro horario.' }, { status: 409 })
    }

    updatePayload.service_id = nextServiceId
    updatePayload.barber_id = nextBarberId
    updatePayload.start_time = nextStartTime
    updatePayload.end_time = nextEndTime
    updatePayload.service_price = service.price
  }

  let query = supabase
    .from('appointments')
    .update(updatePayload)
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
    const pricedService = appointment.service
      ? { ...appointment.service, price: appointment.service_price ?? appointment.service.price }
      : appointment.service
    sendCancellationEmail(
      appointment.client,
      appointment.barber,
      pricedService,
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
