import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CashMovement,
  CashMovementPaymentMethod,
  CashMovementType,
  CashRegister,
  CashRegisterSummary,
  PaymentMethod,
} from '@/types'

export function mapPaymentMethodToCashMethod(method: PaymentMethod): CashMovementPaymentMethod {
  if (method === 'efectivo') return 'cash'
  if (method === 'transferencia') return 'transfer'
  return 'card'
}

export function getMovementSignedAmount(type: CashMovementType, amount: number) {
  if (type === 'expense') return -Math.abs(amount)
  return Math.abs(amount)
}

export function buildCashSummary(movements: Pick<CashMovement, 'type' | 'payment_method' | 'amount'>[], openingAmount: number): CashRegisterSummary {
  const summary = {
    opening_amount: Number(openingAmount),
    cash_income_total: 0,
    cash_expense_total: 0,
    cash_adjustment_total: 0,
    other_payment_total: 0,
    expected_cash_amount: Number(openingAmount),
  }

  for (const movement of movements) {
    const amount = Number(movement.amount)

    if (movement.payment_method === 'cash') {
      if (movement.type === 'expense') {
        summary.cash_expense_total += amount
      } else if (movement.type === 'adjustment') {
        summary.cash_adjustment_total += amount
      } else {
        summary.cash_income_total += amount
      }
    } else {
      summary.other_payment_total += amount
    }
  }

  summary.expected_cash_amount =
    summary.opening_amount +
    summary.cash_income_total -
    summary.cash_expense_total +
    summary.cash_adjustment_total

  return summary
}

export async function getOpenCashRegister(admin: SupabaseClient, branchId: string) {
  const { data } = await admin
    .from('cash_registers')
    .select('*')
    .eq('branch_id', branchId)
    .eq('status', 'open')
    .maybeSingle()

  return data as CashRegister | null
}

export async function createCashAuditLog(
  admin: SupabaseClient,
  input: {
    company_id?: string | null
    branch_id: string
    cash_register_id: string
    action: string
    entity_type: string
    entity_id?: string | null
    performed_by_user_id?: string | null
    metadata?: Record<string, unknown> | null
  }
) {
  await admin.from('cash_audit_logs').insert({
    ...input,
    entity_id: input.entity_id ?? null,
    metadata: input.metadata ?? {},
  })
}

export async function getCashRegisterSummary(admin: SupabaseClient, cashRegisterId: string, openingAmount: number) {
  const { data: movements } = await admin
    .from('cash_movements')
    .select('type, payment_method, amount')
    .eq('cash_register_id', cashRegisterId)
    .order('created_at', { ascending: true })

  return buildCashSummary((movements ?? []) as Pick<CashMovement, 'type' | 'payment_method' | 'amount'>[], openingAmount)
}

export async function hydrateCashRegister(admin: SupabaseClient, cashRegisterId: string) {
  const { data: register, error } = await admin
    .from('cash_registers')
    .select(`
      *,
      branch:branches(*),
      company:companies(*)
    `)
    .eq('id', cashRegisterId)
    .single()

  if (error || !register) return null

  const [{ data: movements }, { data: logs }, { data: usersData }] = await Promise.all([
    admin
      .from('cash_movements')
      .select('*')
      .eq('cash_register_id', cashRegisterId)
      .order('created_at', { ascending: true }),
    admin
      .from('cash_audit_logs')
      .select('*')
      .eq('cash_register_id', cashRegisterId)
      .order('created_at', { ascending: false }),
    admin.auth.admin.listUsers(),
  ])

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

  const summary = buildCashSummary(
    (movements ?? []) as Pick<CashMovement, 'type' | 'payment_method' | 'amount'>[],
    Number(register.opening_amount)
  )

  return {
    ...register,
    summary,
    opened_by_user: register.opened_by_user_id ? userMap.get(register.opened_by_user_id) ?? null : null,
    closed_by_user: register.closed_by_user_id ? userMap.get(register.closed_by_user_id) ?? null : null,
    movements: (movements ?? []).map((movement: any) => ({
      ...movement,
      created_by_user: movement.created_by_user_id ? userMap.get(movement.created_by_user_id) ?? null : null,
    })),
    audit_logs: (logs ?? []).map((log: any) => ({
      ...log,
      performed_by_user: log.performed_by_user_id ? userMap.get(log.performed_by_user_id) ?? null : null,
    })),
  }
}
