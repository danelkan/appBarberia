import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAuth, unauthorizedResponse } from '@/lib/api-auth'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'

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
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

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

  // Single query — fetch entire year (covers all ranges) to avoid 4 round-trips
  const query = supabase
    .from('payments')
    .select('amount, method, created_at, appointment:appointments(branch_id, barber_id)')
    .gte('created_at', ranges.year[0])
    .lte('created_at', ranges.year[1])

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Apply role/branch filter
  let rows = data ?? []

  if (auth.role === 'barber') {
    rows = rows.filter((p: any) => {
      const appt = p.appointment
      return (
        (appt?.branch_id && auth.branch_ids.includes(appt.branch_id)) ||
        (auth.barber_id && appt?.barber_id === auth.barber_id)
      )
    })
  }

  if (branch_id) {
    rows = rows.filter((p: any) => p.appointment?.branch_id === branch_id)
  }

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
