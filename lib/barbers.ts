import type { SupabaseClient } from '@supabase/supabase-js'

interface AuthUserLike {
  id: string
  email?: string | null
}

interface UserRoleLike {
  user_id?: string | null
  barber_id?: string | null
  branch_ids?: unknown
  active?: boolean | null
}

interface BarberBranchLike {
  barber_id?: string | null
  branch_id?: string | null
}

interface BarberWriteInput {
  name: string
  email: string
  availability?: unknown
  photo_url?: string | null
}

export class BarberEmailConflictError extends Error {
  constructor() {
    super('Ese email ya tiene un perfil de barbero asociado a otro usuario')
    this.name = 'BarberEmailConflictError'
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function sanitizeBranchIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function cleanBarberPayload(input: BarberWriteInput) {
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    email: normalizeEmail(input.email),
  }

  if (input.availability !== undefined) payload.availability = input.availability
  if (input.photo_url !== undefined) payload.photo_url = input.photo_url

  return payload
}

export function getVisibleBarberIds(input: {
  authUsers: AuthUserLike[]
  userRoles: UserRoleLike[]
  branchLinks?: BarberBranchLike[]
  branchId?: string
}) {
  const activeAuthIds = new Set(
    input.authUsers.map(user => user.id)
  )

  const agendaBranchIdsByBarberId = new Map<string, Set<string>>()
  for (const link of input.branchLinks ?? []) {
    if (!link.barber_id || !link.branch_id) continue
    const branchIds = agendaBranchIdsByBarberId.get(link.barber_id) ?? new Set<string>()
    branchIds.add(link.branch_id)
    agendaBranchIdsByBarberId.set(link.barber_id, branchIds)
  }

  const activeLinkedBarberIds = input.userRoles
    .filter(role => {
      if (role.active === false) return false
      if (!role.barber_id || !role.user_id) return false
      if (!activeAuthIds.has(role.user_id)) return false

      const userBranchIds = sanitizeBranchIds(role.branch_ids)
      const agendaBranchIds = agendaBranchIdsByBarberId.get(role.barber_id) ?? new Set<string>()

      if (input.branchId) {
        return userBranchIds.includes(input.branchId) && agendaBranchIds.has(input.branchId)
      }

      return userBranchIds.some(branchId => agendaBranchIds.has(branchId))
    })
    .map(role => role.barber_id as string)

  return new Set(activeLinkedBarberIds)
}

async function hasExistingAuthUser(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  return !error && Boolean(data?.user)
}

export async function createOrReuseBarberForUser(
  supabase: SupabaseClient,
  input: BarberWriteInput,
  userId: string
) {
  const payload = cleanBarberPayload(input)
  const email = payload.email as string

  const { data: existingBarber, error: findError } = await supabase
    .from('barbers')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  if (findError) throw findError

  if (existingBarber) {
    const { data: linkedRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('barber_id', existingBarber.id)

    if (rolesError) throw rolesError

    for (const role of linkedRoles ?? []) {
      if (!role.user_id || role.user_id === userId) continue

      if (await hasExistingAuthUser(supabase, role.user_id)) {
        throw new BarberEmailConflictError()
      }

      await supabase.from('user_roles').delete().eq('user_id', role.user_id)
    }

    const { data: updatedBarber, error: updateError } = await supabase
      .from('barbers')
      .update(payload)
      .eq('id', existingBarber.id)
      .select('*')
      .single()

    if (updateError) throw updateError
    return { barber: updatedBarber, reused: true }
  }

  const { data: newBarber, error: createError } = await supabase
    .from('barbers')
    .insert(payload)
    .select('*')
    .single()

  if (createError) throw createError
  return { barber: newBarber, reused: false }
}

export async function listVisibleBarbers(
  supabase: SupabaseClient,
  options?: { branchId?: string }
) {
  const [
    { data: barbers, error: barbersError },
    { data: userRoles, error: rolesError },
    { data: authUsersData, error: authError },
    { data: branchLinks, error: branchError },
  ] = await Promise.all([
    supabase.from('barbers').select('*').order('created_at'),
    supabase.from('user_roles').select('user_id, barber_id, role, active, branch_ids').not('barber_id', 'is', null),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from('barber_branches').select('barber_id, branch_id, branch:branches(*)'),
  ])

  if (barbersError) throw barbersError
  if (rolesError) throw rolesError
  if (authError) throw authError
  if (branchError) throw branchError

  const visibleBarberIds = getVisibleBarberIds({
    authUsers: authUsersData?.users ?? [],
    userRoles: userRoles ?? [],
    branchLinks: branchLinks ?? [],
    branchId: options?.branchId,
  })

  const branchLinksList = branchLinks ?? []
  const filteredBarbers = (barbers ?? []).filter(barber => visibleBarberIds.has(barber.id))

  return {
    barbers: filteredBarbers,
    userRoles: userRoles ?? [],
    branchLinks: branchLinksList,
  }
}

export async function getVisibleBarberById(
  supabase: SupabaseClient,
  barberId: string,
  options?: { branchId?: string | null }
) {
  const { barbers } = await listVisibleBarbers(
    supabase,
    options?.branchId ? { branchId: options.branchId } : undefined
  )

  return barbers.find(barber => barber.id === barberId) ?? null
}
