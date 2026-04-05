import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAuth, unauthorizedResponse } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      appointment:appointments(
        id, date, start_time, end_time,
        client:clients(first_name, last_name, email, phone),
        barber:barbers(name),
        service:services(name, price, duration_minutes),
        branch:branches(name, address)
      )
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ payment: data })
}
