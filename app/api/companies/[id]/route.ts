import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'manage_companies')
  if (denied) return denied

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
  const denied = requirePermission(auth, 'manage_companies')
  if (denied) return denied

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

// PATCH: master-admin-only plan update
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  // Only superadmin can change plan/limits — this is the master-admin gate
  if (auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Solo el superadmin puede cambiar el plan' }, { status: 403 })
  }

  const body = await req.json()
  const { plan_tier, max_branches, max_barbers, billing_email } = body

  const validTiers = ['starter', 'pro', 'enterprise']
  if (plan_tier && !validTiers.includes(plan_tier)) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (plan_tier        !== undefined) update.plan_tier        = plan_tier
  if (max_branches     !== undefined) update.max_branches     = Number(max_branches)
  if (max_barbers      !== undefined) update.max_barbers      = Number(max_barbers)
  if (billing_email    !== undefined) update.billing_email    = billing_email?.trim() || null

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('companies')
    .update(update)
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ company: data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'manage_companies')
  if (denied) return denied

  // Only superadmins can delete companies
  if (auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Solo el superadmin puede eliminar empresas' }, { status: 403 })
  }

  const supabase = createSupabaseAdmin()
  const { error } = await supabase.from('companies').delete().eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
