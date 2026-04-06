import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, unauthorizedResponse } from '@/lib/api-auth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  const body = await req.json()
  const { name, address, phone, active } = body

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
    })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ branch: data })
}
