import { NextRequest, NextResponse } from 'next/server'
import { COMPANY_PLAN_TIERS, getCompanyPlanDefaults, normalizeOptionalBoolean, normalizeOptionalText, normalizePositiveInt, slugifyCompanyName } from '@/lib/companies'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'manage_companies')
  if (denied) return denied

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, slug, email, phone, address, active, created_at, plan_tier, max_branches, max_barbers, billing_email, branches(id, name, address, active, company_id)')
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
  if (auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Solo el superadmin puede editar barberías' }, { status: 403 })
  }

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = normalizeOptionalText(body.email)
  const phone = normalizeOptionalText(body.phone)
  const address = normalizeOptionalText(body.address)
  const active = normalizeOptionalBoolean(body.active, true)

  if (!name) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const slug = slugifyCompanyName(name)
  if (!slug) {
    return NextResponse.json({ error: 'No se pudo generar un slug válido para la barbería' }, { status: 400 })
  }

  const { data: existingSlug } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .neq('id', params.id)
    .maybeSingle()

  if (existingSlug) {
    return NextResponse.json({ error: 'Ya existe otra barbería con ese nombre/slug' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('companies')
    .update({
      name,
      slug,
      email,
      phone,
      address,
      active,
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

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  const requestedPlanTier = typeof body.plan_tier === 'string' ? body.plan_tier : undefined
  const billingEmail = normalizeOptionalText(body.billing_email)

  if (requestedPlanTier && !COMPANY_PLAN_TIERS.includes(requestedPlanTier)) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  const planDefaults = getCompanyPlanDefaults(requestedPlanTier)
  const update: Record<string, unknown> = {}
  if (requestedPlanTier !== undefined) update.plan_tier = requestedPlanTier
  if (body.max_branches !== undefined) update.max_branches = normalizePositiveInt(body.max_branches, planDefaults.max_branches)
  if (body.max_barbers !== undefined) update.max_barbers = normalizePositiveInt(body.max_barbers, planDefaults.max_barbers)
  if (body.billing_email !== undefined) update.billing_email = billingEmail

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No hay cambios para aplicar' }, { status: 400 })
  }

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

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const [{ count: branchCount }, { count: userCount }, { count: appointmentCount }] = await Promise.all([
    supabase.from('branches').select('*', { count: 'exact', head: true }).eq('company_id', params.id),
    supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('company_id', params.id),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('company_id', params.id),
  ])

  if ((branchCount ?? 0) > 0 || (userCount ?? 0) > 0 || (appointmentCount ?? 0) > 0) {
    return NextResponse.json({
      error: 'No podés eliminar una barbería con datos asociados',
      details: {
        branches: branchCount ?? 0,
        users: userCount ?? 0,
        appointments: appointmentCount ?? 0,
      },
    }, { status: 409 })
  }

  const { error } = await supabase.from('companies').delete().eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
