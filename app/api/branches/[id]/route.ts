import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { forbiddenResponse, requireAdminAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()
  const denied = requirePermission(auth, 'manage_branches')
  if (denied) return denied

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const stripHtml = (v: string) => v.replace(/<[^>]*>/g, '').trim()
  const name    = typeof body.name    === 'string' ? stripHtml(body.name).slice(0, 100)  : ''
  const address = typeof body.address === 'string' ? stripHtml(body.address).slice(0, 255) : null
  const phone   = typeof body.phone   === 'string' ? stripHtml(body.phone).slice(0, 50)  : null
  const { active, company_id } = body

  if (!name) {
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  const { data: existingBranch, error: existingError } = await supabase
    .from('branches')
    .select('company_id')
    .eq('id', params.id)
    .maybeSingle()

  if (existingError || !existingBranch) {
    return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })
  }

  if (auth.role !== 'superadmin') {
    const allowedCompanyId = auth.company_id ?? null
    const allowedByCompany = allowedCompanyId && existingBranch.company_id === allowedCompanyId
    const allowedByBranch = auth.branch_ids.includes(params.id)

    if (!allowedByCompany && !allowedByBranch) {
      return forbiddenResponse('No podés editar sucursales fuera de tu empresa')
    }
  }

  const scopedCompanyId = auth.role === 'superadmin'
    ? company_id ?? existingBranch.company_id ?? null
    : existingBranch.company_id ?? auth.company_id ?? null

  let query = supabase
    .from('branches')
    .update({
      name,
      address: address || null,
      phone: phone || null,
      active: Boolean(active),
      company_id: scopedCompanyId,
    })
    .eq('id', params.id)

  if (scopedCompanyId) {
    query = query.eq('company_id', scopedCompanyId)
  }

  const { data, error } = await query
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ branch: data })
}
