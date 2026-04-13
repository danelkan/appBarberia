import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAuth, unauthorizedResponse } from '@/lib/api-auth'
import { resolveCompanyId } from '@/lib/tenant'
import { appointmentQuerySchema } from '@/lib/validations'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const queryParams = {
    from: searchParams.get('from') ?? undefined,
    to:   searchParams.get('to')   ?? undefined,
  }
  const queryResult = appointmentQuerySchema.safeParse(queryParams)
  if (!queryResult.success) {
    return NextResponse.json({ error: queryResult.error.flatten() }, { status: 400 })
  }
  const { from, to } = queryResult.data

  const supabase = createSupabaseAdmin()

  // Scope to caller's company — superadmin sees all
  const companyId = auth.role === 'superadmin'
    ? null
    : await resolveCompanyId(auth, supabase)

  let query = supabase
    .from('appointments')
    .select(`
      id, date, start_time, end_time, status,
      client:clients(id, first_name, last_name, email, phone),
      barber:barbers(id, name, photo_url),
      service:services(id, name, price, duration_minutes)
    `)
    .order('date').order('start_time')
    .limit(500)

  if (from) query = query.gte('date', from)
  if (to)   query = query.lte('date', to)
  if (companyId) query = query.eq('company_id', companyId)
  // Barbers may only see their own appointments
  if (auth.role === 'barber' && auth.barber_id) {
    query = query.eq('barber_id', auth.barber_id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ appointments: data })
}
