import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, unauthorizedResponse } from '@/lib/api-auth'
import type { Permission } from '@/types'

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  const supabase = createSupabaseAdmin()

  // List all auth users
  const { data: authUsersData, error: authError } = await supabase.auth.admin.listUsers()
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const authUsers = authUsersData?.users ?? []

  // Get all user_roles
  const { data: roles } = await supabase
    .from('user_roles')
    .select('user_id, role, barber_id, permissions, active')

  // Get all barbers for name lookup
  const { data: barbers } = await supabase
    .from('barbers')
    .select('id, name, email')

  const roleMap = new Map((roles ?? []).map((r: any) => [r.user_id, r]))
  const barberMap = new Map((barbers ?? []).map((b: any) => [b.id, b]))

  // Determine superadmin UUID from env
  const superadminUUID = process.env.SUPERADMIN_UUID
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()

  const users = authUsers.map((u: any) => {
    const roleRow = roleMap.get(u.id)
    let role = roleRow?.role ?? 'barber'

    // Apply env overrides
    if (superadminUUID && u.id === superadminUUID) role = 'superadmin'
    else if (adminEmail && u.email?.toLowerCase() === adminEmail && role !== 'superadmin') role = 'admin'

    const barber = roleRow?.barber_id ? barberMap.get(roleRow.barber_id) ?? null : null

    return {
      id: u.id,
      email: u.email,
      role,
      barber_id: roleRow?.barber_id ?? null,
      permissions: roleRow?.permissions ?? [],
      active: roleRow?.active ?? true,
      created_at: u.created_at,
      barber,
    }
  })

  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  // Only superadmins can create standalone users
  if (auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Solo el superadmin puede crear usuarios directamente' }, { status: 403 })
  }

  const body = await req.json()
  const { email, password, role = 'barber', permissions = [] } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message || 'Error al crear usuario' }, { status: 500 })
  }

  // Create user_role entry
  await supabase.from('user_roles').upsert(
    { user_id: authUser.user.id, role, permissions, active: true },
    { onConflict: 'user_id' }
  )

  return NextResponse.json({ user: { id: authUser.user.id, email, role, permissions } }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  const body = await req.json()
  const { user_id, role, permissions, active } = body

  if (!user_id) {
    return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })
  }

  // Prevent non-superadmins from granting superadmin role
  if (role === 'superadmin' && auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Solo el superadmin puede asignar el rol superadmin' }, { status: 403 })
  }

  const supabase = createSupabaseAdmin()

  const updateData: Record<string, any> = {}
  if (role !== undefined)        updateData.role        = role
  if (permissions !== undefined) updateData.permissions = permissions as Permission[]
  if (active !== undefined)      updateData.active      = active

  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id, ...updateData }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  if (auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Solo el superadmin puede eliminar usuarios' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const user_id = searchParams.get('user_id')

  if (!user_id) {
    return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })
  }

  // Prevent self-deletion
  if (user_id === auth.session.user.id) {
    return NextResponse.json({ error: 'No podés eliminar tu propio usuario' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { error } = await supabase.auth.admin.deleteUser(user_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
