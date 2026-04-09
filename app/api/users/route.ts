import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import {
  forbiddenResponse,
  requireAdminAuth,
  requirePermission,
  unauthorizedResponse,
} from '@/lib/api-auth'
import { getRolePermissions } from '@/lib/permissions'
import type { AppRole, Permission, WeeklyAvailability } from '@/types'

const DEFAULT_AVAILABILITY: WeeklyAvailability = {
  monday:    { enabled: true,  start: '09:00', end: '19:00' },
  tuesday:   { enabled: true,  start: '09:00', end: '19:00' },
  wednesday: { enabled: true,  start: '09:00', end: '19:00' },
  thursday:  { enabled: true,  start: '09:00', end: '19:00' },
  friday:    { enabled: true,  start: '09:00', end: '19:00' },
  saturday:  { enabled: true,  start: '09:00', end: '14:00' },
  sunday:    { enabled: false, start: '09:00', end: '13:00' },
}

function sanitizeBranchIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string')))
}

function buildUserRolePayload(input: {
  role?: AppRole
  permissions?: Permission[]
  active?: boolean
  barber_id?: string | null
  branch_ids?: string[]
}) {
  const payload: Record<string, unknown> = {}

  if (input.role) payload.role = input.role
  if (input.permissions) payload.permissions = getRolePermissions(input.role ?? 'barber', input.permissions)
  if (typeof input.active === 'boolean') payload.active = input.active
  if (input.barber_id !== undefined) payload.barber_id = input.barber_id
  if (input.branch_ids !== undefined) payload.branch_ids = sanitizeBranchIds(input.branch_ids)

  return payload
}

async function syncBarberBranches(supabase: ReturnType<typeof createSupabaseAdmin>, barberId: string, branchIds: string[]) {
  const { error: deleteError } = await supabase.from('barber_branches').delete().eq('barber_id', barberId)
  if (deleteError) throw deleteError

  if (branchIds.length > 0) {
    const { error: insertError } = await supabase.from('barber_branches').insert(branchIds.map(bid => ({ barber_id: barberId, branch_id: bid })))
    if (insertError) throw insertError
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  const denied = requirePermission(auth, 'manage_users')
  if (denied) return denied

  const supabase = createSupabaseAdmin()
  const [
    { data: authUsersData, error: authError },
    { data: roleRows },
    { data: barbers },
    { data: branches },
  ] = await Promise.all([
    supabase.auth.admin.listUsers(),
    supabase.from('user_roles').select('*'),
    supabase.from('barbers').select('id, name, email, availability'),
    supabase.from('branches').select('id, name'),
  ])

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const authUsers = authUsersData?.users ?? []
  const roleMap   = new Map((roleRows ?? []).map((row: any) => [row.user_id, row]))
  const barberMap = new Map((barbers ?? []).map((b: any) => [b.id, b]))
  const branchMap = new Map((branches ?? []).map((b: any) => [b.id, b]))

  const users = authUsers.map((user: any) => {
    const roleRow    = roleMap.get(user.id)
    const role       = (roleRow?.role ?? 'barber') as AppRole
    const branch_ids = sanitizeBranchIds(roleRow?.branch_ids)
    const permissions = getRolePermissions(role, Array.isArray(roleRow?.permissions) ? roleRow.permissions : [])

    return {
      id:         user.id,
      email:      user.email,
      name:       user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      role,
      barber_id:  roleRow?.barber_id ?? null,
      branch_ids,
      permissions,
      active:     roleRow?.active ?? true,
      created_at: user.created_at,
      barber:     roleRow?.barber_id ? barberMap.get(roleRow.barber_id) ?? null : null,
      branches:   branch_ids.map((id: string) => branchMap.get(id)).filter(Boolean),
    }
  })

  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  const denied = requirePermission(auth, 'manage_users')
  if (denied) return denied

  const body        = await req.json()
  const name        = String(body.name ?? '').trim()
  const email       = String(body.email ?? '').trim().toLowerCase()
  const password    = String(body.password ?? '')
  const role        = (body.role ?? 'barber') as AppRole
  const permissions = Array.isArray(body.permissions) ? body.permissions as Permission[] : []
  const branch_ids  = sanitizeBranchIds(body.branch_ids)
  const is_barber   = body.is_barber === true
  const availability = (body.availability as WeeklyAvailability | undefined) ?? DEFAULT_AVAILABILITY

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
    user_metadata: { full_name: name, name },
  })

  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message || 'Error al crear usuario' }, { status: 500 })
  }

  const userId = authUser.user.id

  // Create user_roles row (barber_id set later if needed)
  const { error: upsertError } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, ...buildUserRolePayload({ role, permissions, active: true, branch_ids }) }, { onConflict: 'user_id' })

  if (upsertError) {
    await supabase.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  // If marked as barber, create barber record and link it
  if (is_barber) {
    const { data: newBarber, error: barberError } = await supabase
      .from('barbers')
      .insert({ name, email, availability })
      .select('id')
      .single()

    if (barberError || !newBarber) {
      await supabase.from('user_roles').delete().eq('user_id', userId)
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: barberError?.message ?? 'Error al crear barbero' }, { status: 500 })
    }

    const { error: linkError } = await supabase.from('user_roles').update({ barber_id: newBarber.id }).eq('user_id', userId)
    if (linkError) {
      await supabase.from('barbers').delete().eq('id', newBarber.id)
      await supabase.from('user_roles').delete().eq('user_id', userId)
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: linkError.message }, { status: 500 })
    }

    try {
      await syncBarberBranches(supabase, newBarber.id, branch_ids)
    } catch (error) {
      await supabase.from('barbers').delete().eq('id', newBarber.id)
      await supabase.from('user_roles').delete().eq('user_id', userId)
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Error asignando sucursales' }, { status: 500 })
    }
  }

  return NextResponse.json({ user: { id: userId, email, name, role, branch_ids } }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  const denied = requirePermission(auth, 'manage_users')
  if (denied) return denied

  const body    = await req.json()
  const user_id = String(body.user_id ?? '')

  if (!user_id) {
    return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })
  }

  const role        = body.role as AppRole | undefined
  const permissions = Array.isArray(body.permissions) ? body.permissions as Permission[] : undefined
  const active      = typeof body.active === 'boolean' ? body.active : undefined
  const name        = typeof body.name === 'string' ? body.name.trim() : undefined
  const branch_ids  = body.branch_ids !== undefined ? sanitizeBranchIds(body.branch_ids) : undefined
  const is_barber   = typeof body.is_barber === 'boolean' ? body.is_barber : undefined
  const availability = body.availability as WeeklyAvailability | undefined

  if (role === 'superadmin' && auth.role !== 'superadmin') {
    return forbiddenResponse('Solo el superadmin puede asignar el rol superadmin')
  }

  if (user_id === auth.session.user.id && active === false) {
    return NextResponse.json({ error: 'No podés desactivarte a vos mismo' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // Update user_roles (role, permissions, active, branches — NOT barber_id, handled below)
  const payload = buildUserRolePayload({ role, permissions, active, branch_ids })
  if (Object.keys(payload).length > 0) {
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id, ...payload }, { onConflict: 'user_id' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Update auth user name if changed
  if (name) {
    const { error: updateUserError } = await supabase.auth.admin.updateUserById(user_id, {
      user_metadata: { full_name: name, name },
    })
    if (updateUserError) {
      return NextResponse.json({ error: updateUserError.message }, { status: 500 })
    }
  }

  // Handle barber record sync
  if (is_barber !== undefined) {
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('barber_id')
      .eq('user_id', user_id)
      .single()

    const currentBarberId = roleRow?.barber_id as string | null

    if (is_barber && !currentBarberId) {
      // Create barber record for this user
      const { data: authUser } = await supabase.auth.admin.getUserById(user_id)
      const barberName  = authUser?.user?.user_metadata?.full_name ?? authUser?.user?.email ?? name ?? ''
      const barberEmail = authUser?.user?.email ?? ''

      const { data: newBarber, error: barberError } = await supabase
        .from('barbers')
        .insert({ name: barberName, email: barberEmail, availability: availability ?? DEFAULT_AVAILABILITY })
        .select('id')
        .single()

      if (!barberError && newBarber) {
        await supabase.from('user_roles').update({ barber_id: newBarber.id }).eq('user_id', user_id)
        if (branch_ids) await syncBarberBranches(supabase, newBarber.id, branch_ids)
      }
    } else if (is_barber && currentBarberId) {
      // Update existing barber record
      const updates: Record<string, unknown> = {}
      if (availability) updates.availability = availability
      if (name) updates.name = name
      if (Object.keys(updates).length > 0) {
        await supabase.from('barbers').update(updates).eq('id', currentBarberId)
      }
      if (branch_ids) await syncBarberBranches(supabase, currentBarberId, branch_ids)
    } else if (!is_barber && currentBarberId) {
      // Unlink barber from user (keep barber record for appointment history)
      await supabase.from('barber_branches').delete().eq('barber_id', currentBarberId)
      await supabase.from('user_roles').update({ barber_id: null }).eq('user_id', user_id)
    }
  } else if (branch_ids !== undefined) {
    // Branch sync for existing barbers even when is_barber not explicitly sent
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('barber_id')
      .eq('user_id', user_id)
      .single()

    if (roleRow?.barber_id) {
      await syncBarberBranches(supabase, roleRow.barber_id, branch_ids)
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

  // 1. Resolve any linked barber record before wiping the role row
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('barber_id')
    .eq('user_id', user_id)
    .maybeSingle()

  const barberId = (roleRow?.barber_id as string | null) ?? null

  // Delete the auth user first. If this fails, keep user_roles intact so the
  // user does not fall into an implicit/default role state.
  const { error } = await supabase.auth.admin.deleteUser(user_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (barberId) {
    await supabase.from('barber_branches').delete().eq('barber_id', barberId)
    // Keep the barbers row for appointment history. Visibility is driven only
    // by active user_roles rows linked to existing auth users.
  }

  await supabase.from('user_roles').delete().eq('user_id', user_id)

  return NextResponse.json({ success: true })
}
