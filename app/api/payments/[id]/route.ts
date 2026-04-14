import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'
import { resolveCompanyId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'cash.view')
  if (denied) return denied

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // Scope to caller's company — prevents fetching another tenant's payment by UUID
  const companyId = auth.role === 'superadmin'
    ? null
    : await resolveCompanyId(auth, supabase)

  let query = supabase
    .from('payments')
    .select(`
      *,
      appointment:appointments(
        id, date, start_time, end_time, branch_id, barber_id,
        client:clients(first_name, last_name, email, phone),
        barber:barbers(name),
        service:services(name, price, duration_minutes),
        branch:branches(name, address)
      )
    `)
    .eq('id', params.id)

  if (companyId) query = query.eq('company_id', companyId)

  const { data, error } = await query.single()

  if (error) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

  if (auth.role === 'barber') {
    const appointment = data.appointment as { branch_id?: string | null; barber_id?: string | null } | null
    const canSeePayment =
      Boolean(appointment?.branch_id && auth.branch_ids.includes(appointment.branch_id)) ||
      Boolean(auth.barber_id && appointment?.barber_id === auth.barber_id)

    if (!canSeePayment) {
      return NextResponse.json({ error: 'No tenés acceso a este pago' }, { status: 403 })
    }
  }

  return NextResponse.json({ payment: data })
}
