import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import {
  forbiddenResponse,
  getRolePermissions,
  requireAdminAuth,
  requirePermission,
  unauthorizedResponse,
} from '@/lib/api-auth'
import type { AppRole, Permission } from '@/types'

function sanitizeBranchIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string')))
}

function buildUserRolePayload(input: {
  role?: AppRole
  permissions?: Permission[]
  active?: boolean
  barber_id?: string | null
  company_id?: string | null
  branch_ids?: string[]
}) {
  const payload: Record<string, unknown> = {}

  if (input.role) payload.role = input.role
  if (input.permissions) payload.permissions = getRolePermissions(input.role ?? 'barber', input.permissions)
  if (typeof input.active === 'boolean') payload.active = input.active
  if (input.barber_id !== undefined) payload.barber_id = input.barber_id
  if (input.company_id !== undefined) payload.company_id = input.company_id
  if (input.branch_ids !== undefined) payload.branch_ids = sanitizeBranchIds(input.branch_ids)

  return payload
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  const denied = requirePermission(auth, 'manage_users')
  if (denied) return denied

  const supabase = createSupabaseAdmin()
  const [{ data: authUsersData, error: authError }, { data: roleRows }, { data: barbers }, { data: companies }, { data: branches }] = await Promise.all([
    supabase.auth.admin.listUsers(),
    supabase.from('user_roles').select('*'),
    supabase.from('barbers').select('id, name, email'),
    supabase.from('companies').select('id, name'),
    supabase.from('branches').select('id, name'),
  ])

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const authUsers = authUsersData?.users ?? []
  const roleMap = new Map((roleRows ?? []).map((row: any) => [row.user_id, row]))
  const barberMap = new Map((barbers ?? []).map((barber: any) => [barber.id, barber]))
  const companyMap = new Map((companies ?? []).map((company: any) => [company.id, company]))
  const branchMap = new Map((branches ?? []).map((branch: any) => [branch.id, branch]))

  const users = authUsers.map((user: any) => {
    const roleRow = roleMap.get(user.id)
    const role = (roleRow?.role ?? 'barber') as AppRole
    const branch_ids = sanitizeBranchIds(roleRow?.branch_ids)
    const permissions = getRolePermissions(role, Array.isArray(roleRow?.permissions) ? roleRow.permissions : [])

    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      role,
      barber_id: roleRow?.barber_id ?? null,
      company_id: roleRow?.company_id ?? null,
      branch_ids,
      permissions,
      active: roleRow?.active ?? true,
      created_at: user.created_at,
      barber: roleRow?.barber_id ? barberMap.get(roleRow.barber_id) ?? null : null,
      company: roleRow?.company_id ? companyMap.get(roleRow.company_id) ?? null : null,
      branches: branch_ids.map(branchId => branchMap.get(branchId)).filter(Boolean),
    }
  })

  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  const denied = requirePermission(auth, 'manage_users')
  if (denied) return denied

  const body = await req.json()
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const role = (body.role ?? 'barber') as AppRole
  const permissions = Array.isArray(body.permissions) ? body.permissions as Permission[] : []
  const company_id = typeof body.company_id === 'string' ? body.company_id : null
  const branch_ids = sanitizeBranchIds(body.branch_ids)

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nombre, email y contraseña son requeridos' }, { status: 400 })
  }

  if (role === 'superadmin' && auth.role !== 'superadmin') {
    return forbiddenResponse('Solo el superadmin puede crear otro superadmin')
  }

  const supabase = createSupabaseAdmin()
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      name,
    },
  })

  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message || 'Error al crear usuario' }, { status: 500 })
  }

  const payload = buildUserRolePayload({
    role,
    permissions,
    active: true,
    company_id,
    branch_ids,
    barber_id: null,
  })

  const { error: upsertError } = await supabase
    .from('user_roles')
    .upsert({ user_id: authUser.user.id, ...payload }, { onConflict: 'user_id' })

  if (upsertError) {
    await supabase.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({
    user: {
      id: authUser.user.id,
      email,
      name,
      role,
      company_id,
      branch_ids,
      permissions: getRolePermissions(role, permissions),
    },
  }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  const denied = requirePermission(auth, 'manage_users')
  if (denied) return denied

  const body = await req.json()
  const user_id = String(body.user_id ?? '')

  if (!user_id) {
    return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })
  }

  const role = body.role as AppRole | undefined
  const permissions = Array.isArray(body.permissions) ? body.permissions as Permission[] : undefined
  const active = typeof body.active === 'boolean' ? body.active : undefined
  const name = typeof body.name === 'string' ? body.name.trim() : undefined
  const company_id = body.company_id === null || typeof body.company_id === 'string' ? body.company_id : undefined
  const branch_ids = body.branch_ids !== undefined ? sanitizeBranchIds(body.branch_ids) : undefined

  if (role === 'superadmin' && auth.role !== 'superadmin') {
    return forbiddenResponse('Solo el superadmin puede asignar el rol superadmin')
  }

  if (user_id === auth.session.user.id && active === false) {
    return NextResponse.json({ error: 'No podés desactivarte a vos mismo' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const payload = buildUserRolePayload({
    role,
    permissions,
    active,
    company_id,
    branch_ids,
  })

  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id, ...payload }, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (name) {
    const { error: updateUserError } = await supabase.auth.admin.updateUserById(user_id, {
      user_metadata: {
        full_name: name,
        name,
      },
    })

    if (updateUserError) {
      return NextResponse.json({ error: updateUserError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  const denied = requirePermission(auth, 'manage_users')
  if (denied) return denied

  if (auth.role !== 'superadmin') {
    return forbiddenResponse('Solo el superadmin puede eliminar usuarios')
  }

  const { searchParams } = new URL(req.url)
  const user_id = searchParams.get('user_id')

  if (!user_id) {
    return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })
  }

  if (user_id === auth.session.user.id) {
    return NextResponse.json({ error: 'No podés eliminar tu propio usuario' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { error } = await supabase.auth.admin.deleteUser(user_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
