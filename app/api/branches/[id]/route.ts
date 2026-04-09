import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { forbiddenResponse, requireAdminAuth, requirePermission, unauthorizedResponse } from '@/lib/api-auth'

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

  const { data, error } = await supabase
    .from('branches')
    .update({
      name: name.trim(),
      address: address?.trim() || null,
      phone: phone?.trim() || null,
      active: Boolean(active),
      company_id: auth.role === 'superadmin' ? company_id ?? null : existingBranch.company_id ?? auth.company_id ?? null,
    })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ branch: data })
}
