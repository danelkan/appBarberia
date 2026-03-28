import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { calcEndTime } from '@/lib/utils'
import { sendConfirmationEmail, sendAdminNotification } from '@/lib/emails'


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to') ?? from

  const supabase = createSupabaseAdmin()

  let query = supabase
    .from('appointments')
    .select(`
      *,
      client:clients(id, first_name, last_name, email, phone),
      barber:barbers(id, name, photo_url),
      service:services(id, name, price, duration_minutes)
    `)
    .order('date')
    .order('start_time')

  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ appointments: data ?? [] })
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { serviceId, barberId, date, startTime, client: clientData } = body

    if (!serviceId || !barberId || !date || !startTime || !clientData) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()

    // 1. Fetch service for duration
    const { data: service } = await supabase
      .from('services').select('*').eq('id', serviceId).single()
    if (!service) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

    // 2. Fetch barber
    const { data: barber } = await supabase
      .from('barbers').select('*').eq('id', barberId).single()
    if (!barber) return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 })

    const endTime = calcEndTime(startTime, service.duration_minutes)

    // 3. Double-check no overlap (race condition protection)
    const { data: conflicts } = await supabase
      .from('appointments')
      .select('id')
      .eq('barber_id', barberId)
      .eq('date', date)
      .neq('status', 'cancelada')
      .lt('start_time', endTime)
      .gt('end_time', startTime)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: 'El horario ya no está disponible. Por favor elegí otro.' }, { status: 409 })
    }

    // 4. Upsert client (by email)
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
          last_name: clientData.last_name,
          email: clientData.email,
          phone: clientData.phone,
        })
        .select('id').single()
      if (clientError || !newClient) {
        return NextResponse.json({ error: 'Error creando cliente' }, { status: 500 })
      }
      clientId = newClient.id
    }

    // 5. Create appointment
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert({
        client_id: clientId,
        barber_id: barberId,
        service_id: serviceId,
        date,
        start_time: startTime,
        end_time: endTime,
        status: 'pendiente',
      })
      .select('*').single()

    if (apptError || !appointment) {
      return NextResponse.json({ error: 'Error creando turno' }, { status: 500 })
    }

    // 6. Fetch full client for email
    const { data: fullClient } = await supabase
      .from('clients').select('*').eq('id', clientId).single()

    // 7. Send emails (non-blocking)
    if (fullClient) {
      Promise.all([
        sendConfirmationEmail(fullClient, barber, service, appointment),
        sendAdminNotification(fullClient, barber, service, appointment),
      ]).catch(console.error)
    }

    return NextResponse.json({ appointment, success: true })
  } catch (err) {
    console.error('Error creating appointment:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
