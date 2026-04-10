import { NextRequest, NextResponse } from 'next/server'
import { cashMovementSchema } from '@/lib/validations'
import { createSupabaseAdmin } from '@/lib/supabase'
import { createCashAuditLog } from '@/lib/cash'
import { requireAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'

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
  const { data: movements, error } = await supabase
    .from('cash_movements')
    .select('*')
    .eq('cash_register_id', params.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ movements: movements ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'cash.add_movement')
  if (denied) return denied

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  const result = cashMovementSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { data: register } = await supabase
    .from('cash_registers')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!register) {
    return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 })
  }

  if (register.status !== 'open') {
    return NextResponse.json({ error: 'No se pueden cargar movimientos en una caja cerrada' }, { status: 400 })
  }

  if (auth.role === 'barber' && !auth.branch_ids.includes(register.branch_id)) {
    return NextResponse.json({ error: 'No tenés acceso a esta caja' }, { status: 403 })
  }

  const { data: movement, error } = await supabase
    .from('cash_movements')
    .insert({
      cash_register_id: register.id,
      company_id: register.company_id,
      branch_id: register.branch_id,
      ...result.data,
      created_by_user_id: auth.session.user.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await createCashAuditLog(supabase, {
    company_id: register.company_id,
    branch_id: register.branch_id,
    cash_register_id: register.id,
    action: 'cash_register.movement_created',
    entity_type: 'cash_movement',
    entity_id: movement.id,
    performed_by_user_id: auth.session.user.id,
    metadata: {
      type: movement.type,
      payment_method: movement.payment_method,
      amount: movement.amount,
    },
  })

  return NextResponse.json({ movement }, { status: 201 })
}
