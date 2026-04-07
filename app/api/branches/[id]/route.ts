import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'manage_branches')
  if (denied) return denied

  const body = await req.json()
  const { name, address, phone, active, company_id } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('branches')
    .update({
      name: name.trim(),
      address: address?.trim() || null,
      phone: phone?.trim() || null,
      active: Boolean(active),
      company_id: company_id ?? null,
    })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ branch: data })
}
