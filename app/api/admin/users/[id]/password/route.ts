import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import {
  forbiddenResponse,
  requireAdminAuth,
  requirePermission,
  unauthorizedResponse,
} from '@/lib/api-auth'
import { resolveCompanyId } from '@/lib/tenant'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

function sanitizeBranchIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

async function branchIdsBelongToCompany(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  branchIds: string[],
  companyId: string
) {
  if (branchIds.length === 0) return false

  const { data, error } = await supabase
    .from('branches')
    .select('id')
    .eq('company_id', companyId)
    .in('id', branchIds)

  if (error) return false
  return (data ?? []).length > 0
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rl = checkRateLimit(req, 'admin-user-password:write', RateLimitConfigs.write)
  if (!rl.allowed) return rateLimitResponse(rl)!

  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  const denied = requirePermission(auth, 'manage_users')
  if (denied) return denied

  const targetUserId = params.id
  if (!targetUserId) {
    return NextResponse.json({ error: 'Usuario requerido' }, { status: 400 })
  }

  const isSelf = targetUserId === auth.session.user.id

  const body = await req.json().catch(() => null) as { new_password?: unknown } | null
  const newPassword = typeof body?.new_password === 'string' ? body.new_password.trim() : ''
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const companyId = auth.role === 'superadmin' ? null : await resolveCompanyId(auth, supabase)
  if (auth.role !== 'superadmin' && !companyId) {
    return NextResponse.json({ error: 'No se pudo resolver la empresa del admin' }, { status: 400 })
  }

  const { data: targetRole, error: roleError } = await supabase
    .from('user_roles')
    .select('role, company_id, branch_ids, barber_id, active')
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 500 })
  }
  if (!targetRole) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }
  if (targetRole.role === 'superadmin' && !isSelf) {
    return forbiddenResponse('No podés cambiar la contraseña del superadmin')
  }
  if (!isSelf && (targetRole.role !== 'barber' || !targetRole.barber_id)) {
    return forbiddenResponse('Solo se puede cambiar la contraseña de barberos')
  }

  if (auth.role !== 'superadmin') {
    const targetBranchIds = sanitizeBranchIds(targetRole.branch_ids)
    const sameCompany = targetRole.company_id === companyId
    const sameCompanyByBranch = await branchIdsBelongToCompany(supabase, targetBranchIds, companyId!)
    if (!sameCompany && !sameCompanyByBranch) {
      return forbiddenResponse('No podés cambiar contraseñas de usuarios fuera de tu empresa')
    }
  }

  const { data: targetAuthUser, error: getUserError } = await supabase.auth.admin.getUserById(targetUserId)
  if (getUserError || !targetAuthUser.user) {
    return NextResponse.json({ error: 'Usuario de Auth no encontrado' }, { status: 404 })
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(targetUserId, {
    password: newPassword,
  })

  if (updateError) {
    return NextResponse.json({ error: updateError.message || 'No se pudo actualizar la contraseña' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
