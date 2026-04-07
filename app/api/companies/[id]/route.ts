import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, unauthorizedResponse } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('companies')
    .select('*, branches(id, name, address, active)')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ company: data })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  const body = await req.json()
  const { name, email, phone, address, active } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('companies')
    .update({
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      active: active ?? true,
    })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ company: data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  // Only superadmins can delete companies
  if (auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Solo el superadmin puede eliminar empresas' }, { status: 403 })
  }

  const supabase = createSupabaseAdmin()
  const { error } = await supabase.from('companies').delete().eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
