import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { buildCashSummary, createCashAuditLog } from '@/lib/cash'
import { requireAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'
import { cashRegisterQuerySchema, openCashRegisterSchema } from '@/lib/validations'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'cash.view')
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const queryParams = {
    status: searchParams.get('status') ?? undefined,
    branch_id: searchParams.get('branch_id') ?? undefined,
    company_id: searchParams.get('company_id') ?? undefined,
    opened_by_user_id: searchParams.get('opened_by_user_id') ?? undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
  }

  const result = cashRegisterQuerySchema.safeParse(queryParams)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  let query = supabase
    .from('cash_registers')
    .select(`
      *,
      branch:branches(id, name, address, company_id),
      company:companies(id, name)
    `)
    .order('opened_at', { ascending: false })

  const { status, branch_id, company_id, opened_by_user_id, from, to } = result.data

  if (status) query = query.eq('status', status)
  if (branch_id) query = query.eq('branch_id', branch_id)
  if (company_id) query = query.eq('company_id', company_id)
  if (opened_by_user_id) query = query.eq('opened_by_user_id', opened_by_user_id)
  if (from) query = query.gte('opened_at', `${from}T00:00:00`)
  if (to) query = query.lte('opened_at', `${to}T23:59:59`)

  const { data: registers, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const filteredRegisters = auth.role === 'barber'
    ? (registers ?? []).filter((register: any) => auth.branch_ids.includes(register.branch_id))
    : registers ?? []

  const registerIds = filteredRegisters.map((register: any) => register.id)
  const [{ data: movements }, { data: usersData }] = await Promise.all([
    registerIds.length > 0
      ? supabase
          .from('cash_movements')
          .select('cash_register_id, type, payment_method, amount')
          .in('cash_register_id', registerIds)
      : Promise.resolve({ data: [] }),
    supabase.auth.admin.listUsers(),
  ])

  const movementMap = new Map<string, any[]>()
  ;(movements ?? []).forEach((movement: any) => {
    const current = movementMap.get(movement.cash_register_id) ?? []
    current.push(movement)
    movementMap.set(movement.cash_register_id, current)
  })

  const users = usersData?.users ?? []
  const userMap = new Map(
    users.map(user => [
      user.id,
      {
        id: user.id,
        email: user.email ?? '',
        name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? '',
      },
    ])
  )

  const hydrated = filteredRegisters.map((register: any) => ({
    ...register,
    opened_by_user: register.opened_by_user_id ? userMap.get(register.opened_by_user_id) ?? null : null,
    closed_by_user: register.closed_by_user_id ? userMap.get(register.closed_by_user_id) ?? null : null,
    summary: buildCashSummary(movementMap.get(register.id) ?? [], Number(register.opening_amount)),
  }))

  return NextResponse.json({ cash_registers: hydrated })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'cash.open')
  if (denied) return denied

  const body = await req.json()
  const result = openCashRegisterSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { branch_id, opening_amount, opening_notes } = result.data
  const { data: branch } = await supabase
    .from('branches')
    .select('id, company_id')
    .eq('id', branch_id)
    .maybeSingle()

  if (!branch) {
    return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })
  }

  if (auth.role === 'barber' && !auth.branch_ids.includes(branch_id)) {
    return NextResponse.json({ error: 'No tenés acceso a esta sucursal' }, { status: 403 })
  }

  const payload = {
    company_id: branch.company_id ?? auth.company_id ?? null,
    branch_id,
    status: 'open',
    opening_amount: Number(opening_amount),
    opened_by_user_id: auth.session.user.id,
    opened_at: new Date().toISOString(),
    opening_notes: opening_notes ?? null,
  }

  const { data: register, error } = await supabase
    .from('cash_registers')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    if (error.message.toLowerCase().includes('uniq_cash_register_open_per_branch')) {
      return NextResponse.json({ error: 'Ya existe una caja abierta en esta sucursal' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await createCashAuditLog(supabase, {
    company_id: register.company_id,
    branch_id: register.branch_id,
    cash_register_id: register.id,
    action: 'cash_register.opened',
    entity_type: 'cash_register',
    entity_id: register.id,
    performed_by_user_id: auth.session.user.id,
    metadata: { opening_amount: Number(opening_amount) },
  })

  return NextResponse.json({ cash_register: register }, { status: 201 })
}
