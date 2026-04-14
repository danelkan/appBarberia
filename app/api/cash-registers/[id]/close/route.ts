import { NextRequest, NextResponse } from 'next/server'
import { closeCashRegisterSchema } from '@/lib/validations'
import { createSupabaseAdmin } from '@/lib/supabase'
import { createCashAuditLog, getCashRegisterSummary } from '@/lib/cash'
import { requireAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'
import { resolveCompanyId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'cash.close')
  if (denied) return denied

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  const result = closeCashRegisterSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const companyId = auth.role === 'superadmin' ? null : await resolveCompanyId(auth, supabase)

  let registerQuery = supabase
    .from('cash_registers')
    .select('*')
    .eq('id', params.id)

  if (companyId) {
    registerQuery = registerQuery.eq('company_id', companyId)
  }

  const { data: register } = await registerQuery.maybeSingle()

  if (!register) {
    return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 })
  }

  if (register.status !== 'open') {
    return NextResponse.json({ error: 'La caja ya está cerrada' }, { status: 400 })
  }

  if (auth.role === 'barber' && !auth.branch_ids.includes(register.branch_id)) {
    return NextResponse.json({ error: 'No tenés acceso a esta caja' }, { status: 403 })
  }

  const summary = await getCashRegisterSummary(supabase, register.id, Number(register.opening_amount))
  const counted = Number(result.data.counted_cash_amount)
  const difference = counted - summary.expected_cash_amount

  let updateQuery = supabase
    .from('cash_registers')
    .update({
      status: 'closed',
      expected_cash_amount: summary.expected_cash_amount,
      counted_cash_amount: counted,
      difference_amount: difference,
      closing_notes: result.data.closing_notes ?? null,
      closed_by_user_id: auth.session.user.id,
      closed_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('status', 'open')

  if (companyId) {
    updateQuery = updateQuery.eq('company_id', companyId)
  }

  const { data: updated, error } = await updateQuery
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await createCashAuditLog(supabase, {
    company_id: updated.company_id,
    branch_id: updated.branch_id,
    cash_register_id: updated.id,
    action: 'cash_register.closed',
    entity_type: 'cash_register',
    entity_id: updated.id,
    performed_by_user_id: auth.session.user.id,
    metadata: {
      counted_cash_amount: counted,
      expected_cash_amount: summary.expected_cash_amount,
      difference_amount: difference,
    },
  })

  return NextResponse.json({ cash_register: updated })
}
