import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'

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
    .order('date').order('start_time')

  if (from) query = query.gte('date', from)
  if (to)   query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ appointments: data })
}
