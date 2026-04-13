import { NextRequest, NextResponse } from 'next/server'
import { getVisibleBarberById } from '@/lib/barbers'
import { calcEndTime, isSlotAvailable } from '@/lib/booking-availability'
import { createSupabaseAdmin } from '@/lib/supabase'
import { sendBookingEmails } from '@/lib/emails'
import { applyAuthCookies, type AuthRoleContext, requireAuth, unauthorizedResponse } from '@/lib/api-auth'
import { resolveCompanyIdFromBranch } from '@/lib/tenant'
import { createAppointmentSchema, appointmentQuerySchema } from '@/lib/validations'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

async function resolveCompanyBranchIds(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  auth: AuthRoleContext
): Promise<string[]> {
  // Use branch_ids from token if available
  if (auth.branch_ids.length > 0) return auth.branch_ids

  let companyId = auth.company_id ?? null

  if (!companyId) {
    // Derive company from a single active company (single-tenant default)
    const { data: companies } = await supabase.from('companies').select('id').eq('active', true)
    if ((companies ?? []).length === 1) companyId = companies![0].id as string
  }

  if (!companyId) return []

  const { data: branches } = await supabase.from('branches').select('id').eq('company_id', companyId)
  return (branches ?? []).map((b: any) => b.id as string)
}

export async function GET(req: NextRequest) {
  const rateLimit = checkRateLimit(req, 'appointments:read', RateLimitConfigs.read)
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)!

  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const queryParams = {
    from: searchParams.get('from') ?? undefined,
    to:   searchParams.get('to')   ?? undefined,
  }

  const queryResult = appointmentQuerySchema.safeParse(queryParams)
  if (!queryResult.success) {
    return applyAuthCookies(NextResponse.json({ error: queryResult.error.flatten() }, { status: 400 }), auth)
  }

  const { from, to } = queryResult.data
  // Optional filters
  const barberId = searchParams.get('barber_id') ?? undefined
  const branchId = searchParams.get('branch_id') ?? undefined
  const status   = searchParams.get('status')    ?? undefined

  // Barbers may only see their own appointments
  const effectiveBarberId = auth.role === 'barber'
    ? (auth.barber_id ?? barberId)
    : barberId

  const supabase = createSupabaseAdmin()

  // Resolve which branch IDs this caller is allowed to see
  // Superadmin sees everything; everyone else is scoped to their company
  let allowedBranchIds: string[] | null = null
  if (auth.role !== 'superadmin') {
    if (branchId) {
      allowedBranchIds = [branchId]
    } else {
      allowedBranchIds = await resolveCompanyBranchIds(supabase, auth)
    }
  }

  let query = supabase
    .from('appointments')
    .select(`
      *,
      client:clients(id, first_name, last_name, email, phone),
      barber:barbers(id, name, photo_url),
      service:services(id, name, price, duration_minutes),
      branch:branches(id, name, address),
      payment:payments(id, amount, method, receipt_number)
    `)
    .order('date', { ascending: false })
    .order('start_time', { ascending: false })

  if (from)                      query = query.gte('date', from)
  if (to)                        query = query.lte('date', to)
  if (effectiveBarberId)         query = query.eq('barber_id', effectiveBarberId)
  if (allowedBranchIds)          query = query.in('branch_id', allowedBranchIds)
  else if (branchId)             query = query.eq('branch_id', branchId)
  if (status)                    query = query.eq('status', status)

  const { data, error } = await query

  if (error) {
    return applyAuthCookies(NextResponse.json({ error: error.message }, { status: 500 }), auth)
  }

  const response = NextResponse.json({ appointments: data ?? [] })
  const headers = getRateLimitHeaders(rateLimit)
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
  return applyAuthCookies(response, auth)
}

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, 'appointments:booking', RateLimitConfigs.booking)
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)!

  try {
    const body = await req.json()
    const result = createAppointmentSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
    }

    const { serviceId, barberId, branchId, date, startTime, client: clientData } = result.data
    const supabase = createSupabaseAdmin()

    // Parallelize service + barber lookup — saves ~100ms vs sequential
    const [serviceResult, barber] = await Promise.all([
      supabase.from('services').select('*').eq('id', serviceId).single(),
      getVisibleBarberById(supabase, barberId, { branchId }),
    ])
    const { data: service, error: serviceError } = serviceResult
    if (serviceError || !service) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
    }
    if (!barber) {
      return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 })
    }

    const endTime = calcEndTime(startTime, service.duration_minutes)

    const { data: appointmentsForDay = [] } = await supabase
      .from('appointments')
      .select('start_time, end_time, status')
      .eq('barber_id', barberId)
      .eq('date', date)
      .neq('status', 'cancelada')

    const availabilityCheck = isSlotAvailable({
      date,
      startTime,
      durationMinutes: service.duration_minutes,
      availability: barber.availability,
      existingAppointments: appointmentsForDay as any,
    })

    if (!availabilityCheck.available) {
      if (availabilityCheck.reason === 'day_unavailable' || availabilityCheck.reason === 'outside_schedule') {
        return NextResponse.json({ error: 'Ese horario no pertenece a la disponibilidad actual del barbero.' }, { status: 400 })
      }

      return NextResponse.json({ error: 'El horario ya no está disponible. Por favor elegí otro.' }, { status: 409 })
    }

    const companyId = await resolveCompanyIdFromBranch(supabase, branchId)

    const { data: existingClient } = await supabase
      .from('clients').select('id').eq('email', clientData.email).single()

    let clientId: string
    if (existingClient) {
      clientId = existingClient.id
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          first_name: clientData.first_name,
          last_name: clientData.last_name || '',
          email: clientData.email,
          phone: clientData.phone,
          birthday: clientData.birthday ?? null,
          ...(companyId ? { company_id: companyId } : {}),
        })
        .select('id').single()
      if (clientError || !newClient) {
        return NextResponse.json({ error: 'Error creando cliente' }, { status: 500 })
      }
      clientId = newClient.id
    }

    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert({
        client_id: clientId,
        barber_id: barberId,
        service_id: serviceId,
        branch_id: branchId ?? null,
        company_id: companyId,
        date,
        start_time: startTime,
        end_time: endTime,
        status: 'pendiente',
      })
      .select('*').single()

    if (apptError || !appointment) {
      return NextResponse.json({ error: 'Error creando turno' }, { status: 500 })
    }

    const { data: fullClient } = await supabase.from('clients').select('*').eq('id', clientId).single()

    if (fullClient) {
      await sendBookingEmails(fullClient, barber, service, appointment)
    }

    const response = NextResponse.json({ appointment, success: true })
    const headers = getRateLimitHeaders(rateLimit)
    Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
    return response
  } catch (err) {
    console.error('Error creating appointment:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
