import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { getCashRegisterSummary, hydrateCashRegister, createCashAuditLog } from '@/lib/cash'
import { requireAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'cash.view')
  if (denied) return denied

  const supabase = createSupabaseAdmin()
  const register = await hydrateCashRegister(supabase, params.id)

  if (!register) {
    return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 })
  }

  if (auth.role === 'barber' && !auth.branch_ids.includes(register.branch_id)) {
    return NextResponse.json({ error: 'No tenés acceso a esta caja' }, { status: 403 })
  }

  return NextResponse.json({ cash_register: register })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'cash.edit_closed')
  if (denied) return denied

  const body = await req.json()
  const supabase = createSupabaseAdmin()
  const { data: current } = await supabase
    .from('cash_registers')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!current) {
    return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 })
  }

  if (current.status !== 'closed') {
    return NextResponse.json({ error: 'Solo podés editar una caja cerrada' }, { status: 400 })
  }

  const nextCounted = body.counted_cash_amount !== undefined ? Number(body.counted_cash_amount) : Number(current.counted_cash_amount ?? 0)
  const summary = await getCashRegisterSummary(supabase, current.id, Number(current.opening_amount))
  const difference = nextCounted - summary.expected_cash_amount

  const { data: updated, error } = await supabase
    .from('cash_registers')
    .update({
      opening_notes: body.opening_notes ?? current.opening_notes,
      closing_notes: body.closing_notes ?? current.closing_notes,
      counted_cash_amount: nextCounted,
      expected_cash_amount: summary.expected_cash_amount,
      difference_amount: difference,
    })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await createCashAuditLog(supabase, {
    company_id: updated.company_id,
    branch_id: updated.branch_id,
    cash_register_id: updated.id,
    action: 'cash_register.edited_closed',
    entity_type: 'cash_register',
    entity_id: updated.id,
    performed_by_user_id: auth.session.user.id,
    metadata: {
      counted_cash_amount: nextCounted,
      difference_amount: difference,
    },
  })

  return NextResponse.json({ cash_register: updated })
}
