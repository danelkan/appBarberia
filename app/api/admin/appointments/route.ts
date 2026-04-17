import { NextRequest, NextResponse } from 'next/server'
import { getVisibleBarberById } from '@/lib/barbers'
import { calcEndTime, isSlotAvailable } from '@/lib/booking-availability'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'
import { canAccessBranch, resolveCompanyId } from '@/lib/tenant'
import { notifyBarberForAppointment } from '@/lib/push'

export const dynamic = 'force-dynamic'

// POST /api/admin/appointments
// Staff booking (admin + barbers): email is optional, no public rate limit
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'create_appointments')
  if (denied) return denied

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

  if (!branch_id) {
    return NextResponse.json({ error: 'La sucursal es obligatoria para crear un turno' }, { status: 400 })
  }

  if (!existingClientId && !client_name?.trim()) {
    return NextResponse.json({ error: 'Nombre del cliente requerido' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const companyId = await resolveCompanyId(auth, supabase)

  if (!companyId) {
    return NextResponse.json({ error: 'No se pudo resolver la empresa del usuario' }, { status: 400 })
  }

  const branchAllowed = await canAccessBranch(auth, supabase, branch_id)
  if (!branchAllowed) {
    return NextResponse.json({ error: 'No tenés acceso a esa sucursal' }, { status: 403 })
  }

  if (auth.role === 'barber' && barber_id !== auth.barber_id) {
    return NextResponse.json({ error: 'No podés crear turnos para otro barbero' }, { status: 403 })
  }

  const [{ data: service, error: serviceError }, barber] = await Promise.all([
    supabase.from('services').select('*').eq('id', service_id).eq('company_id', companyId).single(),
    getVisibleBarberById(supabase, barber_id, { branchId: branch_id, companyId }),
  ])

  if (serviceError || !service) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
  if (!barber) return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 })

  const end_time = calcEndTime(start_time, service.duration_minutes)

  const { data: appointmentsForDay = [] } = await supabase
    .from('appointments')
    .select('start_time, end_time, status')
    .eq('company_id', companyId)
    .eq('barber_id', barber_id)
    .eq('date', date)
    .neq('status', 'cancelada')

  const availabilityCheck = isSlotAvailable({
    date,
    startTime: start_time,
    durationMinutes: service.duration_minutes,
    availability: barber.availability,
    existingAppointments: appointmentsForDay as any,
    // Staff can book walk-ins at any time — the 5-min cutoff is for public self-bookings only.
    skipCutoff: true,
  })

  if (!availabilityCheck.available) {
    if (availabilityCheck.reason === 'day_unavailable' || availabilityCheck.reason === 'outside_schedule') {
      return NextResponse.json({ error: 'Ese horario no pertenece a la disponibilidad actual del barbero.' }, { status: 400 })
    }

    return NextResponse.json({ error: 'El horario ya está ocupado. Elegí otro horario.' }, { status: 409 })
  }

  // Resolve client
  let clientId: string

  if (existingClientId) {
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('id', existingClientId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (!existingClient) {
      return NextResponse.json({ error: 'Cliente no encontrado en esta empresa' }, { status: 404 })
    }

    clientId = existingClient.id
  } else {
    const emailNorm = client_email?.trim().toLowerCase() || null

    // Dedup by email only if provided
    if (emailNorm) {
      const { data: byEmail } = await supabase
        .from('clients')
        .select('id')
        .eq('company_id', companyId)
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
            company_id: companyId,
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
          company_id: companyId,
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
      company_id: companyId,
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

  notifyBarberForAppointment(supabase, {
    appointment,
    barber,
    service,
    branchId: branch_id,
    companyId,
  }).catch(console.error)

  return NextResponse.json({ appointment }, { status: 201 })
}
