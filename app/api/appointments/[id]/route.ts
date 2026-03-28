import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { sendCancellationEmail } from '@/lib/emails'
import type { AppointmentStatus } from '@/types'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const { status }: { status: AppointmentStatus } = await req.json()

  if (!['pendiente', 'completada', 'cancelada'].includes(status)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

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

  return NextResponse.json({ appointment })
}
