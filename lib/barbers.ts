import type { SupabaseClient } from '@supabase/supabase-js'

interface AuthUserLike {
  id: string
  email?: string | null
}

interface UserRoleLike {
  user_id?: string | null
  barber_id?: string | null
  active?: boolean | null
}

export function getVisibleBarberIds(input: {
  authUsers: AuthUserLike[]
  userRoles: UserRoleLike[]
}) {
  const activeAuthIds = new Set(
    input.authUsers.map(user => user.id)
  )

  const activeLinkedBarberIds = input.userRoles
    .filter(role =>
      role.active !== false &&
      role.barber_id &&
      role.user_id &&
      activeAuthIds.has(role.user_id)
    )
    .map(role => role.barber_id as string)

  return new Set(activeLinkedBarberIds)
}

export async function listVisibleBarbers(
  supabase: SupabaseClient,
  options?: { branchId?: string }
) {
  const branchLinksQuery = supabase
    .from('barber_branches')
    .select('barber_id, branch:branches(*)')

  const [
    { data: barbers, error: barbersError },
    { data: userRoles, error: rolesError },
    { data: authUsersData, error: authError },
    { data: branchLinks, error: branchError },
  ] = await Promise.all([
    supabase.from('barbers').select('*').order('created_at'),
    supabase.from('user_roles').select('user_id, barber_id, role, active').not('barber_id', 'is', null),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    (options?.branchId
      ? branchLinksQuery.eq('branch_id', options.branchId)
      : branchLinksQuery),
  ])

  if (barbersError) throw barbersError
  if (rolesError) throw rolesError
  if (authError) throw authError
  if (branchError) throw branchError

  const visibleBarberIds = getVisibleBarberIds({
    authUsers: authUsersData?.users ?? [],
    userRoles: userRoles ?? [],
  })

  const branchLinksList = branchLinks ?? []
  const filteredBarbers = (barbers ?? []).filter(barber => {
    if (!visibleBarberIds.has(barber.id)) return false
    if (!options?.branchId) return true
    return branchLinksList.some(link => link.barber_id === barber.id)
  })

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
