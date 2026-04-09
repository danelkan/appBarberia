import { NextRequest, NextResponse } from 'next/server'
import { BarberEmailConflictError, createOrReuseBarberForUser } from '@/lib/barbers'
import { createSupabaseAdmin } from '@/lib/supabase'
import {
  type AuthRoleContext,
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

function isSuperadminIdentity(user: { id: string; email?: string | null }, role?: AppRole | null) {
  if (role === 'superadmin') return true
  if (process.env.SUPERADMIN_UUID && user.id === process.env.SUPERADMIN_UUID) return true
  return false
}

async function getCompanyScope(supabase: ReturnType<typeof createSupabaseAdmin>, auth: AuthRoleContext) {
  if (auth.role === 'superadmin') return null

  let companyId = auth.company_id ?? null

  if (!companyId && auth.branch_ids.length > 0) {
    const { data: branch } = await supabase
      .from('branches')
      .select('company_id')
      .eq('id', auth.branch_ids[0])
      .maybeSingle()

    companyId = (branch?.company_id as string | null) ?? null
  }

  if (!companyId && auth.branch_ids.length === 0) {
    const { data: companies } = await supabase
      .from('companies')
      .select('id')
      .eq('active', true)

    if ((companies ?? []).length === 1) {
      companyId = companies![0].id as string
    }
  }

  if (!companyId) {
    return {
      companyId: null,
      branchIds: new Set(auth.branch_ids),
    }
  }

  const { data: branches } = await supabase
    .from('branches')
    .select('id')
    .eq('company_id', companyId)

  return {
    companyId,
    branchIds: new Set((branches ?? []).map((branch: any) => branch.id as string)),
  }
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

function sanitizeBranchIdsForScope(branchIds: string[], scope: Awaited<ReturnType<typeof getCompanyScope>>) {
  if (!scope) return branchIds
  return branchIds.filter(branchId => scope.branchIds.has(branchId))
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth) return unauthorizedResponse()

  const denied = requirePermission(auth, 'manage_users')
  if (denied) return denied

  const supabase = createSupabaseAdmin()
  const scope = await getCompanyScope(supabase, auth)
  const [
    { data: authUsersData, error: authError },
    { data: roleRows },
    { data: barbers },
    { data: branches },
    { data: branchLinks },
  ] = await Promise.all([
    supabase.auth.admin.listUsers(),
    supabase.from('user_roles').select('*'),
    supabase.from('barbers').select('id, name, email, availability'),
    supabase.from('branches').select('id, name'),
    supabase.from('barber_branches').select('barber_id, branch_id'),
  ])

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const authUsers = authUsersData?.users ?? []
  const roleMap   = new Map((roleRows ?? []).map((row: any) => [row.user_id, row]))
  const barberMap = new Map((barbers ?? []).map((b: any) => [b.id, b]))
  const branchMap = new Map((branches ?? []).map((b: any) => [b.id, b]))
  const barberBranchIds = new Map<string, string[]>()
  for (const link of branchLinks ?? []) {
    if (!link.barber_id || !link.branch_id) continue
    barberBranchIds.set(link.barber_id, [...(barberBranchIds.get(link.barber_id) ?? []), link.branch_id])
  }

  const users = authUsers.flatMap((user: any) => {
    const roleRow    = roleMap.get(user.id)
    const role       = (roleRow?.role ?? 'barber') as AppRole
    const roleBranchIds = sanitizeBranchIds(roleRow?.branch_ids)
    const permissions = getRolePermissions(role, Array.isArray(roleRow?.permissions) ? roleRow.permissions : [])
    const barber_id = roleRow?.barber_id ?? null
    const agendaBranchIds = barber_id ? barberBranchIds.get(barber_id) ?? [] : []
    const branch_ids = Array.from(new Set([...roleBranchIds, ...agendaBranchIds]))
    const userCompanyId = (roleRow?.company_id as string | null) ?? null

    if (auth.role !== 'superadmin') {
      if (isSuperadminIdentity(user, role)) return []

      const scopedByCompany = scope?.companyId && userCompanyId === scope.companyId
      const scopedByBranches = branch_ids.some(branchId => scope?.branchIds.has(branchId))
      const scopedByBarberBranches = barber_id
        ? (barberBranchIds.get(barber_id) ?? []).some(branchId => scope?.branchIds.has(branchId))
        : false

      if (!scopedByCompany && !scopedByBranches && !scopedByBarberBranches) return []
    }

    return [{
      id:         user.id,
      email:      user.email,
      name:       user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      role,
      barber_id,
      is_barber: Boolean(barber_id),
      appears_in_agenda: agendaBranchIds.length > 0,
      agenda_branch_ids: agendaBranchIds,
      company_id: userCompanyId,
      branch_ids,
      permissions,
      active:     roleRow?.active ?? true,
      created_at: user.created_at,
      barber:     barber_id ? barberMap.get(barber_id) ?? null : null,
      branches:   branch_ids.map((id: string) => branchMap.get(id)).filter(Boolean),
    }]
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
  const appears_in_agenda = is_barber && body.appears_in_agenda !== false
  const availability = (body.availability as WeeklyAvailability | undefined) ?? DEFAULT_AVAILABILITY

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nombre, email y contraseña son requeridos' }, { status: 400 })
  }

  if (auth.role !== 'superadmin' && role === 'superadmin') {
    return forbiddenResponse('No podés crear usuarios superadmin')
  }

  const supabase = createSupabaseAdmin()
  const scope = await getCompanyScope(supabase, auth)
  const scopedBranchIds = sanitizeBranchIdsForScope(branch_ids, scope)
  const company_id = auth.role === 'superadmin'
    ? (typeof body.company_id === 'string' ? body.company_id : null)
    : scope?.companyId ?? null

  if (appears_in_agenda && scopedBranchIds.length === 0) {
    return NextResponse.json({ error: 'Seleccioná al menos una sucursal para mostrar el barbero en reservas' }, { status: 400 })
  }

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
    .upsert({ user_id: userId, company_id, ...buildUserRolePayload({ role, permissions, active: true, branch_ids: scopedBranchIds }) }, { onConflict: 'user_id' })

  if (upsertError) {
    await supabase.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  // If marked as barber, create or relink a barber record for this auth user.
  if (is_barber) {
    let barber
    let reusedBarber = false

    try {
      const result = await createOrReuseBarberForUser(supabase, { name, email, availability }, userId)
      barber = result.barber
      reusedBarber = result.reused
    } catch (error) {
      await supabase.from('user_roles').delete().eq('user_id', userId)
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Error al crear barbero' },
        { status: error instanceof BarberEmailConflictError ? 409 : 500 }
      )
    }

    const { error: linkError } = await supabase.from('user_roles').update({ barber_id: barber.id }).eq('user_id', userId)
    if (linkError) {
      if (!reusedBarber) await supabase.from('barbers').delete().eq('id', barber.id)
      await supabase.from('user_roles').delete().eq('user_id', userId)
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: linkError.message }, { status: 500 })
    }

    try {
      await syncBarberBranches(supabase, barber.id, appears_in_agenda ? scopedBranchIds : [])
    } catch (error) {
      if (!reusedBarber) await supabase.from('barbers').delete().eq('id', barber.id)
      await supabase.from('user_roles').delete().eq('user_id', userId)
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Error asignando sucursales' }, { status: 500 })
    }
  }

  return NextResponse.json({ user: { id: userId, email, name, role, branch_ids: scopedBranchIds, company_id, is_barber, appears_in_agenda } }, { status: 201 })
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
  const appears_in_agenda = typeof body.appears_in_agenda === 'boolean' ? body.appears_in_agenda : undefined
  const availability = body.availability as WeeklyAvailability | undefined

  if (auth.role !== 'superadmin' && role === 'superadmin') {
    return forbiddenResponse('No podés asignar el rol superadmin')
  }

  if (user_id === auth.session.user.id && active === false) {
    return NextResponse.json({ error: 'No podés desactivarte a vos mismo' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const scope = await getCompanyScope(supabase, auth)

  if (auth.role !== 'superadmin') {
    const { data: targetRole } = await supabase
      .from('user_roles')
      .select('role, company_id, branch_ids, barber_id')
      .eq('user_id', user_id)
      .maybeSingle()

    if (targetRole?.role === 'superadmin') {
      return forbiddenResponse('No podés modificar al superadmin')
    }

    const targetBranchIds = sanitizeBranchIds(targetRole?.branch_ids)
    const inCompany = scope?.companyId && targetRole?.company_id === scope.companyId
    const inBranches = targetBranchIds.some(branchId => scope?.branchIds.has(branchId))
    if (!inCompany && !inBranches) {
      return forbiddenResponse('No podés modificar usuarios fuera de tu empresa')
    }
  }

  // Update user_roles (role, permissions, active, branches — NOT barber_id, handled below)
  const scopedBranchIds = branch_ids ? sanitizeBranchIdsForScope(branch_ids, scope) : undefined
  if ((is_barber === true || appears_in_agenda === true) && scopedBranchIds !== undefined && scopedBranchIds.length === 0) {
    return NextResponse.json({ error: 'Seleccioná al menos una sucursal para mostrar el barbero en reservas' }, { status: 400 })
  }
  const payload = buildUserRolePayload({ role, permissions, active, branch_ids: scopedBranchIds })
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
      // Create or relink a barber record for this user
      const { data: authUser } = await supabase.auth.admin.getUserById(user_id)
      const barberName  = authUser?.user?.user_metadata?.full_name ?? authUser?.user?.email ?? name ?? ''
      const barberEmail = authUser?.user?.email ?? ''

      if (!barberEmail) {
        return NextResponse.json({ error: 'El usuario no tiene email para crear perfil de barbero' }, { status: 400 })
      }

      try {
        const { barber } = await createOrReuseBarberForUser(
          supabase,
          { name: barberName, email: barberEmail, availability: availability ?? DEFAULT_AVAILABILITY },
          user_id
        )
        const { error: linkError } = await supabase.from('user_roles').update({ barber_id: barber.id }).eq('user_id', user_id)
        if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 })
        await syncBarberBranches(supabase, barber.id, appears_in_agenda === false ? [] : scopedBranchIds ?? [])
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Error al crear barbero' },
          { status: error instanceof BarberEmailConflictError ? 409 : 500 }
        )
      }
    } else if (is_barber && currentBarberId) {
      // Update existing barber record
      const updates: Record<string, unknown> = {}
      if (availability) updates.availability = availability
      if (name) updates.name = name
      if (Object.keys(updates).length > 0) {
        await supabase.from('barbers').update(updates).eq('id', currentBarberId)
      }
      if (appears_in_agenda === false) {
        await syncBarberBranches(supabase, currentBarberId, [])
      } else if (scopedBranchIds) {
        await syncBarberBranches(supabase, currentBarberId, scopedBranchIds)
      }
    } else if (!is_barber && currentBarberId) {
      // Unlink barber from user (keep barber record for appointment history)
      await supabase.from('barber_branches').delete().eq('barber_id', currentBarberId)
      await supabase.from('user_roles').update({ barber_id: null }).eq('user_id', user_id)
    }
  } else if (scopedBranchIds !== undefined) {
    // Branch sync for existing barbers even when is_barber not explicitly sent
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('barber_id')
      .eq('user_id', user_id)
      .single()

    if (roleRow?.barber_id) {
      await syncBarberBranches(supabase, roleRow.barber_id, scopedBranchIds)
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
