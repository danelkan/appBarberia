import { NextRequest, NextResponse } from 'next/server'
import { listVisibleBarbers } from '@/lib/barbers'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'manage_companies')
  if (denied) return denied

  const supabase = createSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const withBranches   = searchParams.get('branches')      === '1'
  const includeStats   = searchParams.get('include_stats') === '1'

  // include_stats adds branch/barber counts — superadmin only (master panel)
  if (includeStats && auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Solo el superadmin puede ver estadísticas globales' }, { status: 403 })
  }

  const selectQuery = (withBranches || includeStats)
    ? '*, branches(id, name, address, active)'
    : '*'

  const { data, error } = await supabase
    .from('companies')
    .select(selectQuery)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let companies = data ?? []

  if (includeStats) {
    const { barbers: visibleBarbers, branchLinks } = await listVisibleBarbers(supabase)
    const visibleBarberIds = new Set(visibleBarbers.map((barber: any) => barber.id))

    companies = companies.map((c: any) => {
      const activeBranches = (c.branches ?? []).filter((b: any) => b.active)
      const activeBranchIds = new Set(activeBranches.map((branch: any) => branch.id))
      const barberCount = new Set(
        (branchLinks ?? [])
          .filter((link: any) => visibleBarberIds.has(link.barber_id) && activeBranchIds.has(link.branch?.id))
          .map((link: any) => link.barber_id)
      ).size

      return {
        ...c,
        plan_tier: c.plan_tier ?? 'starter',
        max_branches: c.max_branches ?? 1,
        max_barbers: c.max_barbers ?? 3,
        branch_count: activeBranches.length,
        barber_count: barberCount,
      }
    })
  }

  return NextResponse.json({ companies })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'manage_companies')
  if (denied) return denied

  const body = await req.json()
  const { name, email, phone, address, active } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  }

  // Generate slug from name
  const slug = name.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('companies')
    .insert({
      name: name.trim(),
      slug,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      active: active ?? true,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ company: data }, { status: 201 })
}
