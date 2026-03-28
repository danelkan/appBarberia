import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { generateTimeSlots } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const barberId = searchParams.get('barberId')
  const date = searchParams.get('date')
  const duration = Number(searchParams.get('duration') ?? '30')

  if (!barberId || !date) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

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

  return NextResponse.json({ slots })
}
