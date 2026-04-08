import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { calcEndTime } from '@/lib/utils'
import { requireAdminAuth, unauthorizedResponse } from '@/lib/api-auth'

// POST /api/admin/appointments
// Admin-only instant booking: email is optional, no public rate limit
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const {
    client_name,
    client_phone,
    client_email,
    client_id: existingClientId,
    service_id,
    barber_id,
    branch_id,
    date,
    start_time,
  } = body

  if (!service_id || !barber_id || !date || !start_time) {
    return NextResponse.json({ error: 'Faltan campos obligatorios: servicio, barbero, fecha y hora' }, { status: 400 })
  }

  if (!existingClientId && !client_name?.trim()) {
    return NextResponse.json({ error: 'Nombre del cliente requerido' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // Fetch service and barber
  const [{ data: service, error: serviceError }, { data: barber, error: barberError }] = await Promise.all([
    supabase.from('services').select('*').eq('id', service_id).single(),
    supabase.from('barbers').select('*').eq('id', barber_id).single(),
  ])

  if (serviceError || !service) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
  if (barberError || !barber) return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 })

  const end_time = calcEndTime(start_time, service.duration_minutes)

  // Check for conflicts
  const { data: conflicts } = await supabase
    .from('appointments')
    .select('id')
    .eq('barber_id', barber_id)
    .eq('date', date)
    .neq('status', 'cancelada')
    .lt('start_time', end_time)
    .gt('end_time', start_time)

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json({ error: 'El horario ya está ocupado. Elegí otro horario.' }, { status: 409 })
  }

  // Resolve client
  let clientId: string

  if (existingClientId) {
    clientId = existingClientId
  } else {
    const emailNorm = client_email?.trim().toLowerCase() || null

    // Dedup by email only if provided
    if (emailNorm) {
      const { data: byEmail } = await supabase
        .from('clients')
        .select('id')
        .eq('email', emailNorm)
        .maybeSingle()

      if (byEmail) {
        clientId = byEmail.id
      } else {
        const { data: newClient, error: ce } = await supabase
          .from('clients')
          .insert({
            first_name: client_name.trim(),
            last_name:  '',
            email:      emailNorm,
            phone:      client_phone?.trim() ?? null,
          })
          .select('id')
          .single()

        if (ce || !newClient) return NextResponse.json({ error: 'Error creando cliente' }, { status: 500 })
        clientId = newClient.id
      }
    } else {
      // No email — create new client (walk-in)
      const { data: newClient, error: ce } = await supabase
        .from('clients')
        .insert({
          first_name: client_name.trim(),
          last_name:  '',
          email:      null,
          phone:      client_phone?.trim() ?? null,
        })
        .select('id')
        .single()

      if (ce || !newClient) return NextResponse.json({ error: 'Error creando cliente' }, { status: 500 })
      clientId = newClient.id
    }
  }

  // Create appointment
  const { data: appointment, error: apptError } = await supabase
    .from('appointments')
    .insert({
      client_id:  clientId,
      barber_id,
      service_id,
      branch_id:  branch_id ?? null,
      date,
      start_time,
      end_time,
      status: 'pendiente',
    })
    .select('*, client:clients(*), barber:barbers(*), service:services(*)')
    .single()

  if (apptError || !appointment) {
    return NextResponse.json({ error: 'Error creando turno' }, { status: 500 })
  }

  return NextResponse.json({ appointment }, { status: 201 })
}
