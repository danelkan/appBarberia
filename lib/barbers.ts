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

interface BarberLike {
  id: string
  email?: string | null
}

function normalizeEmail(email?: string | null) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

export function getVisibleBarberIds(input: {
  authUsers: AuthUserLike[]
  userRoles: UserRoleLike[]
  barbers: BarberLike[]
}) {
  const validAuthIds = new Set(input.authUsers.map(user => user.id))
  const validAuthEmails = new Set(
    input.authUsers
      .map(user => normalizeEmail(user.email))
      .filter(Boolean)
  )

  const roleLinkedBarberIds = input.userRoles
    .filter(role =>
      role.active !== false &&
      role.barber_id &&
      role.user_id &&
      validAuthIds.has(role.user_id)
    )
    .map(role => role.barber_id as string)

  const emailMatchedBarberIds = input.barbers
    .filter(barber => {
      const email = normalizeEmail(barber.email)
      return email && validAuthEmails.has(email)
    })
    .map(barber => barber.id)

  return new Set([...roleLinkedBarberIds, ...emailMatchedBarberIds])
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
    barbers: barbers ?? [],
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
