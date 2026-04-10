import { NextRequest, NextResponse } from 'next/server'
import { getVisibleBarberById } from '@/lib/barbers'
import { createSupabaseAdmin } from '@/lib/supabase'
import { calcEndTime } from '@/lib/utils'
import { sendBookingEmails } from '@/lib/emails'
import { applyAuthCookies, requireAuth, unauthorizedResponse } from '@/lib/api-auth'
import { createAppointmentSchema, appointmentQuerySchema } from '@/lib/validations'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse, getRateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

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

  if (from)               query = query.gte('date', from)
  if (to)                 query = query.lte('date', to)
  if (effectiveBarberId)  query = query.eq('barber_id', effectiveBarberId)
  if (branchId)           query = query.eq('branch_id', branchId)
  if (status)             query = query.eq('status', status)

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

    const { data: service, error: serviceError } = await supabase
      .from('services').select('*').eq('id', serviceId).single()
    if (serviceError || !service) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
    }

    const barber = await getVisibleBarberById(supabase, barberId, { branchId })
    if (!barber) {
      return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 })
    }

    const endTime = calcEndTime(startTime, service.duration_minutes)

    const { data: conflicts } = await supabase
      .from('appointments').select('id')
      .eq('barber_id', barberId).eq('date', date).neq('status', 'cancelada')
      .lt('start_time', endTime).gt('end_time', startTime)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: 'El horario ya no está disponible. Por favor elegí otro.' }, { status: 409 })
    }

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
        })
        .select('id').single()
      if (clientError || !newClient) {
        return NextResponse.json({ error: 'Error creando cliente' }, { status: 500 })
      }
      clientId = newClient.id
    }

    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert({ client_id: clientId, barber_id: barberId, service_id: serviceId, branch_id: branchId ?? null, date, start_time: startTime, end_time: endTime, status: 'pendiente' })
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
