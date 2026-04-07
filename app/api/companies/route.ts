import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'manage_companies')
  if (denied) return denied

  const supabase = createSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const withBranches = searchParams.get('branches') === '1'

  const selectQuery = withBranches
    ? '*, branches(id, name, address, active)'
    : '*'

  const { data, error } = await supabase
    .from('companies')
    .select(selectQuery)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ companies: data ?? [] })
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
