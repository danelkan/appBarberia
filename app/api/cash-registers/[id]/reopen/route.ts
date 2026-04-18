import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { createCashAuditLog } from '@/lib/cash'
import { requireAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'
import { resolveCompanyId } from '@/lib/tenant'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = checkRateLimit(req, 'cash-register:reopen', RateLimitConfigs.write)
  if (!rl.allowed) return rateLimitResponse(rl)!

  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'cash.reopen')
  if (denied) return denied

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
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

  if (register.status !== 'closed') {
    return NextResponse.json({ error: 'Solo se puede reabrir una caja cerrada' }, { status: 400 })
  }

  const { data: existingOpen } = await supabase
    .from('cash_registers')
    .select('id')
    .eq('branch_id', register.branch_id)
    .eq('company_id', register.company_id)
    .eq('status', 'open')
    .maybeSingle()

  if (existingOpen) {
    return NextResponse.json({ error: 'Ya existe otra caja abierta en esta sucursal' }, { status: 409 })
  }

  let reopenQuery = supabase
    .from('cash_registers')
    .update({
      status: 'open',
      closed_by_user_id: null,
      closed_at: null,
      counted_cash_amount: null,
      difference_amount: null,
      closing_notes: null,
    })
    .eq('id', params.id)

  if (companyId) {
    reopenQuery = reopenQuery.eq('company_id', companyId)
  }

  const { data: reopened, error } = await reopenQuery
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await createCashAuditLog(supabase, {
    company_id: reopened.company_id,
    branch_id: reopened.branch_id,
    cash_register_id: reopened.id,
    action: 'cash_register.reopened',
    entity_type: 'cash_register',
    entity_id: reopened.id,
    performed_by_user_id: auth.session.user.id,
    metadata: {},
  })

  return NextResponse.json({ cash_register: reopened })
}
