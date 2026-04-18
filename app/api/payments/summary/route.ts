import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'
import { canAccessBranch, resolveCompanyId } from '@/lib/tenant'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

async function resolveScopedAppointmentIds(input: {
  supabase: ReturnType<typeof createSupabaseAdmin>
  auth: Awaited<ReturnType<typeof requireAuth>>
  companyId: string | null
  branchId?: string | null
}) {
  const { supabase, auth, companyId, branchId } = input

  let query = supabase.from('appointments').select('id')

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  if (auth?.role !== 'superadmin' && auth?.branch_ids.length && !branchId) {
    query = query.in('branch_id', auth.branch_ids)
  }

  if (auth?.role === 'barber') {
    const orFilters: string[] = []
    if (auth.barber_id) {
      orFilters.push(`barber_id.eq.${auth.barber_id}`)
    }
    if (auth.branch_ids.length > 0) {
      const sanitizedBranchIds = auth.branch_ids
        .join(',')
      orFilters.push(`branch_id.in.(${sanitizedBranchIds})`)
    }

    if (orFilters.length === 0) {
      return []
    }

    query = query.or(orFilters.join(','))
  }

  const { data } = await query
  return (data ?? []).map((appointment: { id: string }) => appointment.id)
}

function calcTotals(payments: any[]): {
  efectivo: number; mercado_pago: number; debito: number; transferencia: number; total: number; count: number
} {
  const result = { efectivo: 0, mercado_pago: 0, debito: 0, transferencia: 0, total: 0, count: payments.length }
  for (const p of payments) {
    const amount = Number(p.amount)
    if (p.method in result) (result as any)[p.method] += amount
    result.total += amount
  }
  return result
}

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(req, 'payments:summary', RateLimitConfigs.authedRead)
  if (!rl.allowed) return rateLimitResponse(rl)!

  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'cash.view')
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const branch_id = searchParams.get('branch_id')

  const supabase = createSupabaseAdmin()
  const now = new Date()

  const ranges = {
    today: [format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"), format(endOfDay(now), "yyyy-MM-dd'T'HH:mm:ss")],
    week:  [format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd'T'00:00:00"), format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd'T'23:59:59")],
    month: [format(startOfMonth(now), "yyyy-MM-dd'T'00:00:00"), format(endOfMonth(now), "yyyy-MM-dd'T'23:59:59")],
    year:  [format(startOfYear(now), "yyyy-MM-dd'T'00:00:00"), format(endOfYear(now), "yyyy-MM-dd'T'23:59:59")],
  }

  // Scope to caller's company — prevents revenue leakage across tenants
  const companyId = auth.role === 'superadmin'
    ? null
    : await resolveCompanyId(auth, supabase)
  if (branch_id && auth.role !== 'superadmin') {
    const allowed = await canAccessBranch(auth, supabase, branch_id)
    if (!allowed) return NextResponse.json({ error: 'No tenés acceso a esa sucursal' }, { status: 403 })
  }
  const appointmentIds = await resolveScopedAppointmentIds({
    supabase,
    auth,
    companyId,
    branchId: branch_id,
  })

  if (appointmentIds.length === 0) {
    return NextResponse.json({
      summary: {
        today: calcTotals([]),
        week: calcTotals([]),
        month: calcTotals([]),
        year: calcTotals([]),
      }
    })
  }

  // Single query — fetch entire year (covers all ranges) to avoid 4 round-trips.
  // company_id filter at DB level replaces the in-memory cross-tenant post-filter.
  let query = supabase
    .from('payments')
    .select('amount, method, created_at')
    .gte('created_at', ranges.year[0])
    .lte('created_at', ranges.year[1])

  if (companyId) query = query.eq('company_id', companyId)
  query = query.in('appointment_id', appointmentIds)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []

  // Bucket into periods
  const [todayFrom, todayTo]   = ranges.today.map(d => new Date(d))
  const [weekFrom, weekTo]     = ranges.week.map(d => new Date(d))
  const [monthFrom, monthTo]   = ranges.month.map(d => new Date(d))

  const inRange = (dateStr: string, from: Date, to: Date) => {
    const d = new Date(dateStr)
    return d >= from && d <= to
  }

  const todayRows  = rows.filter((p: any) => inRange(p.created_at, todayFrom, todayTo))
  const weekRows   = rows.filter((p: any) => inRange(p.created_at, weekFrom, weekTo))
  const monthRows  = rows.filter((p: any) => inRange(p.created_at, monthFrom, monthTo))
  const yearRows   = rows

  return NextResponse.json({
    summary: {
      today: calcTotals(todayRows),
      week:  calcTotals(weekRows),
      month: calcTotals(monthRows),
      year:  calcTotals(yearRows),
    }
  })
}
