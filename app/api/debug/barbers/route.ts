import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Temporary diagnostic endpoint — DELETE after debugging
export async function GET() {
  const supabase = createSupabaseAdmin()

  const [
    { data: barbers },
    { data: userRoles },
    { data: branchLinks },
    { data: branches },
  ] = await Promise.all([
    supabase.from('barbers').select('id, name, email'),
    supabase.from('user_roles').select('user_id, barber_id, active, branch_ids, role'),
    supabase.from('barber_branches').select('barber_id, branch_id'),
    supabase.from('branches').select('id, name, active'),
  ])

  const report = (barbers ?? []).map(barber => {
    const role = (userRoles ?? []).find(r => r.barber_id === barber.id)
    const links = (branchLinks ?? []).filter(l => l.barber_id === barber.id)

    let status = '✅ visible'
    const issues: string[] = []

    if (!role) {
      status = '❌ invisible'
      issues.push('Sin fila en user_roles')
    } else {
      if (!role.user_id) issues.push('user_roles.user_id es null')
      if (role.active === false) issues.push('user_roles.active = false')
      if (links.length === 0 && (!role.branch_ids || (role.branch_ids as string[]).length === 0)) {
        issues.push('Sin barber_branches ni branch_ids — no asignado a ninguna sede')
      }
      if (issues.length > 0) status = '❌ invisible'
    }

    return {
      name: barber.name,
      email: barber.email,
      barber_id: barber.id,
      status,
      issues,
      user_roles: role ?? null,
      barber_branches: links.map(l => {
        const branch = (branches ?? []).find(b => b.id === l.branch_id)
        return { branch_id: l.branch_id, branch_name: branch?.name ?? '???' }
      }),
    }
  })

  return NextResponse.json({
    branches: branches ?? [],
    barbers_total: (barbers ?? []).length,
    report,
  })
}
