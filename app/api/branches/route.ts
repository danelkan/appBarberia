import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const includeInactive = searchParams.get('all') === '1'

  if (includeInactive) {
    const auth = await requireAdminAuth(req)
    if (!auth) return unauthorizedResponse()
    const denied = requirePermission(auth, 'manage_branches')
    if (denied) return denied
  }

  const supabase = createSupabaseAdmin()
  let query = supabase.from('branches').select('*, company:companies(id, name)').order('name')

  if (!includeInactive) {
    query = query.eq('active', true)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ branches: data })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'manage_branches')
  if (denied) return denied

  const body = await req.json()
  const { name, address, phone, active, company_id } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('branches')
    .insert({ name: name.trim(), address, phone, active: active ?? true, company_id: company_id ?? null })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ branch: data })
}
