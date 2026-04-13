import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Internal types ───────────────────────────────────────────────

interface UserRoleLike {
  user_id?: string | null
  barber_id?: string | null
  active?: boolean | null
  branch_ids?: unknown
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

// ─── Helpers ─────────────────────────────────────────────────────

export class BarberEmailConflictError extends Error {
  constructor() {
    super('Ese email ya tiene un perfil de barbero asociado a otro usuario')
    this.name = 'BarberEmailConflictError'
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
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

// ─── Core visibility logic ────────────────────────────────────────

/**
 * Determines which barbers are visible in the booking flow.
 *
 * Rules:
 *   1. user_roles row must exist with active !== false, user_id set, barber_id set.
 *   2. The linked auth user must still exist.
 *   3. The barber must be assigned to at least one branch via barber_branches.
 *
 * Source of truth:
 *   - user_roles decides whether a real app user is an active barber
 *   - barber_branches decides whether that barber appears in the booking flow
 *
 * Legacy branch_ids on user_roles are intentionally ignored here. They still
 * exist for admin scoping, but they do NOT make a barber bookable. This avoids
 * leaked legacy barbers, stale "appears in agenda" state, and orphan records
 * showing up in Reservas after a user was removed.
 */
export function getVisibleBarberIds(input: {
  userRoles: UserRoleLike[]
  branchLinks: BarberBranchLike[]
  validAuthUserIds?: Set<string>
  branchId?: string
}): Set<string> {
  // Build: barber_id → set of branch_ids from barber_branches (sole booking source)
  const tableSourceBranches = new Map<string, Set<string>>()
  for (const link of input.branchLinks) {
    if (!link.barber_id || !link.branch_id) continue
    const set = tableSourceBranches.get(link.barber_id) ?? new Set<string>()
    set.add(link.branch_id)
    tableSourceBranches.set(link.barber_id, set)
  }

  const visibleViaRoles = input.userRoles
    .filter(role => {
      if (role.active === false) return false
      if (!role.barber_id || !role.user_id) return false
      if (input.validAuthUserIds && !input.validAuthUserIds.has(role.user_id)) return false

      const tableBranches = tableSourceBranches.get(role.barber_id)
      if (!tableBranches || tableBranches.size === 0) return false

      if (input.branchId) {
        return tableBranches.has(input.branchId)
      }

      return true
    })
    .map(role => role.barber_id as string)

  return new Set(visibleViaRoles)
}

export function getAssignedBranchIdsByBarber(input: {
  userRoles: UserRoleLike[]
  branchLinks: BarberBranchLike[]
}) {
  const branchIdsByBarber = new Map<string, Set<string>>()

  for (const link of input.branchLinks) {
    if (!link.barber_id || !link.branch_id) continue
    const set = branchIdsByBarber.get(link.barber_id) ?? new Set<string>()
    set.add(link.branch_id)
    branchIdsByBarber.set(link.barber_id, set)
  }

  return new Map(
    Array.from(branchIdsByBarber.entries()).map(([barberId, branchIds]) => [
      barberId,
      Array.from(branchIds),
    ])
  )
}

// ─── Barber CRUD helpers ──────────────────────────────────────────

async function hasExistingAuthUser(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  return !error && Boolean(data?.user)
}

/**
 * Creates a new barber record or reuses an existing one (matched by email).
 * Detects email conflicts with OTHER valid auth users and throws accordingly.
 */
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
      // Orphaned role row (auth user gone) — clean it up
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

// ─── Public query helpers ─────────────────────────────────────────

/**
 * List all barbers visible in the booking flow, optionally scoped to a branch.
 *
 * Runs the canonical visibility check against:
 *   - barbers
 *   - user_roles
 *   - barber_branches
 *   - auth.users
 *
 * When branchId is provided, the barber_branches query is filtered at DB level
 * (avoids transferring the full join table when only one branch matters).
 */
export async function listVisibleBarbers(
  supabase: SupabaseClient,
  options?: { branchId?: string; companyId?: string }
) {
  const branchLinksQuery = options?.branchId
    ? supabase
        .from('barber_branches')
        .select('barber_id, branch_id, branch:branches(*)')
        .eq('branch_id', options.branchId)
    : supabase
        .from('barber_branches')
        .select('barber_id, branch_id, branch:branches(*)')

  let barbersQuery = supabase.from('barbers').select('*').order('created_at')
  if (options?.companyId) {
    barbersQuery = barbersQuery.eq('company_id', options.companyId)
  }

  let rolesQuery = supabase
    .from('user_roles')
    .select('user_id, barber_id, role, active, branch_ids, company_id')
    .not('barber_id', 'is', null)
  if (options?.companyId) {
    rolesQuery = rolesQuery.eq('company_id', options.companyId)
  }

  const [
    { data: barbers,    error: barbersError },
    { data: userRoles,  error: rolesError   },
    { data: branchLinks, error: branchError },
  ] = await Promise.all([
    barbersQuery,
    rolesQuery,
    branchLinksQuery,
  ])

  if (barbersError) throw barbersError
  if (rolesError)   throw rolesError
  if (branchError)  throw branchError

  // We trust user_roles.active as the source of truth for barber status.
  // Skipping auth.admin.listUsers() removes a global O(N_all_users) call from
  // every barber listing request. Orphaned rows are cleaned up on user deletion.
  const visibleBarberIds = getVisibleBarberIds({
    userRoles:   userRoles   ?? [],
    branchLinks: branchLinks ?? [],
    branchId: options?.branchId,
  })

  return {
    barbers:     (barbers ?? []).filter(barber => visibleBarberIds.has(barber.id)),
    userRoles:   userRoles   ?? [],
    branchLinks: branchLinks ?? [],
  }
}

/**
 * Targeted single-barber visibility check for booking POST validation.
 * Does NOT load all barbers — scoped queries per barber.
 */
export async function getVisibleBarberById(
  supabase: SupabaseClient,
  barberId: string,
  options?: { branchId?: string | null }
) {
  const branchLinksQuery = options?.branchId
    ? supabase
        .from('barber_branches')
        .select('branch_id')
        .eq('barber_id', barberId)
        .eq('branch_id', options.branchId)
    : supabase
        .from('barber_branches')
        .select('branch_id')
        .eq('barber_id', barberId)

  const [
    { data: barber   },
    { data: roleRow  },
    { data: branchLinks },
  ] = await Promise.all([
    supabase.from('barbers').select('*').eq('id', barberId).maybeSingle(),
    supabase.from('user_roles').select('user_id, barber_id, active').eq('barber_id', barberId).maybeSingle(),
    branchLinksQuery,
  ])

  if (!barber) return null

  // If explicitly deactivated, block immediately
  if (roleRow?.active === false) return null

  if (!roleRow?.user_id) return null

  const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(roleRow.user_id)
  if (authUserError || !authUser?.user) return null

  const hasTableBranch = (branchLinks ?? []).length > 0
  if (!hasTableBranch) return null

  return barber
}
